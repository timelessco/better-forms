import type { ReactNode } from "react";
import { createContext, use, useMemo } from "react";

import AvatarUpload from "@/components/ui/avatar-upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ImageIcon, SmileIcon, UploadIcon, XIcon } from "@/components/ui/icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFileUpload } from "@/hooks/use-file-upload";
import { cn } from "@/lib/utils";

interface FormHeaderContextValue {
  title: string;
  icon?: string;
  cover?: string;
  hasCover: boolean;
  hasLogo: boolean;
  onTitleChange: (title: string) => void;
  onIconChange: (icon: string | null) => void;
  onCoverChange: (cover: string | null) => void;
}

const FormHeaderContext = createContext<FormHeaderContextValue | null>(null);

const useFormHeaderContext = (): FormHeaderContextValue => {
  const ctx = use(FormHeaderContext);

  if (!ctx) {
    throw new Error("FormHeader compound components must be used within <FormHeader>");
  }

  return ctx;
};

const CoverUpload = ({ onFileChange }: { onFileChange: (url: string) => void }) => {
  const [
    { isDragging, errors },
    { handleDragEnter, handleDragLeave, handleDragOver, handleDrop, openFileDialog, getInputProps },
  ] = useFileUpload({
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
    accept: "image/*",
    multiple: false,
    onFilesChange: (files) => {
      if (files[0]?.preview) {
        onFileChange(files[0].preview);
      }
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <button
        className={cn(
          "group/cover-upload relative flex h-32 w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-dashed transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/20 hover:bg-muted/50",
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFileDialog}
        type="button"
      >
        <input {...getInputProps()} className="sr-only" />
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <UploadIcon className="h-8 w-8" />
          <span className="text-sm">Upload cover image</span>
          <span className="text-xs">Max 5MB</span>
        </div>
      </button>
      {errors.length > 0 && <div className="text-sm text-destructive">{errors[0]}</div>}
    </div>
  );
};

const FormHeaderCover = () => {
  const { cover, onCoverChange } = useFormHeaderContext();

  if (!cover) {
    return null;
  }
  const setCoverUrl = (url: string | null) => onCoverChange(url);

  return (
    <div className="group/cover relative h-[120px] w-full bg-muted/20 sm:h-[200px]">
      {cover && !cover.startsWith("#") ? (
        <>
          {cover.includes("tint=true") && (
            <div className="pointer-events-none absolute inset-0 z-1 bg-primary opacity-50 mix-blend-color" />
          )}
          <img
            src={cover}
            alt="Cover"
            width={800}
            height={200}
            className={cn(
              "h-full w-full object-cover",
              cover.includes("tint=true") && "relative z-0 brightness-60 grayscale",
            )}
          />
        </>
      ) : (
        <div
          className="h-full w-full"
          style={{
            backgroundColor: cover?.startsWith("#") ? cover : "#FFE4E1",
          }}
        />
      )}{" "}
      <div className="absolute right-2 bottom-2 flex gap-2 opacity-0 transition-opacity group-hover/cover:opacity-100">
        <Dialog>
          <DialogTrigger
            render={
              <Button
                variant="secondary"
                size="sm"
                className="h-7 bg-white/80 text-xs hover:bg-white"
              />
            }
          >
            Change cover
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cover Image</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="gallery" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="gallery">Gallery</TabsTrigger>
                <TabsTrigger value="upload">Upload</TabsTrigger>
              </TabsList>
              <TabsContent value="gallery" className="grid grid-cols-4 gap-2 pt-4">
                <button
                  type="button"
                  onClick={() =>
                    setCoverUrl(
                      "https://images.unsplash.com/photo-1604076850742-4c7221f3101b?w=800&q=80&tint=true",
                    )
                  }
                  className="relative h-16 cursor-pointer overflow-hidden rounded bg-muted ring-primary transition-[opacity,transform] hover:ring-2"
                  aria-label="Abstract mesh"
                >
                  <div className="pointer-events-none absolute inset-0 z-1 bg-primary opacity-50 mix-blend-color" />
                  <img
                    src="https://images.unsplash.com/photo-1604076850742-4c7221f3101b?w=800&q=80&tint=true"
                    alt="Abstract mesh"
                    width={200}
                    height={64}
                    className="relative z-0 h-full w-full object-cover brightness-60 grayscale"
                  />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCoverUrl(
                      "https://images.unsplash.com/photo-1574169208507-84376144848b?w=800&q=80&tint=true",
                    )
                  }
                  className="relative h-16 cursor-pointer overflow-hidden rounded bg-muted ring-primary transition-[opacity,transform] hover:ring-2"
                  aria-label="Abstract gradient"
                >
                  <div className="pointer-events-none absolute inset-0 z-1 bg-primary opacity-50 mix-blend-color" />
                  <img
                    src="https://images.unsplash.com/photo-1574169208507-84376144848b?w=800&q=80&tint=true"
                    alt="Abstract gradient"
                    width={200}
                    height={64}
                    className="relative z-0 h-full w-full object-cover brightness-60 grayscale"
                  />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCoverUrl(
                      "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=800&q=80&tint=true",
                    )
                  }
                  className="relative h-16 cursor-pointer overflow-hidden rounded bg-muted ring-primary transition-[opacity,transform] hover:ring-2"
                  aria-label="Abstract geometric"
                >
                  <div className="pointer-events-none absolute inset-0 z-1 bg-primary opacity-50 mix-blend-color" />
                  <img
                    src="https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=800&q=80&tint=true"
                    alt="Abstract geometric"
                    width={200}
                    height={64}
                    className="relative z-0 h-full w-full object-cover brightness-60 grayscale"
                  />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCoverUrl(
                      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80&tint=true",
                    )
                  }
                  className="relative h-16 cursor-pointer overflow-hidden rounded bg-muted ring-primary transition-[opacity,transform] hover:ring-2"
                  aria-label="Abstract liquid"
                >
                  <div className="pointer-events-none absolute inset-0 z-1 bg-primary opacity-50 mix-blend-color" />
                  <img
                    src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80&tint=true"
                    alt="Abstract liquid"
                    width={200}
                    height={64}
                    className="relative z-0 h-full w-full object-cover brightness-60 grayscale"
                  />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCoverUrl(
                      "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=800&q=80&tint=true",
                    )
                  }
                  className="relative h-16 cursor-pointer overflow-hidden rounded bg-muted ring-primary transition-[opacity,transform] hover:ring-2"
                  aria-label="3D shapes"
                >
                  <div className="pointer-events-none absolute inset-0 z-1 bg-primary opacity-50 mix-blend-color" />
                  <img
                    src="https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=800&q=80&tint=true"
                    alt="3D shapes"
                    width={200}
                    height={64}
                    className="relative z-0 h-full w-full object-cover brightness-60 grayscale"
                  />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCoverUrl(
                      "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80&tint=true",
                    )
                  }
                  className="relative h-16 cursor-pointer overflow-hidden rounded bg-muted ring-primary transition-[opacity,transform] hover:ring-2"
                  aria-label="Gradient curves"
                >
                  <div className="pointer-events-none absolute inset-0 z-1 bg-primary opacity-50 mix-blend-color" />
                  <img
                    src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80&tint=true"
                    alt="Gradient curves"
                    width={200}
                    height={64}
                    className="relative z-0 h-full w-full object-cover brightness-60 grayscale"
                  />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCoverUrl(
                      "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&q=80&tint=true",
                    )
                  }
                  className="relative h-16 cursor-pointer overflow-hidden rounded bg-muted ring-primary transition-[opacity,transform] hover:ring-2"
                  aria-label="Geometric waves"
                >
                  <div className="pointer-events-none absolute inset-0 z-1 bg-primary opacity-50 mix-blend-color" />
                  <img
                    src="https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&q=80&tint=true"
                    alt="Geometric waves"
                    width={200}
                    height={64}
                    className="relative z-0 h-full w-full object-cover brightness-60 grayscale"
                  />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCoverUrl(
                      "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&q=80&tint=true",
                    )
                  }
                  className="relative h-16 cursor-pointer overflow-hidden rounded bg-muted ring-primary transition-[opacity,transform] hover:ring-2"
                  aria-label="Abstract paint"
                >
                  <div className="pointer-events-none absolute inset-0 z-1 bg-primary opacity-50 mix-blend-color" />
                  <img
                    src="https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&q=80&tint=true"
                    alt="Abstract paint"
                    width={200}
                    height={64}
                    className="relative z-0 h-full w-full object-cover brightness-60 grayscale"
                  />
                </button>

                <button
                  type="button"
                  onClick={() => setCoverUrl(null)}
                  className="col-span-4 mt-2 flex items-center justify-center gap-2 rounded-md border py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-destructive"
                >
                  <XIcon className="h-4 w-4" /> Remove cover
                </button>
              </TabsContent>
              <TabsContent value="upload" className="pt-4">
                <CoverUpload onFileChange={setCoverUrl} />
                <button
                  type="button"
                  onClick={() => setCoverUrl(null)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-destructive"
                >
                  <XIcon className="h-4 w-4" /> Remove cover
                </button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

const FormHeaderIcon = () => {
  const { icon, hasCover, onIconChange } = useFormHeaderContext();

  if (!icon) {
    return null;
  }

  const setLogoUrl = (url: string | null) => onIconChange(url);

  return (
    <button
      type="button"
      className={cn("relative z-10 mb-4", hasCover ? "-mt-[30px] sm:-mt-[40px]" : "mt-6 sm:mt-8")}
    >
      <Dialog>
        <DialogTrigger
          render={
            <div className="group/logo h-[60px] w-[60px] cursor-pointer overflow-hidden rounded-full bg-background shadow-sm transition-all hover:ring-2 hover:ring-muted-foreground/20 sm:h-[80px] sm:w-[80px]" />
          }
        >
          {icon && icon !== "default-icon" ? (
            <img
              src={icon}
              alt="Logo"
              width={80}
              height={80}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-black text-white">
              <svg
                className="h-6 w-6 sm:h-10 sm:w-10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <title>Form header placeholder icon</title>
                <path d="M12 2l9 4.9V17L12 22l-9-4.9V7z" />
              </svg>
            </div>
          )}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose an icon</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="emoji" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="emoji">Emoji</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
            </TabsList>
            <TabsContent
              value="emoji"
              className="flex h-[200px] flex-col items-center justify-center gap-4 text-muted-foreground"
            >
              <span className="text-sm">Emoji picker placeholder</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLogoUrl(null)}
                className="text-destructive hover:text-destructive"
              >
                <XIcon className="mr-2 h-4 w-4" /> Remove icon
              </Button>
            </TabsContent>
            <TabsContent value="upload" className="flex flex-col items-center pt-4">
              <AvatarUpload
                onFileChange={(file) => {
                  if (file?.preview) {
                    setLogoUrl(file.preview);
                  }
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogoUrl(null)}
                className="mt-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Remove icon
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </button>
  );
};

const FormHeaderTitle = () => {
  const { title, onTitleChange } = useFormHeaderContext();

  return (
    <div className="group/title relative">
      <input
        type="text"
        placeholder="Form title"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        aria-label="Form title"
        className="h-auto w-full border-none bg-transparent py-1 text-2xl font-bold outline-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring sm:py-2 sm:text-4xl"
      />
    </div>
  );
};

const ActionButtons = () => {
  const { hasCover, hasLogo, onIconChange, onCoverChange } = useFormHeaderContext();
  const handleAddCover = () => onCoverChange("#FFE4E1");
  const handleAddIcon = () => onIconChange("default-icon");

  return (
    <div
      className={cn(
        "mb-2 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100",
        !hasCover && !hasLogo && "mt-8 sm:mt-12",
        hasCover && !hasLogo && "mt-4",
        !hasCover && hasLogo && "mt-0",
      )}
    >
      {!hasLogo && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:bg-muted"
          onClick={handleAddIcon}
        >
          <SmileIcon className="mr-1.5 h-3.5 w-3.5" />
          Add icon
        </Button>
      )}
      {!hasCover && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:bg-muted"
          onClick={handleAddCover}
        >
          <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
          Add cover
        </Button>
      )}
    </div>
  );
};

