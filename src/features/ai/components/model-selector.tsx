"use client";

import type { AIModelConfig } from "@/features/ai/config/models";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";

interface ModelSelectorProps {
  models: AIModelConfig[];
  value: string;
  onValueChange: (value: string) => void;
}

export function ModelSelector({ models, value, onValueChange }: ModelSelectorProps) {
  const t = useTranslations("ai");

  return (
    <Select value={value} onValueChange={onValueChange}>
      {/* The trigger says what it is for; the model that is picked is what it shows */}
      <SelectTrigger className="w-48" aria-label={t("selectModel")}>
        <SelectValue placeholder={t("selectModel")} />
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