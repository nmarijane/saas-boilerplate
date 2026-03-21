import { streamText } from "ai";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { isUnlimitedCredits } from "@/features/ai/config/credits";
import { calculateCredits, getModelConfig  } from "@/features/ai/config/models";
import { getProvider } from "@/features/ai/config/providers";
import { getCreditBalance } from "@/features/ai/queries";
import { auth } from "@/features/auth/auth";
import { aiConversation, aiCreditLedger, aiMessage } from "@/models/ai";
import { subscription } from "@/models/subscription";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";

const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
  })),
  conversationId: z.string().min(1),
  model: z.string().min(1).default("gpt-4o-mini"),
});

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

    // Verify conversation belongs to user
    const conversations = await db
      .select()
      .from(aiConversation)
      .where(
        and(
          eq(aiConversation.id, parsed.conversationId),
          eq(aiConversation.userId, session.user.id),
        ),
      )
      .limit(1);

    const conversation = conversations[0];
    if (!conversation) {
      return new Response("Conversation not found", { status: 404 });
    }

    // Check credits
    const orgSubs = await db
      .select()
      .from(subscription)
      .where(eq(subscription.organizationId, conversation.organizationId))
      .limit(1);

    const planId = orgSubs[0]?.planId ?? "free";
    const unlimited = isUnlimitedCredits(planId);

    if (!unlimited) {
      const balance = await getCreditBalance(conversation.organizationId);
      if (balance <= 0) {
        return new Response("Insufficient credits", { status: 402 });
      }
    }

    // Save user message
    const userMessageId = generateId();
    await db.insert(aiMessage).values({
      id: userMessageId,
      conversationId: parsed.conversationId,
      role: "user",
      content: parsed.messages.at(-1)?.content ?? "",
    });

    // Stream response
    const provider = getProvider(modelConfig.provider);
    const model = provider(modelConfig.modelId);

    const result = streamText({
      model,
      messages: parsed.messages,
      onFinish: async ({ usage }) => {
        const inputTokens = usage?.totalTokens ?? 0;
        const outputTokens = usage?.totalTokens ?? 0;
        const credits = calculateCredits(parsed.model, inputTokens, outputTokens);

        // Save assistant message
        const assistantMessageId = generateId();
        await db.insert(aiMessage).values({
          id: assistantMessageId,
          conversationId: parsed.conversationId,
          role: "assistant",
          content: "", // Will be accumulated from stream — or set via full text
          inputTokens,
          outputTokens,
          creditsUsed: credits,
        });

        // Deduct credits
        if (!unlimited && credits > 0) {
          await db.insert(aiCreditLedger).values({
            id: generateId(),
            organizationId: conversation.organizationId,
            amount: -credits,
            reason: "usage",
            referenceId: assistantMessageId,
          });
        }

        // Update conversation timestamp
        await db
          .update(aiConversation)
          .set({ updatedAt: new Date() })
          .where(eq(aiConversation.id, parsed.conversationId));
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response("Invalid request", { status: 400 });
    }
    console.error("AI chat error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}