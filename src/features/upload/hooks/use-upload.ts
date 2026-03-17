"use client";

import { useCallback, useState } from "react";

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

export function useUpload({ userId, orgId, onSuccess, onError }: UseUploadOptions) {
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
              const data = JSON.parse(xhr.responseText);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data);
              }
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });

          xhr.addEventListener("error", () => {
            reject(new Error("Upload failed"));
          });

          xhr.open("POST", "/api/upload");
          xhr.send(formData);
        });

        setState({ uploading: false, progress: 100, error: null });
        onSuccess?.(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setState({ uploading: false, progress: 0, error: message });
        onError?.(message);
        return null;
      }
    },
    [userId, orgId, onSuccess, onError],
  );

  return { ...state, upload };
}
