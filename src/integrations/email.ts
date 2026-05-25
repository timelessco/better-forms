import { Resend } from "resend";
import { APP_NAME } from "@/lib/config/app-config";
import { logger } from "@/lib/utils";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = `${APP_NAME} <noreply@share.recollect.so>`;

export const sendMagicLinkEmail = async (email: string, url: string) => {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Sign in to ${APP_NAME}`,
    html: `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h2 style="color: #333;">Sign in to ${APP_NAME}</h2>
				<p style="font-size: 16px; color: #555;">Click the button below to sign in:</p>
				<p style="margin: 24px 0;">
					<a href="${url}" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Sign in</a>
				</p>
				<p style="font-size: 14px; color: #888;">This link expires in 5 minutes.</p>
				<p style="font-size: 14px; color: #888;">Or copy this link:</p>
				<p style="font-size: 14px; color: #0066cc; word-break: break-all;">${url}</p>
				<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
				<p style="font-size: 12px; color: #999;">If you didn't request this link, you can safely ignore this email.</p>
			</div>
		`,
  });

  if (error) {
    logger("[Email] Failed to send magic link:", error);
  }
};

export const sendOrgInvitationEmail = async (
  email: string,
  orgName: string,
  inviterName: string,
  inviteLink: string,
) => {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `You're invited to join ${orgName}`,
    html: `
			<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
				<h2 style="color: #333;">You're invited!</h2>
				<p style="font-size: 16px; color: #555;">
					<strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on ${APP_NAME}.
				</p>
				<p style="font-size: 16px; color: #555; margin-top: 24px;">
					<a href="${inviteLink}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 16px;">Accept Invitation</a>
				</p>
				<p style="font-size: 14px; color: #666; margin-top: 16px;">Or copy this link:</p>
				<p style="font-size: 14px; color: #0066cc; word-break: break-all;">${inviteLink}</p>
				<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
				<p style="font-size: 12px; color: #999;">If you weren't expecting this invitation, you can safely ignore this email.</p>
			</div>
		`,
  });

  if (error) {
    logger("[Email] Failed to send invitation:", error);
  }
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

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `New submission: ${formTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New form submission</h2>
        <p style="font-size: 16px; color: #555;">
          You received a new response for <strong>${escapeHtml(formTitle)}</strong>.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          ${rows}
        </table>
        <p style="font-size: 12px; color: #999;">Submission ID: ${submissionId}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #999;">You're receiving this because you enabled email notifications for this form.</p>
      </div>
    `,
  });

  if (error) {
    logger("[Email] Failed to send submission notification:", error);
  }
};

export const sendRespondentConfirmation = async (to: string, subject: string, body: string) => {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <p style="font-size: 16px; color: #333; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(body)}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #999;">This email was sent via ${APP_NAME}.</p>
      </div>
    `,
  });

  if (error) {
    logger("[Email] Failed to send respondent confirmation:", error);
  }
};

export const sendChangeEmailConfirmationEmail = async (
  email: string,
  newEmail: string,
  url: string,
) => {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Confirm your email change`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Confirm your email change</h2>
        <p style="font-size: 16px; color: #555;">
          You requested to change your email to <strong>${escapeHtml(newEmail)}</strong>.
        </p>
        <p style="font-size: 16px; color: #555; margin-top: 24px;">
          <a href="${url}" style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Confirm Email Change</a>
        </p>
        <p style="font-size: 14px; color: #666; margin-top: 16px;">Or copy this link:</p>
        <p style="font-size: 14px; color: #0066cc; word-break: break-all;">${url}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #999;">If you didn't request this change, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    logger("[Email] Failed to send change email confirmation:", error);
  }
};

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
