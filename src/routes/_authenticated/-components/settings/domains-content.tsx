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
import { auth, useSession } from "@/lib/auth/auth-client";
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

type DnsRecord = ReturnType<typeof getDnsInstructions>[number];

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

  const [newDomain, setNewDomain] = useState("");
  // Per-domain DNS records (TXT challenge if any + CNAME for routing).
  // Populated from addDomain / checkDomainStatus / recheckDomainStatus.
  // Keyed by domain.id so each card renders its own records inline.
  const [dnsRecordsByDomainId, setDnsRecordsByDomainId] = useState<Record<string, DnsRecord[]>>({});
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

  const cancelDeleteButtonRef = useRef<HTMLButtonElement>(null);

  // Move focus to Cancel when entering confirm-delete state. Without this the
  // trash button (where focus was) gets unmounted and focus falls back to body —
  // keyboard users have to tab from the top to reach the confirm controls.
  // eslint-disable-next-line react-doctor/no-effect-event-handler -- focus restoration must wait for the trash→cancel-button mount swap; can't run inside the click handler
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

  // Shares the cache + invalidation with MembersContent (same auth query key)
  // so member mutations elsewhere keep this owner check fresh.
  const { data: membersData } = useQuery({
    ...auth.organization.listMembers.queryOptions(),
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
      void queryClient.invalidateQueries({ queryKey: ["org-domains", orgId] });
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
      void queryClient.invalidateQueries({ queryKey: ["org-domains", orgId] });
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
    onSuccess: (result) => {
      handleStatusResult(result);
      void queryClient.invalidateQueries({ queryKey: ["org-domains", orgId] });
    },
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

  const { mutate: mutateAddDomain } = addMutation;
  const { mutate: mutateUpdateMeta } = updateMetaMutation;

  const handleAddDomain = useCallback(() => {
    const trimmed = newDomain.trim();
    if (!trimmed) return;
    mutateAddDomain(trimmed);
  }, [newDomain, mutateAddDomain]);

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

  return (
    <div className="flex flex-col gap-6">
      <AddDomainCard
        domainInputId={domainInputId}
        newDomain={newDomain}
        domainCount={domainCount}
        isAdding={addMutation.isPending}
        onNewDomainChange={setNewDomain}
        onAdd={handleAddDomain}
      />

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
          {(domains as Domain[]).map((domain) => (
            <DomainListItem
              key={domain.id}
              domain={domain}
              state={{
                confirmingDelete: confirmDeleteId === domain.id,
                configuring: expandedConfigId === domain.id,
              }}
              pending={{
                recheck: recheckMutation.isPending,
                remove: removeMutation.isPending,
                updateMeta: updateMetaMutation.isPending,
              }}
              dnsRecords={dnsRecordsByDomainId[domain.id]}
              cancelDeleteButtonRef={cancelDeleteButtonRef}
              handlers={{
                onRecheck: () => recheckMutation.mutate(domain.id),
                onRequestDelete: () => setConfirmDeleteId(domain.id),
                onConfirmDelete: () => removeMutation.mutate(domain.id),
                onCancelDelete: handleCancelDelete,
                onOpenConfig: () => setExpandedConfigId(domain.id),
                onCloseConfig: () => setExpandedConfigId(null),
              }}
              onUpdateMeta={mutateUpdateMeta}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface AddDomainCardProps {
  domainInputId: string;
  newDomain: string;
  domainCount: number;
  isAdding: boolean;
  onNewDomainChange: (value: string) => void;
  onAdd: () => void;
}

const AddDomainCard = ({
  domainInputId,
  newDomain,
  domainCount,
  isAdding,
  onNewDomainChange,
  onAdd,
}: AddDomainCardProps) => {
  const trimmedDomain = newDomain.trim();
  const canAddDomain = trimmedDomain.length > 0 && domainCount < MAX_DOMAINS;

  return (
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
          onChange={(e) => onNewDomainChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onAdd();
          }}
          disabled={domainCount >= MAX_DOMAINS || isAdding}
          variant="secondary"
        />
        {canAddDomain && (
          <InputGroupButton
            variant="default"
            onClick={onAdd}
            disabled={isAdding}
            className="h-[24px] w-[47px] rounded-lg bg-neutral-50 px-3 text-sm text-neutral-800 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-neutral-200"
          >
            {isAdding ? <Loader2Icon className="size-3 animate-spin" /> : "Add"}
          </InputGroupButton>
        )}
      </InputGroup>
    </div>
  );
};

type DomainItemState = {
  confirmingDelete: boolean;
  configuring: boolean;
};

type DomainItemPending = {
  recheck: boolean;
  remove: boolean;
  updateMeta: boolean;
};

type DomainItemHandlers = {
  onRecheck: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onOpenConfig: () => void;
  onCloseConfig: () => void;
};

interface DomainListItemProps {
  domain: Domain;
  state: DomainItemState;
  pending: DomainItemPending;
  dnsRecords: DnsRecord[] | undefined;
  cancelDeleteButtonRef: React.RefObject<HTMLButtonElement | null>;
  handlers: DomainItemHandlers;
  onUpdateMeta: (data: {
    domainId: string;
    siteTitle?: string;
    faviconUrl?: string;
    ogImageUrl?: string;
  }) => void;
}

const DomainListItem = ({
  domain,
  state,
  pending,
  dnsRecords,
  cancelDeleteButtonRef,
  handlers,
  onUpdateMeta,
}: DomainListItemProps) => (
  <div className="rounded-xl border">
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <GlobeIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{domain.domain}</span>
        <StatusBadge status={domain.status} />
      </div>
      <DomainItemActions
        domain={domain}
        state={state}
        pending={pending}
        cancelDeleteButtonRef={cancelDeleteButtonRef}
        handlers={handlers}
      />
    </div>

    {dnsRecords && dnsRecords.length > 0 && domain.status !== "verified" && (
      <DomainDnsRecords records={dnsRecords} />
    )}

    {state.configuring && (
      <DomainConfigPanel
        domain={domain}
        isUpdateMetaPending={pending.updateMeta}
        onUpdateMeta={onUpdateMeta}
      />
    )}
  </div>
);

interface DomainItemActionsProps {
  domain: Domain;
  state: DomainItemState;
  pending: Pick<DomainItemPending, "recheck" | "remove">;
  cancelDeleteButtonRef: React.RefObject<HTMLButtonElement | null>;
  handlers: DomainItemHandlers;
}

const DomainItemActions = ({
  domain,
  state,
  pending,
  cancelDeleteButtonRef,
  handlers,
}: DomainItemActionsProps) => {
  const { confirmingDelete, configuring } = state;
  const { recheck: isRecheckPending, remove: isRemovePending } = pending;
  const {
    onRecheck,
    onRequestDelete,
    onConfirmDelete,
    onCancelDelete,
    onOpenConfig,
    onCloseConfig,
  } = handlers;
  if (confirmingDelete) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">Are you sure?</span>
        <Button
          ref={cancelDeleteButtonRef}
          variant="outline"
          size="icon"
          className="size-7"
          onClick={onCancelDelete}
          disabled={isRemovePending}
          aria-label="Cancel removing domain"
        >
          <XIcon className="size-3.5" />
        </Button>
        <Button
          variant="destructive"
          size="icon"
          className="size-7"
          onClick={onConfirmDelete}
          disabled={isRemovePending}
          aria-label="Confirm remove domain"
        >
          {isRemovePending ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <Trash2Icon className="size-3.5" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {(domain.status === "pending" || domain.status === "failed") && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRecheck}
          disabled={isRecheckPending}
          prefix={
            isRecheckPending ? (
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
          onClick={configuring ? onCloseConfig : onOpenConfig}
          prefix={<SettingsIcon className="size-4" />}
        ></Button>
      )}
      <Button
        data-trash-for={domain.id}
        variant="ghost"
        size="icon"
        className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={onRequestDelete}
        aria-label={`Remove ${domain.domain}`}
      >
        <Trash2Icon className="size-3.5" />
      </Button>
    </div>
  );
};

const DomainDnsRecords = ({ records }: { records: DnsRecord[] }) => {
  const hasTxt = records.some((r) => r.type === "TXT");
  const hasCname = records.some((r) => r.type === "CNAME");
  const hasShortName = records.some((r) => r.shortName);

  return (
    <div className="space-y-3 border-t bg-muted/40 px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Add {records.length > 1 ? "all records" : "the record"} below at your DNS provider, then
        click <strong className="text-foreground">Verify now</strong>.
        {hasTxt && hasCname && (
          <> The TXT proves ownership; the CNAME makes the subdomain resolve, both are required.</>
        )}
        {hasShortName && (
          <>
            {" "}
            Some providers strip your zone from the Name and store it in the short form, both work.
          </>
        )}
      </p>
      <div className="flex items-start gap-2 rounded-md border border-dashed border-foreground/25 bg-background px-3 py-2 text-xs text-muted-foreground">
        <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
        <span>
          If your DNS provider offers a proxy or CDN feature on individual records, keep it{" "}
          <strong className="text-foreground">disabled</strong> for this record. A proxied record
          blocks the SSL handshake and the domain will stay unverified.
        </span>
      </div>
      <div className="overflow-hidden rounded-md border bg-background text-xs">
        <div className="grid grid-cols-[80px_minmax(0,1fr)_minmax(0,2fr)_36px] border-b bg-muted font-medium text-foreground">
          <div className="border-r border-border px-3 py-2">Type</div>
          <div className="border-r border-border px-3 py-2">Name</div>
          <div className="border-r border-border px-3 py-2">Value</div>
          <div />
        </div>
        {records.map((rec, i) => (
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
  );
};

interface DomainConfigPanelProps {
  domain: Domain;
  isUpdateMetaPending: boolean;
  onUpdateMeta: (data: {
    domainId: string;
    siteTitle?: string;
    faviconUrl?: string;
    ogImageUrl?: string;
  }) => void;
}

const DomainConfigPanel = ({
  domain,
  isUpdateMetaPending,
  onUpdateMeta,
}: DomainConfigPanelProps) => {
  const siteTitleInputId = useId();
  const [siteTitle, setSiteTitle] = useState(domain.siteTitle ?? "");
  const [faviconUrl, setFaviconUrl] = useState(domain.faviconUrl ?? "");
  const [ogImageUrl, setOgImageUrl] = useState(domain.ogImageUrl ?? "");
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const [isUploadingOg, setIsUploadingOg] = useState(false);

  const faviconInputRef = useRef<HTMLInputElement>(null);
  const ogInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File, type: "favicon" | "og") => {
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
        onUpdateMeta({ domainId: domain.id, [metaField]: result.url });
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
    [domain.id, onUpdateMeta],
  );

  const titleDirty = siteTitle !== (domain.siteTitle ?? "");

  return (
    <div className="space-y-5 border-t p-4">
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
            titleDirty && "pr-[3px]",
          )}
        >
          <InputGroupInput
            id={siteTitleInputId}
            placeholder="My Forms"
            value={siteTitle}
            onChange={(e) => setSiteTitle(e.target.value)}
            variant="secondary"
          />
          {titleDirty && (
            <InputGroupButton
              variant="default"
              onClick={() =>
                onUpdateMeta({ domainId: domain.id, siteTitle: siteTitle || undefined })
              }
              disabled={isUpdateMetaPending}
              className="h-[24px] w-[47px] rounded-lg bg-neutral-50 px-3 text-sm text-neutral-800 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-neutral-200"
            >
              {isUpdateMetaPending ? <Loader2Icon className="size-3 animate-spin" /> : "Save"}
            </InputGroupButton>
          )}
        </InputGroup>
      </div>

      <div className="flex items-start gap-3">
        <DomainAssetUpload
          label="Favicon"
          previewUrl={faviconUrl}
          previewAlt="Favicon preview"
          previewClassName="size-8 shrink-0 rounded border object-contain"
          isUploading={isUploadingFavicon}
          inputRef={faviconInputRef}
          onChoose={(file) => void uploadFile(file, "favicon")}
          buttonLabel={`${faviconUrl ? "Replace" : "Upload"} favicon`}
        />
        <DomainAssetUpload
          label="OG image"
          previewUrl={ogImageUrl}
          previewAlt="Open Graph preview"
          previewClassName="h-8 w-14 shrink-0 rounded border object-cover"
          isUploading={isUploadingOg}
          inputRef={ogInputRef}
          onChoose={(file) => void uploadFile(file, "og")}
          buttonLabel={`${ogImageUrl ? "Replace" : "Upload"} OG image`}
        />
      </div>
    </div>
  );
};

interface DomainAssetUploadProps {
  label: string;
  previewUrl: string;
  previewAlt: string;
  previewClassName: string;
  isUploading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChoose: (file: File) => void;
  buttonLabel: string;
}

const DomainAssetUpload = ({
  label,
  previewUrl,
  previewAlt,
  previewClassName,
  isUploading,
  inputRef,
  onChoose,
  buttonLabel,
}: DomainAssetUploadProps) => (
  <div className="flex flex-1 flex-col gap-2">
    <span className="text-base tracking-[0.28px] text-muted-foreground">{label}</span>
    <div className="flex items-center gap-3">
      {previewUrl && <img src={previewUrl} alt={previewAlt} className={previewClassName} />}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="h-[30px] rounded-lg bg-neutral-50 px-3 text-sm text-neutral-800 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-neutral-200"
        prefix={
          isUploading ? (
            <Loader2Icon className="size-3 animate-spin" />
          ) : (
            <UploadIcon className="size-3" />
          )
        }
      >
        {buttonLabel}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onChoose(file);
        }}
      />
    </div>
  </div>
);
