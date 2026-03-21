import { eq } from "drizzle-orm";
import { AlertTriangleIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { createConversation } from "@/features/ai/actions";
import { Chat } from "@/features/ai/components/chat";
import { isUnlimitedCredits } from "@/features/ai/config/credits";
import { getAvailableModels } from "@/features/ai/config/models";
import { getAvailableProviders } from "@/features/ai/config/providers";
import { getConversations, getMessages } from "@/features/ai/queries";
import { requireAuth } from "@/features/auth/guards";
import { organizationMember } from "@/models/organization";
import { subscription } from "@/models/subscription";
import { db } from "@/shared/lib/DB";

export default async function AIPage() {
  const session = await requireAuth();
  const providers = getAvailableProviders();

  // No providers configured
  if (providers.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="mx-auto max-w-md text-center">
          <AlertTriangleIcon className="mx-auto mb-4 size-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">AI not configured</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Add at least one AI provider API key to your environment variables to enable AI chat.
            Supported: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, GROQ_API_KEY.
          </p>
        </div>
      </div>
    );
  }

  // Get user's org
  const memberships = await db
    .select()
    .from(organizationMember)
    .where(eq(organizationMember.userId, session.user.id))
    .limit(1);

  const membership = memberships[0];
  if (!membership) {
    redirect("/onboarding");
  }

  const orgId = membership.organizationId;

  // Get plan
  const orgSubs = await db
    .select()
    .from(subscription)
    .where(eq(subscription.organizationId, orgId))
    .limit(1);
  const planId = orgSubs[0]?.planId ?? "free";
  const unlimited = isUnlimitedCredits(planId);

  // Get or create conversation
  const conversations = await getConversations(session.user.id, orgId);
  let conversationId: string;

  if (conversations.length > 0) {
    conversationId = conversations[0].id;
  } else {
    const result = await createConversation({
      orgId,
      model: process.env.AI_DEFAULT_MODEL ?? "gpt-4o-mini",
    });
    if (!result.success) {
      redirect("/dashboard");
    }
    conversationId = result.data.id;
  }

  const messages = await getMessages(conversationId);
  const availableModels = getAvailableModels(providers);
  const defaultModel = process.env.AI_DEFAULT_MODEL ?? availableModels[0]?.id ?? "gpt-4o-mini";

  return (
    <Chat
      conversationId={conversationId}
      orgId={orgId}
      initialMessages={messages.map((m) => ({ role: m.role, content: m.content }))}
      availableModels={availableModels}
      defaultModel={defaultModel}
      unlimited={unlimited}
    />
  );
}