import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2Icon,
  ClockIcon,
  GlobeIcon,
  Loader2Icon,
  RefreshCwIcon,
  SettingsIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
  AlertCircleIcon,
} from "@/components/ui/icons";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { InputGroup, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth/auth-client";
import { DOMAIN_LIMITS } from "@/lib/config/plan-config";
import { getDnsInstructions } from "@/lib/dns-instructions";
import {
  addDomain,
  orgDomainsQueryOptions,
  recheckDomainStatus,
  removeDomain,
  updateDomainMeta,
} from "@/lib/server-fn/custom-domains";
import { uploadEditorMedia } from "@/lib/server-fn/uploads";

type DomainStatus = "pending" | "verified" | "failed";

type Domain = {
  id: string;
  domain: string;
  status: DomainStatus;
  organizationId: string;
  vercelDomainId: string | null;
  siteTitle: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

const MAX_DOMAINS = DOMAIN_LIMITS.maxDomainsPerOrg;

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Failed to read file"));
      }
    });
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("Failed to read file")),
    );
    reader.readAsDataURL(file);
  });

const StatusBadge = ({ status }: { status: DomainStatus }) => {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          <ClockIcon className="mr-1 size-3" />
          Pending
        </Badge>
      );
    case "verified":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle2Icon className="mr-1 size-3" />
          Verified
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <AlertCircleIcon className="mr-1 size-3" />
          Failed
        </Badge>
      );
  }
};

