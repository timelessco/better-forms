import { parseError } from "@/lib/errors/parse";
import { useEffect, useMemo, useRef, useState } from "react";

import { Trash2Icon, UploadLineIcon } from "@/components/ui/icons";
import { useStepForm } from "@/contexts/step-form-context";
import { useFileUpload } from "@/hooks/use-file-upload";
import {
  buildAcceptFromExtensions,
  DEFAULT_MAX_FILE_SIZE_MB,
  resolveAllowedExtensions,
} from "@/lib/form-schema/file-upload-types";
import type { UploadedFormFile } from "@/lib/server-fn/public-file-uploads";
import { uploadFormFile } from "@/lib/server-fn/public-file-uploads";
import { cn } from "@/lib/utils";
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
  // Stable evlog codes — set by the server via createError({ code }).
  "uploads/rate-limited": "Too many uploads. Please wait a moment and try again.",
  "uploads/form-no-content": "This form is no longer accepting uploads.",
  "uploads/field-not-found": "Upload field is not configured.",
  "uploads/mime-not-allowed": "This file type isn't allowed.",
  "uploads/too-large": "File is larger than 10 MB.",
  "uploads/empty-file": "File is empty.",
  // Legacy string codes — un-migrated endpoints still emit these in `message`. Back-compat until server migration done.
  rate_limited: "Too many uploads. Please wait a moment and try again.",
  form_not_found: "This form is no longer accepting uploads.",
  file_field_not_found: "Upload field is not configured.",
  mime_not_allowed: "This file type isn't allowed.",
  file_too_large: "File is larger than 10 MB.",
  empty_file: "File is empty.",
};

const FileUploadField = ({ element, form }: FieldRendererProps<"FileUpload">) => {
  const accept = useMemo(
    () =>
      buildAcceptFromExtensions(
        resolveAllowedExtensions(element.allowedFileTypes, element.allowedFileExtensions),
      ),
    [element.allowedFileTypes, element.allowedFileExtensions],
  );
  const maxFileSizeMb = element.maxFileSize ?? DEFAULT_MAX_FILE_SIZE_MB;
  const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;

  const { formId } = useStepForm();
  const draftIdRef = useRef<string>(crypto.randomUUID());
  const [uploadState, setUploadState] = useState<FileUploadState>({ status: "idle" });
  // Current object URL, revoked on replace/unmount — avoids leaking blob URLs across multiple picks or mid-upload navigation.
  const activePreviewRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (activePreviewRef.current) URL.revokeObjectURL(activePreviewRef.current);
    },
    [],
  );

  // Upload File binary, swap field to UploadedFormFile (url + metadata). Runs from field onChange so binary never reaches submission payload (serializes URL, not bytes).
  const uploadAndReplace = async (
    picked: File,
    setValue: (next: UploadedFormFile | "") => void,
  ) => {
    const isImage = picked.type.startsWith("image/");
    const localPreview = isImage ? URL.createObjectURL(picked) : null;
    if (activePreviewRef.current) URL.revokeObjectURL(activePreviewRef.current);
    activePreviewRef.current = localPreview;

    // Preview mode (no formId): show file without uploading, seed fake UploadedFormFile so field is non-empty and user can advance.
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
      // Prefer structured `code`; fall back to `message` (legacy code on un-migrated endpoints), then generic.
      const parsed = parseError(err);
      const lookupKey = parsed.code ?? parsed.message ?? "";
      const friendly = UPLOAD_ERROR_MESSAGES[lookupKey];
      setUploadState({
        status: "error",
        message: friendly ?? parsed.message ?? "Upload failed. Please try again.",
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
        // Route raw File through field onChange — the one place binary→URL happens.
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
          // Fires on every value change (URL replace, reset-to-empty). Only raw File triggers upload + swap.
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
        const showError = uploadState.status === "error" || hasFieldErrors;

        return (
          <>
            <button
              type="button"
              id={element.name}
              aria-invalid={showError}
              className={cn(
                "relative flex min-h-[100px] w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[8px] border-0 bg-[var(--form-input-bg,var(--color-gray-50))] p-4 elevation-sm transition-colors hover:bg-accent/50",
                showError && "form-input-error",
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
                  <div className="flex items-center gap-1.5">
                    <UploadLineIcon className="size-4" />
                    <span className="text-sm" data-bf-upload-primary>
                      Click to choose a file or drag here
                    </span>
                  </div>
                  <span
                    className="text-[13px] text-[color:var(--color-gray-500)]"
                    data-bf-upload-secondary
                  >
                    Max file up to {maxFileSizeMb}MB
                  </span>
                </div>
              )}
            </button>
            {uploadState.status === "error" ? (
              <p className="mt-1.5 text-sm text-destructive">{uploadState.message}</p>
            ) : (
              <f.FieldError />
            )}
          </>
        );
      }}
    </form.AppField>
  );
};

export default FileUploadField;
