import { createError } from "@/lib/errors/create";
import type { ErrorCode } from "@/lib/errors/codes";
import { requireVercelProjectId, vercel, vercelTeamId } from "@/integrations/vercel";

export interface VercelDomainVerification {
  type: string;
  domain: string;
  value: string;
}

export interface VercelDomainStatus {
  verified: boolean;
  verification?: VercelDomainVerification[];
}

const NOT_FOUND_RE = /not.?found|404/i;

// VercelError exposes the raw body as a string — Vercel's Content-Type isn't
// always JSON, so the SDK doesn't auto-parse.
type ParsedErrorBody = {
  error?: { message?: string; verification?: VercelDomainVerification[] };
};

const parseErrorBody = (error: unknown): ParsedErrorBody | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const body = (error as { body?: unknown }).body;
  if (typeof body !== "string" || body.length === 0) return undefined;
  try {
    return JSON.parse(body) as ParsedErrorBody;
  } catch {
    return undefined;
  }
};

const extractVerificationFromError = (error: unknown): VercelDomainVerification[] | undefined => {
  const verification = parseErrorBody(error)?.error?.verification;
  return Array.isArray(verification) ? verification : undefined;
};

const errorMessage = (error: unknown, fallback: string): string => {
  const message = parseErrorBody(error)?.error?.message;
  if (message) return message;
  if (error instanceof Error) return error.message;
  return fallback;
};

export const vercelDomains = {
  async add(domain: string): Promise<VercelDomainStatus & { domain: string }> {
    try {
      const value = await vercel.projects.addProjectDomain({
        idOrName: requireVercelProjectId(),
        teamId: vercelTeamId(),
        requestBody: { name: domain },
      });
      return {
        domain: value.name ?? domain,
        verified: value.verified ?? false,
        verification: value.verification,
      };
    } catch (error) {
      // When domain is already on another team, Vercel returns the challenge
      // inline — surface it (don't throw) so UI can show TXT _vercel steps.
      const verification = extractVerificationFromError(error);
      if (verification?.length) {
        return { domain, verified: false, verification };
      }
      throw createError({
        code: "vercel/domain-add-failed" satisfies ErrorCode,
        status: 502,
        message: errorMessage(error, "Failed to add domain to Vercel"),
        why: "Upstream Vercel API rejected the addProjectDomain call",
        fix: "Retry shortly; if it persists, check Vercel project state",
        cause: error instanceof Error ? error : undefined,
        internal: { domain },
      });
    }
  },

  async check(domain: string): Promise<VercelDomainStatus> {
    try {
      const value = await vercel.projects.getProjectDomain({
        idOrName: requireVercelProjectId(),
        teamId: vercelTeamId(),
        domain,
      });
      return {
        verified: value.verified ?? false,
        verification: value.verification,
      };
    } catch (error) {
      throw createError({
        code: "vercel/domain-check-failed" satisfies ErrorCode,
        status: 502,
        message: errorMessage(error, "Failed to check domain status"),
        why: "Upstream Vercel API rejected the getProjectDomain call",
        fix: "Retry shortly; if it persists, check Vercel project state",
        cause: error instanceof Error ? error : undefined,
        internal: { domain },
      });
    }
  },

  async verify(domain: string): Promise<VercelDomainStatus> {
    try {
      const value = await vercel.projects.verifyProjectDomain({
        idOrName: requireVercelProjectId(),
        teamId: vercelTeamId(),
        domain,
      });
      // verify only reports `verified`; for the TXT challenge fall back to check().
      return { verified: value.verified ?? false };
    } catch (error) {
      throw createError({
        code: "vercel/domain-verify-failed" satisfies ErrorCode,
        status: 502,
        message: errorMessage(error, "Failed to verify domain"),
        why: "Upstream Vercel API rejected the verifyProjectDomain call",
        fix: "Retry shortly; if it persists, check DNS records",
        cause: error instanceof Error ? error : undefined,
        internal: { domain },
      });
    }
  },

  /** Project-level detach only — domain stops resolving here but stays on the
   * team, so re-add (e.g. re-upgrade) skips re-verification. For downgrade/suspend. */
  async detach(domain: string): Promise<void> {
    try {
      await vercel.projects.removeProjectDomain({
        idOrName: requireVercelProjectId(),
        teamId: vercelTeamId(),
        domain,
      });
    } catch (error) {
      // SDK exposes no status code on errors; tolerate "not found" by message.
      const message = errorMessage(error, "Failed to detach domain from project");
      if (NOT_FOUND_RE.test(message)) return;
      throw createError({
        code: "vercel/domain-detach-failed" satisfies ErrorCode,
        status: 502,
        message,
        why: "Upstream Vercel API rejected the removeProjectDomain call",
        fix: "Retry shortly; verify the domain still exists on the project",
        cause: error instanceof Error ? error : undefined,
        internal: { domain },
      });
    }
  },

  /** Full removal: project-detach + account-level delete. For permanent offboarding. */
  async remove(domain: string): Promise<void> {
    await this.detach(domain);
    try {
      await vercel.domains.deleteDomain({
        domain,
        teamId: vercelTeamId(),
      });
    } catch (error) {
      const message = errorMessage(error, "Failed to delete domain from account");
      if (NOT_FOUND_RE.test(message)) return;
      throw createError({
        code: "vercel/domain-delete-failed" satisfies ErrorCode,
        status: 502,
        message,
        why: "Upstream Vercel API rejected the deleteDomain call",
        fix: "Retry shortly; verify the domain still exists in the team",
        cause: error instanceof Error ? error : undefined,
        internal: { domain },
      });
    }
  },
};
