"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Search,
  Copy,
  Check,
  MoreHorizontal,
  Pencil,
  Trash2,
  RefreshCw,
  Phone,
  Loader2,
  ArrowUp,
  Upload,
  FileX,
} from "lucide-react";
import { PbxSsoButton } from "./pbx-sso-button";

/* ─── Types ──────────────────────────────────────────────────── */

interface PbxInstance {
  id: string;
  name: string;
  fqdn: string;
  extensionNumber: string;
  companyName: string | null;
  status: string;
  version: string | null;
  os: string | null;
  isActive: boolean;
  lastSeenAt: string | Date | null;
  productCode: string | null;
  maxSimCalls: number | null;
  expirationDate: string | Date | null;
  maintenanceExpiresAt: string | Date | null;
  updateAvailable: boolean | null;
  latestVersion: string | null;
  callsActive: number | null;
  extensionsRegistered: number | null;
  extensionsTotal: number | null;
  userExtensions: number | null;
  maxUserExtensions: number | null;
  trunksRegistered: number | null;
  trunksTotal: number | null;
  hasFailedServices: boolean | null;
  localIp: string | null;
  ssoDeployed: boolean;
  ssoDeployedAt: string | Date | null;
  ssoDeployStatus: string | null;
  sshUsername: string | null;
  company: { id: string; name: string } | null;
}

interface PbxInstanceTableProps {
  instances: PbxInstance[];
  canManage: boolean;
  onEdit: (instance: PbxInstance) => void;
  isFetching?: boolean;
}

/* ─── Helpers ────────────────────────────────────────────────── */

function statusDotClass(status: string) {
  switch (status) {
    case "online":
      return "bg-green-500";
    case "offline":
      return "bg-red-500";
    case "degraded":
      return "bg-yellow-500";
    default:
      return "bg-zinc-500";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "degraded":
      return "Degraded";
    default:
      return "Unknown";
  }
}

