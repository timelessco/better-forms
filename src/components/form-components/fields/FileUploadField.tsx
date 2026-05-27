import { parseError } from "@/lib/errors/parse";
import { useEffect, useMemo, useRef, useState } from "react";

import { Trash2Icon, UploadIcon } from "@/components/ui/icons";
import { useStepForm } from "@/contexts/step-form-context";
import { useFileUpload } from "@/hooks/use-file-upload";
import { upload } from "@vercel/blob/client";
import {
  buildAcceptString,
  buildPlaceholderLabel,
  DEFAULT_MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_HARD_CAP_MB,
  resolveAllowedSubtypes,
} from "@/lib/form-schema/file-upload-types";
import type { UploadedFormFile } from "@/lib/form-schema/file-upload-types";
import { cn } from "@/lib/utils";
import type { FieldRendererProps } from "./shared";

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
  const { category, subtypes } = useMemo(
    () => resolveAllowedSubtypes(element.allowedFileTypes, element.allowedFileExtensions),
    [element.allowedFileTypes, element.allowedFileExtensions],
  );
  const accept = useMemo(() => buildAcceptString(category, subtypes), [category, subtypes]);
  const placeholderLabel = useMemo(
    () => buildPlaceholderLabel(category, subtypes),
    [category, subtypes],
  );
  // Clamp the field's configured size to the hard cap so the client pre-check
  // matches what Blob enforces server-side (no "accepted then rejected" gap).
  const maxFileSizeMb = Math.min(
    element.maxFileSize ?? DEFAULT_MAX_FILE_SIZE_MB,
    MAX_FILE_SIZE_HARD_CAP_MB,
  );
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
      const contentType = picked.type || "application/octet-stream";
      // Upload straight from the browser to Vercel Blob. `/api/forms/upload`
      // mints a scoped token (rate limit, form/field, MIME + size guards); the
      // bytes never pass through our server, so large files aren't capped by
      // the serverless request-body limit.
      const blob = await upload(
        `submissions/${formId}/${draftIdRef.current}/${picked.name}`,
        picked,
        {
          access: "public",
          contentType,
          handleUploadUrl: "/api/forms/upload",
          clientPayload: JSON.stringify({
            formId,
            draftId: draftIdRef.current,
            fieldName: element.name,
          }),
        },
      );
      const uploaded: UploadedFormFile = {
        url: blob.url,
        name: picked.name,
        size: picked.size,
        type: contentType,
      };
      setUploadState({ status: "done", value: uploaded, localPreview });
      setValue(uploaded);
    } catch (err) {
      // Client uploads surface server-side rejections as an opaque BlobError
      // ("Failed to retrieve the client token") — the token route's structured
      // code/message doesn't always cross back. Prefer `code`, fall back to
      // `message`, then a clean generic message rather than the raw error.
      const parsed = parseError(err);
      const lookupKey = parsed.code ?? parsed.message ?? "";
      const friendly = UPLOAD_ERROR_MESSAGES[lookupKey];
      setUploadState({
        status: "error",
        message: friendly ?? "Upload failed. Please try again.",
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
    // Surface the picker's own rejection (oversize / wrong type) — without
    // this the field swallows the error and an oversized pick looks like a
    // dead click. The next valid pick resets the state to "uploading".
    onError: (errors) => {
      setUploadState({
        status: "error",
        message: errors[0] ?? "That file can't be uploaded.",
      });
    },
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
                "relative flex min-h-20 w-full cursor-pointer flex-col items-center justify-center rounded-[8px] border border-dashed border-border/60 bg-[var(--form-input-bg,var(--color-gray-50))] p-4 elevation-sm transition-colors hover:bg-accent/50",
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
