import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeftIcon,
  GlobeIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  UploadIcon,
} from "@/components/ui/icons";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const STATUS_LABEL: Record<DomainStatus, string> = {
  pending: "Pending",
  verified: "Verified",
  failed: "Failed",
};

// Figma system-flat status pills (node 26156-14047/14120/13590) — pastel fill + saturated text.
const STATUS_STYLES: Record<DomainStatus, string> = {
  failed: "bg-[#ffe2dc] text-[#fc3103] dark:bg-[#fc3103]/15 dark:text-[#ff8a6e]",
  pending: "bg-[#fdf8d8] text-[#b35309] dark:bg-[#b35309]/20 dark:text-[#e0a23c]",
  verified: "bg-[#e4faeb] text-[#137949] dark:bg-[#137949]/20 dark:text-[#4ec48a]",
};

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

const StatusBadge = ({ status }: { status: DomainStatus }) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center rounded-full px-1.5 py-[3px] text-xs leading-[1.15] font-medium tracking-[0.24px]",
      STATUS_STYLES[status],
    )}
  >
    {STATUS_LABEL[status]}
  </span>
);

export const DomainsContent = () => {
  const queryClient = useQueryClient();
  const { data: session, isPending: isSessionPending } = useSession();
  const domainInputId = useId();

  const [newDomain, setNewDomain] = useState("");
  // Per-domain DNS records (TXT challenge + CNAME) from add/check/recheckDomainStatus, keyed by domain.id.
  const [dnsRecordsByDomainId, setDnsRecordsByDomainId] = useState<Record<string, DnsRecord[]>>({});
  const clearDnsRecords = useCallback((id: string) => {
    setDnsRecordsByDomainId((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);
  // Stacked detail screen: the domain whose DNS records / config is open (null = list).
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);

  const orgId = session?.session?.activeOrganizationId as string | undefined;

  // Shares cache/invalidation with MembersContent (same query key) so member mutations keep this owner check fresh.
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
      clearDnsRecords(domainId);
      setSelectedDomainId((prev) => (prev === domainId ? null : prev));
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
      toast.success("Saved");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Failed to save domain settings");
    },
  });

  const { mutate: mutateAddDomain } = addMutation;
  const { mutate: mutateRemoveDomain } = removeMutation;
  const { mutate: mutateRecheck } = recheckMutation;
  const { mutate: mutateUpdateMeta } = updateMetaMutation;

  const handleAddDomain = useCallback(() => {
    const trimmed = newDomain.trim();
    if (!trimmed) return;
    mutateAddDomain(trimmed);
  }, [newDomain, mutateAddDomain]);

  const handleDelete = useCallback(
    (domain: Domain) => {
      if (!window.confirm(`Remove ${domain.domain}? This can't be undone.`)) return;
      mutateRemoveDomain(domain.id);
    },
    [mutateRemoveDomain],
  );

  if (isSessionPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <GlobeIcon className="mx-auto mb-3 size-8 opacity-50" />
        <p>Only the organization owner can manage domains.</p>
      </div>
    );
  }

  const selectedDomain = (domains as Domain[]).find((d) => d.id === selectedDomainId);

  if (selectedDomain) {
    return (
      <DomainDetail
        domain={selectedDomain}
        dnsRecords={dnsRecordsByDomainId[selectedDomain.id]}
        isRecheckPending={recheckMutation.isPending}
        isUpdateMetaPending={updateMetaMutation.isPending}
        onBack={() => setSelectedDomainId(null)}
        onRecheck={() => mutateRecheck(selectedDomain.id)}
        onUpdateMeta={mutateUpdateMeta}
      />
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

      <div className="h-px w-full bg-[var(--color-gray-100)]" />

      <div className="flex flex-col gap-4">
        <p className="font-case text-base font-medium text-foreground">Added domains</p>
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
          <div className="flex flex-col">
            {(domains as Domain[]).map((domain, i) => (
              <DomainRow
                key={domain.id}
                domain={domain}
                isLast={i === domains.length - 1}
                isRecheckPending={recheckMutation.isPending}
                onOpen={() => setSelectedDomainId(domain.id)}
                onRecheck={() => mutateRecheck(domain.id)}
                onDelete={() => handleDelete(domain)}
              />
            ))}
          </div>
        )}
      </div>
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
  const atLimit = domainCount >= MAX_DOMAINS;
  const canAddDomain = newDomain.trim().length > 0 && !atLimit;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-base tracking-[0.28px] text-muted-foreground" htmlFor={domainInputId}>
        Add a custom domain
      </label>
      <InputGroup
        variant="borderless"
        className="h-[30px] overflow-clip border-0 bg-secondary pr-[3px] ring-0"
      >
        <InputGroupInput
          id={domainInputId}
          // Flat like Figma; also kills elevation-sm's right-edge hairline that reads as a line
          // next to the always-visible Save button (the group, not the input, owns the focus ring).
          className="[box-shadow:none]!"
          placeholder="forms.acme.com"
          value={newDomain}
          onChange={(e) => onNewDomainChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onAdd();
          }}
          disabled={atLimit || isAdding}
          variant="secondary"
        />
        <InputGroupButton
          variant="default"
          onClick={onAdd}
          disabled={!canAddDomain || isAdding}
          className="h-[24px] w-[47px] rounded-lg bg-popover px-3 text-sm text-popover-foreground shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-muted"
        >
          {isAdding ? <Loader2Icon className="size-3 animate-spin" /> : "Save"}
        </InputGroupButton>
      </InputGroup>
    </div>
  );
};

