import * as React from "react";
import { toast } from "sonner";
import { uploadEditorMedia } from "@/lib/server-fn/uploads";

export type UploadedFile = {
  key: string;
  name: string;
  size: number;
  type: string;
  url: string;
};

interface UseUploadFileProps {
  onUploadComplete?: (file: UploadedFile) => void;
  onUploadError?: (error: unknown) => void;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Failed to read file"));
      }
    });
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("Failed to read file")),
    );
    reader.readAsDataURL(file);
  });

export const useUploadFile = ({ onUploadComplete, onUploadError }: UseUploadFileProps = {}) => {
  const [uploadedFile, setUploadedFile] = React.useState<UploadedFile>();
  const [uploadingFile, setUploadingFile] = React.useState<File>();
  const [progress, setProgress] = React.useState<number>(0);
  const [isUploading, setIsUploading] = React.useState(false);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadingFile(file);
    setProgress(10);

    try {
      const base64 = await fileToBase64(file);
      setProgress(40);

      const result = await uploadEditorMedia({
        data: {
          base64,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
        },
      });
      setProgress(100);

      const uploaded: UploadedFile = {
        key: result.url,
        name: result.name,
        size: result.size,
        type: result.type,
        url: result.url,
      };
      setUploadedFile(uploaded);
      onUploadComplete?.(uploaded);
      return uploaded;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong, please try again later.";
      toast.error(message);
      onUploadError?.(error);
      return undefined;
    } finally {
      setProgress(0);
      setIsUploading(false);
      setUploadingFile(undefined);
    }
  };

  return {
    isUploading,
    progress,
    uploadedFile,
    uploadFile,
    uploadingFile,
  };
};
