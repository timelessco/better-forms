import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { BellIcon, CheckCheckIcon, UsersIcon, XIcon } from "@/components/ui/icons";
import { SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import { useMinimalSidebar } from "@/contexts/minimal-sidebar-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { useSubmissionNotifications } from "@/hooks/use-submission-notifications";
import { auth } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// Figma 26669:11845 — clock in the notification row (e.g. "2:47 PM").
const formatNotificationClock = (value: string) => format(new Date(value), "h:mm a");

// Figma 26669:11845 — batch notifications into Today / Yesterday / dated sections by latest activity.
const groupNotificationsByDay = <T extends { latestSubmissionAt: string }>(items: readonly T[]) => {
  const buckets = new Map<string, { label: string; order: number; items: T[] }>();
  for (const item of items) {
    const date = new Date(item.latestSubmissionAt);
    const label = isToday(date) ? "Today" : isYesterday(date) ? "Yesterday" : format(date, "MMM d");
    const bucket = buckets.get(label);
    if (bucket) {
      bucket.items.push(item);
      bucket.order = Math.max(bucket.order, date.getTime());
    } else {
      buckets.set(label, { label, order: date.getTime(), items: [item] });
    }
  }
  return [...buckets.values()].sort((a, b) => b.order - a.order);
};

// Inbox body (header + notifications + invitations). Two contexts: desktop floating panel (SidebarInbox), mobile in-drawer (back button vs close).
interface InboxPanelBodyProps {
  onClose: () => void;
  // Rendered left of title — mobile back-arrow; desktop omits (close button only).
  headerLeft?: React.ReactNode;
}

export const InboxPanelBody = ({ onClose, headerLeft }: InboxPanelBodyProps) => {
  const queryClient = useQueryClient();

  const { data: invitations } = useQuery(auth.organization.listUserInvitations.queryOptions());
  const {
    notifications,
    readNotificationCount,
    openNotification,
    clearNotification,
    clearAllReadNotifications,
    isClearingAllRead,
    clearingFormId,
    readingFormId,
  } = useSubmissionNotifications();

  const handleError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "Something went wrong";
    toast.error(message);
    void queryClient.invalidateQueries({
      queryKey: auth.organization.listUserInvitations.queryKey(),
    });
  };

  const acceptMutation = useMutation(
    auth.organization.acceptInvitation.mutationOptions({
      onSuccess: () => {
        toast.success("Invitation accepted!");
        void queryClient.invalidateQueries({
          queryKey: auth.organization.listUserInvitations.queryKey(),
        });
      },
      onError: handleError,
    }),
  );

  const rejectMutation = useMutation(
    auth.organization.rejectInvitation.mutationOptions({
      onSuccess: () => {
        toast.success("Invitation declined");
        void queryClient.invalidateQueries({
          queryKey: auth.organization.listUserInvitations.queryKey(),
        });
      },
      onError: handleError,
    }),
  );

  const pendingInvitations = (invitations ?? []).filter(
    (inv: { status: string }) => inv.status === "pending",
  );
  const hasNotifications = notifications.length > 0;
  const hasPendingInvitations = pendingInvitations.length > 0;

  return (
    // [font-variation-settings:normal] un-pins the global opsz20/wght450 so font-weight utils apply
    <div className="flex size-full flex-col [font-variation-settings:normal]">
      <SidebarHeader className="shrink-0 gap-2.25 space-y-2 pt-2 pb-3 pl-1">
        <div className="flex items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1">
            {headerLeft}
            <h2 className="truncate pl-2.5 text-base text-foreground">Inbox</h2>
          </div>
          <Button
            variant="ghost-flat"
            size="icon"
            className="shrink-0 rounded-lg p-1.25 text-gray-800 hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon className="size-4.5" />
          </Button>
        </div>
      </SidebarHeader>

      <div className="no-scrollbar flex-1 overflow-y-auto p-2">
        <div className="overflow-hidden px-1">
          {hasNotifications && (
            // -mx-1 cancels the parent px-1 so the list is flush to the p-2 frame (Figma frame edge).
            <div className="-mx-1">
              {/* Figma 26669:11834 — section header: "Notifications" + mark-all (double-check). */}
              <div className="flex items-center justify-between py-2 pr-2 pl-4">
                <span className="px-0.5 py-1 text-base leading-[1.15] font-[450] tracking-[0.14px] text-gray-800">
                  Notifications
                </span>
                {readNotificationCount > 0 && (
                  <Button
                    variant="ghost-flat"
                    size="icon"
                    className="rounded-[8px] p-1.25 text-gray-800 hover:text-foreground"
                    disabled={isClearingAllRead}
                    onClick={() => void clearAllReadNotifications()}
                    aria-label="Clear all read"
                    title="Clear all read"
                  >
                    <CheckCheckIcon className="size-4" />
                  </Button>
                )}
              </div>

              {/* Figma 26669:11845 — day-batched notification list. */}
              <div className="flex flex-col gap-5 pt-1.5 pb-3.5">
                {groupNotificationsByDay(notifications).map((group) => (
                  <div key={group.label} className="flex flex-col gap-2">
                    <p className="pl-4 text-sm leading-[1.15] font-[450] tracking-[0.13px] text-gray-500">
                      {group.label}
                    </p>
                    <div className="flex flex-col">
                      {group.items.map((notification) => {
                        const isUnread = !notification.isRead && notification.unreadCount > 0;
                        const isBusy =
                          readingFormId === notification.formId ||
                          clearingFormId === notification.formId;

                        return (
                          <button
                            key={notification.id}
                            type="button"
                            className="group flex w-full items-center gap-1.5 border-b border-gray-200 px-2 py-3 text-left transition-colors hover:rounded-[8px] hover:border-transparent hover:bg-gray-100"
                            onClick={() => void openNotification(notification)}
                            disabled={readingFormId === notification.formId}
                          >
                            {/* Message — 14px / Medium 450 / gray-800 / lh 1.5 (Figma 27015:15776). */}
                            <span className="min-w-0 flex-1 text-base leading-[1.5] font-[450] tracking-[0.14px] text-gray-800">
                              {notification.formTitle || "Untitled"}
                            </span>
                            {/* Right cluster — time (13px / gray-550) + unread dot / hover-clear (Figma 27015:15777). */}
                            <span className="flex shrink-0 items-center gap-0.5">
                              <span className="text-sm leading-[1.15] font-[450] tracking-[0.13px] text-[var(--color-gray-550)]">
                                {formatNotificationClock(notification.latestSubmissionAt)}
                              </span>
                              {isUnread ? (
                                <span
                                  className="flex size-4 shrink-0 items-center justify-center"
                                  aria-label="Unread"
                                >
                                  {/* Figma blue/500 #0289f7 — no token exists; matches logic-block-node.tsx precedent. */}
                                  <span className="size-1.5 rounded-full bg-[#0289f7]" />
                                </span>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="size-4 shrink-0 text-[var(--color-gray-550)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                                  disabled={isBusy}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void clearNotification(notification.formId);
                                  }}
                                  aria-label="Clear notification"
                                >
                                  <XIcon className="size-3" />
                                </Button>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasPendingInvitations && (
            <>
              <p className="mb-3 px-2 text-[10px] font-bold tracking-widest text-muted-foreground/30 uppercase">
                Invitations
              </p>
              <div className="mb-4 space-y-1">
                {pendingInvitations.map((invitation) => {
                  const isProcessing =
                    (acceptMutation.isPending &&
                      acceptMutation.variables?.invitationId === invitation.id) ||
                    (rejectMutation.isPending &&
                      rejectMutation.variables?.invitationId === invitation.id);

                  return (
                    <div
                      key={invitation.id}
                      className="group flex flex-col gap-2 rounded-md border border-transparent p-2 transition-colors hover:border-foreground/5 hover:bg-muted/50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded bg-foreground/5">
                          <UsersIcon className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] text-foreground">
                            You've been invited to join{" "}
                            <span className="font-bold">
                              {(
                                invitation as unknown as {
                                  organization?: { name?: string };
                                }
                              ).organization?.name ?? "an organization"}
                            </span>
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                            Role: <span className="capitalize">{invitation.role}</span>
                          </p>
                        </div>
                      </div>
                      <div className="ml-11 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 px-3 text-xs"
                          disabled={isProcessing}
                          onClick={() =>
                            acceptMutation.mutate({
                              invitationId: invitation.id,
                            })
                          }
                        >
                          {acceptMutation.isPending &&
                          acceptMutation.variables?.invitationId === invitation.id
                            ? "Accepting..."
                            : "Accept"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-3 text-xs"
                          disabled={isProcessing}
                          onClick={() =>
                            rejectMutation.mutate({
                              invitationId: invitation.id,
                            })
                          }
                        >
                          {rejectMutation.isPending &&
                          rejectMutation.variables?.invitationId === invitation.id
                            ? "Declining..."
                            : "Decline"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!hasNotifications && !hasPendingInvitations ? (
            <Empty className="border-none py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BellIcon />
                </EmptyMedia>
                <EmptyTitle>No notifications yet</EmptyTitle>
                <EmptyDescription>
                  Submission notifications appear here for forms where in-app notifications are
                  enabled.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
        </div>
      </div>
    </div>
  );
};

/** Desktop-only floating Inbox panel; left-X follows sidebar collapsed/expanded width. Mobile returns null (rendered in drawer via AppSidebar). */
export const SidebarInbox = () => {
  const { isInboxOpen, closeInbox } = useMinimalSidebar();
  const { state } = useSidebar();
  const isMobile = useIsMobile();
  const prevOpenRef = useRef(isInboxOpen);
  // eslint-disable-next-line react-doctor/rerender-state-only-in-handlers -- value is read in JSX to apply exit animation styling
  const [isExiting, setIsExiting] = useState(false);
  const [applyExitClass, setApplyExitClass] = useState(false);

  const [lastIsInboxOpen, setLastIsInboxOpen] = useState(isInboxOpen);
  if (lastIsInboxOpen !== isInboxOpen) {
    setLastIsInboxOpen(isInboxOpen);
    if (isInboxOpen) {
      prevOpenRef.current = true;
      setIsExiting(false);
      setApplyExitClass(false);
    } else if (prevOpenRef.current) {
      setIsExiting(true);
      prevOpenRef.current = false;
    }
  }

  useIsomorphicLayoutEffect(() => {
    if (!isExiting) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setApplyExitClass(true));
    });
    return () => cancelAnimationFrame(id);
  }, [isExiting]);

  const EXIT_DURATION_MS = 250;
  useEffect(() => {
    if (!isExiting) return;
    const timeoutId = setTimeout(() => setIsExiting(false), EXIT_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [isExiting]);

  const handleTransitionEnd = useCallback((e: React.TransitionEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName === "transform") setIsExiting(false);
  }, []);

  if (isMobile) return null;
  if (!isInboxOpen && !isExiting && !prevOpenRef.current) return null;

  return (
    <div
      className={cn(
        "fixed top-0 bottom-0 z-40 flex w-80 flex-col border-r border-foreground/5 bg-background select-none",
        "transition-[left,opacity] duration-150 ease-out [[data-resizing]_&]:transition-none",
        state === "expanded" ? "left-(--sidebar-width)" : "left-(--sidebar-width-icon)",
        applyExitClass && "opacity-0",
      )}
      onTransitionEnd={handleTransitionEnd}
    >
      <InboxPanelBody onClose={closeInbox} />
    </div>
  );
};
