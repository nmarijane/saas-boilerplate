import type { ModelMessage } from "ai";
import { streamText } from "ai";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import { CONVERSATION_HEADER, MAX_HISTORY_MESSAGES, MAX_MESSAGE_LENGTH } from "@/features/ai/config/chat";
import { calculateCredits, getModelConfig } from "@/features/ai/config/models";
import { getProvider } from "@/features/ai/config/providers";
import { getLatestMessages } from "@/features/ai/queries";
import { debitCredits, ensureMonthlyAllocation } from "@/features/ai/service";
import { auth } from "@/features/auth/auth";
import { getWorkspaceContext } from "@/features/auth/organization/workspace";
import { aiConversation, aiMessage } from "@/models/ai";
import { organization } from "@/models/organization";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";

// What the client sends is what the person typed: the last message of theirs is
// the new one, and every other message of the request is ignored, whatever its
// role. The history the model is given is the conversation the server holds,
// written by the server: a `system` message or an `assistant` message of the
// client never reaches the model.
const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.string(),
    content: z.string().max(MAX_MESSAGE_LENGTH),
  })),
  /** The conversation to go on with; none for the first message, which starts one. */
  conversationId: z.string().min(1).optional(),
  model: z.string().min(1).default("gpt-4o-mini"),
});

/**
 * The turns of a stored conversation that the model is given: the person's and
 * the assistant's, as the server wrote them, from the latest ones it was read
 * (`MAX_HISTORY_MESSAGES`). They start with one of the person's: a history cut
 * in the middle of an exchange does not open on an answer.
 */
