import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";

export type AIProviderName = "openai" | "anthropic" | "google" | "groq" | "ollama";

export function getProvider(providerName: AIProviderName) {
  switch (providerName) {
    case "openai":
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    case "anthropic":
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    case "google":
      return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
    case "groq":
      return createGroq({ apiKey: process.env.GROQ_API_KEY });
    case "ollama":
      return createOpenAI({
        baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
        apiKey: "ollama",
      });
    default:
      throw new Error(`Unknown AI provider: ${providerName}`);
  }
}

export function getAvailableProviders(): AIProviderName[] {
  const providers: AIProviderName[] = [];
  if (process.env.OPENAI_API_KEY) providers.push("openai");
  if (process.env.ANTHROPIC_API_KEY) providers.push("anthropic");
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) providers.push("google");
  if (process.env.GROQ_API_KEY) providers.push("groq");
  if (process.env.OLLAMA_BASE_URL) providers.push("ollama");
  return providers;
}