import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "@/components/theme-provider";
import { auth, useSession } from "@/lib/auth/auth-client";
import { settingsDialogStore } from "@/hooks/use-settings-dialog";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { useLoaderData, useRouter } from "@tanstack/react-router";
import {
  ChevronDownIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  Trash2Icon,
} from "@/components/ui/icons";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const getInitials = (name?: string | null) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export interface UserMenuMinimalProps {
  onOpenTrash: () => void;
}

export const UserMenuMinimal = ({ onOpenTrash }: UserMenuMinimalProps) => {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const { data: session } = useSession();
  const { activeOrg } = useLoaderData({ from: "/_authenticated" });
  const displayName = activeOrg?.name ?? session?.user?.name ?? "User";

  const signOutMutation = useMutation(
    auth.signOut.mutationOptions({
      onSuccess: () => {
        void router.invalidate();
        void router.navigate({ to: "/" });
      },
    }),
  );

  const accountMenuItems = [
    {
      key: "settings",
      label: "Settings",
      icon: SettingsIcon,
      action: () => {
        settingsDialogStore.open("account");
        setIsOpen(false);
      },
    },
    {
      key: "theme",
      label: { dark: "Light mode", light: "System theme", system: "Dark mode" }[theme ?? "system"],
      icon: { dark: SunIcon, light: MonitorIcon, system: MoonIcon }[theme ?? "system"],
      action: () => {
        setTheme(
          { dark: "light", light: "system", system: "dark" }[theme ?? "system"] as
            | "light"
            | "system"
            | "dark",
        );
        setIsOpen(false);
      },
    },
    {
      key: "trash",
      label: "Trash",
      icon: Trash2Icon,
      action: () => {
        onOpenTrash();
        setIsOpen(false);
      },
    },
  ];

  const menuItemIconClass =
    "size-4 shrink-0 text-foreground/80 [&_path]:stroke-[1.6] [&_path]:stroke-current";

  return (
    <div className="hover:bg-sidebar-active bg-background transition-colors">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="md"
              className="flex w-full min-w-0 cursor-pointer items-center justify-start gap-2 overflow-hidden rounded-lg px-1 py-[7px] transition-colors"
              aria-label="Toggle user menu"
            />
          }
        >
          <div className="bg-sidebar-active flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              getInitials(displayName)
            )}
          </div>
          <p className="min-w-0 truncate text-left font-case text-sm text-sidebar-foreground">
            {displayName}
          </p>
          <div className="flex shrink-0 items-center">
            <ChevronDownIcon
              className={cn(
                "size-3 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180",
              )}
              strokeWidth={1.5}
            />
          </div>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="center"
          sideOffset={8}
          className="w-[calc(var(--anchor-width)-16px)]"
        >
          {/* User info header */}
          <div className="flex items-start gap-2.5 px-2 py-1.5">
            <div className="bg-sidebar-active flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-sm font-bold">
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(displayName)
              )}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] text-foreground">{displayName}</span>
              <span className="text-[11px] text-muted-foreground">Free Plan</span>
            </div>
          </div>

          <div className="my-1 h-px bg-border" />

          {/* Account section */}
          <div className="flex flex-col">
            <div className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground">Account</div>
            {accountMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.action}
                  className="inline-flex h-[26px] cursor-pointer items-center gap-1.5 overflow-hidden rounded-lg px-2 py-[5.5px] text-[13px] text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon className={menuItemIconClass} />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="my-1 h-px bg-border" />

          {/* Logout */}
          <button
            type="button"
            onClick={() => {
              signOutMutation.mutate({});
              setIsOpen(false);
            }}
            className="inline-flex h-[26px] cursor-pointer items-center gap-1.5 overflow-hidden rounded-lg px-2 py-[5.5px] text-[13px] text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <LogOutIcon className={menuItemIconClass} />
            <span className="flex-1 text-left">Log out</span>
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
};