export const DomainsContent = () => {
  const queryClient = useQueryClient();
  const { data: session, isPending: isSessionPending } = useSession();
  const domainInputId = useId();
  const siteTitleInputId = useId();

  const [newDomain, setNewDomain] = useState("");
  // Per-domain DNS records (TXT challenge if any + CNAME for routing).
  // Populated from addDomain / checkDomainStatus / recheckDomainStatus.
  // Keyed by domain.id so each card renders its own records inline.
  const [dnsRecordsByDomainId, setDnsRecordsByDomainId] = useState<
    Record<string, ReturnType<typeof getDnsInstructions>>
  >({});
  const clearDnsRecords = useCallback((id: string) => {
    setDnsRecordsByDomainId((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedConfigId, setExpandedConfigId] = useState<string | null>(null);
  const [siteTitle, setSiteTitle] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const [isUploadingOg, setIsUploadingOg] = useState(false);

  const faviconInputRef = useRef<HTMLInputElement>(null);
  const ogInputRef = useRef<HTMLInputElement>(null);
  const cancelDeleteButtonRef = useRef<HTMLButtonElement>(null);

  // Move focus to Cancel when entering confirm-delete state. Without this the
  // trash button (where focus was) gets unmounted and focus falls back to body —
  // keyboard users have to tab from the top to reach the confirm controls.
  useEffect(() => {
    if (confirmDeleteId) {
      cancelDeleteButtonRef.current?.focus();
    }
  }, [confirmDeleteId]);

  const handleCancelDelete = useCallback(() => {
    const cancelledId = confirmDeleteId;
    setConfirmDeleteId(null);
    if (!cancelledId) return;
    // The trash button re-mounts after state flips; restore focus to it so
    // tab order continues from where the user invoked the confirm.
    requestAnimationFrame(() => {
      const trashBtn = document.querySelector<HTMLButtonElement>(
        `[data-trash-for="${cancelledId}"]`,
      );
      trashBtn?.focus();
    });
  }, [confirmDeleteId]);

  const orgId = session?.session?.activeOrganizationId as string | undefined;

  const { data: membersData } = useQuery({
    queryKey: ["org-members-for-domains"],
    queryFn: async () => {
      const { authClient } = await import("@/lib/auth/auth-client");
      const result = await authClient.organization.listMembers();
      return result.data;
    },
    enabled: !!orgId,
  });

  const isOwner = useMemo(() => {
    if (!membersData?.members || !session?.user?.id) return false;
    const currentMember = membersData.members.find(
      (m: { userId: string; role: string }) => m.userId === session.user.id,
    );
    return currentMember?.role === "owner";
  }, [membersData, session?.user?.id]);

  const { data: domains = [], isLoading: isLoadingDomains } = useQuery({
    ...orgDomainsQueryOptions(orgId ?? ""),
    enabled: !!orgId,
  });

  const domainCount = domains.length;

  const addMutation = useMutation({
    mutationFn: (domain: string) => addDomain({ data: { orgId: orgId ?? "", domain } }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["org-domains", orgId] });
      setNewDomain("");
      const records = getDnsInstructions(result.domain, result.verification);
      setDnsRecordsByDomainId((prev) => ({ ...prev, [result.id]: records }));
      if (result.warning) {
        toast.error(result.warning);
      } else {
        toast.success("Domain added successfully");
      }
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to add domain");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (domainId: string) => removeDomain({ data: { domainId } }),
    onSuccess: (_data, domainId) => {
      queryClient.invalidateQueries({ queryKey: ["org-domains", orgId] });
      setConfirmDeleteId(null);
      clearDnsRecords(domainId);
      toast.success("Domain removed");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to remove domain");
    },
  });

  const handleStatusResult = useCallback(
    (result: {
      id: string;
      domain: string;
      status: string;
      verification?: { type: string; domain: string; value: string }[];
    }) => {
      queryClient.invalidateQueries({ queryKey: ["org-domains", orgId] });
      if (result.status === "verified") {
        clearDnsRecords(result.id);
        toast.success("Domain verified!");
        return;
      }
      const records = getDnsInstructions(result.domain, result.verification);
      setDnsRecordsByDomainId((prev) => ({ ...prev, [result.id]: records }));
      if (result.status === "failed") {
        toast.error("Domain verification failed. Check your DNS records.");
      } else {
        toast("Domain is still pending verification. DNS changes can take up to 48 hours.");
      }
    },
    [orgId, queryClient, clearDnsRecords],
  );

  const recheckMutation = useMutation({
    mutationFn: (domainId: string) => recheckDomainStatus({ data: { domainId } }),
    onSuccess: handleStatusResult,
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to verify domain");
    },
  });

  const updateMetaMutation = useMutation({
    mutationFn: (data: {
      domainId: string;
      siteTitle?: string;
      faviconUrl?: string;
      ogImageUrl?: string;
    }) => updateDomainMeta({ data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["org-domains", orgId] });
      // Don't close the panel — fields save inline (like account-settings),
      // user keeps the panel open while iterating.
      toast.success("Saved");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to save domain settings");
    },
  });

  const handleAddDomain = useCallback(() => {
    const trimmed = newDomain.trim();
    if (!trimmed) return;
    addMutation.mutate(trimmed);
  }, [newDomain, addMutation]);

  const handleDomainInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setNewDomain(e.target.value),
    [],
  );

  const handleDomainInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleAddDomain();
    },
    [handleAddDomain],
  );

  const handleOpenConfig = useCallback((domain: Domain) => {
    setExpandedConfigId(domain.id);
    setSiteTitle(domain.siteTitle ?? "");
    setFaviconUrl(domain.faviconUrl ?? "");
    setOgImageUrl(domain.ogImageUrl ?? "");
  }, []);

  const handleSaveSiteTitle = useCallback(
    (domainId: string) => {
      updateMetaMutation.mutate({ domainId, siteTitle: siteTitle || undefined });
    },
    [siteTitle, updateMetaMutation],
  );

  const handleSiteTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSiteTitle(e.target.value),
    [],
  );

  const uploadFile = useCallback(
    async (file: File, type: "favicon" | "og", domainId: string) => {
      const setUploading = type === "favicon" ? setIsUploadingFavicon : setIsUploadingOg;
      const setUrl = type === "favicon" ? setFaviconUrl : setOgImageUrl;
      const metaField = type === "favicon" ? "faviconUrl" : "ogImageUrl";

      setUploading(true);
      try {
        const base64 = await fileToBase64(file);
        const result = await uploadEditorMedia({
          data: {
            base64,
            filename: `domain-${type}-${Date.now()}-${file.name}`,
            contentType: file.type || "image/png",
          },
        });
        setUrl(result.url);
        // Auto-commit the new URL to the domain row so the user doesn't need a
        // second "Save" click. Mirrors the inline-save pattern in account-settings.
        updateMetaMutation.mutate({ domainId, [metaField]: result.url });
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : `Failed to upload ${type === "favicon" ? "favicon" : "OG image"}`,
        );
      } finally {
        setUploading(false);
      }
    },
    [updateMetaMutation],
  );

  const handleFaviconChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && expandedConfigId) uploadFile(file, "favicon", expandedConfigId);
    },
    [uploadFile, expandedConfigId],
  );

  const handleOgChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && expandedConfigId) uploadFile(file, "og", expandedConfigId);
    },
    [uploadFile, expandedConfigId],
  );

  const handleFaviconButtonClick = useCallback(() => faviconInputRef.current?.click(), []);
  const handleOgButtonClick = useCallback(() => ogInputRef.current?.click(), []);
  const handleCloseConfig = useCallback(() => setExpandedConfigId(null), []);

  if (isSessionPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isOwner && !isSessionPending) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <GlobeIcon className="mx-auto mb-3 size-8 opacity-50" />
        <p>Only the organization owner can manage domains.</p>
      </div>
    );
  }

  const trimmedDomain = newDomain.trim();
  const canAddDomain = trimmedDomain.length > 0 && domainCount < MAX_DOMAINS;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label
            className="text-base tracking-[0.28px] text-muted-foreground"
            htmlFor={domainInputId}
          >
            Add a custom domain
          </label>
          <span className="text-xs text-muted-foreground">
            {domainCount} of {MAX_DOMAINS} domains used
          </span>
        </div>
        <InputGroup
          variant="borderless"
          className={cn(
            "h-[30px] overflow-clip border-0 bg-secondary ring-0",
            canAddDomain && "pr-[3px]",
          )}
        >
          <InputGroupInput
            id={domainInputId}
            placeholder="forms.acme.com"
            value={newDomain}
            onChange={handleDomainInputChange}
            onKeyDown={handleDomainInputKeyDown}
            disabled={domainCount >= MAX_DOMAINS || addMutation.isPending}
            variant="secondary"
          />
          {canAddDomain && (
            <InputGroupButton
              variant="default"
              onClick={handleAddDomain}
              disabled={addMutation.isPending}
              className="h-[24px] w-[47px] rounded-lg bg-gray-50 px-3 text-sm text-gray-800 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-gray-200"
            >
              {addMutation.isPending ? <Loader2Icon className="size-3 animate-spin" /> : "Add"}
            </InputGroupButton>
          )}
        </InputGroup>
      </div>

      {isLoadingDomains ? (
        <div className="flex items-center justify-center py-8">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : domains.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          <GlobeIcon className="mx-auto mb-3 size-8 opacity-50" />
          <p>No custom domains yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(domains as Domain[]).map((domain) => {
            const isConfirmingDelete = confirmDeleteId === domain.id;
            const isConfiguring = expandedConfigId === domain.id;
            return (
              <div key={domain.id} className="rounded-xl border">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <GlobeIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{domain.domain}</span>
                    <StatusBadge status={domain.status} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isConfirmingDelete ? (
                      <>
                        <span className="mr-1 text-xs text-muted-foreground">Are you sure?</span>
                        <Button
                          ref={cancelDeleteButtonRef}
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleCancelDelete}
                          disabled={removeMutation.isPending}
                          aria-label="Cancel removing domain"
                        >
                          <XIcon className="size-3.5" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeMutation.mutate(domain.id)}
                          disabled={removeMutation.isPending}
                          aria-label="Confirm remove domain"
                        >
                          {removeMutation.isPending ? (
                            <Loader2Icon className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2Icon className="size-3.5" />
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        {domain.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => recheckMutation.mutate(domain.id)}
                            disabled={recheckMutation.isPending}
                            prefix={
                              recheckMutation.isPending ? (
                                <Loader2Icon className="size-4 animate-spin" />
                              ) : (
                                <RefreshCwIcon className="size-4" />
                              )
                            }
                          >
                            Verify now
                          </Button>
                        )}
                        {domain.status === "verified" && (
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() =>
                              isConfiguring ? handleCloseConfig() : handleOpenConfig(domain)
                            }
                            prefix={<SettingsIcon className="size-4" />}
                          ></Button>
                        )}
                        {domain.status === "failed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => recheckMutation.mutate(domain.id)}
                            disabled={recheckMutation.isPending}
                            prefix={
                              recheckMutation.isPending ? (
                                <Loader2Icon className="size-4 animate-spin" />
                              ) : (
                                <RefreshCwIcon className="size-4" />
                              )
                            }
                          >
                            Verify now
                          </Button>
                        )}
                        <Button
                          data-trash-for={domain.id}
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setConfirmDeleteId(domain.id)}
                          aria-label={`Remove ${domain.domain}`}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {dnsRecordsByDomainId[domain.id]?.length && domain.status !== "verified" && (
                  <div className="space-y-3 border-t bg-muted/40 px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Add{" "}
                      {dnsRecordsByDomainId[domain.id].length > 1 ? "all records" : "the record"}{" "}
                      below at your DNS provider, then click{" "}
                      <strong className="text-foreground">Verify now</strong>.
                      {dnsRecordsByDomainId[domain.id].some((r) => r.type === "TXT") &&
                        dnsRecordsByDomainId[domain.id].some((r) => r.type === "CNAME") && (
                          <>
                            {" "}
                            The TXT proves ownership; the CNAME makes the subdomain resolve — both
                            are required.
                          </>
                        )}
                      {dnsRecordsByDomainId[domain.id].some((r) => r.shortName) && (
                        <>
                          {" "}
                          Some providers strip your zone from the Name and store it in the short
                          form — both work.
                        </>
                      )}
                    </p>
                    <div className="flex items-start gap-2 rounded-md border border-dashed border-foreground/25 bg-background px-3 py-2 text-xs text-muted-foreground">
                      <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        If your DNS provider offers a proxy or CDN feature on individual records,
                        keep it <strong className="text-foreground">disabled</strong> for this
                        record. A proxied record blocks the SSL handshake and the domain will stay
                        unverified.
                      </span>
                    </div>
                    <div className="overflow-hidden rounded-md border bg-background text-xs">
                      <div className="grid grid-cols-[80px_minmax(0,1fr)_minmax(0,2fr)_36px] border-b bg-muted font-medium text-foreground">
                        <div className="border-r border-border px-3 py-2">Type</div>
                        <div className="border-r border-border px-3 py-2">Name</div>
                        <div className="border-r border-border px-3 py-2">Value</div>
                        <div />
                      </div>
                      {dnsRecordsByDomainId[domain.id].map((rec, i) => (
                        <div
                          key={`${rec.type}-${rec.name}-${rec.value}`}
                          className={cn(
                            "grid grid-cols-[80px_minmax(0,1fr)_minmax(0,2fr)_36px] items-center",
                            i > 0 && "border-t",
                          )}
                        >
                          <div className="border-r px-3 py-2 font-mono">{rec.type}</div>
                          <div className="min-w-0 space-y-0.5 border-r px-3 py-2 font-mono break-all">
                            <div>{rec.name}</div>
                            {rec.shortName && (
                              <div className="text-[10px] font-normal text-muted-foreground">
                                or just <span className="font-mono">{rec.shortName}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex min-w-0 items-center gap-1 border-r px-3 py-2">
                            <span className="min-w-0 flex-1 font-mono break-all">{rec.value}</span>
                          </div>
                          <div className="flex items-center justify-center">
                            <CopyButton
                              text={rec.value}
                              variant="ghost"
                              size="icon-xs"
                              aria-label={`Copy ${rec.type} value`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isConfiguring && (
                  <div className="space-y-5 border-t px-4 py-4">
                    <div className="flex flex-col gap-2">
                      <label
                        className="text-base tracking-[0.28px] text-muted-foreground"
                        htmlFor={siteTitleInputId}
                      >
                        Site title
                      </label>
                      <InputGroup
                        variant="borderless"
                        className={cn(
                          "h-[30px] overflow-clip border-0 bg-secondary ring-0",
                          siteTitle !== (domain.siteTitle ?? "") && "pr-[3px]",
                        )}
                      >
                        <InputGroupInput
                          id={siteTitleInputId}
                          placeholder="My Forms"
                          value={siteTitle}
                          onChange={handleSiteTitleChange}
                          variant="secondary"
                        />
                        {siteTitle !== (domain.siteTitle ?? "") && (
                          <InputGroupButton
                            variant="default"
                            onClick={() => handleSaveSiteTitle(domain.id)}
                            disabled={updateMetaMutation.isPending}
                            className="h-[24px] w-[47px] rounded-lg bg-gray-50 px-3 text-sm text-gray-800 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-gray-200"
                          >
                            {updateMetaMutation.isPending ? (
                              <Loader2Icon className="size-3 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </InputGroupButton>
                        )}
                      </InputGroup>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex flex-1 flex-col gap-2">
                        <span className="text-base tracking-[0.28px] text-muted-foreground">
                          Favicon
                        </span>
                        <div className="flex items-center gap-3">
                          {faviconUrl && (
                            <img
                              src={faviconUrl}
                              alt="Favicon preview"
                              className="size-8 shrink-0 rounded border object-contain"
                            />
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleFaviconButtonClick}
                            disabled={isUploadingFavicon}
                            className="h-[30px] rounded-lg bg-gray-50 px-3 text-sm text-gray-800 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-gray-200"
                            prefix={
                              isUploadingFavicon ? (
                                <Loader2Icon className="size-3 animate-spin" />
                              ) : (
                                <UploadIcon className="size-3" />
                              )
                            }
                          >
                            {faviconUrl ? "Replace" : "Upload"} favicon
                          </Button>
                          <input
                            ref={faviconInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFaviconChange}
                          />
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col gap-2">
                        <span className="text-base tracking-[0.28px] text-muted-foreground">
                          OG image
                        </span>
                        <div className="flex items-center gap-3">
                          {ogImageUrl && (
                            <img
                              src={ogImageUrl}
                              alt="Open Graph preview"
                              className="h-8 w-14 shrink-0 rounded border object-cover"
                            />
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleOgButtonClick}
                            disabled={isUploadingOg}
                            className="h-[30px] rounded-lg bg-gray-50 px-3 text-sm text-gray-800 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-gray-200"
                            prefix={
                              isUploadingOg ? (
                                <Loader2Icon className="size-3 animate-spin" />
                              ) : (
                                <UploadIcon className="size-3" />
                              )
                            }
                          >
                            {ogImageUrl ? "Replace" : "Upload"} OG image
                          </Button>
                          <input
                            ref={ogInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleOgChange}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
