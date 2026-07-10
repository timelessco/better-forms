import {
  clearAllReadSubmissionNotifications,
  clearSubmissionNotification,
  getSubmissionNotificationsQueryOptions,
  markSubmissionNotificationRead,
} from "@/lib/server-fn/notifications";
import type { SerializedSubmissionNotification } from "@/lib/server-fn/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { parseError } from "@/lib/errors/parse";
import { safeStorage } from "@/lib/safe-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const LEADER_KEY = "bf-submission-notification-leader";
const POPUP_STATE_PREFIX = "bf-submission-notification-popup";
const LEADER_TTL_MS = 25_000;
const LEADER_HEARTBEAT_MS = 10_000;
const POPUP_COALESCE_MS = 60_000;
const VISIBLE_POLL_INTERVAL_MS = 30_000;
const HIDDEN_POLL_INTERVAL_MS = 300_000;

type HookOptions = {
  poll?: boolean;
};

type LeaderState = {
  tabId: string;
  expiresAt: number;
};

type PopupState = {
  latestSubmissionId: string;
  shownAt: number;
};

const getPollInterval = () => {
  if (typeof document === "undefined") {
    return VISIBLE_POLL_INTERVAL_MS;
  }

  return document.visibilityState === "visible"
    ? VISIBLE_POLL_INTERVAL_MS
    : HIDDEN_POLL_INTERVAL_MS;
};

const claimLeader = (tabId: string) => {
  const now = Date.now();
  const current = safeStorage.getJson<LeaderState>(LEADER_KEY);

  if (!current || current.tabId === tabId || current.expiresAt <= now) {
    safeStorage.setJson(LEADER_KEY, { tabId, expiresAt: now + LEADER_TTL_MS });
    return true;
  }

  return false;
};

const releaseLeader = (tabId: string) => {
  const current = safeStorage.getJson<LeaderState>(LEADER_KEY);
  if (current?.tabId === tabId && typeof window !== "undefined") {
    safeStorage.remove(LEADER_KEY);
  }
};

const shouldShowPopup = (formId: string, latestSubmissionId: string) => {
  const key = `${POPUP_STATE_PREFIX}:${formId}`;
  const current = safeStorage.getJson<PopupState>(key);
  const now = Date.now();

  if (current?.latestSubmissionId === latestSubmissionId) {
    return false;
  }

  if (current && now - current.shownAt < POPUP_COALESCE_MS) {
    return false;
  }

  safeStorage.setJson(key, { latestSubmissionId, shownAt: now });
  return true;
};

export const useSubmissionNotifications = ({ poll = false }: HookOptions = {}) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const tabIdRef = useRef<string>(crypto.randomUUID());
  const hasSeededNotificationsRef = useRef(false);
  const previousNotificationsRef = useRef<Map<string, SerializedSubmissionNotification>>(new Map());
  const [isLeader, setIsLeader] = useState(false);

  useEffect(() => {
    if (!poll || typeof window === "undefined") {
      return;
    }

    const tabId = tabIdRef.current;
    const updateLeader = () =>
      setIsLeader((prev) => {
        const next = claimLeader(tabId);
        return prev === next ? prev : next;
      });

    updateLeader();

    const heartbeatId = window.setInterval(updateLeader, LEADER_HEARTBEAT_MS);
    const handleStorage = () => updateLeader();

    window.addEventListener("storage", handleStorage);

    return () => {
      window.clearInterval(heartbeatId);
      window.removeEventListener("storage", handleStorage);
      releaseLeader(tabId);
    };
  }, [poll]);

  const notificationsQuery = useQuery({
    ...getSubmissionNotificationsQueryOptions(),
    refetchInterval: poll ? () => getPollInterval() : false,
    refetchIntervalInBackground: poll,
    refetchOnWindowFocus: poll,
  });

  const invalidateNotifications = async () => {
    await queryClient.invalidateQueries({ queryKey: ["submission-notifications"] });
  };

  const {
    mutateAsync: markRead,
    isPending: isMarkReadPending,
    variables: markReadVariables,
  } = useMutation({
    mutationFn: async (formId: string) => markSubmissionNotificationRead({ data: { formId } }),
    onSuccess: invalidateNotifications,
    onError: (error) => {
      const message = parseError(error).message || "Failed to mark notification read";
      toast.error(message);
    },
  });

  const clearNotificationMutation = useMutation({
    mutationFn: async (formId: string) => clearSubmissionNotification({ data: { formId } }),
    onSuccess: invalidateNotifications,
    onError: (error) => {
      const message = parseError(error).message || "Failed to clear notification";
      toast.error(message);
    },
  });

  const clearAllReadMutation = useMutation({
    mutationFn: async () => clearAllReadSubmissionNotifications(),
    onSuccess: invalidateNotifications,
    onError: (error) => {
      const message = parseError(error).message || "Failed to clear read notifications";
      toast.error(message);
    },
  });

  const openNotification = useCallback(
    async (notification: SerializedSubmissionNotification) => {
      await markRead(notification.formId);
      await router.navigate({
        to: "/workspace/$workspaceId/form-builder/$formId/submissions",
        params: {
          workspaceId: notification.workspaceId,
          formId: notification.formId,
        },
      });
    },
    [markRead, router],
  );

  useEffect(() => {
    if (notificationsQuery.data === undefined) {
      return;
    }

    const notifications = notificationsQuery.data ?? [];
    const nextById = new Map(notifications.map((notification) => [notification.id, notification]));

    if (!hasSeededNotificationsRef.current) {
      previousNotificationsRef.current = nextById;
      hasSeededNotificationsRef.current = true;
      return;
    }

    if (
      !poll ||
      !isLeader ||
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
      previousNotificationsRef.current = nextById;
      return;
    }

    for (const notification of notifications) {
      if (
        notification.isRead ||
        notification.unreadCount === 0 ||
        !notification.latestSubmissionId
      ) {
        continue;
      }

      const previous = previousNotificationsRef.current.get(notification.id);
      const hasChanged =
        previous?.latestSubmissionId !== notification.latestSubmissionId ||
        previous?.unreadCount !== notification.unreadCount ||
        previous?.isRead !== notification.isRead;

      if (!hasChanged || !shouldShowPopup(notification.formId, notification.latestSubmissionId)) {
        continue;
      }

      const popup = new Notification(notification.formTitle, {
        body:
          notification.unreadCount === 1
            ? "1 new submission"
            : `${notification.unreadCount} new submissions`,
        tag: `submission:${notification.formId}`,
      });

      popup.addEventListener("click", () => {
        popup.close();
        window.focus();
        void openNotification(notification);
      });
    }

    previousNotificationsRef.current = nextById;
  }, [isLeader, notificationsQuery.data, openNotification, poll]);

  const notifications = notificationsQuery.data ?? [];

  const unreadSubmissionCount = notifications.reduce(
    (total, notification) => total + notification.unreadCount,
    0,
  );

  const readNotificationCount = notifications.filter((notification) => notification.isRead).length;

  return {
    notifications,
    unreadSubmissionCount,
    readNotificationCount,
    isLoading: notificationsQuery.isLoading,
    isFetching: notificationsQuery.isFetching,
    refetch: notificationsQuery.refetch,
    markNotificationRead: markRead,
    clearNotification: clearNotificationMutation.mutateAsync,
    clearAllReadNotifications: clearAllReadMutation.mutateAsync,
    openNotification,
    isClearingAllRead: clearAllReadMutation.isPending,
    clearingFormId: clearNotificationMutation.isPending
      ? clearNotificationMutation.variables
      : null,
    readingFormId: isMarkReadPending ? markReadVariables : null,
  };
};
