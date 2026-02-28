"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  MapPin,
  Key,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Globe,
  Server,
  Shield,
  FileText,
  Plus,
  X,
  Building2,
} from "lucide-react";

interface SitesSectionProps {
  organizationIds?: string[];
}

/* ─── Copy button helper ──────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1 rounded hover:bg-accent/50 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

/* ─── Editable list (local domains / resolvers) ────────── */

function EditableList({
  label,
  items,
  onAdd,
  onRemove,
  placeholder,
  isLoading,
}: {
  label: string;
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (item: string) => void;
  placeholder: string;
  isLoading?: boolean;
}) {
  const [newItem, setNewItem] = useState("");

  const handleAdd = () => {
    const val = newItem.trim();
    if (!val || items.includes(val)) return;
    onAdd(val);
    setNewItem("");
  };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</h4>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && (
          <span className="text-[10px] text-muted-foreground italic">None configured</span>
        )}
        {items.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent border border-border text-xs text-foreground">
            {item}
            <button onClick={() => onRemove(item)} className="hover:text-red-400 transition-colors" disabled={isLoading}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={placeholder}
          className="h-7 px-2 rounded-md bg-accent border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-blue-500/50 flex-1 min-w-[140px] max-w-[220px]"
        />
        <button
          onClick={handleAdd}
          disabled={!newItem.trim() || isLoading}
          className="h-7 px-2 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-40 transition-colors flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
    </div>
  );
}

/* ─── Single Site Card ──────────────────────────────── */

