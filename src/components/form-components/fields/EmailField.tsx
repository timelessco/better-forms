import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { VerifiedIcon } from "@/components/ui/icons";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useEmailVerificationStore } from "@/components/form-components/email-verification-context";
import type { EmailVerificationStore } from "@/components/form-components/email-verification-context";
import { sendEmailOtp, verifyEmailOtp } from "@/lib/server-fn/email-otp";
import { parseError } from "@/lib/errors/parse";
import { fieldLabelId, getAriaLabelFallback, getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalize = (email: string) => email.trim().toLowerCase();

const EmailField = ({ element, form, name }: FieldRendererProps<"Email">) => {
  const fieldName = name ?? element.name;
  const isArrayItem = name !== undefined;
  const ctx = useEmailVerificationStore();
  // No provider (editor canvas / embeds) → standalone mock store.
  const [fallbackStore] = useState<EmailVerificationStore>(() => ({
    mode: "mock",
    formId: null,
    tokens: new Map(),
  }));
  const store = ctx ?? fallbackStore;
  const verifyEnabled = element.verifyEmail === true;

  const inputProps = {
    id: fieldName,
    type: "email",
    placeholder: element.placeholder,
    autoComplete: "email",
    inputMode: "email",
    "aria-label": getAriaLabelFallback(element),
    "aria-labelledby": isArrayItem ? fieldLabelId(element.name) : getAriaLabelledBy(element),
  } as const;

  if (!verifyEnabled) {
    return (
      <form.AppField name={fieldName}>
        {(f) => (
          <>
            <f.Input {...inputProps} className="h-7 form-input pr-[8px] pl-[10px]" />
            <f.FieldError />
          </>
        )}
      </form.AppField>
    );
  }

  return (
    <form.AppField
      name={fieldName}
      validators={{
        // Block step/submit until the entered email is the one that was verified.
        onSubmit: ({ value }) => {
          if (typeof value !== "string" || value.trim() === "") return undefined;
          const entry = store.tokens.get(fieldName);
          return entry && entry.email === normalize(value)
            ? undefined
            : "Please verify your email to continue";
        },
      }}
    >
      {(f) => (
        <>
          <VerifyEmailFlow
            value={(f.state.value as string | undefined) ?? ""}
            fieldName={fieldName}
            store={store}
            input={<f.Input {...inputProps} className="h-7 form-input pr-7 pl-[10px]" />}
          />
          <f.FieldError />
        </>
      )}
    </form.AppField>
  );
};

type FlowStatus = "idle" | "sending" | "sent" | "verifying";

/** OTP flow for a Verify-email field: Enter/blur with a valid email sends the code (live) or
 * toasts it (mock); a code strip fades in below; success collapses it and shows the scalloped
 * verified badge in the input. Editing the email re-arms verification. */
const VerifyEmailFlow = ({
  value,
  fieldName,
  store,
  input,
}: {
  value: string;
  fieldName: string;
  store: EmailVerificationStore;
  input: React.ReactNode;
}) => {
  const [status, setStatus] = useState<FlowStatus>("idle");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const challengeRef = useRef<string | null>(null);
  const mockCodeRef = useRef<string | null>(null);

  const verifiedEntry = store.tokens.get(fieldName);
  const isVerified = !!verifiedEntry && verifiedEntry.email === normalize(value);

  // Email edited away from the verified/sent address → re-arm. setState-during-render
  // (documented React: render aborts + re-renders) keeps the strip in sync without effects.
  if (verifiedEntry && value && verifiedEntry.email !== normalize(value)) {
    store.tokens.delete(fieldName);
  }
  if (status !== "idle" && sentTo && normalize(value) !== sentTo) {
    setStatus("idle");
    setSentTo(null);
    setOtp("");
    setError(null);
  }

  const requestCode = useCallback(
    async (email: string) => {
      const target = normalize(email);
      setStatus("sending");
      setError(null);
      setOtp("");
      try {
        if (store.mode === "live" && store.formId) {
          const { challenge } = await sendEmailOtp({
            data: { formId: store.formId, email: target },
          });
          challengeRef.current = challenge;
        } else {
          const code = Math.floor(100_000 + Math.random() * 900_000).toString();
          mockCodeRef.current = code;
          toast.info(`Your verification code is ${code}`, {
            description: "Preview only — on the live form this code is emailed.",
            duration: 10_000,
          });
        }
        setSentTo(target);
        setStatus("sent");
      } catch (err) {
        setStatus("idle");
        setError(parseError(err).message);
      }
    },
    [store],
  );

  const submitCode = useCallback(
    async (code: string) => {
      if (!sentTo) return;
      setStatus("verifying");
      setError(null);
      try {
        let token = "mock";
        if (store.mode === "live" && store.formId) {
          if (!challengeRef.current) throw new Error("Request a new code");
          ({ verifiedToken: token } = await verifyEmailOtp({
            data: { challenge: challengeRef.current, code },
          }));
        } else if (code !== mockCodeRef.current) {
          throw new Error("That code didn't match — check the toast and try again");
        }
        store.tokens.set(fieldName, { email: sentTo, token });
        setStatus("idle");
        setSentTo(null);
        setOtp("");
      } catch (err) {
        setStatus("sent");
        setOtp("");
        setError(parseError(err).message);
      }
    },
    [store, fieldName, sentTo],
  );

  const maybeSend = useCallback(() => {
    if (isVerified || status === "sending" || status === "verifying") return;
    if (!EMAIL_RE.test(value.trim())) return;
    if (status === "sent" && sentTo === normalize(value)) return; // already pending for this email
    void requestCode(value);
  }, [isVerified, status, sentTo, value, requestCode]);

  const showStrip = status === "sent" || status === "verifying";

  return (
    <div
      role="group"
      aria-label="Email with verification"
      onKeyDown={(e) => {
        // Enter inside the email input requests the code instead of advancing the form.
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT" && !showStrip) {
          if (EMAIL_RE.test(value.trim()) && !isVerified) {
            e.preventDefault();
            e.stopPropagation();
            maybeSend();
          }
        }
      }}
      onBlur={(e) => {
        // Leaving the email input (not moving into the OTP strip) also triggers a send.
        const next = e.relatedTarget as Node | null;
        if (!e.currentTarget.contains(next)) maybeSend();
      }}
    >
      <div className="relative">
        {input}
        {isVerified && (
          <span
            data-testid="email-verified-badge"
            title="Email verified"
            className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 animate-in text-green-600 duration-200 zoom-in-75 fade-in"
          >
            <VerifiedIcon className="size-4" />
          </span>
        )}
      </div>

      {status === "sending" && (
        <p className="mt-1.5 text-xs text-muted-foreground">Sending code…</p>
      )}

      {showStrip && (
        <div className="mt-2 animate-in duration-200 fade-in slide-in-from-top-1">
          <p className="text-xs text-muted-foreground">
            We sent a code to <span className="font-medium">{sentTo}</span>
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={setOtp}
              onComplete={(code: string) => void submitCode(code)}
              disabled={status === "verifying"}
              inputMode="numeric"
              aria-label="Email verification code"
            >
              {/* Separate boxes in the form's canonical field style (form-input drives bg/radius/
                  shadow from the theme tokens) instead of the app's joined-slot look. */}
              <InputOTPGroup className="gap-1.5">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="!size-7 form-input shrink-0 text-sm data-[active=true]:ring-2 data-[active=true]:ring-ring/50"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <button
              type="button"
              onClick={() => sentTo && void requestCode(sentTo)}
              disabled={status === "verifying"}
              className="text-xs text-muted-foreground underline underline-offset-2 enabled:cursor-pointer enabled:hover:text-foreground"
            >
              Resend
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default EmailField;
