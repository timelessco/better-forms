import { createContext, useContext } from "react";

/** Carries "Verify email" state between EmailField and the submit call site.
 * Live public form: provider supplies mode "live" + formId; verified tokens collected in
 * `tokens` ride along on createPublicSubmission. No provider (editor canvas, previews,
 * embeds) ⇒ mock mode: no emails sent, the code is surfaced via toast instead. */
export type EmailVerificationStore = {
  mode: "live" | "mock";
  formId: string | null;
  /** fieldName → verified email + token ("mock" in previews). Mutable — read at submit time. */
  tokens: Map<string, { email: string; token: string }>;
};

export const EmailVerificationContext = createContext<EmailVerificationStore | null>(null);

export const useEmailVerificationStore = () => useContext(EmailVerificationContext);
