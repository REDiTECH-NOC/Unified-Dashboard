"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useTimezone } from "@/hooks/use-timezone";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Globe,
  Loader2,
  Shield,
  FileText,
  ExternalLink,
  AlertTriangle,
  Info,
  X,
  Search,
} from "lucide-react";

const severityConfig = {
  critical: { label: "Critical", color: "text-red-500", bg: "bg-red-500/10", dot: "bg-red-500", border: "border-red-500/20" },
  high: { label: "High", color: "text-orange-500", bg: "bg-orange-500/10", dot: "bg-orange-500", border: "border-orange-500/20" },
  medium: { label: "Medium", color: "text-yellow-500", bg: "bg-yellow-500/10", dot: "bg-yellow-500", border: "border-yellow-500/20" },
  low: { label: "Low", color: "text-blue-400", bg: "bg-blue-400/10", dot: "bg-blue-400", border: "border-blue-400/20" },
  informational: { label: "Info", color: "text-zinc-400", bg: "bg-zinc-400/10", dot: "bg-zinc-400", border: "border-zinc-400/20" },
} as const;

type SeverityKey = keyof typeof severityConfig;

interface DnsFilterAlertsProps {
  from?: Date;
  to?: Date;
  organizationIds?: string[];
}

/* ─── Add to List Action ───────────────────────────────── */

