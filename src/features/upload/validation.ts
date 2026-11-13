import type { UploadRefusal } from "./refusals";
import { BYTES_PER_MEGABYTE } from "./units";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

// Only these types are displayed by the browser. The others (SVG, text,
// archives…) are downloaded, so an uploaded file never runs a script on the
// app origin.
const INLINE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

// 10 MB, in the unit of the quota (`units.ts`): ten million bytes
const MAX_SIZE = Number(process.env.UPLOAD_MAX_SIZE) || 10 * BYTES_PER_MEGABYTE;

// A file that is refused says why as a code and the values its message takes
// (`refusals.ts`): the words are in the locales, in the language of the page that
// tells them, and not in the server that refuses.
export type FileValidationResult =
  | { valid: true }
  | { valid: false; error: UploadRefusal };

export function validateFile(file: File): FileValidationResult {
  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: {
        code: "FILE_TOO_LARGE",
        // On one decimal: a limit that is not a round number of megabytes says so
        values: { max: Math.round((MAX_SIZE / BYTES_PER_MEGABYTE) * 10) / 10 },
      },
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: {
        code: "FILE_TYPE_NOT_ALLOWED",
        // The browser gives no type for what it does not know
        values: { type: file.type || "unknown" },
      },
    };
  }

  return { valid: true };
}

/** File name usable in a storage key: no directory, no "..", plain characters only. */
export function storageSafeName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const safe = base.replace(/[^\w.-]/g, "_").replace(/^\.+/, "").slice(0, 100);
  return safe || "file";
}

/** Content-Disposition header for an uploaded file (RFC 6266, RFC 5987). */
export function contentDisposition(mimetype: string, filename: string): string {
  const type = INLINE_MIME_TYPES.has(mimetype) ? "inline" : "attachment";
  // Printable ASCII only, without quote or backslash: no header injection.
  const fallback = filename.replace(/[^\x20-\x7E]|["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