function SiteCard({
  networkId,
  name,
  secretKey,
  policyId,
  scheduledPolicyId,
  blockPageId,
  localDomains,
  localResolvers,
  ipAddresses,
  policies,
  scheduledPolicies,
  blockPages,
}: {
  networkId: string;
  name: string;
  secretKey?: string;
  policyId?: string;
  scheduledPolicyId?: string;
  blockPageId?: string;
  localDomains?: string[];
  localResolvers?: string[];
  ipAddresses?: string[];
  policies: Array<{ id: string; name: string }>;
  scheduledPolicies: Array<{ id: string; name: string }>;
  blockPages: Array<{ id: string; name: string }>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const utils = trpc.useUtils();

  const policyName = policies.find((p) => p.id === policyId)?.name ?? "—";
  const scheduleName = scheduledPolicies.find((s) => s.id === scheduledPolicyId)?.name;
  const blockPageName = blockPages.find((b) => b.id === blockPageId)?.name;

  const updateDomains = trpc.dnsFilter.updateLocalDomains.useMutation({
    onSuccess: () => {
      utils.dnsFilter.getNetworks.invalidate();
      utils.dnsFilter.getNetworkDetail.invalidate({ networkId });
    },
  });

  const updateResolvers = trpc.dnsFilter.updateLocalResolvers.useMutation({
    onSuccess: () => {
      utils.dnsFilter.getNetworks.invalidate();
      utils.dnsFilter.getNetworkDetail.invalidate({ networkId });
    },
  });

  const currentDomains = localDomains ?? [];
  const currentResolvers = localResolvers ?? [];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
      >
        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <MapPin className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-medium text-foreground flex-1">{name}</span>

        {/* Inline info */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          {policyId && (
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {scheduleName ? `${policyName} / ${scheduleName}` : policyName}
            </span>
          )}
          {blockPageName && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {blockPageName}
            </span>
          )}
          {ipAddresses && ipAddresses.length > 0 && (
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {ipAddresses[0]}{ipAddresses.length > 1 ? ` +${ipAddresses.length - 1}` : ""}
            </span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Secret Key */}
          {secretKey && (
            <div className="flex items-center gap-2">
              <Key className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs text-muted-foreground">Site Key:</span>
              <code className="text-xs font-mono text-foreground bg-accent px-2 py-0.5 rounded border border-border">
                {secretKey}
              </code>
              <CopyButton text={secretKey} />
            </div>
          )}

          {/* Policy / Schedule / Block Page */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-blue-400" />
              <div>
                <span className="text-[10px] text-muted-foreground block">Policy</span>
                <span className="text-xs text-foreground">{policyName}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Server className="h-3.5 w-3.5 text-purple-400" />
              <div>
                <span className="text-[10px] text-muted-foreground block">Schedule</span>
                <span className="text-xs text-foreground">{scheduleName ?? "None"}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-orange-400" />
              <div>
                <span className="text-[10px] text-muted-foreground block">Block Page</span>
                <span className="text-xs text-foreground">{blockPageName ?? "Default"}</span>
              </div>
            </div>
          </div>

          {/* Local Domains & Resolvers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableList
              label="Local Domains"
              items={currentDomains}
              placeholder="e.g. internal.local"
              isLoading={updateDomains.isPending}
              onAdd={(item) => updateDomains.mutate({ networkId, domains: [...currentDomains, item] })}
              onRemove={(item) => updateDomains.mutate({ networkId, domains: currentDomains.filter((d) => d !== item) })}
            />
            <EditableList
              label="Local Resolvers"
              items={currentResolvers}
              placeholder="e.g. 192.168.1.1"
              isLoading={updateResolvers.isPending}
              onAdd={(item) => updateResolvers.mutate({ networkId, resolvers: [...currentResolvers, item] })}
              onRemove={(item) => updateResolvers.mutate({ networkId, resolvers: currentResolvers.filter((d) => d !== item) })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── MAIN SITES SECTION ────────────────────────────── */

export function SitesSection({ organizationIds }: SitesSectionProps) {
  const networks = trpc.dnsFilter.getNetworks.useQuery(undefined, {
    retry: false, staleTime: 60 * 60_000,
  });
  const organizations = trpc.dnsFilter.getOrganizations.useQuery(undefined, {
    retry: false, staleTime: 60 * 60_000,
  });
  const policies = trpc.dnsFilter.getPolicies.useQuery(undefined, {
    retry: false, staleTime: 60 * 60_000,
  });
  const scheduledPolicies = trpc.dnsFilter.getScheduledPolicies.useQuery(undefined, {
    retry: false, staleTime: 60 * 60_000,
  });
  const blockPages = trpc.dnsFilter.getBlockPages.useQuery(undefined, {
    retry: false, staleTime: 60 * 60_000,
  });

  // Group networks by org
  const orgMap = useMemo(() => {
    const map = new Map<string, { orgName: string; networks: typeof filteredNetworks }>();
    if (!networks.data || !organizations.data) return map;

    const orgLookup = new Map(organizations.data.map((o) => [o.id, o.name]));

    // Filter by selected orgs if applicable
    const filteredNets = organizationIds?.length
      ? networks.data.filter((n) => n.organizationId && organizationIds.includes(n.organizationId))
      : networks.data;

    for (const net of filteredNets) {
      const orgId = net.organizationId ?? "unknown";
      const orgName = orgLookup.get(orgId) ?? "Unknown Organization";
      if (!map.has(orgId)) map.set(orgId, { orgName, networks: [] });
      map.get(orgId)!.networks.push(net);
    }

    return map;
  }, [networks.data, organizations.data, organizationIds]);

  // Flatten for simple lookup
  const policyList = useMemo(() => (policies.data ?? []).map((p) => ({ id: p.id, name: p.name })), [policies.data]);
  const scheduleList = useMemo(() => (scheduledPolicies.data ?? []).map((s) => ({ id: s.id, name: s.name })), [scheduledPolicies.data]);
  const blockPageList = useMemo(() => (blockPages.data ?? []).map((b) => ({ id: b.id, name: b.name })), [blockPages.data]);

  const filteredNetworks = networks.data ?? [];

  if (networks.isLoading || organizations.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sortedOrgs = [...orgMap.entries()].sort((a, b) => a[1].orgName.localeCompare(b[1].orgName));

  return (
    <div className="space-y-4">
      {sortedOrgs.map(([orgId, { orgName, networks: orgNets }]) => (
        <div key={orgId} className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Building2 className="h-3.5 w-3.5 text-violet-400" />
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {orgName} ({orgNets.length} {orgNets.length === 1 ? "site" : "sites"})
            </h3>
          </div>
          {orgNets.map((net) => (
            <SiteCard
              key={net.id}
              networkId={net.id}
              name={net.name}
              secretKey={net.secretKey}
              policyId={net.policyId}
              scheduledPolicyId={net.scheduledPolicyId}
              blockPageId={net.blockPageId}
              localDomains={net.localDomains}
              localResolvers={net.localResolvers}
              ipAddresses={net.ipAddresses}
              policies={policyList}
              scheduledPolicies={scheduleList}
              blockPages={blockPageList}
            />
          ))}
        </div>
      ))}

      {sortedOrgs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">No sites found</div>
      )}
    </div>
  );
}
