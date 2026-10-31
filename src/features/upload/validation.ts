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

const MAX_SIZE = Number(process.env.UPLOAD_MAX_SIZE) || 10_485_760; // 10MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFile(file: File): FileValidationResult {
  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${Math.round(MAX_SIZE / 1_048_576)}MB.`,
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type}" is not allowed.`,
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
