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

// VercelError exposes the raw HTTP body as a string (Content-Type from the
// Vercel API isn't always application/json, so the SDK doesn't auto-parse).
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
      // Vercel returns the verification challenge inline when a domain is
      // already attached to another team — surface it instead of throwing so
      // the UI can render TXT _vercel instructions.
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
      // The verify endpoint only reports verified; callers needing the TXT
      // challenge should fall back to check().
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

  /**
   * Project-level disassociation only. The domain stops resolving on this
   * project but remains on the team, so a later re-add (e.g. plan re-upgrade)
   * skips re-verification. Use for downgrade/suspend flows.
   */
  async detach(domain: string): Promise<void> {
    try {
      await vercel.projects.removeProjectDomain({
        idOrName: requireVercelProjectId(),
        teamId: vercelTeamId(),
        domain,
      });
    } catch (error) {
      // The SDK doesn't expose a status code on errors directly; tolerate
      // "not found" by message inspection.
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

  /**
   * Full removal: project-detach + account-level delete. Use for permanent
   * tenant offboarding.
   */
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
