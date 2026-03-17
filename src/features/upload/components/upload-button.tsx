"use client";

import { useRef } from "react";
import { Button } from "@/shared/components/ui/button";

interface UploadButtonProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function UploadButton({
  onFileSelect,
  accept,
  disabled = false,
  children = "Upload File",
}: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {children}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.target.value = "";
        }}
        className="hidden"
      />
    </>
  );
}