function AddToListAction({
  domain,
  organizationIds,
  onClose,
}: {
  domain: string;
  organizationIds?: string[];
  onClose: () => void;
}) {
  const [rule, setRule] = useState<"allow" | "block">("block");
  const [note, setNote] = useState("");
  const [target, setTarget] = useState<"universal" | "policy">("universal");
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const utils = trpc.useUtils();

  const allPolicies = trpc.dnsFilter.getPolicies.useQuery(undefined, {
    retry: false, staleTime: 60 * 60_000,
  });

  // Filter policies by selected org (if org filter active)
  const policies = useMemo(() => {
    const data = allPolicies.data ?? [];
    if (!organizationIds?.length) return data;
    return data.filter((p) => p.organizationId && organizationIds.includes(p.organizationId));
  }, [allPolicies.data, organizationIds]);

  const addAllow = trpc.dnsFilter.addAllowDomain.useMutation({
    onSuccess: () => {
      utils.dnsFilter.getPolicies.invalidate();
      onClose();
    },
  });

  const addBlock = trpc.dnsFilter.addBlockDomain.useMutation({
    onSuccess: () => {
      utils.dnsFilter.getPolicies.invalidate();
      onClose();
    },
  });

  const addUniversal = trpc.dnsFilter.addUniversalDomain.useMutation({
    onSuccess: () => {
      utils.dnsFilter.getUniversalList.invalidate();
      utils.dnsFilter.getPolicies.invalidate();
      onClose();
    },
  });

  const isPending = addAllow.isPending || addBlock.isPending || addUniversal.isPending;

  function handleSubmit() {
    const noteVal = note.trim() || undefined;
    if (target === "universal") {
      addUniversal.mutate({ domain, rule, note: noteVal });
    } else {
      if (!selectedPolicyId) return;
      if (rule === "allow") {
        addAllow.mutate({ policyId: selectedPolicyId, domain, note: noteVal });
      } else {
        addBlock.mutate({ policyId: selectedPolicyId, domain, note: noteVal });
      }
    }
  }

  return (
    <div className="mt-3 p-3 rounded-lg bg-accent/30 border border-border space-y-2.5">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-medium text-foreground flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-violet-400" />
          Add &quot;{domain}&quot;
        </h5>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Target: Universal vs Specific Policy */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">To:</span>
        <div className="flex gap-1 rounded-lg bg-accent p-0.5">
          <button
            onClick={() => setTarget("universal")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              target === "universal"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Universal List
          </button>
          <button
            onClick={() => setTarget("policy")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              target === "policy"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Specific Policy
          </button>
        </div>
      </div>

      {/* Policy selector (only when targeting specific policy) */}
      {target === "policy" && (
        <select
          value={selectedPolicyId}
          onChange={(e) => setSelectedPolicyId(e.target.value)}
          className="w-full h-8 rounded-md bg-accent px-3 text-xs text-foreground border-none outline-none cursor-pointer"
        >
          <option value="">Select a policy...</option>
          {policies.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}

      {/* Rule */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Rule:</span>
        <div className="flex gap-1 rounded-lg bg-accent p-0.5">
          <button
            onClick={() => setRule("allow")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              rule === "allow"
                ? "bg-green-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Allow
          </button>
          <button
            onClick={() => setRule("block")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              rule === "block"
                ? "bg-red-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Block
          </button>
        </div>
      </div>

      {/* Note */}
      <div className="flex items-center gap-2">
        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="flex-1 h-7 px-2 rounded-md bg-accent text-xs text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>

      {/* Submit */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={isPending || (target === "policy" && !selectedPolicyId)}
          className={cn(
            "h-7 px-3 rounded-md text-xs font-medium transition-colors text-white",
            rule === "allow" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700",
            (isPending || (target === "policy" && !selectedPolicyId)) && "opacity-50"
          )}
        >
          {isPending ? (
            <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Adding...</span>
          ) : target === "universal" ? (
            `${rule === "allow" ? "Allow" : "Block"} in Universal List`
          ) : (
            `${rule === "allow" ? "Allow" : "Block"} in Policy`
          )}
        </button>
      </div>

      {target === "universal" && (
        <p className="text-[10px] text-muted-foreground">
          Adds to all policies across every organization.
        </p>
      )}
    </div>
  );
}

/* ─── MAIN ALERTS COMPONENT ─────────────────────────────── */

export function DnsFilterAlerts({ from, to, organizationIds }: DnsFilterAlertsProps) {
  const { dateTime } = useTimezone();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addToListDomain, setAddToListDomain] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const threats = trpc.dnsFilter.getThreats.useQuery(
    { from, to, organizationIds, page, pageSize: 50 },
    { retry: false, staleTime: 5 * 60_000 }
  );

  // Domain lookup for expanded threat
  const expandedThreat = useMemo(() => {
    if (!expandedId || !threats.data?.data) return null;
    return threats.data.data.find((t) => t.sourceId === expandedId);
  }, [expandedId, threats.data]);

  const domainLookup = trpc.dnsFilter.lookupDomain.useQuery(
    { fqdn: expandedThreat?.fqdn ?? expandedThreat?.domain ?? "" },
    { enabled: !!expandedThreat?.domain, retry: false, staleTime: 60 * 60_000 }
  );

  if (threats.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (threats.isError) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Failed to load DNS threat events.
      </div>
    );
  }

  const data = threats.data?.data ?? [];

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No DNS threat events found in this time range.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">
            Recent Threats
            <span className="ml-2 text-muted-foreground font-normal">
              {threats.data?.totalCount ?? data.length} total
            </span>
          </h3>
        </div>

        {/* Threat List */}
        <div className="divide-y divide-border">
          {data.map((threat) => {
            const sev = severityConfig[threat.severity as SeverityKey] ?? severityConfig.medium;
            const isExpanded = expandedId === threat.sourceId;

            return (
              <div key={threat.sourceId}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : threat.sourceId)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 transition-colors text-left group",
                    isExpanded ? "bg-accent/40" : "hover:bg-accent/50"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full shrink-0", sev.dot)} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Globe className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">
                        {threat.domain || threat.fqdn}
                      </span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", sev.bg, sev.color, sev.border)}>
                        {sev.label}
                      </span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border",
                        threat.action === "blocked"
                          ? "text-green-400 bg-green-500/10 border-green-500/20"
                          : "text-red-400 bg-red-500/10 border-red-500/20"
                      )}>
                        {threat.action === "blocked" ? "Blocked" : "Allowed"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground">{threat.category}</span>
                      {threat.organizationName && (
                        <span className="text-[10px] text-violet-400">{threat.organizationName}</span>
                      )}
                      {threat.networkName && (
                        <span className="text-[10px] text-muted-foreground">{threat.networkName}</span>
                      )}
                      {threat.agentHostname && (
                        <span className="text-[10px] text-muted-foreground">{threat.agentHostname}</span>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">
                    {dateTime(threat.timestamp)}
                  </span>

                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  )}
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-accent/20 border-t border-border/50 space-y-3">
                    {/* Threat Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Domain</span>
                        <p className="text-foreground font-medium">{threat.domain}</p>
                      </div>
                      {threat.fqdn && threat.fqdn !== threat.domain && (
                        <div>
                          <span className="text-muted-foreground">FQDN</span>
                          <p className="text-foreground font-medium">{threat.fqdn}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Category</span>
                        <p className="text-foreground font-medium">{threat.category}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Source</span>
                        <p className="text-foreground font-medium capitalize">{threat.source}</p>
                      </div>
                      {threat.queryType && (
                        <div>
                          <span className="text-muted-foreground">Query Type</span>
                          <p className="text-foreground font-medium">{threat.queryType}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Severity Score</span>
                        <p className="text-foreground font-medium">{threat.severityScore}/10</p>
                      </div>
                      {threat.organizationName && (
                        <div>
                          <span className="text-muted-foreground">Organization</span>
                          <p className="text-foreground font-medium">{threat.organizationName}</p>
                        </div>
                      )}
                      {threat.networkName && (
                        <div>
                          <span className="text-muted-foreground">Network</span>
                          <p className="text-foreground font-medium">{threat.networkName}</p>
                        </div>
                      )}
                      {threat.agentHostname && (
                        <div>
                          <span className="text-muted-foreground">Agent</span>
                          <p className="text-foreground font-medium">{threat.agentHostname}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Action</span>
                        <p className={cn("font-medium", threat.action === "blocked" ? "text-green-400" : "text-red-400")}>
                          {threat.action === "blocked" ? "Blocked" : "Allowed"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Timestamp</span>
                        <p className="text-foreground font-medium">{dateTime(threat.timestamp)}</p>
                      </div>
                    </div>

                    {/* Domain Categorization Info */}
                    {domainLookup.data && (
                      <div className="p-2.5 rounded-lg bg-accent/30 border border-border/50 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Info className="h-3.5 w-3.5 text-blue-400" />
                          <h5 className="text-xs font-medium text-foreground">Domain Intelligence</h5>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Registered Domain</span>
                            <p className="text-foreground font-medium">{domainLookup.data.domain}</p>
                          </div>
                          {domainLookup.data.host && (
                            <div>
                              <span className="text-muted-foreground">Host</span>
                              <p className="text-foreground font-medium">{domainLookup.data.host}</p>
                            </div>
                          )}
                          {domainLookup.data.application && (
                            <div>
                              <span className="text-muted-foreground">Application</span>
                              <p className="text-foreground font-medium">
                                {domainLookup.data.application.name}
                                {domainLookup.data.application.category && (
                                  <span className="text-muted-foreground ml-1">({domainLookup.data.application.category})</span>
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                        {domainLookup.data.categories.length > 0 && (
                          <div>
                            <span className="text-[10px] text-muted-foreground">Categories:</span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {domainLookup.data.categories.map((c) => (
                                <span key={c.id} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                  {c.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {domainLookup.isLoading && (
                      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading domain intelligence...
                      </div>
                    )}

                    {/* Severity Assessment */}
                    <div className="p-2.5 rounded-lg bg-accent/30 border border-border/50">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
                        <h5 className="text-xs font-medium text-foreground">Assessment</h5>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {threat.severityScore >= 8 && (
                          <>This domain has a <strong className="text-red-400">high severity score ({threat.severityScore}/10)</strong>. It was categorized as &quot;{threat.category}&quot; which is a known security threat category. Adding to allow list is <strong className="text-red-400">not recommended</strong> unless you have verified the domain is safe.</>
                        )}
                        {threat.severityScore >= 5 && threat.severityScore < 8 && (
                          <>This domain has a <strong className="text-yellow-400">medium severity score ({threat.severityScore}/10)</strong>. It was categorized as &quot;{threat.category}&quot;. Verify with the requesting user before allowing this domain.</>
                        )}
                        {threat.severityScore < 5 && (
                          <>This domain has a <strong className="text-green-400">low severity score ({threat.severityScore}/10)</strong>. It was categorized as &quot;{threat.category}&quot;. This may be a false positive — review and allow if the domain is legitimate.</>
                        )}
                      </p>
                    </div>

                    {/* Domain Reputation Lookups */}
                    <div className="p-2.5 rounded-lg bg-accent/30 border border-border/50">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Search className="h-3.5 w-3.5 text-cyan-400" />
                        <h5 className="text-xs font-medium text-foreground">Domain Reputation</h5>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <a
                          href={`https://www.virustotal.com/gui/domain/${encodeURIComponent(threat.domain)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          VirusTotal
                        </a>
                        <a
                          href={`https://urlhaus.abuse.ch/browse.php?search=${encodeURIComponent(threat.domain)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          URLhaus
                        </a>
                        <a
                          href={`https://transparencyreport.google.com/safe-browsing/search?url=${encodeURIComponent(threat.domain)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          Google Safe Browsing
                        </a>
                        <a
                          href={`https://talosintelligence.com/reputation_center/lookup?search=${encodeURIComponent(threat.domain)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-colors"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          Cisco Talos
                        </a>
                        <a
                          href={`https://www.abuseipdb.com/check/${encodeURIComponent(threat.domain)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          AbuseIPDB
                        </a>
                        <a
                          href={`https://exchange.xforce.ibmcloud.com/url/${encodeURIComponent(threat.domain)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          IBM X-Force
                        </a>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setAddToListDomain(
                          addToListDomain === threat.domain ? null : threat.domain
                        )}
                        className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors"
                      >
                        <Shield className="h-3 w-3" />
                        {addToListDomain === threat.domain ? "Cancel" : "Add to List"}
                      </button>
                    </div>

                    {/* Add to List Form */}
                    {addToListDomain === threat.domain && (
                      <AddToListAction
                        domain={threat.domain}
                        organizationIds={organizationIds}
                        onClose={() => setAddToListDomain(null)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {(threats.data?.hasMore || page > 1) && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!threats.data?.hasMore}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
