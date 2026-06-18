import { Switch } from "@/components/ui/switch";
import { useCallback, useState } from "react";
import { toast } from "sonner";

const PRODUCT_UPDATES_KEY = "reform:notif:product-updates";
const BROWSER_KEY = "reform:notif:browser";

type Permission = NotificationPermission | "unsupported";

const readPermission = (): Permission =>
  typeof window !== "undefined" && "Notification" in window
    ? Notification.permission
    : "unsupported";

const readProductUpdates = () =>
  typeof window !== "undefined" && localStorage.getItem(PRODUCT_UPDATES_KEY) === "true";

// Local on/off preference layered over the browser permission: the permission is a capability
// (can't be revoked from JS), this preference is whether the app uses it. Defaults on when
// permission is already granted.
const readBrowserPref = () => {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(BROWSER_KEY);
  return stored === null ? readPermission() === "granted" : stored === "true";
};

// One Figma cell-primitive row (node 26146-13632): title + description + trailing switch.
const NotificationRow = ({
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (next: boolean) => void;
}) => (
  <div className="flex w-full items-center gap-5">
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <p className="text-base leading-[1.15] font-medium text-foreground">{title}</p>
      <p className="text-base leading-[1.5] tracking-[0.28px] text-muted-foreground">
        {description}
      </p>
    </div>
    <Switch
      size="lg"
      aria-label={title}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    />
  </div>
);

export const NotificationsContent = () => {
  // Lazy init keeps this SSR-safe (no Notification API on the server).
  const [permission, setPermission] = useState<Permission>(readPermission);
  const [browserPref, setBrowserPref] = useState(readBrowserPref);
  const [productUpdates, setProductUpdates] = useState(readProductUpdates);

  const handleProductUpdates = useCallback((next: boolean) => {
    setProductUpdates(next);
    localStorage.setItem(PRODUCT_UPDATES_KEY, String(next));
  }, []);

  const handleBrowserNotifications = useCallback(
    async (next: boolean) => {
      // Off = just stop using the permission (browsers can't revoke it from JS).
      if (!next) {
        setBrowserPref(false);
        localStorage.setItem(BROWSER_KEY, "false");
        return;
      }
      if (permission === "unsupported") {
        toast.error("Your browser doesn't support notifications.");
        return;
      }
      if (permission === "denied") {
        toast.error("Notifications are blocked. Enable them in your browser's site settings.");
        return;
      }
      // Request only when not yet decided; if already granted, just flip the preference on.
      const result = permission === "granted" ? "granted" : await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        setBrowserPref(true);
        localStorage.setItem(BROWSER_KEY, "true");
        toast.success("Browser notifications enabled.");
        new Notification("Reform", { body: "Browser notifications are now on." });
      } else if (result === "denied") {
        toast.error("Notifications were blocked.");
      }
    },
    [permission],
  );

  return (
    <div className="flex flex-col gap-6">
      <NotificationRow
        title="Product updates"
        description="Receive email updates about new features, improvements, and how to get the most out of Reform."
        checked={productUpdates}
        onCheckedChange={handleProductUpdates}
      />
      <NotificationRow
        title="Browser notifications"
        description="Get notified in your browser about new responses and important activity on your forms."
        checked={browserPref && permission === "granted"}
        disabled={permission === "unsupported"}
        onCheckedChange={handleBrowserNotifications}
      />
    </div>
  );
};
