"use client";

import type { AIModelConfig } from "@/features/ai/config/models";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";

interface ModelSelectorProps {
  models: AIModelConfig[];
  value: string;
  onValueChange: (value: string) => void;
}

export function ModelSelector({ models, value, onValueChange }: ModelSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            <span className="flex items-center gap-2">
              <span>{model.name}</span>
              <span className="text-xs text-muted-foreground">
                {model.provider}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}