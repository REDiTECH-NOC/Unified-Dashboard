"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Shield,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Loader2,
  Building2,
  Globe,
  FileText,
  ExternalLink,
} from "lucide-react";

interface PolicySectionProps {
  organizationIds?: string[];
}

/* ─── Add Domain Form (reusable) ───────────────────────── */

function AddDomainForm({
  policyId,
  type,
  onClose,
}: {
  policyId: string;
  type: "allow" | "block";
  onClose: () => void;
}) {
  const [domain, setDomain] = useState("");
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();

  const addAllow = trpc.dnsFilter.addAllowDomain.useMutation({
    onSuccess: () => { utils.dnsFilter.getPolicies.invalidate(); onClose(); },
  });
  const addBlock = trpc.dnsFilter.addBlockDomain.useMutation({
    onSuccess: () => { utils.dnsFilter.getPolicies.invalidate(); onClose(); },
  });

  const isPending = addAllow.isPending || addBlock.isPending;

  function handleSubmit() {
    if (!domain.trim()) return;
    const payload = { policyId, domain: domain.trim(), note: note.trim() || undefined };
    if (type === "allow") addAllow.mutate(payload);
    else addBlock.mutate(payload);
  }

  return (
    <div className="flex flex-col gap-2 mt-2 p-3 rounded-lg bg-accent/30 border border-border">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Enter domain (e.g., example.com)"
          className="flex-1 h-8 px-3 rounded-md bg-accent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={!domain.trim() || isPending}
          className={cn(
            "h-8 px-3 rounded-md text-xs font-medium transition-colors",
            type === "allow"
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-red-600 hover:bg-red-700 text-white",
            isPending && "opacity-50"
          )}
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : type === "allow" ? "Allow" : "Block"}
        </button>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note (e.g., approved by John for client X)"
          className="flex-1 h-7 px-2 rounded-md bg-accent text-xs text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>
    </div>
  );
}

/* ─── Universal List Section (DB-backed) ──────────────── */

