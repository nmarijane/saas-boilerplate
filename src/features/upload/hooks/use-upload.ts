"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { failureMessage, UploadFailed } from "../upload-failure";

interface UseUploadOptions {
  userId: string;
  orgId: string;
  onSuccess?: (result: { id: string; filename: string }) => void;
  onError?: (error: string) => void;
}

interface UploadState {
  uploading: boolean;
  progress: number;
  error: string | null;
}

/** The body of an answer as JSON, or null when it is none: the answer of a server that is down is a page. */
function bodyOf(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function useUpload({ userId, orgId, onSuccess, onError }: UseUploadOptions) {
  const t = useTranslations();
  const [state, setState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    error: null,
  });

  const upload = useCallback(
    async (file: File) => {
      setState({ uploading: true, progress: 0, error: null });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userId);
      formData.append("orgId", orgId);

      try {
        const xhr = new XMLHttpRequest();

        const result = await new Promise<{ id: string; filename: string }>((resolve, reject) => {
          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              setState((prev) => ({ ...prev, progress }));
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch {
                reject(new UploadFailed(xhr.status, null));
              }
            } else {
              // A file the server refuses comes as a 400 that says why: the page tells it in its language (failureMessage)
              reject(new UploadFailed(xhr.status, bodyOf(xhr.responseText)));
            }
          });

          xhr.addEventListener("error", () => {
            reject(new UploadFailed(0, null));
          });

          xhr.open("POST", "/api/upload");
          xhr.send(formData);
        });

        setState({ uploading: false, progress: 100, error: null });
        onSuccess?.(result);
        return result;
      } catch (err) {
        const message = failureMessage(err, (key, values) => t(key, values));
        setState({ uploading: false, progress: 0, error: message });
        onError?.(message);
        return null;
      }
    },
    [userId, orgId, onSuccess, onError, t],
  );

  /** Forgets an upload that is over: its error, its progress, its state. */
  const reset = useCallback(() => {
    setState({ uploading: false, progress: 0, error: null });
  }, []);

  return { ...state, upload, reset };
}
