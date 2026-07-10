import { useCallback, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, InputHTMLAttributes, Ref } from "react";

export type FileMetadata = {
  name: string;
  size: number;
  type: string;
  url: string;
  id: string;
};

export type FileWithPreview = {
  file: File | FileMetadata;
  id: string;
  preview?: string;
};

type FileUploadOptions = {
  maxFiles?: number; // Only used when multiple is true, defaults to Infinity
  maxSize?: number; // in bytes
  accept?: string;
  multiple?: boolean; // Defaults to false
  initialFiles?: FileMetadata[];
  onFilesChange?: (files: FileWithPreview[]) => void; // Callback when files change
  onFilesAdded?: (addedFiles: FileWithPreview[]) => void; // Callback when new files are added
  onError?: (errors: string[]) => void;
};

type FileUploadState = {
  files: FileWithPreview[];
  isDragging: boolean;
  errors: string[];
};

type FileUploadActions = {
  addFiles: (files: FileList | File[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  clearErrors: () => void;
  handleDragEnter: (e: DragEvent<HTMLElement>) => void;
  handleDragLeave: (e: DragEvent<HTMLElement>) => void;
  handleDragOver: (e: DragEvent<HTMLElement>) => void;
  handleDrop: (e: DragEvent<HTMLElement>) => void;
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  openFileDialog: () => void;
  getInputProps: (
    props?: InputHTMLAttributes<HTMLInputElement>,
  ) => InputHTMLAttributes<HTMLInputElement> & {
    ref: Ref<HTMLInputElement>;
  };
};

export const useFileUpload = (
  options: FileUploadOptions = {},
): [FileUploadState, FileUploadActions] => {
  const {
    maxFiles = Number.POSITIVE_INFINITY,
    maxSize = Number.POSITIVE_INFINITY,
    accept = "*",
    multiple = false,
    initialFiles = [],
    onFilesChange,
    onFilesAdded,
    onError,
  } = options;

  const [state, setState] = useState<FileUploadState>(() => ({
    files: initialFiles.map((file) => ({
      file,
      id: file.id,
      preview: file.url,
    })),
    isDragging: false,
    errors: [],
  }));

  const inputRef = useRef<HTMLInputElement>(null);
  // Live mirror of state.files: lets callbacks read fresh files without depending on state,
  // keeping them stable AND keeping side effects out of setState updaters (must stay pure).
  const filesRef = useRef(state.files);

  // maxSize is enforced in addFiles (single source); this only checks accepted types.
  const validateFile = useCallback(
    (file: File | FileMetadata): string | null => {
      if (accept !== "*") {
        const acceptedTypes = accept.split(",").map((type) => type.trim());
        const fileType = file instanceof File ? file.type || "" : file.type;
        const fileExtension = `.${file.name.split(".").pop()}`;

        const isAccepted = acceptedTypes.some((type) => {
          if (type.startsWith(".")) {
            return fileExtension.toLowerCase() === type.toLowerCase();
          }
          if (type.endsWith("/*")) {
            const baseType = type.split("/")[0];
            return fileType.startsWith(`${baseType}/`);
          }
          return fileType === type;
        });

        if (!isAccepted) {
          return `File "${file.name}" is not an accepted file type.`;
        }
      }

      return null;
    },
    [accept],
  );

  const createPreview = useCallback((file: File | FileMetadata): string | undefined => {
    if (file instanceof File) {
      return URL.createObjectURL(file);
    }
    return file.url;
  }, []);

  const generateUniqueId = useCallback((file: File | FileMetadata): string => {
    if (file instanceof File) {
      return `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    return file.id;
  }, []);

  const clearFiles = useCallback(() => {
    for (const file of filesRef.current) {
      if (file.preview && file.file instanceof File && file.file.type.startsWith("image/")) {
        URL.revokeObjectURL(file.preview);
      }
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    filesRef.current = [];
    setState((prev) => ({ ...prev, files: [], errors: [] }));
    onFilesChange?.([]);
  }, [onFilesChange]);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      if (!newFiles || newFiles.length === 0) return;

      const newFilesArray = Array.from(newFiles);

      if (!multiple) {
        clearFiles();
      }

      // Read the live file list via filesRef instead of the closed-over state.files,
      // so this callback stays stable across file changes.
      const prevFiles = filesRef.current;
      const errors: string[] = [];

      if (
        multiple &&
        maxFiles !== Number.POSITIVE_INFINITY &&
        prevFiles.length + newFilesArray.length > maxFiles
      ) {
        errors.push(`You can only upload a maximum of ${maxFiles} files.`);
        setState((prev) => ({ ...prev, errors }));
        onError?.(errors);
        return;
      }

      const validFiles: FileWithPreview[] = [];

      for (const file of newFilesArray) {
        // Only check for duplicates if multiple files are allowed
        if (multiple) {
          const isDuplicate = prevFiles.some(
            (existingFile) =>
              existingFile.file.name === file.name && existingFile.file.size === file.size,
          );

          // Skip duplicate files silently — abort the whole batch (input left untouched)
          if (isDuplicate) {
            setState((prev) => ({ ...prev, errors: [] }));
            return;
          }
        }

        if (file.size > maxSize) {
          errors.push(
            multiple
              ? `Some files exceed the maximum size of ${formatBytes(maxSize)}.`
              : `File exceeds the maximum size of ${formatBytes(maxSize)}.`,
          );
          continue;
        }

        const error = validateFile(file);
        if (error) {
          errors.push(error);
        } else {
          validFiles.push({
            file,
            id: generateUniqueId(file),
            preview: createPreview(file),
          });
        }
      }

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      if (validFiles.length > 0) {
        const updatedFiles = !multiple ? validFiles : [...prevFiles, ...validFiles];
        filesRef.current = updatedFiles;
        setState((prev) => ({ ...prev, files: updatedFiles, errors }));
        onFilesAdded?.(validFiles);
        onFilesChange?.(updatedFiles);
        return;
      }

      if (errors.length > 0) {
        setState((prev) => ({ ...prev, errors }));
        onError?.(errors);
        return;
      }

      setState((prev) => ({ ...prev, errors: [] }));
    },
    [
      maxFiles,
      multiple,
      maxSize,
      validateFile,
      createPreview,
      generateUniqueId,
      clearFiles,
      onFilesChange,
      onFilesAdded,
      onError,
    ],
  );

  const removeFile = useCallback(
    (id: string) => {
      const fileToRemove = filesRef.current.find((file) => file.id === id);
      if (
        fileToRemove?.preview &&
        fileToRemove.file instanceof File &&
        fileToRemove.file.type.startsWith("image/")
      ) {
        URL.revokeObjectURL(fileToRemove.preview);
      }

      const newFiles = filesRef.current.filter((file) => file.id !== id);
      filesRef.current = newFiles;
      setState((prev) => ({ ...prev, files: newFiles, errors: [] }));
      onFilesChange?.(newFiles);
    },
    [onFilesChange],
  );

  const clearErrors = useCallback(() => {
    setState((prev) => ({
      ...prev,
      errors: [],
    }));
  }, []);

  const handleDragEnter = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setState((prev) => ({ ...prev, isDragging: true }));
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }

    setState((prev) => ({ ...prev, isDragging: false }));
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setState((prev) => ({ ...prev, isDragging: false }));

      if (inputRef.current?.disabled) {
        return;
      }

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        if (!multiple) {
          const file = e.dataTransfer.files[0];
          addFiles([file]);
        } else {
          addFiles(e.dataTransfer.files);
        }
      }
    },
    [addFiles, multiple],
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
    },
    [addFiles],
  );

  const openFileDialog = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  }, []);

  const getInputProps = useCallback(
    (props: InputHTMLAttributes<HTMLInputElement> = {}) => ({
      ...props,
      type: "file" as const,
      onChange: handleFileChange,
      accept: props.accept || accept,
      multiple: props.multiple !== undefined ? props.multiple : multiple,
      ref: inputRef,
    }),
    [accept, multiple, handleFileChange],
  );

  return [
    state,
    {
      addFiles,
      removeFile,
      clearFiles,
      clearErrors,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      handleFileChange,
      openFileDialog,
      getInputProps,
    },
  ];
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);

  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)}\u00a0${units[i]}`;
};
