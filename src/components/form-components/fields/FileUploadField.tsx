import { useEffect, useMemo, useRef, useState } from "react";

import { Trash2Icon, UploadIcon } from "@/components/ui/icons";
import { useStepForm } from "@/contexts/step-form-context";
import { useFileUpload } from "@/hooks/use-file-upload";
import {
  buildAcceptString,
  buildPlaceholderLabel,
  DEFAULT_MAX_FILE_SIZE_MB,
  resolveAllowedSubtypes,
} from "@/lib/form-schema/file-upload-types";
import type { UploadedFormFile } from "@/lib/server-fn/public-file-uploads";
import { uploadFormFile } from "@/lib/server-fn/public-file-uploads";
import { cn } from "@/lib/utils";
import { extractErrorMessage } from "./shared";
import type { FieldRendererProps } from "./shared";

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("Failed to read file"));
    });
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("Failed to read file")),
    );
    reader.readAsDataURL(file);
  });

type FileUploadState =
  | { status: "idle" }
  | {
      status: "uploading";
      localPreview: string | null;
      fileName: string;
      isImage: boolean;
    }
  | { status: "done"; value: UploadedFormFile; localPreview: string | null }
  | { status: "error"; message: string };

const UPLOAD_ERROR_MESSAGES: Record<string, string> = {
  rate_limited: "Too many uploads. Please wait a moment and try again.",
  form_not_found: "This form is no longer accepting uploads.",
  file_field_not_found: "Upload field is not configured.",
  mime_not_allowed: "This file type isn't allowed.",
  file_too_large: "File is larger than 10 MB.",
  empty_file: "File is empty.",
};