function UniversalListSection() {
  const [addTarget, setAddTarget] = useState<{ type: "allow" | "block" } | null>(null);
  const [domain, setDomain] = useState("");
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();

  const list = trpc.dnsFilter.getUniversalList.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });

  const addMutation = trpc.dnsFilter.addUniversalDomain.useMutation({
    onSuccess: () => {
      utils.dnsFilter.getUniversalList.invalidate();
      utils.dnsFilter.getPolicies.invalidate();
      setDomain("");
      setNote("");
      setAddTarget(null);
    },
  });

  const removeMutation = trpc.dnsFilter.removeUniversalDomain.useMutation({
    onSuccess: () => {
      utils.dnsFilter.getUniversalList.invalidate();
      utils.dnsFilter.getPolicies.invalidate();
    },
  });

  const allowEntries = (list.data ?? []).filter((e) => e.rule === "allow");
  const blockEntries = (list.data ?? []).filter((e) => e.rule === "block");

  function handleSubmit() {
    if (!domain.trim() || !addTarget) return;
    addMutation.mutate({
      domain: domain.trim(),
      rule: addTarget.type,
      note: note.trim() || undefined,
    });
  }

  return (
    <div className="rounded-xl border border-violet-500/30 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-violet-500/5">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-medium text-foreground">Universal Allow/Block List</h3>
        </div>
        <span className="text-[10px] text-muted-foreground">
          Applied to all policies
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Allowed Domains */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-xs font-medium text-green-400">Allowed Domains</h4>
            <button
              onClick={() => setAddTarget(addTarget?.type === "allow" ? null : { type: "allow" })}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allowEntries.length === 0 ? (
              <span className="text-[10px] text-muted-foreground">None</span>
            ) : (
              allowEntries.map((e) => (
                <span key={e.id} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                  {e.domain}
                  {e.note && <span className="text-muted-foreground" title={e.note}>*</span>}
                  <button
                    onClick={() => removeMutation.mutate({ id: e.id })}
                    disabled={removeMutation.isPending}
                    className="hover:text-red-400 transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Blocked Domains */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="text-xs font-medium text-red-400">Blocked Domains</h4>
            <button
              onClick={() => setAddTarget(addTarget?.type === "block" ? null : { type: "block" })}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {blockEntries.length === 0 ? (
              <span className="text-[10px] text-muted-foreground">None</span>
            ) : (
              blockEntries.map((e) => (
                <span key={e.id} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                  {e.domain}
                  {e.note && <span className="text-muted-foreground" title={e.note}>*</span>}
                  <button
                    onClick={() => removeMutation.mutate({ id: e.id })}
                    disabled={removeMutation.isPending}
                    className="hover:text-red-400 transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Add form */}
        {addTarget && (
          <div className="flex flex-col gap-2 p-3 rounded-lg bg-accent/30 border border-border">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Enter domain (e.g., example.com)"
                className="flex-1 h-8 px-3 rounded-md bg-accent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                autoFocus
              />
              <button
                onClick={handleSubmit}
                disabled={!domain.trim() || addMutation.isPending}
                className={cn(
                  "h-8 px-3 rounded-md text-xs font-medium transition-colors text-white",
                  addTarget.type === "allow"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700",
                  (addMutation.isPending || !domain.trim()) && "opacity-50"
                )}
              >
                {addMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : addTarget.type === "allow" ? "Allow" : "Block"}
              </button>
              <button onClick={() => setAddTarget(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note"
                className="flex-1 h-7 px-2 rounded-md bg-accent text-xs text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Domain will be added to all {addTarget.type === "allow" ? "allow" : "block"} lists across every policy.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Single Policy Card ───────────────────────────────── */

function PolicyCard({ policy }: { policy: { id: string; name: string; organizationId?: string; allowedDomains: string[]; blockedDomains: string[]; blockedCategories: number[] } }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [addTarget, setAddTarget] = useState<{ type: "allow" | "block" } | null>(null);
  const utils = trpc.useUtils();

  const removeAllow = trpc.dnsFilter.removeAllowDomain.useMutation({
    onSuccess: () => utils.dnsFilter.getPolicies.invalidate(),
  });
  const removeBlock = trpc.dnsFilter.removeBlockDomain.useMutation({
    onSuccess: () => utils.dnsFilter.getPolicies.invalidate(),
  });

  return (
    <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/50 transition-colors"
      >
        {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <Shield className="h-3.5 w-3.5 text-violet-400" />
        <span className="text-sm font-medium text-foreground flex-1">{policy.name}</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-green-400">{policy.allowedDomains.length} allowed</span>
          <span className="text-[10px] text-red-400">{policy.blockedDomains.length} blocked</span>
          <span className="text-[10px] text-muted-foreground">{policy.blockedCategories.length} categories</span>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 py-3 border-t border-border/50 space-y-3">
          {/* Allowed Domains */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs font-medium text-green-400">Allowed Domains</h4>
              <button
                onClick={() => setAddTarget(addTarget?.type === "allow" ? null : { type: "allow" })}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {policy.allowedDomains.length === 0 ? (
                <span className="text-[10px] text-muted-foreground">None</span>
              ) : (
                policy.allowedDomains.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                    {d}
                    <button onClick={() => removeAllow.mutate({ policyId: policy.id, domain: d })} className="hover:text-red-400 transition-colors">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Blocked Domains */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs font-medium text-red-400">Blocked Domains</h4>
              <button
                onClick={() => setAddTarget(addTarget?.type === "block" ? null : { type: "block" })}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {policy.blockedDomains.length === 0 ? (
                <span className="text-[10px] text-muted-foreground">None</span>
              ) : (
                policy.blockedDomains.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                    {d}
                    <button onClick={() => removeBlock.mutate({ policyId: policy.id, domain: d })} className="hover:text-green-400 transition-colors">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Add Domain Form */}
          {addTarget && (
            <AddDomainForm
              policyId={policy.id}
              type={addTarget.type}
              onClose={() => setAddTarget(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Org Policies Group ───────────────────────────────── */

function OrgPoliciesGroup({
  orgName,
  orgPolicies,
  defaultExpanded,
}: {
  orgName: string;
  orgPolicies: Array<{ id: string; name: string; organizationId?: string; allowedDomains: string[]; blockedDomains: string[]; blockedCategories: number[] }>;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
      >
        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <Building2 className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-medium text-foreground flex-1">{orgName}</span>
        <span className="text-xs text-muted-foreground">{orgPolicies.length} {orgPolicies.length === 1 ? "policy" : "policies"}</span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-2">
          {orgPolicies.map((policy) => (
            <PolicyCard key={policy.id} policy={policy} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── MAIN POLICIES SECTION ─────────────────────────────── */

export function PoliciesSection({ organizationIds }: PolicySectionProps) {
  const policies = trpc.dnsFilter.getPolicies.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60_000,
  });

  const organizations = trpc.dnsFilter.getOrganizations.useQuery(undefined, {
    retry: false,
    staleTime: 60 * 60_000,
  });

  // Build org name lookup
  const orgNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const org of organizations.data ?? []) {
      map.set(org.id, org.name);
    }
    return map;
  }, [organizations.data]);

  // Group policies: global (MSP parent) vs per-org
  const hasOrgFilter = !!organizationIds?.length;
  const { globalPolicies, policiesByOrg } = useMemo(() => {
    if (!policies.data || !organizations.data) return { globalPolicies: [], policiesByOrg: new Map<string, typeof policies.data>() };

    // Find the MSP parent org (type "msp" or the first org that owns others)
    const mspOrg = organizations.data.find((o) => o.type === "msp");
    const mspOrgId = mspOrg?.id;

    const global: typeof policies.data = [];
    const byOrg = new Map<string, typeof policies.data>();

    for (const pol of policies.data) {
      const isGlobal = pol.organizationId === mspOrgId || !pol.organizationId;

      // When org filter is active, only show that org's policies (skip global/MSP)
      if (hasOrgFilter) {
        if (isGlobal) continue;
        if (pol.organizationId && !organizationIds.includes(pol.organizationId)) continue;
      }

      if (isGlobal) {
        global.push(pol);
      } else if (pol.organizationId) {
        if (!byOrg.has(pol.organizationId)) byOrg.set(pol.organizationId, []);
        byOrg.get(pol.organizationId)!.push(pol);
      }
    }

    return { globalPolicies: global, policiesByOrg: byOrg };
  }, [policies.data, organizations.data, organizationIds, hasOrgFilter]);

  // Sort org groups alphabetically
  const sortedOrgEntries = useMemo(() => {
    return Array.from(policiesByOrg.entries())
      .sort((a, b) => (orgNameMap.get(a[0]) ?? "").localeCompare(orgNameMap.get(b[0]) ?? ""));
  }, [policiesByOrg, orgNameMap]);

  if (policies.isLoading || organizations.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Universal List — managed in DNSFilter portal (no API) */}
      <UniversalListSection />

      {/* Global / MSP Policies */}
      {globalPolicies.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            Global Policies
          </h3>
          {globalPolicies.map((policy) => (
            <PolicyCard key={policy.id} policy={policy} />
          ))}
        </div>
      )}

      {/* Per-Org Policies */}
      {sortedOrgEntries.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            Organization Policies
          </h3>
          {sortedOrgEntries.map(([orgId, orgPolicies]) => (
            <OrgPoliciesGroup
              key={orgId}
              orgName={orgNameMap.get(orgId) ?? orgId}
              orgPolicies={orgPolicies ?? []}
              defaultExpanded={organizationIds?.includes(orgId)}
            />
          ))}
        </div>
      )}

      {globalPolicies.length === 0 && sortedOrgEntries.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">No policies found</div>
      )}
    </div>
  );
}
