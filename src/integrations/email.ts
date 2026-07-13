import "@tanstack/react-start/server-only";
import { Resend } from "resend";
import { APP_NAME } from "@/lib/config/app-config";
import { logger } from "@/lib/utils";

// Lazy singleton: the Resend constructor throws on a missing key, so building it at module load
// would crash every test suite that transitively imports this file in a keyless env (CI). Defer
// until an email is actually sent.
let resendClient: Resend | null = null;
const resend = () => (resendClient ??= new Resend(process.env.RESEND_API_KEY));
const FROM_EMAIL = `${APP_NAME} <noreply@share.recollect.so>`;

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Shared inline-styled shell for every transactional email. `bodyHtml` is trusted markup built by
// the caller; interpolate user-controlled values through escapeHtml before passing them in.
const emailLayout = ({ bodyHtml, footer }: { bodyHtml: string; footer: string }): string => `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				${bodyHtml}
				<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
				<p style="font-size: 12px; color: #999;">${footer}</p>
			</div>
		`;

// Centralizes the FROM address + error logging. Pass `throwOnError` for flows (OTP) that must
// surface send failures instead of firing and forgetting.
const sendEmail = async ({
  to,
  subject,
  html,
  errorLog,
  throwOnError,
}: {
  to: string;
  subject: string;
  html: string;
  errorLog: string;
  throwOnError?: boolean;
}) => {
  const { error } = await resend().emails.send({ from: FROM_EMAIL, to, subject, html });
  if (error) {
    logger(errorLog, error);
    if (throwOnError) throw new Error("Failed to send verification email");
  }
};

export const sendMagicLinkEmail = async (email: string, url: string) => {
  await sendEmail({
    to: email,
    subject: `Sign in to ${APP_NAME}`,
    errorLog: "[Email] Failed to send magic link:",
    html: emailLayout({
      bodyHtml: `
				<h2 style="color: #333;">Sign in to ${APP_NAME}</h2>
				<p style="font-size: 16px; color: #555;">Click the button below to sign in:</p>
				<p style="margin: 24px 0;">
					<a href="${url}" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Sign in</a>
				</p>
				<p style="font-size: 14px; color: #888;">This link expires in 5 minutes.</p>
				<p style="font-size: 14px; color: #888;">Or copy this link:</p>
				<p style="font-size: 14px; color: #0066cc; word-break: break-all;">${url}</p>
			`,
      footer: "If you didn't request this link, you can safely ignore this email.",
    }),
  });
};

export const sendOrgInvitationEmail = async (
  email: string,
  orgName: string,
  inviterName: string,
  inviteLink: string,
) => {
  await sendEmail({
    to: email,
    subject: `You're invited to join ${orgName}`,
    errorLog: "[Email] Failed to send invitation:",
    html: emailLayout({
      bodyHtml: `
				<h2 style="color: #333;">You're invited!</h2>
				<p style="font-size: 16px; color: #555;">
					<strong>${escapeHtml(inviterName)}</strong> has invited you to join <strong>${escapeHtml(orgName)}</strong> on ${APP_NAME}.
				</p>
				<p style="font-size: 16px; color: #555; margin-top: 24px;">
					<a href="${inviteLink}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 16px;">Accept Invitation</a>
				</p>
				<p style="font-size: 14px; color: #666; margin-top: 16px;">Or copy this link:</p>
				<p style="font-size: 14px; color: #0066cc; word-break: break-all;">${inviteLink}</p>
			`,
      footer: "If you weren't expecting this invitation, you can safely ignore this email.",
    }),
  });
};

export const sendFormSubmissionNotification = async (
  to: string,
  formTitle: string,
  submissionId: string,
  data: Record<string, unknown>,
) => {
  const rows = Object.entries(data)
    .map(([key, value]) => {
      let displayValue = value;
      if (typeof value === "object" && value !== null) {
        displayValue = JSON.stringify(value);
      }
      return `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: 500; color: #333;">${escapeHtml(key)}</td><td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #555;">${escapeHtml(String(displayValue ?? ""))}</td></tr>`;
    })
    .join("");

  await sendEmail({
    to,
    subject: `New submission: ${formTitle}`,
    errorLog: "[Email] Failed to send submission notification:",
    html: emailLayout({
      bodyHtml: `
        <h2 style="color: #333;">New form submission</h2>
        <p style="font-size: 16px; color: #555;">
          You received a new response for <strong>${escapeHtml(formTitle)}</strong>.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          ${rows}
        </table>
        <p style="font-size: 12px; color: #999;">Submission ID: ${submissionId}</p>
      `,
      footer: "You're receiving this because you enabled email notifications for this form.",
    }),
  });
};

export const sendRespondentConfirmation = async (to: string, subject: string, body: string) => {
  await sendEmail({
    to,
    subject,
    errorLog: "[Email] Failed to send respondent confirmation:",
    html: emailLayout({
      bodyHtml: `
        <p style="font-size: 16px; color: #333; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(body)}</p>
      `,
      footer: `This email was sent via ${APP_NAME}.`,
    }),
  });
};

/** OTP for the public-form "Verify email" field. Throws on send failure so the
 * caller can surface it (unlike fire-and-forget notification mails). */
export const sendEmailVerificationCode = async (to: string, code: string, formTitle: string) => {
  await sendEmail({
    to,
    subject: `${code} is your verification code`,
    errorLog: "[Email] Failed to send verification code:",
    throwOnError: true,
    html: emailLayout({
      bodyHtml: `
        <h2 style="color: #333;">Verify your email</h2>
        <p style="font-size: 16px; color: #555;">
          Use this code to verify your email for <strong>${escapeHtml(formTitle)}</strong>:
        </p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111; margin: 24px 0;">${code}</p>
        <p style="font-size: 14px; color: #888;">This code expires in 10 minutes.</p>
      `,
      footer: "If you didn't request this code, you can safely ignore this email.",
    }),
  });
};

export const sendChangeEmailConfirmationEmail = async (
  email: string,
  newEmail: string,
  url: string,
) => {
  await sendEmail({
    to: email,
    subject: `Confirm your email change`,
    errorLog: "[Email] Failed to send change email confirmation:",
    html: emailLayout({
      bodyHtml: `
        <h2 style="color: #333;">Confirm your email change</h2>
        <p style="font-size: 16px; color: #555;">
          You requested to change your email to <strong>${escapeHtml(newEmail)}</strong>.
        </p>
        <p style="font-size: 16px; color: #555; margin-top: 24px;">
          <a href="${url}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Confirm Email Change</a>
        </p>
        <p style="font-size: 14px; color: #666; margin-top: 16px;">Or copy this link:</p>
        <p style="font-size: 14px; color: #0066cc; word-break: break-all;">${url}</p>
      `,
      footer: "If you didn't request this change, you can safely ignore this email.",
    }),
  });
};