const FileUploadField = ({ element, form }: FieldRendererProps<"FileUpload">) => {
  const { category, subtypes } = useMemo(
    () => resolveAllowedSubtypes(element.allowedFileTypes, element.allowedFileExtensions),
    [element.allowedFileTypes, element.allowedFileExtensions],
  );
  const accept = useMemo(() => buildAcceptString(category, subtypes), [category, subtypes]);
  const placeholderLabel = useMemo(
    () => buildPlaceholderLabel(category, subtypes),
    [category, subtypes],
  );
  const maxFileSizeMb = element.maxFileSize ?? DEFAULT_MAX_FILE_SIZE_MB;
  const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;

  const { formId } = useStepForm();
  const draftIdRef = useRef<string>(crypto.randomUUID());
  const [uploadState, setUploadState] = useState<FileUploadState>({ status: "idle" });
  // Tracks the currently-displayed object URL so we can revoke it on
  // replacement or unmount. Avoids leaking blob URLs when the user picks
  // multiple files in a row or navigates away mid-upload.
  const activePreviewRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (activePreviewRef.current) URL.revokeObjectURL(activePreviewRef.current);
    },
    [],
  );

  // Uploads the File binary and swaps it into the field as an UploadedFormFile
  // (url + metadata). Runs from the field-level `onChange` listener so the
  // binary never reaches the form submission payload — submissions always
  // serialize the URL object, not the file bytes.
  const uploadAndReplace = async (
    picked: File,
    setValue: (next: UploadedFormFile | "") => void,
  ) => {
    const isImage = picked.type.startsWith("image/");
    const localPreview = isImage ? URL.createObjectURL(picked) : null;
    if (activePreviewRef.current) URL.revokeObjectURL(activePreviewRef.current);
    activePreviewRef.current = localPreview;

    // Preview mode (no formId): show the picked file in the UI without actually
    // uploading, and seed a fake UploadedFormFile so the field is non-empty and
    // the user can advance to the next step.
    if (!formId) {
      const previewValue: UploadedFormFile = {
        url: localPreview ?? "",
        name: picked.name,
        type: picked.type || "application/octet-stream",
        size: picked.size,
      };
      setUploadState({ status: "done", value: previewValue, localPreview });
      setValue(previewValue);
      return;
    }

    setUploadState({ status: "uploading", localPreview, fileName: picked.name, isImage });

    try {
      const base64 = await fileToBase64(picked);
      const uploaded = await uploadFormFile({
        data: {
          formId,
          draftId: draftIdRef.current,
          fieldName: element.name,
          filename: picked.name,
          contentType: picked.type || "application/octet-stream",
          base64,
        },
      });
      setUploadState({ status: "done", value: uploaded, localPreview });
      setValue(uploaded);
    } catch (err) {
      const code = err instanceof Error ? err.message : "upload_failed";
      setUploadState({
        status: "error",
        message: UPLOAD_ERROR_MESSAGES[code] ?? "Upload failed. Please try again.",
      });
      if (localPreview) URL.revokeObjectURL(localPreview);
      activePreviewRef.current = null;
      setValue("");
    }
  };

  const [
    ,
    { openFileDialog, getInputProps, handleDragEnter, handleDragLeave, handleDragOver, handleDrop },
  ] = useFileUpload({
    accept,
    maxSize: maxFileSizeBytes,
    onFilesChange: (updatedFiles) => {
      const picked = updatedFiles[0]?.file;
      if (picked instanceof File) {
        // Route the raw File through the field's onChange listener — the
        // listener is the single place that translates binary -> URL.
        form.setFieldValue(element.name, picked);
      }
    },
  });

  const reset = () => {
    if (activePreviewRef.current) {
      URL.revokeObjectURL(activePreviewRef.current);
      activePreviewRef.current = null;
    }
    setUploadState({ status: "idle" });
  };

  const hasFile = uploadState.status === "uploading" || uploadState.status === "done";
  const previewUrl =
    uploadState.status === "done"
      ? uploadState.value.type.startsWith("image/")
        ? uploadState.value.url
        : null
      : uploadState.status === "uploading"
        ? uploadState.localPreview
        : null;
  const fileName =
    uploadState.status === "done"
      ? uploadState.value.name
      : uploadState.status === "uploading"
        ? uploadState.fileName
        : "";

  return (
    <form.AppField
      name={element.name}
      listeners={{
        onChange: ({ value, fieldApi }) => {
          // The listener fires for every value change (including the URL
          // replacement and the reset-to-empty). Only act when we see a raw
          // File binary — that's the trigger to upload + swap.
          if (value instanceof File) {
            void uploadAndReplace(value, (next) => {
              fieldApi.handleChange(next as never);
            });
          }
        },
      }}
    >
      {(f) => {
        const hasFieldErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
        const fieldErrorMessage = hasFieldErrors ? extractErrorMessage(f.state.meta.errors[0]) : "";
        const showError = uploadState.status === "error" || hasFieldErrors;
        const errorMessage =
          uploadState.status === "error" ? uploadState.message : fieldErrorMessage;

        return (
          <>
            <button
              type="button"
              className={cn(
                "relative flex min-h-20 w-full cursor-pointer flex-col items-center justify-center rounded-[8px] border border-dashed border-border/60 bg-[var(--color-gray-50)] p-4 shadow-[0_0_1px_rgba(0,0,0,0.54),0_1px_1px_rgba(0,0,0,0.06)] transition-colors hover:bg-accent/50",
                showError && "border-destructive ring-1 ring-destructive",
              )}
              onClick={!hasFile ? openFileDialog : undefined}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                {...getInputProps()}
                className="sr-only"
                aria-label={`${element.label || "File"} upload`}
              />
              {hasFile ? (
                <div className="flex flex-col items-center gap-2">
                  {previewUrl ? (
                    <div className="overflow-hidden rounded-md border border-border/40">
                      <img
                        src={previewUrl}
                        alt={fileName}
                        className="max-h-48 max-w-full object-contain"
                      />
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="max-w-[200px] truncate text-muted-foreground">
                      {uploadState.status === "uploading" ? `Uploading ${fileName}…` : fileName}
                    </span>
                    {uploadState.status === "done" ? (
                      <button
                        type="button"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          reset();
                          f.handleChange("");
                        }}
                        aria-label={`Remove ${fileName}`}
                      >
                        <Trash2Icon className="size-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-muted-foreground select-none">
                  <UploadIcon className="size-5" />
                  <span className="text-sm">Click or drag to upload</span>
                  <span className="text-xs">
                    {placeholderLabel} up to {maxFileSizeMb}MB
                  </span>
                </div>
              )}
            </button>
            {showError ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          </>
        );
      }}
    </form.AppField>
  );
};

export default FileUploadField;
