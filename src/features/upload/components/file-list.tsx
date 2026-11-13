"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { deleteFile } from "../actions";
import { fileSizeOf } from "../file-size";

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

export function FileList({ files }: FileListProps) {
  const t = useTranslations("upload.list");
  const format = useFormatter();
  // The size is told in the unit of the storage quota (a megabyte is a million bytes), written as the page writes a figure and a unit.
  // A byte is said in words ("512 bytes", « 512 octets »): its short form is "byte" in English, which reads wrong next to "2 kB".
  const sizeOf = (bytes: number) => {
    const { value, unit } = fileSizeOf(bytes);
    return format.number(value, {
      style: "unit",
      unit,
      unitDisplay: unit === "byte" ? "long" : "short",
      maximumFractionDigits: 1,
    });
  };

  if (files.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("empty")}
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
              {sizeOf(file.size)} &middot; {file.mimetype}
            </p>
          </div>
          <div className="ml-4 flex gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a
                href={`/api/upload/${file.id}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("viewFile", { name: file.filename })}
              >
                {t("view")}
              </a>
            </Button>
            <form action={async () => { await deleteFile(file.id); }}>
              <Button variant="ghost" size="sm" type="submit" aria-label={t("deleteFile", { name: file.filename })}>
                {t("delete")}
              </Button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
