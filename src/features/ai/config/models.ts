import type { AIProviderName } from "./providers";

export interface AIModelConfig {
  id: string;
  name: string;
  provider: AIProviderName;
  modelId: string;
  inputCostPer1k: number;  // credits per 1k input tokens
  outputCostPer1k: number; // credits per 1k output tokens
  maxTokens: number;
  supportsStreaming: boolean;
}

export const AI_MODELS: AIModelConfig[] = [
  // OpenAI
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", modelId: "gpt-4o-mini", inputCostPer1k: 1, outputCostPer1k: 2, maxTokens: 128000, supportsStreaming: true },
  { id: "gpt-4o", name: "GPT-4o", provider: "openai", modelId: "gpt-4o", inputCostPer1k: 5, outputCostPer1k: 15, maxTokens: 128000, supportsStreaming: true },
  { id: "o3-mini", name: "o3-mini", provider: "openai", modelId: "o3-mini", inputCostPer1k: 3, outputCostPer1k: 12, maxTokens: 200000, supportsStreaming: true },
  // Anthropic
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "anthropic", modelId: "claude-sonnet-4-20250514", inputCostPer1k: 3, outputCostPer1k: 15, maxTokens: 200000, supportsStreaming: true },
  { id: "claude-haiku-3.5", name: "Claude 3.5 Haiku", provider: "anthropic", modelId: "claude-3-5-haiku-20241022", inputCostPer1k: 1, outputCostPer1k: 5, maxTokens: 200000, supportsStreaming: true },
  // Google
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "google", modelId: "gemini-2.0-flash", inputCostPer1k: 1, outputCostPer1k: 2, maxTokens: 1000000, supportsStreaming: true },
  // Groq
  { id: "llama-3.3-70b", name: "Llama 3.3 70B", provider: "groq", modelId: "llama-3.3-70b-versatile", inputCostPer1k: 1, outputCostPer1k: 1, maxTokens: 128000, supportsStreaming: true },
];

export function getModelConfig(modelId: string): AIModelConfig | undefined {
  return AI_MODELS.find((m) => m.id === modelId);
}

export function getAvailableModels(availableProviders: AIProviderName[]): AIModelConfig[] {
  return AI_MODELS.filter((m) => availableProviders.includes(m.provider));
}

export function calculateCredits(modelId: string, inputTokens: number, outputTokens: number): number {
  const model = getModelConfig(modelId);
  if (!model) return 0;
  const inputCost = Math.ceil((inputTokens / 1000) * model.inputCostPer1k);
  const outputCost = Math.ceil((outputTokens / 1000) * model.outputCostPer1k);
  return inputCost + outputCost;
}