function relativeTime(date: string | Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function extensionColor(registered: number | null, total: number | null) {
  if (registered === null || total === null || total === 0) return "";
  const pct = (registered / total) * 100;
  if (pct >= 90) return "text-red-500";
  if (pct >= 70) return "text-yellow-500";
  return "text-green-500";
}

function displayCompanyName(inst: PbxInstance): string | null {
  return inst.company?.name ?? inst.companyName ?? null;
}

function parseLicenseType(productCode: string | null): string | null {
  if (!productCode) return null;
  const code = productCode.toUpperCase();
  if (code.includes("ENT")) return "Enterprise";
  if (code.includes("PROF") || code.includes("PRO")) return "Pro";
  if (code.includes("STD") || code.includes("STARTUP")) return "Startup";
  return null;
}

/* ─── Copy Button ────────────────────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

/* ─── Row Actions Menu (fixed positioning to avoid overflow clip) ── */

function RowActions({
  instance,
  canManage,
  onEdit,
}: {
  instance: PbxInstance;
  canManage: boolean;
  onEdit: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const utils = trpc.useUtils();

  const refreshMutation = trpc.threecx.refreshInstance.useMutation({
    onSuccess: () => {
      utils.threecx.getDashboardOverview.invalidate();
      setMenuOpen(false);
    },
  });

  const deleteMutation = trpc.threecx.deleteInstance.useMutation({
    onSuccess: () => {
      utils.threecx.getDashboardOverview.invalidate();
      utils.threecx.listInstances.invalidate();
      setMenuOpen(false);
    },
  });

  const deploySsoMutation = trpc.threecx.deploySso.useMutation({
    onSuccess: () => {
      utils.threecx.getDashboardOverview.invalidate();
      setMenuOpen(false);
    },
  });

  const removeSsoMutation = trpc.threecx.removeSso.useMutation({
    onSuccess: () => {
      utils.threecx.getDashboardOverview.invalidate();
      setMenuOpen(false);
    },
  });

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!menuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        left: rect.right - 176, // 176px = w-44
      });
    }
    setMenuOpen(!menuOpen);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(false);
            }}
          />
          <div
            className="fixed z-50 w-44 rounded-lg border border-border bg-card shadow-lg py-1"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                refreshMutation.mutate({ instanceId: instance.id });
              }}
              disabled={refreshMutation.isPending}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {refreshMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh Status
            </button>

            {canManage && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Instance
                </button>

                {instance.localIp && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deploySsoMutation.mutate({ instanceId: instance.id });
                      }}
                      disabled={deploySsoMutation.isPending}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      {deploySsoMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      {instance.ssoDeployed ? "Redeploy SSO Files" : "Deploy SSO Files"}
                    </button>

                    {instance.ssoDeployed && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Remove SSO files from this PBX? The SSO button will stop working until redeployed.")) {
                            removeSsoMutation.mutate({ instanceId: instance.id });
                          }
                        }}
                        disabled={removeSsoMutation.isPending}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 transition-colors"
                      >
                        {removeSsoMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileX className="h-3.5 w-3.5" />
                        )}
                        Remove SSO Files
                      </button>
                    )}
                  </>
                )}

                <div className="my-1 border-t border-border" />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      confirm(
                        `Delete "${instance.name}"? This cannot be undone.`
                      )
                    ) {
                      deleteMutation.mutate({ id: instance.id });
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Instance
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

/* ─── Table Component ─────────────────────────────────────── */

export function PbxInstanceTable({
  instances,
  canManage,
  onEdit,
  isFetching,
}: PbxInstanceTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "online" | "offline"
  >("all");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    let list = instances;

    if (statusFilter !== "all") {
      list = list.filter((i) =>
        statusFilter === "online"
          ? i.status === "online"
          : i.status !== "online"
      );
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.fqdn.toLowerCase().includes(q) ||
          i.company?.name.toLowerCase().includes(q) ||
          i.companyName?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [instances, statusFilter, debouncedSearch]);

  const handleRowClick = (id: string) => {
    router.push(`/3cx/${id}`);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Filters */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full h-8 pl-9 pr-3 rounded-lg bg-accent border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-red-500/50"
            placeholder="Search company or FQDN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 bg-accent rounded-lg p-0.5 border border-border">
          {(["all", "online", "offline"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                statusFilter === s
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {isFetching && (
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          {instances.length === 0 ? (
            <>
              <Phone className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">No PBX instances yet</p>
              <p className="text-xs mt-1 opacity-60">
                {canManage
                  ? 'Click "+ Add PBX" to connect your first 3CX system'
                  : "No phone systems have been configured"}
              </p>
            </>
          ) : (
            <>
              <Search className="h-8 w-8 mb-3 opacity-20" />
              <p className="text-sm font-medium">No matching results</p>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-4 py-2.5 font-medium">Company</th>
                <th className="text-left px-4 py-2.5 font-medium">FQDN</th>
                <th className="text-left px-4 py-2.5 font-medium">License</th>
                <th className="text-left px-4 py-2.5 font-medium">Expires</th>
                <th className="text-left px-4 py-2.5 font-medium">Version</th>
                <th className="text-left px-4 py-2.5 font-medium">
                  User/Ext
                </th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-right px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inst) => {
                const compName = displayCompanyName(inst);
                return (
                  <tr
                    key={inst.id}
                    onClick={() => handleRowClick(inst.id)}
                    className="border-b border-border/50 hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    {/* Company */}
                    <td className="px-4 py-3">
                      {compName ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-foreground font-medium">
                            {compName}
                          </span>
                          {inst.company && (
                            <span className="text-[10px] text-green-500/70">CW</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          {inst.name}
                        </span>
                      )}
                    </td>

                    {/* FQDN */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground font-mono text-[11px]">
                          {inst.fqdn}
                        </span>
                        <CopyButton text={inst.fqdn} />
                      </div>
                    </td>

                    {/* License */}
                    <td className="px-4 py-3">
                      {inst.maxSimCalls !== null ? (
                        <span className="text-foreground">
                          {inst.maxSimCalls}SC{" "}
                          {parseLicenseType(inst.productCode) && (
                            <span className="text-muted-foreground">
                              {parseLicenseType(inst.productCode)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Expires */}
                    <td className="px-4 py-3">
                      {inst.expirationDate ? (
                        <span className={cn(
                          "text-xs",
                          (() => {
                            const d = new Date(inst.expirationDate);
                            const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
                            if (days <= 0) return "text-red-500";
                            if (days <= 30) return "text-red-400";
                            if (days <= 90) return "text-yellow-500";
                            return "text-muted-foreground";
                          })()
                        )}>
                          {new Date(inst.expirationDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Version */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground">
                          {inst.version ?? "—"}
                        </span>
                        {inst.updateAvailable && (
                          <span className="inline-flex items-center gap-0.5 text-green-500">
                            <ArrowUp className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* User/Ext */}
                    <td className="px-4 py-3">
                      {inst.userExtensions !== null &&
                      inst.maxUserExtensions !== null ? (
                        <span
                          className={extensionColor(
                            inst.userExtensions,
                            inst.maxUserExtensions
                          )}
                        >
                          {inst.userExtensions} / {inst.maxUserExtensions}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            statusDotClass(inst.status)
                          )}
                        />
                        <span className="text-foreground">
                          {statusLabel(inst.status)}
                        </span>
                        {inst.lastSeenAt && (
                          <span className="text-muted-foreground text-[10px]">
                            {relativeTime(inst.lastSeenAt)}
                          </span>
                        )}
                        {inst.ssoDeployStatus && (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded",
                            inst.ssoDeployStatus === "deployed" && "bg-green-500/10 text-green-400",
                            inst.ssoDeployStatus === "pending" && "bg-yellow-500/10 text-yellow-400",
                            inst.ssoDeployStatus === "failed" && "bg-red-500/10 text-red-400",
                          )}>
                            SSO
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <PbxSsoButton
                          instanceId={inst.id}
                          disabled={inst.status === "offline"}
                          compact
                        />
                        <RowActions
                          instance={inst}
                          canManage={canManage}
                          onEdit={() => onEdit(inst)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