export interface FormHeaderProps {
  title?: string;
  icon?: string;
  cover?: string;
  onTitleChange: (title: string) => void;
  onIconChange: (icon: string | null) => void;
  onCoverChange: (cover: string | null) => void;
  children?: ReactNode;
}

const FormHeaderRoot = ({
  title = "",
  icon,
  cover,
  onTitleChange,
  onIconChange,
  onCoverChange,
  children,
}: FormHeaderProps) => {
  const hasCover = !!cover;
  const hasLogo = !!icon;

  const contextValue = useMemo<FormHeaderContextValue>(
    () => ({
      title,
      icon,
      cover,
      hasCover,
      hasLogo,
      onTitleChange,
      onIconChange,
      onCoverChange,
    }),
    [title, icon, cover, hasCover, hasLogo, onTitleChange, onIconChange, onCoverChange],
  );

  return (
    <FormHeaderContext value={contextValue}>
      <div className="group relative mb-4 flex w-full flex-col">
        {children ?? (
          <>
            <FormHeaderCover />
            <div
              className={cn("relative mx-auto flex w-full max-w-[900px] flex-col px-4 sm:px-14")}
            >
              <div className="w-full sm:px-[max(10px,calc(50%-350px))]">
                <FormHeaderIcon />
                <ActionButtons />
                <FormHeaderTitle />
              </div>
            </div>
          </>
        )}
      </div>
    </FormHeaderContext>
  );
};

export const FormHeader = Object.assign(FormHeaderRoot, {
  Cover: FormHeaderCover,
  Icon: FormHeaderIcon,
  Title: FormHeaderTitle,
  Actions: ActionButtons,
});