function historyOf(rows: { role: string; content: string }[]): ModelMessage[] {
  const turns = rows.flatMap(({ role, content }): ModelMessage[] => {
    if (content === "") {
      return [];
    }
    if (role === "user") {
      return [{ role: "user", content }];
    }
    if (role === "assistant") {
      return [{ role: "assistant", content }];
    }

    return [];
  });
  const first = turns.findIndex(({ role }) => role === "user");

  return first === -1 ? [] : turns.slice(first);
}

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const parsed = chatRequestSchema.parse(body);
    const modelConfig = getModelConfig(parsed.model);

    if (!modelConfig) {
      return new Response("Invalid model", { status: 400 });
    }

    const text = parsed.messages.findLast((message) => message.role === "user")?.content.trim() ?? "";
    if (text === "") {
      return new Response("No message", { status: 400 });
    }

    // The workspace the person works in, read again on every request: the
    // session's active one while they still belong to it, as every page reads it
    // (getWorkspaceContext). It is the one the conversation must be in and the
    // one the credits are taken from.
    const { workspace } = await getWorkspaceContext();
    if (!workspace) {
      return new Response("No workspace", { status: 403 });
    }

    let conversationId = parsed.conversationId ?? null;
    if (conversationId !== null) {
      const [conversation] = await db
        .select({ id: aiConversation.id })
        .from(aiConversation)
        .where(
          and(
            eq(aiConversation.id, conversationId),
            eq(aiConversation.userId, session.user.id),
            eq(aiConversation.organizationId, workspace.id),
          ),
        )
        .limit(1);

      if (!conversation) {
        return new Response("Conversation not found", { status: 404 });
      }
    }

    // Check credits. The plan's monthly allocation is granted here, at the first use of the month (and
    // only the first: it is idempotent), so that a workspace that never paid still has its free credits
    const credits = await ensureMonthlyAllocation(workspace.id);
    const unlimited = credits.unlimited;

    if (!unlimited && credits.total <= 0) {
      return new Response("Insufficient credits", { status: 402 });
    }

    // The first message starts the conversation: the page writes nothing
    if (conversationId === null) {
      conversationId = generateId();
      await db.insert(aiConversation).values({
        id: conversationId,
        organizationId: workspace.id,
        userId: session.user.id,
        model: parsed.model,
      });
    }
    const history = historyOf(await getLatestMessages(conversationId, MAX_HISTORY_MESSAGES));

    // Save user message
    const questionId = generateId();
    await db.insert(aiMessage).values({
      id: questionId,
      conversationId,
      role: "user",
      content: text,
    });

    // Stream response
    const provider = getProvider(modelConfig.provider);
    const model = provider(modelConfig.modelId);
    const orgId = workspace.id;
    const savedConversationId = conversationId;

    // A provider that fails (a key it refuses, a network that is down, a stream that breaks)
    // leaves no half of an exchange: the question goes with the failure. The client has its
    // answer already, 200 with no text or with half of one, and "Try again" sends the question
    // once more: kept, it would be stored twice and given to the model twice. This also
    // replaces the SDK's own log of the error.
    let failed = false;
    const abandon = async (error: unknown) => {
      failed = true;
      console.error("AI chat error:", error);
      try {
        await db.delete(aiMessage).where(eq(aiMessage.id, questionId));
      } catch (deleteError) {
        console.error("AI chat error:", deleteError);
      }
    };

    const result = streamText({
      model,
      messages: [...history, { role: "user", content: text }],
      // The longest answer the model may give: what one answer can cost
      maxOutputTokens: modelConfig.maxOutputTokens,
      // The SDK ends the stream after this has run, so a retry cannot come before the delete
      onError: ({ error }) => abandon(error),
      onFinish: async ({ text: reply, usage }) => {
        // A provider that fails halfway still ends its step, and onFinish is told of it: the
        // exchange is dropped, and an answer saved now would have no question. Nothing is
        // charged for a failure
        if (failed) {
          return;
        }

        const inputTokens = usage.inputTokens ?? 0;
        const outputTokens = usage.outputTokens ?? 0;
        // An answer costs one credit at least, even from a provider that tells no usage
        const cost = Math.max(1, calculateCredits(parsed.model, inputTokens, outputTokens));
        const assistantMessageId = generateId();
        // An answer with no text (only spaces, or a provider that stopped before any: its
        // content filter, say) is no answer: there is nothing to save, and nothing to give the
        // model next turn. The model read the conversation, and its provider bills it, as it
        // does after Stop: so it is charged as any answer is
        const empty = reply.trim() === "";

        // The debit never takes the balance below zero: an answer that costs more
        // than is left takes what is left. The answers of a workspace are debited
        // one at a time: the transaction locks the row of the workspace, then
        // reads the balance and writes the debit, so two answers that finish
        // together cannot both take the same credits. Requests already on their
        // way when the balance ran out are the operator's, one bounded answer each.
        try {
          await db.transaction(async (tx) => {
            // The credits are taken out of the allocation first, then out of the packs bought
            let debit = 0;
            if (!unlimited) {
              await tx.select({ id: organization.id }).from(organization).where(eq(organization.id, orgId)).for("update");
              debit = await debitCredits(tx, orgId, cost, empty ? savedConversationId : assistantMessageId);
            }

            if (empty) {
              // The question goes with the answer it did not get, so that "Try again" stores it once
              await tx.delete(aiMessage).where(eq(aiMessage.id, questionId));
            } else {
              // Save assistant message: the next turn of the conversation is given to the model from here
              await tx.insert(aiMessage).values({
                id: assistantMessageId,
                conversationId: savedConversationId,
                role: "assistant",
                content: reply,
                inputTokens,
                outputTokens,
                creditsUsed: unlimited ? cost : debit,
              });
            }
          });
        } catch (error) {
          // The transaction rolled back: nothing was saved or charged. The exchange goes, as after
          // any failure, and the log hears of it (the SDK swallows what a callback throws)
          await abandon(error);
          return;
        }

        // Update conversation timestamp: nothing was added to it by an empty answer. The
        // transaction has committed, so a failure here is logged and takes nothing back: the
        // answer is saved, and its question stays
        if (!empty) {
          await db
            .update(aiConversation)
            .set({ updatedAt: new Date() })
            .where(eq(aiConversation.id, savedConversationId))
            .catch((error: unknown) => {
              console.error("AI chat error:", error);
            });
        }
      },
    });

    // The model's answer is read to its end whatever the client does (Stop, a
    // closed tab, a script that stops reading): onFinish then saves it for the
    // next turn and takes its credits, as the provider bills it all the same.
    // `after` keeps the function alive until then, on a host that stops it once
    // the answer is sent.
    let abandoned: Promise<void> | undefined;
    const consumed = result.consumeStream({
      // A connection that drops halfway ends the stream in an error, not in an error part
      // that onError is told of: the answer of the client breaks too, with no ordering to count on
      onError: (error) => {
        abandoned = abandon(error);
      },
    });
    after(async () => {
      await consumed;
      await abandoned;
    });

    // The client keeps the id of the conversation for the next message
    return result.toTextStreamResponse({
      headers: { [CONVERSATION_HEADER]: savedConversationId },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response("Invalid request", { status: 400 });
    }
    console.error("AI chat error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
