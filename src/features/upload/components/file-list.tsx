"use client";

import { Button } from "@/shared/components/ui/button";
import { deleteFile } from "../actions";

interface FileItem {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  createdAt: Date;
}

interface FileListProps {
  files: FileItem[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function FileList({ files }: FileListProps) {
  if (files.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No files uploaded yet.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {files.map((file) => (
        <li key={file.id} className="flex items-center justify-between py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.filename}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)} &middot; {file.mimetype}
            </p>
          </div>
          <div className="ml-4 flex gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href={`/api/upload/${file.id}`} target="_blank" rel="noopener noreferrer">
                View
              </a>
            </Button>
            <form action={async () => { await deleteFile(file.id); }}>
              <Button variant="ghost" size="sm" type="submit">
                Delete
              </Button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