interface DomainRowProps {
  domain: Domain;
  isLast: boolean;
  isRecheckPending: boolean;
  onOpen: () => void;
  onRecheck: () => void;
  onDelete: () => void;
}

const DomainRow = ({
  domain,
  isLast,
  isRecheckPending,
  onOpen,
  onRecheck,
  onDelete,
}: DomainRowProps) => (
  <div
    className={cn("flex items-center py-1.5", !isLast && "border-b border-[var(--color-gray-100)]")}
  >
    {/* Figma: domain 14/420/gray-800/opsz-24; flex-1 (Figma's fixed 200px → responsive) so the
        fixed-width status slot below keeps every badge column-aligned across rows. */}
    <button
      type="button"
      onClick={onOpen}
      className="min-w-0 flex-1 truncate text-left text-base font-[420] text-gray-800 transition-colors font-opsz-24 hover:text-foreground"
    >
      {domain.domain}
    </button>
    {/* Fixed 100px status slot, badge left-aligned (Figma node 26156:14119) — aligns the badge column. */}
    <div className="w-[100px] shrink-0">
      <StatusBadge status={domain.status} />
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 rounded-lg text-muted-foreground hover:text-gray-800"
            aria-label={`Actions for ${domain.domain}`}
          />
        }
      >
        <MoreHorizontalIcon className="size-[18px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="w-40" positionerClassName="z-103">
        {domain.status !== "verified" && (
          <DropdownMenuItem onClick={onRecheck} disabled={isRecheckPending}>
            Verify now
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

interface DomainDetailProps {
  domain: Domain;
  dnsRecords: DnsRecord[] | undefined;
  isRecheckPending: boolean;
  isUpdateMetaPending: boolean;
  onBack: () => void;
  onRecheck: () => void;
  onUpdateMeta: (data: {
    domainId: string;
    siteTitle?: string;
    faviconUrl?: string;
    ogImageUrl?: string;
  }) => void;
}

const DomainDetail = ({
  domain,
  dnsRecords,
  isRecheckPending,
  isUpdateMetaPending,
  onBack,
  onRecheck,
  onUpdateMeta,
}: DomainDetailProps) => {
  // Fall back to the base routing record so DNS shows even before the first verify check.
  const records = dnsRecords ?? getDnsInstructions(domain.domain);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-1">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to domains"
            className="-ml-1 flex size-6 shrink-0 items-center justify-center rounded-md text-gray-800 hover:bg-secondary"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <span className="truncate text-xl text-foreground">{domain.domain}</span>
        </div>
        {domain.status !== "verified" && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRecheck}
            disabled={isRecheckPending}
            className="h-7 rounded-lg bg-[var(--color-gray-200)] px-2 text-base font-medium tracking-[0.14px] text-foreground hover:bg-[var(--color-gray-300)]"
            prefix={isRecheckPending ? <Loader2Icon className="size-4 animate-spin" /> : undefined}
          >
            Verify Now
          </Button>
        )}
      </div>

      {domain.status === "verified" ? (
        <DomainConfigPanel
          domain={domain}
          isUpdateMetaPending={isUpdateMetaPending}
          onUpdateMeta={onUpdateMeta}
        />
      ) : (
        <DomainDnsRecords records={records} />
      )}
    </div>
  );
};

const DnsKeyValueRow = ({
  label,
  value,
  copyText,
}: {
  label: string;
  value: string;
  copyText?: string;
}) => (
  <div className="flex items-center gap-3 py-[7px]">
    <span className="min-w-0 flex-1 text-base text-muted-foreground">{label}</span>
    <span className="flex items-center gap-1.5 text-base whitespace-nowrap text-gray-800">
      <span className="truncate">{value}</span>
      {copyText && (
        <CopyButton text={copyText} variant="ghost" size="icon-xs" aria-label={`Copy ${label}`} />
      )}
    </span>
  </div>
);

const DomainDnsRecords = ({ records }: { records: DnsRecord[] }) => (
  <div className="flex flex-col gap-4">
    <div className="flex flex-col gap-1">
      <p className="text-base font-medium text-foreground">DNS records</p>
      <p className="text-base leading-[1.5] tracking-[0.28px] text-muted-foreground">
        Add these records to your domain name provider&rsquo;s DNS settings.
      </p>
    </div>
    <div className="flex flex-col gap-4">
      {records.map((rec, i) => (
        <div key={`${rec.type}-${rec.name}-${rec.value}`} className="flex flex-col">
          {i > 0 && <div className="mb-2 h-px w-full bg-[var(--color-gray-100)]" />}
          <DnsKeyValueRow label="Record type" value={rec.type} />
          <DnsKeyValueRow label="Name" value={rec.shortName ?? rec.name} />
          <DnsKeyValueRow label="Value" value={rec.value} copyText={rec.value} />
          <DnsKeyValueRow label="TTL" value="Auto" />
        </div>
      ))}
    </div>
  </div>
);

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
        // Auto-commit URL to domain row — no second Save click. Mirrors account-settings inline save.
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
    <div className="flex flex-col gap-5">
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
              className="h-[24px] w-[47px] rounded-lg bg-popover px-3 text-sm text-popover-foreground shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-muted"
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
        className="h-[30px] rounded-lg bg-popover px-3 text-sm text-popover-foreground shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-muted"
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
