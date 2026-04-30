import { useTheme } from "@/components/theme-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ImageCrop,
  ImageCropApply,
  ImageCropContent,
  ImageCropReset,
} from "@/components/ui/image-crop";
import { InputGroup, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppForm } from "@/components/ui/tanstack-form";
import { auth, useSession } from "@/lib/auth/auth-client";
import { uploadAvatar } from "@/lib/server-fn/uploads";
import { useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import {
  AlertCircleIcon,
  ImageIcon,
  Loader2Icon,
  MailIcon,
  RotateCcwIcon,
  TeleVisionIcon,
  TriangleAlertIcon,
} from "@/components/ui/icons";
import { useCallback, useId, useRef, useState } from "react";
import { toast } from "sonner";

interface EmailChangeApi {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  submit: (newEmail: string) => void;
  isPending: boolean;
}

const useEmailChange = (onSuccess: (fieldName: string, value: string) => void): EmailChangeApi => {
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);

  const changeEmailMutation = useMutation(
    auth.changeEmail.mutationOptions({
      onSuccess: () => {
        toast.success("Verification email sent to your new address. Please check your inbox.");
        onSuccess("newEmail", "");
        setIsChangeEmailOpen(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to change email");
      },
    }),
  );

  return {
    isOpen: isChangeEmailOpen,
    toggle: () => setIsChangeEmailOpen((prev) => !prev),
    close: () => setIsChangeEmailOpen(false),
    submit: (newEmail: string) => {
      changeEmailMutation.mutate({
        newEmail,
        callbackURL: window.location.origin,
      });
    },
    isPending: changeEmailMutation.isPending,
  };
};

interface AvatarUploadApi {
  isDialogOpen: boolean;
  selectedFile: File | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCroppedImage: (croppedImage: string) => Promise<void>;
  setDialogOpen: (open: boolean) => void;
  isUploading: boolean;
}

const useAvatarUpload = (): AvatarUploadApi => {
  const queryClient = useQueryClient();
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateImageMutation = useMutation(
    auth.updateUser.mutationOptions({
      onSuccess: () => {
        toast.success("Profile updated successfully");
        void queryClient.invalidateQueries({ queryKey: auth.getSession.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update profile");
      },
    }),
  );

  const uploadAvatarMutation = useMutation({
    mutationFn: async (base64: string) => {
      const { url } = await uploadAvatar({ data: { base64 } });
      await updateImageMutation.mutateAsync({ image: url });
      return url;
    },
    onSuccess: () => {
      setIsAvatarDialogOpen(false);
      setSelectedFile(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to upload image");
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setIsAvatarDialogOpen(true);
    }
    e.target.value = "";
  };

  const handleCroppedImage = async (croppedImage: string) => {
    await uploadAvatarMutation.mutateAsync(croppedImage);
  };

  const setDialogOpen = (open: boolean) => {
    setIsAvatarDialogOpen(open);
    if (!open) setSelectedFile(null);
  };

  return {
    isDialogOpen: isAvatarDialogOpen,
    selectedFile,
    fileInputRef,
    handleFileSelect,
    handleCroppedImage,
    setDialogOpen,
    isUploading: uploadAvatarMutation.isPending,
  };
};

const ThemeSelect = () => {
  const { theme, setTheme } = useTheme();
  const handleThemeChange = useCallback(
    (val: string | null) => setTheme((val ?? "system") as "dark" | "light" | "system"),
    [setTheme],
  );
  return (
    <Select value={theme} onValueChange={handleThemeChange}>
      <SelectTrigger
        size="md"
        className="shrink-0 rounded-lg border-0 bg-gray-50 pr-2.5 pl-3 text-sm text-foreground capitalize shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] outline-1 -outline-offset-1 outline-transparent"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent positionerClassName="z-103">
        <SelectItem value="system">System</SelectItem>
        <SelectItem value="light">Light</SelectItem>
        <SelectItem value="dark">Dark</SelectItem>
      </SelectContent>
    </Select>
  );
};

export const AccountSettingsContent = () => {
  const queryClient = useQueryClient();
  const { data: session, isPending: isSessionPending } = useSession();
  const user = session?.user;

  const profileForm = useAppForm({
    defaultValues: {
      displayName: user?.name || "",
      username: user?.name?.split(" ")[0]?.toLowerCase() || "",
      newEmail: "",
    },
  });
  const displayNameChanged = useStore(
    profileForm.store,
    (state) => state.values.displayName !== profileForm.options.defaultValues?.displayName,
  );
  const usernameChanged = useStore(
    profileForm.store,
    (state) => state.values.username !== profileForm.options.defaultValues?.username,
  );

  const displayNameId = useId();
  const usernameId = useId();

  const emailChange = useEmailChange((fieldName, value) => {
    profileForm.setFieldValue(fieldName as "newEmail", value);
  });
  const avatarUpload = useAvatarUpload();

  const { data: accounts = [] } = useQuery({
    ...auth.listAccounts.queryOptions(),
  });

  const updateProfileMutation = useMutation(
    auth.updateUser.mutationOptions({
      onSuccess: () => {
        toast.success("Profile updated successfully");
        void queryClient.invalidateQueries({ queryKey: auth.getSession.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update profile");
      },
    }),
  );

  const unlinkAccountMutation = useMutation(
    auth.unlinkAccount.mutationOptions({
      onSuccess: (_, variables) => {
        toast.success(`${variables.providerId} disconnected`);
        queryClient.invalidateQueries({
          queryKey: auth.listAccounts.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to disconnect account");
      },
    }),
  );

  const deleteAccountMutation = useMutation(
    auth.deleteUser.mutationOptions({
      onSuccess: () => {
        toast.success("Account deleted successfully");
        window.location.href = "/";
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete account");
      },
    }),
  );

  const socialSignInMutation = useMutation(
    auth.signIn.social.mutationOptions({
      onSuccess: () => {
        sessionStorage.setItem("shouldSyncAfterSocialLogin", "true");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to connect account");
      },
    }),
  );

  const handleDisconnectAccount = useCallback(
    (providerId: string) => {
      unlinkAccountMutation.mutate({ providerId });
    },
    [unlinkAccountMutation],
  );

  const handleDeleteAccount = useCallback(() => {
    if (!window.confirm("Are you absolutely sure? This action cannot be undone.")) return;
    deleteAccountMutation.mutate({});
  }, [deleteAccountMutation]);

  const handleGoogleSignIn = useCallback(() => {
    socialSignInMutation.mutate({
      provider: "google",
      callbackURL: window.location.origin,
    });
  }, [socialSignInMutation]);

  const handleOpenFileDialog = useCallback(
    () => avatarUpload.fileInputRef.current?.click(),
    [avatarUpload.fileInputRef],
  );

  const handleRemoveAvatar = useCallback(
    () => updateProfileMutation.mutate({ image: "" }),
    [updateProfileMutation],
  );

  const handleDisconnectGoogle = useCallback(
    () => handleDisconnectAccount("google"),
    [handleDisconnectAccount],
  );

  if (isSessionPending) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2Icon aria-hidden="true" className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <profileForm.AppForm>
      <div className="flex flex-col gap-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={handleOpenFileDialog}
            aria-label="Change avatar"
            className="group relative h-auto cursor-pointer rounded-full p-0"
          >
            <Avatar className="size-[46px]">
              <AvatarImage src={user?.image || ""} />
              <AvatarFallback className="bg-indigo-600 text-base text-white">
                {user?.name?.charAt(0) || "V"}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-4 w-4 text-white" />
            </div>
          </Button>
          <input
            ref={avatarUpload.fileInputRef}
            type="file"
            accept="image/*"
            onChange={avatarUpload.handleFileSelect}
            aria-label="Upload avatar image"
            className="hidden"
          />
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              prefix={<ImageIcon />}
              className="h-[30px] rounded-lg bg-popover px-2 text-sm text-popover-foreground filter-[drop-shadow(0_0_0.5px_rgba(0,0,0,0.6))_drop-shadow(0_1px_1px_rgba(0,0,0,0.1))] hover:bg-gray-200"
              onClick={handleOpenFileDialog}
            >
              Upload image
            </Button>
            {user?.image && (
              <Button
                variant="secondary"
                size="sm"
                className="h-[30px] rounded-lg px-2.5"
                onClick={handleRemoveAvatar}
              >
                Remove
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <profileForm.AppField name="displayName">
            {(field) => (
              <div className="flex flex-1 flex-col gap-2">
                <label
                  className="text-base tracking-[0.28px] text-muted-foreground"
                  htmlFor={displayNameId}
                >
                  Display name
                </label>
                <InputGroup
                  variant="borderless"
                  className={`h-[30px] border-0 bg-secondary ring-0 overflow-clip${displayNameChanged ? " pr-[3px]" : ""}`}
                >
                  <InputGroupInput
                    id={displayNameId}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter display name"
                    variant="secondary"
                  />
                  {displayNameChanged && (
                    <InputGroupButton
                      variant="default"
                      onClick={() => {
                        updateProfileMutation.mutate(
                          { name: field.state.value },
                          {
                            onSuccess: () => {
                              profileForm.update({
                                defaultValues: {
                                  displayName: field.state.value,
                                  username: profileForm.getFieldValue("username"),
                                  newEmail: "",
                                },
                              });
                            },
                          },
                        );
                      }}
                      disabled={updateProfileMutation.isPending}
                      className="h-[24px] w-[47px] rounded-lg bg-gray-50 px-3 text-sm text-gray-800 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-gray-200"
                    >
                      Save
                    </InputGroupButton>
                  )}
                </InputGroup>
              </div>
            )}
          </profileForm.AppField>
          <profileForm.AppField name="username">
            {(field) => (
              <div className="flex flex-1 flex-col gap-2">
                <label
                  className="text-base tracking-[0.28px] text-muted-foreground"
                  htmlFor={usernameId}
                >
                  Username
                </label>
                <InputGroup
                  variant="borderless"
                  className={`h-[30px] border-0 bg-secondary ring-0 overflow-clip${usernameChanged ? " pr-[3px]" : ""}`}
                >
                  <InputGroupInput
                    id={usernameId}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter username"
                    variant="secondary"
                  />
                  {usernameChanged && (
                    <InputGroupButton
                      variant="default"
                      onClick={() => {
                        updateProfileMutation.mutate(
                          {
                            name: profileForm.getFieldValue("displayName"),
                          },
                          {
                            onSuccess: () => {
                              profileForm.update({
                                defaultValues: {
                                  displayName: profileForm.getFieldValue("displayName"),
                                  username: field.state.value,
                                  newEmail: "",
                                },
                              });
                            },
                          },
                        );
                      }}
                      disabled={updateProfileMutation.isPending}
                      className="h-[24px] w-[47px] rounded-lg bg-gray-50 px-3 text-sm text-gray-800 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-gray-200"
                    >
                      Save
                    </InputGroupButton>
                  )}
                </InputGroup>
              </div>
            )}
          </profileForm.AppField>
        </div>

        <section className="flex flex-col gap-[10px]">
          <h3 className="text-base font-medium text-foreground">Email</h3>
          <div className="flex items-center gap-3 rounded-2xl bg-secondary py-2 pr-2.5 pl-2">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <div className="flex size-[38px] shrink-0 items-center justify-center overflow-hidden rounded-lg">
                <MailIcon className="size-[22px] text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="truncate text-base font-medium text-foreground">
                  {user?.email || ""}
                </p>
                <p className="text-base text-muted-foreground">Current email</p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={emailChange.toggle}
              className="h-[30px] rounded-lg bg-gray-50 px-3 font-sans text-sm font-medium text-gray-800 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-gray-200"
            >
              Change email
            </Button>
          </div>
          {emailChange.isOpen && (
            <profileForm.AppField name="newEmail">
              {(field) => (
                <InputGroup
                  variant="borderless"
                  className="h-[30px] overflow-clip border-0 bg-secondary pr-[3px] ring-0"
                >
                  <InputGroupInput
                    type="email"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Enter new email address"
                    aria-label="New email address"
                    className="h-[30px] pr-1.5 pl-2.5 text-base text-foreground"
                  />
                  <InputGroupButton
                    variant="default"
                    onClick={() => {
                      if (!field.state.value) return;
                      emailChange.submit(field.state.value);
                    }}
                    disabled={emailChange.isPending || !field.state.value}
                    className="h-[24px] rounded-lg bg-gray-50 px-3 text-sm text-gray-800 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-gray-200"
                  >
                    {emailChange.isPending ? "Sending..." : "Verify"}
                  </InputGroupButton>
                </InputGroup>
              )}
            </profileForm.AppField>
          )}
        </section>

        <section className="flex flex-col gap-[10px]">
          <h3 className="text-base font-medium text-foreground">Appearance</h3>
          <div className="flex items-center gap-3 rounded-2xl bg-secondary py-2 pr-2.5 pl-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex size-[38px] shrink-0 items-center justify-center overflow-hidden rounded-lg">
                <TeleVisionIcon className="size-[22px] text-muted-foreground" />
              </div>
              <div className="flex flex-col justify-center">
                <p className="font-sans text-base font-medium text-foreground">
                  Choose light/dark mode
                </p>
              </div>
            </div>
            <ThemeSelect />
          </div>
        </section>

        <section className="flex flex-col gap-[10px]">
          <h3 className="text-base font-medium text-foreground">Connected account</h3>
          <div className="flex items-center gap-3 rounded-2xl bg-secondary py-2 pr-2.5 pl-2">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <div className="flex size-[38px] shrink-0 items-center justify-center overflow-hidden rounded-lg">
                <svg viewBox="0 0 24 24" width="20" height="20" className="size-5">
                  <title>Google logo</title>
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              </div>
              <div className="flex flex-col gap-1">
                <p className="truncate text-base font-medium text-foreground">
                  {accounts.find((a) => a.providerId === "google")
                    ? user?.email || "Google account"
                    : "Google"}
                </p>
                <p className="text-base text-muted-foreground">
                  {accounts.find((a) => a.providerId === "google")
                    ? "Current email"
                    : "Not connected"}
                </p>
              </div>
            </div>
            {accounts.find((a) => a.providerId === "google") ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDisconnectGoogle}
                className="h-[30px] rounded-lg bg-gray-50 px-3 text-sm text-gray-800 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-gray-200"
              >
                Disconnect
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGoogleSignIn}
                className="h-[30px] w-[95px] rounded-lg bg-gray-50 px-3 text-sm text-gray-800 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-gray-200"
              >
                Connect
              </Button>
            )}
          </div>
          {accounts.find((a) => a.providerId === "google") && (
            <div className="flex items-center gap-2">
              <AlertCircleIcon className="size-[18px] shrink-0 text-muted-foreground" />
              <p className="text-sm leading-[1.5] text-muted-foreground">
                You have logged in with your Google account.
              </p>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-[10px]">
          <h3 className="text-base font-medium text-foreground">Delete Account</h3>
          <p className="text-base leading-[1.5] text-foreground">
            If you no longer wish to use recollect, you can permanently delete your account.
          </p>
          <Button
            variant="secondary"
            size="md"
            onClick={handleDeleteAccount}
            disabled={deleteAccountMutation.isPending}
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-secondary px-2.5 py-[7px] transition-colors hover:bg-accent disabled:opacity-50"
          >
            {deleteAccountMutation.isPending ? (
              <Loader2Icon className="size-3 animate-spin text-destructive" />
            ) : (
              <TriangleAlertIcon className="size-3 text-destructive" />
            )}
            <span className="text-sm text-destructive">Delete my account</span>
          </Button>
        </section>

        <Dialog open={avatarUpload.isDialogOpen} onOpenChange={avatarUpload.setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Crop your photo</DialogTitle>
              <DialogDescription>
                Adjust the crop area to set your profile picture.
              </DialogDescription>
            </DialogHeader>

            {avatarUpload.selectedFile && (
              <ImageCrop
                file={avatarUpload.selectedFile}
                aspect={1}
                circularCrop
                onCrop={avatarUpload.handleCroppedImage}
              >
                <div className="space-y-4">
                  <ImageCropContent className="max-h-[300px]" />

                  <div className="flex justify-between">
                    <ImageCropReset render={<Button variant="outline" size="sm" />}>
                      <RotateCcwIcon className="mr-2 h-4 w-4" />
                      Reset
                    </ImageCropReset>

                    <ImageCropApply
                      render={
                        <Button
                          disabled={avatarUpload.isUploading}
                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                        />
                      }
                    >
                      {avatarUpload.isUploading ? (
                        <>
                          <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        "Save photo"
                      )}
                    </ImageCropApply>
                  </div>
                </div>
              </ImageCrop>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </profileForm.AppForm>
  );
};
