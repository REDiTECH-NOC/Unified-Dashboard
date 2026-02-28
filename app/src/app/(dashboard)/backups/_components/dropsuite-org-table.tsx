"use client";

import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Building2,
  Search,
  Archive,
  Globe,
  Mail,
  Loader2,
  AlertTriangle,
  ArrowUpDown,
  HardDrive,
  Share2,
  Users as UsersIcon,
  Calendar,
  Contact,
  ListTodo,
  Shield,
} from "lucide-react";
type SaasBackupHealth = "healthy" | "warning" | "overdue" | "failed" | "preparing" | "never_ran" | "unknown";

interface SaasBackupOrg {
  sourceId: string;
  organizationId: number;
  organizationName: string;
  authenticationToken: string;
  email: string;
  planId: string | null;
  planName: string | null;
  planType: string | null;
  planPrice: string | null;
  activeSeats: number;
  seatsUsed: number;
  seatsAvailable: number;
  deactivatedSeats: number;
  requiredSeats: number;
  freeSharedMailboxes: number;
  paidSharedMailboxes: number;
  storageUsedBytes: number;
  storageAvailableBytes: number;
  archive: boolean;
  autoLicense: boolean;
  isBusiness: boolean;
  isDeactivated: boolean;
  isSuspended: boolean;
  externalId: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

type SortField = "name" | "activeSeats" | "storage";
type SortDir = "asc" | "desc";

interface OrgStorageMap {
  [orgId: string]: number;
}

interface DropsuiteOrgTableProps {
  healthFilter: SaasBackupHealth | null;
  orgStorageMap?: OrgStorageMap;
  initialExpandOrg?: string;
}

export function DropsuiteOrgTable({ healthFilter, orgStorageMap, initialExpandOrg }: DropsuiteOrgTableProps) {
  const [search, setSearch] = useState("");
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [initialExpanded, setInitialExpanded] = useState(false);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const {
    data: orgs,
    isLoading,
    isError,
  } = trpc.saasBackup.getOrganizations.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  // Auto-expand org from URL param (e.g., from "Open in Backups" on alert detail)
  useEffect(() => {
    if (initialExpandOrg && orgs && !initialExpanded) {
      const match = orgs.find(
        (o) => o.organizationName.toLowerCase() === initialExpandOrg.toLowerCase()
      );
      if (match) {
        setExpandedOrg(match.sourceId);
        setInitialExpanded(true);
      }
    }
  }, [initialExpandOrg, orgs, initialExpanded]);

  const filtered = useMemo(() => {
    if (!orgs) return [];
    let list = orgs;
    if (search) {
      const term = search.toLowerCase();
      list = list.filter((o) => o.organizationName.toLowerCase().includes(term));
    }
    // Sort
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.organizationName.localeCompare(b.organizationName);
          break;
        case "activeSeats":
          cmp = a.activeSeats - b.activeSeats;
          break;
        case "storage": {
          const aStorage = (orgStorageMap?.[a.sourceId] ?? 0) || a.storageUsedBytes;
          const bStorage = (orgStorageMap?.[b.sourceId] ?? 0) || b.storageUsedBytes;
          cmp = aStorage - bStorage;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [orgs, search, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading organizations...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-500">
        <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
        Failed to load Dropsuite organizations
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search organizations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Table */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_100px_100px_100px_100px_80px] gap-2 px-4 py-2 bg-zinc-900/50 border-b border-zinc-800 text-xs font-medium text-zinc-500">
          <button onClick={() => toggleSort("name")} className="flex items-center gap-1 text-left hover:text-zinc-300">
            Organization
            {sortField === "name" && <ArrowUpDown className="h-3 w-3" />}
          </button>
          <button onClick={() => toggleSort("activeSeats")} className="flex items-center gap-1 text-center hover:text-zinc-300">
            Active
            {sortField === "activeSeats" && <ArrowUpDown className="h-3 w-3" />}
          </button>
          <span className="text-center">Deactivated</span>
          <span className="text-center">Free Shared</span>
          <button onClick={() => toggleSort("storage")} className="flex items-center gap-1 text-center hover:text-zinc-300">
            Storage
            {sortField === "storage" && <ArrowUpDown className="h-3 w-3" />}
          </button>
          <span className="text-center">Archive</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-zinc-800/50">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No organizations found
            </div>
          ) : (
            filtered.map((org) => (
              <OrgRow
                key={org.sourceId}
                org={org}
                isExpanded={expandedOrg === org.sourceId}
                computedStorageBytes={orgStorageMap?.[org.sourceId]}
                onToggle={() =>
                  setExpandedOrg((prev) => (prev === org.sourceId ? null : org.sourceId))
                }
              />
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-zinc-500 text-right">
        {filtered.length} of {orgs?.length ?? 0} organizations
      </p>
    </div>
  );
}

/* ─── Org Row ───────────────────────────────────────────────────── */

function OrgRow({
  org,
  isExpanded,
  computedStorageBytes,
  onToggle,
}: {
  org: SaasBackupOrg;
  isExpanded: boolean;
  computedStorageBytes?: number;
  onToggle: () => void;
}) {
  // Use computed storage from backup accounts when org-level is 0
  const displayStorage = (computedStorageBytes && computedStorageBytes > 0)
    ? computedStorageBytes
    : org.storageUsedBytes;
  return (
    <div>
      <div
        onClick={onToggle}
        className="grid grid-cols-[1fr_100px_100px_100px_100px_80px] gap-2 px-4 py-2.5 items-center hover:bg-zinc-800/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          )}
          <Building2 className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          <span className="text-sm truncate">{org.organizationName}</span>
          {org.isDeactivated && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 shrink-0">
              Deactivated
            </span>
          )}
          {org.isSuspended && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 shrink-0">
              Suspended
            </span>
          )}
        </div>
        <div className="text-center text-sm">{org.activeSeats}</div>
        <div className="text-center text-sm text-zinc-500">{org.deactivatedSeats}</div>
        <div className="text-center text-sm text-zinc-500">{org.freeSharedMailboxes}</div>
        <div className="text-center text-sm text-zinc-400">{formatBytes(displayStorage)}</div>
        <div className="flex justify-center">
          {org.archive ? (
            <Archive className="h-3.5 w-3.5 text-blue-400" />
          ) : (
            <span className="text-zinc-700">—</span>
          )}
        </div>
      </div>

      {/* Expanded: Tenants */}
      {isExpanded && (
        <OrgExpandedPanel orgSourceId={org.sourceId} orgAuthToken={org.authenticationToken} org={org} />
      )}
    </div>
  );
}

/* ─── Expanded Panel ────────────────────────────────────────────── */

type AccountSortField = "email" | "health" | "lastBackup" | "storage";
type DataTab = "email" | "onedrive" | "sharepoint" | "teams" | "calendar" | "contacts" | "tasks" | "retention";

const HEALTH_ORDER: Record<string, number> = {
  failed: 0, overdue: 1, warning: 2, never_ran: 3, preparing: 4, healthy: 5, unknown: 6,
};

const DATA_TABS: { key: DataTab; label: string; icon: typeof Mail }[] = [
  { key: "email", label: "Email", icon: Mail },
  { key: "onedrive", label: "OneDrive", icon: HardDrive },
  { key: "sharepoint", label: "SharePoint", icon: Share2 },
  { key: "teams", label: "Teams", icon: UsersIcon },
  { key: "calendar", label: "Calendars", icon: Calendar },
  { key: "contacts", label: "Contacts", icon: Contact },
  { key: "tasks", label: "Tasks", icon: ListTodo },
  { key: "retention", label: "Retention", icon: Shield },
];

function OrgExpandedPanel({
  orgSourceId,
  orgAuthToken,
  org,
}: {
  orgSourceId: string;
  orgAuthToken: string;
  org: SaasBackupOrg;
}) {
  const [acctSort, setAcctSort] = useState<AccountSortField>("health");
  const [acctSortDir, setAcctSortDir] = useState<SortDir>("asc");
  const [acctSearch, setAcctSearch] = useState("");
  const [activeTab, setActiveTab] = useState<DataTab>("email");

  const { data: tenants, isLoading } = trpc.saasBackup.getOrganizationTenants.useQuery(
    { orgSourceId, orgAuthToken },
    { staleTime: 5 * 60 * 1000 }
  );

  const { data: accounts, isLoading: accountsLoading } = trpc.saasBackup.getBackupAccounts.useQuery(
    { orgAuthToken },
    { staleTime: 5 * 60 * 1000 }
  );

  const { data: journals } = trpc.saasBackup.getJournals.useQuery(
    { orgAuthToken },
    { staleTime: 10 * 60 * 1000 }
  );

  const { data: ndrJournal } = trpc.saasBackup.getNdrJournal.useQuery(
    { orgAuthToken },
    { staleTime: 10 * 60 * 1000 }
  );

  // Lazy-load data source tabs only when selected
  const { data: oneDrives, isLoading: odLoading } = trpc.saasBackup.getOneDrives.useQuery(
    { orgAuthToken },
    { staleTime: 5 * 60 * 1000, enabled: activeTab === "onedrive" }
  );
  const { data: sharePoints, isLoading: spLoading } = trpc.saasBackup.getSharePoints.useQuery(
    { orgAuthToken },
    { staleTime: 5 * 60 * 1000, enabled: activeTab === "sharepoint" }
  );
  const { data: teamsData, isLoading: teamsLoading } = trpc.saasBackup.getTeamsAndGroups.useQuery(
    { orgAuthToken },
    { staleTime: 5 * 60 * 1000, enabled: activeTab === "teams" }
  );
  const { data: calendars, isLoading: calLoading } = trpc.saasBackup.getCalendars.useQuery(
    { orgAuthToken },
    { staleTime: 5 * 60 * 1000, enabled: activeTab === "calendar" }
  );
  const { data: contacts, isLoading: conLoading } = trpc.saasBackup.getContacts.useQuery(
    { orgAuthToken },
    { staleTime: 5 * 60 * 1000, enabled: activeTab === "contacts" }
  );
  const { data: tasks, isLoading: taskLoading } = trpc.saasBackup.getTasks.useQuery(
    { orgAuthToken },
    { staleTime: 5 * 60 * 1000, enabled: activeTab === "tasks" }
  );
  const { data: retentionPolicies, isLoading: retLoading } = trpc.saasBackup.getRetentionPolicies.useQuery(
    { orgSourceId, orgAuthToken },
    { staleTime: 10 * 60 * 1000, enabled: activeTab === "retention" }
  );

  // Compute health summary from accounts
  const healthStats = useMemo(() => {
    if (!accounts) return null;
    const accts = accounts as Array<{ health: string; storageBytes: number; lastBackup: string | null; currentBackupStatus: string | null }>;
    let healthy = 0, warning = 0, overdue = 0, failed = 0, preparing = 0, neverRan = 0;
    let totalStorage = 0;
    let connFailures = 0;
    for (const a of accts) {
      totalStorage += a.storageBytes;
      if (a.currentBackupStatus?.toLowerCase().includes("connection failed")) connFailures++;
      switch (a.health) {
        case "healthy": healthy++; break;
        case "warning": warning++; break;
        case "overdue": overdue++; break;
        case "failed": failed++; break;
        case "preparing": preparing++; break;
        case "never_ran": neverRan++; break;
      }
    }
    return { total: accts.length, healthy, warning, overdue, failed, preparing, neverRan, totalStorage, connFailures };
  }, [accounts]);

  // Filter + sort accounts
  const sortedAccounts = useMemo(() => {
    if (!accounts) return [];
    let accts = [...(accounts as Array<{ id: number; email: string; health: string; lastBackup: string | null; storageBytes: number; currentBackupStatus: string | null; msgCount: number; displayName: string | null }>)];
    if (acctSearch) {
      const term = acctSearch.toLowerCase();
      accts = accts.filter((a) =>
        a.email.toLowerCase().includes(term) ||
        (a.displayName && a.displayName.toLowerCase().includes(term))
      );
    }
    accts.sort((a, b) => {
      let cmp = 0;
      switch (acctSort) {
        case "email": cmp = a.email.localeCompare(b.email); break;
        case "health": cmp = (HEALTH_ORDER[a.health] ?? 6) - (HEALTH_ORDER[b.health] ?? 6); break;
        case "lastBackup": {
          const aT = a.lastBackup ? new Date(a.lastBackup).getTime() : 0;
          const bT = b.lastBackup ? new Date(b.lastBackup).getTime() : 0;
          cmp = aT - bT;
          break;
        }
        case "storage": cmp = a.storageBytes - b.storageBytes; break;
      }
      return acctSortDir === "asc" ? cmp : -cmp;
    });
    return accts;
  }, [accounts, acctSort, acctSortDir, acctSearch]);

  function toggleAcctSort(field: AccountSortField) {
    if (acctSort === field) {
      setAcctSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setAcctSort(field);
      setAcctSortDir("asc");
    }
  }

  return (
    <div className="bg-zinc-900/40 border-t border-zinc-800/50 px-8 py-4 space-y-4">
      {/* ── Health Summary + Seat/Capacity Info ──────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Health Summary */}
        {healthStats && (
          <div className="p-3 rounded-lg border border-zinc-800/50 bg-zinc-900/50">
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2">Health Summary</p>
            <div className="grid grid-cols-4 gap-2 text-center mb-2">
              <div>
                <p className="text-sm font-bold text-green-400">{healthStats.healthy}</p>
                <p className="text-[9px] text-zinc-500">Healthy</p>
              </div>
              <div>
                <p className="text-sm font-bold text-amber-400">{healthStats.warning}</p>
                <p className="text-[9px] text-zinc-500">Warning</p>
              </div>
              <div>
                <p className="text-sm font-bold text-orange-400">{healthStats.overdue}</p>
                <p className="text-[9px] text-zinc-500">Overdue</p>
              </div>
              <div>
                <p className="text-sm font-bold text-red-400">{healthStats.failed}</p>
                <p className="text-[9px] text-zinc-500">Failed</p>
              </div>
            </div>
            {healthStats.total > 0 && (
              <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-800">
                {healthStats.healthy > 0 && <div className="h-full bg-green-500" style={{ width: `${(healthStats.healthy / healthStats.total) * 100}%` }} />}
                {healthStats.warning > 0 && <div className="h-full bg-amber-500" style={{ width: `${(healthStats.warning / healthStats.total) * 100}%` }} />}
                {healthStats.overdue > 0 && <div className="h-full bg-orange-500" style={{ width: `${(healthStats.overdue / healthStats.total) * 100}%` }} />}
                {healthStats.failed > 0 && <div className="h-full bg-red-500" style={{ width: `${(healthStats.failed / healthStats.total) * 100}%` }} />}
                {(healthStats.preparing + healthStats.neverRan) > 0 && <div className="h-full bg-zinc-600" style={{ width: `${((healthStats.preparing + healthStats.neverRan) / healthStats.total) * 100}%` }} />}
              </div>
            )}
            {healthStats.connFailures > 0 && (
              <p className="text-[10px] text-red-400 mt-2">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                {healthStats.connFailures} connection failure{healthStats.connFailures !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {/* Seats & Plan */}
        <div className="p-3 rounded-lg border border-zinc-800/50 bg-zinc-900/50">
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2">Seats & Plan</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Plan Name</span><span className="text-zinc-200 font-medium">{org.planName ?? "—"}</span></div>
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Plan License</span><span className={cn("font-medium", org.isDeactivated ? "text-red-400" : "text-green-400")}>{org.isDeactivated ? "Deactivated" : "Paid Plan"}</span></div>
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Plan Type</span><span className="text-zinc-300">{org.planType ?? "—"}</span></div>
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Billable Seats</span><span className="text-zinc-200 font-medium">{org.requiredSeats}</span></div>
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Max Seats</span><span className="text-zinc-200 font-medium">{org.autoLicense ? "Unlimited" : org.seatsAvailable}</span></div>
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Seats Used</span><span className="text-zinc-200 font-medium">{org.seatsUsed}</span></div>
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Seats Available</span><span className="text-zinc-400">{org.autoLicense ? "N/A" : org.seatsAvailable}</span></div>
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Auto License</span><span className={org.autoLicense ? "text-green-400" : "text-zinc-600"}>{org.autoLicense ? "Yes" : "No"}</span></div>
          </div>
        </div>

        {/* Storage & Info */}
        <div className="p-3 rounded-lg border border-zinc-800/50 bg-zinc-900/50">
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2">Storage & Info</p>
          <div className="grid grid-cols-1 gap-y-1.5">
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Status</span><span className={cn("font-medium", org.isDeactivated ? "text-red-400" : org.isSuspended ? "text-amber-400" : "text-green-400")}>{org.isDeactivated ? "Deactivated" : org.isSuspended ? "Suspended" : "Active"}</span></div>
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Total Storage</span><span className="text-zinc-200 font-medium">{formatBytes(healthStats?.totalStorage ?? 0)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Backup Accounts</span><span className="text-zinc-200 font-medium">{healthStats?.total ?? 0}</span></div>
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Shared Mailboxes</span><span className="text-zinc-400">{org.freeSharedMailboxes}</span></div>
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Free Deactivation Used</span><span className="text-zinc-400">{org.deactivatedSeats}</span></div>
            <div className="flex justify-between text-xs"><span className="text-zinc-500">Archive</span><span className={org.archive ? "text-blue-400" : "text-zinc-600"}>{org.archive ? "Enabled" : "Disabled"}</span></div>
            {journals && journals.length > 0 && (
              <div className="flex justify-between text-xs"><span className="text-zinc-500">Journal</span><span className="text-cyan-400 font-mono text-[10px] truncate max-w-[180px]" title={journals[0].email}>{journals[0].email}</span></div>
            )}
            {ndrJournal && (
              <div className="flex justify-between text-xs"><span className="text-zinc-500">NDR Journal</span><span className="text-cyan-400 font-mono text-[10px] truncate max-w-[180px]" title={ndrJournal.email}>{ndrJournal.email}</span></div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tenants ────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Globe className="h-3 w-3" />
          Tenants
        </p>
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading tenants...
          </div>
        ) : !tenants?.length ? (
          <p className="text-xs text-zinc-600 py-1">No tenants found</p>
        ) : (
          <div className="grid gap-1.5">
            {tenants.map((t) => (
              <div key={t.id} className="flex items-center gap-3 text-xs px-3 py-1.5 rounded bg-zinc-800/40">
                <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-medium", t.type === "m365" ? "bg-blue-500/10 text-blue-400" : "bg-green-500/10 text-green-400")}>
                  {t.type === "m365" ? "M365" : "GWS"}
                </span>
                <span className="text-zinc-300">{t.domain}</span>
                <span className="text-zinc-600 ml-auto">{t.totalUsers} users</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Data Source Tabs ────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-1 border-b border-zinc-800/50 mb-3 overflow-x-auto">
          {DATA_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border-b-2 transition-colors whitespace-nowrap",
                  activeTab === tab.key
                    ? "border-cyan-500 text-cyan-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Icon className="h-3 w-3" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === "email" && (
          <EmailAccountsTab
            accounts={accounts}
            accountsLoading={accountsLoading}
            sortedAccounts={sortedAccounts}
            acctSearch={acctSearch}
            setAcctSearch={setAcctSearch}
            acctSort={acctSort}
            toggleAcctSort={toggleAcctSort}
          />
        )}
        {activeTab === "onedrive" && (
          <OneDriveTab data={oneDrives} isLoading={odLoading} />
        )}
        {activeTab === "sharepoint" && (
          <SharePointTab data={sharePoints} isLoading={spLoading} orgAuthToken={orgAuthToken} />
        )}
        {activeTab === "teams" && (
          <TeamsTab data={teamsData} isLoading={teamsLoading} orgAuthToken={orgAuthToken} />
        )}
        {activeTab === "calendar" && (
          <PimTab type="calendar" data={calendars} isLoading={calLoading} />
        )}
        {activeTab === "contacts" && (
          <PimTab type="contact" data={contacts} isLoading={conLoading} />
        )}
        {activeTab === "tasks" && (
          <PimTab type="task" data={tasks} isLoading={taskLoading} />
        )}
        {activeTab === "retention" && (
          <RetentionTab data={retentionPolicies} isLoading={retLoading} />
        )}
      </div>
    </div>
  );
}

/* ─── Email Accounts Tab ─────────────────────────────────────────── */

function EmailAccountsTab({
  accounts,
  accountsLoading,
  sortedAccounts,
  acctSearch,
  setAcctSearch,
  acctSort,
  toggleAcctSort,
}: {
  accounts: unknown;
  accountsLoading: boolean;
  sortedAccounts: Array<{ id: number; email: string; health: string; lastBackup: string | null; storageBytes: number; currentBackupStatus: string | null; msgCount: number; displayName: string | null }>;
  acctSearch: string;
  setAcctSearch: (v: string) => void;
  acctSort: AccountSortField;
  toggleAcctSort: (f: AccountSortField) => void;
}) {
  const acctArr = accounts as Array<unknown> | undefined;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
          <Mail className="h-3 w-3" />
          Email Backup Accounts ({sortedAccounts.length}{acctSearch ? ` of ${acctArr?.length ?? 0}` : ""})
        </p>
        {(acctArr?.length ?? 0) > 10 && (
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={acctSearch}
              onChange={(e) => setAcctSearch(e.target.value)}
              className="w-full pl-7 pr-3 py-1 text-[11px] bg-zinc-800/50 border border-zinc-700/50 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500/50 text-zinc-300 placeholder:text-zinc-600"
            />
          </div>
        )}
      </div>
      {accountsLoading ? (
        <LoadingSpinner text="Loading email accounts..." />
      ) : !sortedAccounts.length ? (
        <p className="text-xs text-zinc-600 py-1">{acctSearch ? "No accounts match your search" : "No backup accounts found"}</p>
      ) : (
        <div className="border border-zinc-800/50 rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_100px_80px_80px] gap-2 px-3 py-1.5 bg-zinc-800/30 text-[10px] font-medium text-zinc-500">
            <button onClick={() => toggleAcctSort("email")} className="text-left hover:text-zinc-300 flex items-center gap-1">
              Email {acctSort === "email" && <ArrowUpDown className="h-2.5 w-2.5" />}
            </button>
            <button onClick={() => toggleAcctSort("health")} className="text-center hover:text-zinc-300 flex items-center gap-1 justify-center">
              Health {acctSort === "health" && <ArrowUpDown className="h-2.5 w-2.5" />}
            </button>
            <button onClick={() => toggleAcctSort("lastBackup")} className="text-center hover:text-zinc-300 flex items-center gap-1 justify-center">
              Last Backup {acctSort === "lastBackup" && <ArrowUpDown className="h-2.5 w-2.5" />}
            </button>
            <button onClick={() => toggleAcctSort("storage")} className="text-right hover:text-zinc-300 flex items-center gap-1 justify-end">
              Storage {acctSort === "storage" && <ArrowUpDown className="h-2.5 w-2.5" />}
            </button>
            <span className="text-right">Messages</span>
          </div>
          <div className="divide-y divide-zinc-800/30">
            {sortedAccounts.map((acct) => (
              <div key={acct.id} className="grid grid-cols-[1fr_80px_100px_80px_80px] gap-2 px-3 py-1.5 text-xs items-center hover:bg-zinc-800/20">
                <div className="flex items-center gap-2 min-w-0">
                  <HealthDot health={acct.health} />
                  <span className="text-zinc-300 truncate" title={acct.email}>{acct.email}</span>
                </div>
                <HealthLabel health={acct.health} />
                <span className="text-center text-zinc-500 text-[10px]">
                  {acct.lastBackup ? formatTimeAgo(new Date(acct.lastBackup).getTime()) : "Never"}
                </span>
                <span className="text-right text-zinc-400 text-[10px] tabular-nums">{formatBytes(acct.storageBytes)}</span>
                <span className="text-right text-zinc-500 text-[10px] tabular-nums">{acct.msgCount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── OneDrive Tab ───────────────────────────────────────────────── */

function OneDriveTab({ data, isLoading: loading }: { data: Array<{ id: number; email: string; fileCount: number; lastBackup: string | null; storageBytes: number; health: string; currentBackupStatus: string | null; lastActivity: string | null }> | undefined; isLoading: boolean }) {
  if (loading) return <LoadingSpinner text="Loading OneDrive backups..." />;
  if (!data?.length) return <p className="text-xs text-zinc-600 py-1">No OneDrive backups found</p>;
  return (
    <div className="border border-zinc-800/50 rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1fr_80px_80px_100px_80px] gap-2 px-3 py-1.5 bg-zinc-800/30 text-[10px] font-medium text-zinc-500">
        <span>Email</span>
        <span className="text-center">Health</span>
        <span className="text-right">Files</span>
        <span className="text-center">Last Backup</span>
        <span className="text-right">Storage</span>
      </div>
      <div className="divide-y divide-zinc-800/30">
        {data.map((d) => (
          <div key={d.id} className="grid grid-cols-[1fr_80px_80px_100px_80px] gap-2 px-3 py-1.5 text-xs items-center hover:bg-zinc-800/20">
            <div className="flex items-center gap-2 min-w-0">
              <HealthDot health={d.health} />
              <span className="text-zinc-300 truncate" title={d.email}>{d.email}</span>
            </div>
            <HealthLabel health={d.health} />
            <span className="text-right text-zinc-400 text-[10px] tabular-nums">{(d.fileCount ?? 0).toLocaleString()}</span>
            <span className="text-center text-zinc-500 text-[10px]">{d.lastBackup ? formatTimeAgo(new Date(d.lastBackup).getTime()) : "Never"}</span>
            <span className="text-right text-zinc-400 text-[10px] tabular-nums">{formatBytes(d.storageBytes ?? 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── SharePoint Tab ─────────────────────────────────────────────── */

function SharePointTab({ data, isLoading: loading, orgAuthToken }: { data: Array<{ id: number; domainName: string; siteCount: number; fileCount: number; storageBytes: number; lastBackup: string | null; health: string }> | undefined; isLoading: boolean; orgAuthToken: string }) {
  const [expandedDomain, setExpandedDomain] = useState<number | null>(null);

  if (loading) return <LoadingSpinner text="Loading SharePoint backups..." />;
  if (!data?.length) return <p className="text-xs text-zinc-600 py-1">No SharePoint backups found</p>;
  return (
    <div className="border border-zinc-800/50 rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-2 px-3 py-1.5 bg-zinc-800/30 text-[10px] font-medium text-zinc-500">
        <span>Domain</span>
        <span className="text-center">Health</span>
        <span className="text-right">Sites</span>
        <span className="text-right">Files</span>
        <span className="text-right">Storage</span>
      </div>
      <div className="divide-y divide-zinc-800/30">
        {data.map((d) => (
          <div key={d.id}>
            <div
              onClick={() => setExpandedDomain((prev) => (prev === d.id ? null : d.id))}
              className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-2 px-3 py-1.5 text-xs items-center hover:bg-zinc-800/20 cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                {expandedDomain === d.id ? (
                  <ChevronDown className="h-3 w-3 text-zinc-500 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-zinc-500 shrink-0" />
                )}
                <HealthDot health={d.health} />
                <span className="text-zinc-300 truncate">{d.domainName}</span>
              </div>
              <HealthLabel health={d.health} />
              <span className="text-right text-zinc-400 text-[10px] tabular-nums">{d.siteCount}</span>
              <span className="text-right text-zinc-400 text-[10px] tabular-nums">{(d.fileCount ?? 0).toLocaleString()}</span>
              <span className="text-right text-zinc-400 text-[10px] tabular-nums">{formatBytes(d.storageBytes ?? 0)}</span>
            </div>
            {expandedDomain === d.id && (
              <SharePointSitesPanel domainId={d.id} orgAuthToken={orgAuthToken} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SharePointSitesPanel({ domainId, orgAuthToken }: { domainId: number; orgAuthToken: string }) {
  const { data: sites, isLoading } = trpc.saasBackup.getSharePointSites.useQuery(
    { domainId, orgAuthToken },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) return <div className="px-6 py-2"><LoadingSpinner text="Loading sites..." /></div>;
  if (!sites?.length) return <p className="text-xs text-zinc-600 px-6 py-2">No individual sites found</p>;

  return (
    <div className="bg-zinc-900/30 border-t border-zinc-800/30">
      <div className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-2 px-6 py-1 text-[9px] font-medium text-zinc-600">
        <span>Site Name</span>
        <span className="text-center">Health</span>
        <span className="text-right">Files</span>
        <span className="text-center">Last Backup</span>
        <span className="text-right">Storage</span>
      </div>
      <div className="divide-y divide-zinc-800/20">
        {sites.map((s) => (
          <div key={s.id} className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-2 px-6 py-1 text-[11px] items-center hover:bg-zinc-800/10">
            <div className="flex items-center gap-2 min-w-0">
              <HealthDot health={s.health} />
              <span className="text-zinc-400 truncate" title={s.siteName}>{s.siteName}</span>
              {s.deactivatedSince && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-zinc-700/50 text-zinc-500 shrink-0">Deactivated</span>
              )}
            </div>
            <HealthLabel health={s.health} />
            <span className="text-right text-zinc-500 text-[10px] tabular-nums">{(s.fileCount ?? 0).toLocaleString()}</span>
            <span className="text-center text-zinc-500 text-[10px]">{s.lastBackup ? formatTimeAgo(new Date(s.lastBackup).getTime()) : "Never"}</span>
            <span className="text-right text-zinc-500 text-[10px] tabular-nums">{formatBytes(s.storageBytes ?? 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Teams Tab ──────────────────────────────────────────────────── */

function TeamsTab({ data, isLoading: loading, orgAuthToken }: { data: Array<{ id: number; domainName: string; groupCount: number; lastBackup: string | null; health: string }> | undefined; isLoading: boolean; orgAuthToken: string }) {
  const [expandedDomain, setExpandedDomain] = useState<number | null>(null);

  if (loading) return <LoadingSpinner text="Loading Teams & Groups..." />;
  if (!data?.length) return <p className="text-xs text-zinc-600 py-1">No Teams & Groups backups found</p>;
  return (
    <div className="border border-zinc-800/50 rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1fr_80px_80px_120px] gap-2 px-3 py-1.5 bg-zinc-800/30 text-[10px] font-medium text-zinc-500">
        <span>Domain</span>
        <span className="text-center">Health</span>
        <span className="text-right">Groups</span>
        <span className="text-center">Last Backup</span>
      </div>
      <div className="divide-y divide-zinc-800/30">
        {data.map((d) => (
          <div key={d.id}>
            <div
              onClick={() => setExpandedDomain((prev) => (prev === d.id ? null : d.id))}
              className="grid grid-cols-[1fr_80px_80px_120px] gap-2 px-3 py-1.5 text-xs items-center hover:bg-zinc-800/20 cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                {expandedDomain === d.id ? (
                  <ChevronDown className="h-3 w-3 text-zinc-500 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-zinc-500 shrink-0" />
                )}
                <HealthDot health={d.health} />
                <span className="text-zinc-300 truncate">{d.domainName}</span>
              </div>
              <HealthLabel health={d.health} />
              <span className="text-right text-zinc-400 text-[10px] tabular-nums">{d.groupCount}</span>
              <span className="text-center text-zinc-500 text-[10px]">{d.lastBackup ? formatTimeAgo(new Date(d.lastBackup).getTime()) : "Never"}</span>
            </div>
            {expandedDomain === d.id && (
              <TeamsGroupsPanel domainId={d.id} orgAuthToken={orgAuthToken} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamsGroupsPanel({ domainId, orgAuthToken }: { domainId: number; orgAuthToken: string }) {
  const { data: groups, isLoading } = trpc.saasBackup.getTeamsGroups.useQuery(
    { domainId, orgAuthToken },
    { staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) return <div className="px-6 py-2"><LoadingSpinner text="Loading groups..." /></div>;
  if (!groups?.length) return <p className="text-xs text-zinc-600 px-6 py-2">No individual groups found</p>;

  return (
    <div className="bg-zinc-900/30 border-t border-zinc-800/30">
      <div className="grid grid-cols-[1fr_80px_80px_100px] gap-2 px-6 py-1 text-[9px] font-medium text-zinc-600">
        <span>Group Name</span>
        <span className="text-center">Type</span>
        <span className="text-center">Health</span>
        <span className="text-center">Last Backup</span>
      </div>
      <div className="divide-y divide-zinc-800/20">
        {groups.map((g) => (
          <div key={g.id} className="grid grid-cols-[1fr_80px_80px_100px] gap-2 px-6 py-1 text-[11px] items-center hover:bg-zinc-800/10">
            <div className="flex items-center gap-2 min-w-0">
              <HealthDot health={g.health} />
              <span className="text-zinc-400 truncate" title={g.groupName}>{g.groupName}</span>
              {g.deactivatedSince && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-zinc-700/50 text-zinc-500 shrink-0">Deactivated</span>
              )}
            </div>
            <span className={cn("text-center text-[10px] font-medium", g.groupType === "Private" ? "text-amber-400" : "text-blue-400")}>{g.groupType}</span>
            <HealthLabel health={g.health} />
            <span className="text-center text-zinc-500 text-[10px]">{g.lastBackup ? formatTimeAgo(new Date(g.lastBackup).getTime()) : "Never"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── PIM Tab (Calendar / Contacts / Tasks) ──────────────────────── */

interface PimRow { id: number; email: string; health: string; lastBackup: string | null; count: number }

function PimTab({ type, data, isLoading: loading }: {
  type: "calendar" | "contact" | "task";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[] | undefined;
  isLoading: boolean;
}) {
  const labels = { calendar: "Calendar", contact: "Contact", task: "Task" };
  const label = labels[type];

  const items: PimRow[] = useMemo(() => {
    if (!data) return [];
    return data.map((d: Record<string, unknown>) => ({
      id: d.id as number,
      email: d.email as string,
      health: d.health as string,
      lastBackup: d.lastBackup as string | null,
      count: type === "calendar" ? ((d.scheduleCount as number) ?? 0) : type === "contact" ? ((d.contactCount as number) ?? 0) : ((d.taskCount as number) ?? 0),
    }));
  }, [data, type]);

  if (loading) return <LoadingSpinner text={`Loading ${label.toLowerCase()}s...`} />;
  if (!items.length) return <p className="text-xs text-zinc-600 py-1">No {label.toLowerCase()} backups found</p>;

  return (
    <div className="border border-zinc-800/50 rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1fr_80px_80px_120px] gap-2 px-3 py-1.5 bg-zinc-800/30 text-[10px] font-medium text-zinc-500">
        <span>Email</span>
        <span className="text-center">Health</span>
        <span className="text-right">{label}s</span>
        <span className="text-center">Last Backup</span>
      </div>
      <div className="divide-y divide-zinc-800/30">
        {items.map((d) => (
          <div key={d.id} className="grid grid-cols-[1fr_80px_80px_120px] gap-2 px-3 py-1.5 text-xs items-center hover:bg-zinc-800/20">
            <div className="flex items-center gap-2 min-w-0">
              <HealthDot health={d.health} />
              <span className="text-zinc-300 truncate" title={d.email}>{d.email}</span>
            </div>
            <HealthLabel health={d.health} />
            <span className="text-right text-zinc-400 text-[10px] tabular-nums">{d.count.toLocaleString()}</span>
            <span className="text-center text-zinc-500 text-[10px]">{d.lastBackup ? formatTimeAgo(new Date(d.lastBackup).getTime()) : "Never"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Retention Policies Tab ─────────────────────────────────────── */

function RetentionTab({ data, isLoading: loading }: { data: Array<{ id: number; name: string; retentionType: string; periodNumber: number; periodUnit: string }> | undefined; isLoading: boolean }) {
  if (loading) return <LoadingSpinner text="Loading retention policies..." />;
  if (!data?.length) return <p className="text-xs text-zinc-600 py-1">No retention policies found</p>;
  return (
    <div className="border border-zinc-800/50 rounded-lg overflow-hidden">
      <div className="grid grid-cols-[1fr_120px_120px] gap-2 px-3 py-1.5 bg-zinc-800/30 text-[10px] font-medium text-zinc-500">
        <span>Policy Name</span>
        <span className="text-center">Type</span>
        <span className="text-center">Retention Period</span>
      </div>
      <div className="divide-y divide-zinc-800/30">
        {data.map((p) => (
          <div key={p.id} className="grid grid-cols-[1fr_120px_120px] gap-2 px-3 py-1.5 text-xs items-center hover:bg-zinc-800/20">
            <span className="text-zinc-300 truncate" title={p.name}>{p.name}</span>
            <span className="text-center text-zinc-400 text-[10px]">{p.retentionType.replace(/_/g, " ")}</span>
            <span className="text-center text-zinc-300 text-[10px] font-medium">
              {p.periodNumber === 0 ? "Unlimited" : `${p.periodNumber} ${p.periodUnit}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Shared Components & Helpers ─────────────────────────────────── */

function LoadingSpinner({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 py-2">
      <Loader2 className="h-3 w-3 animate-spin" />
      {text}
    </div>
  );
}

function HealthDot({ health }: { health: string }) {
  const color =
    health === "healthy"
      ? "bg-green-400"
      : health === "warning"
        ? "bg-yellow-400"
        : health === "overdue"
          ? "bg-orange-400"
          : health === "failed"
            ? "bg-red-400"
            : "bg-zinc-600";

  return <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", color)} />;
}

function HealthLabel({ health }: { health: string }) {
  return (
    <span className={cn("text-center text-[10px] font-medium",
      health === "healthy" ? "text-green-400" :
      health === "failed" ? "text-red-400" :
      health === "overdue" ? "text-orange-400" :
      health === "warning" ? "text-amber-400" :
      "text-zinc-500"
    )}>
      {health === "healthy" ? "Healthy" :
       health === "failed" ? "Failed" :
       health === "overdue" ? "Overdue" :
       health === "warning" ? "Warning" :
       health === "preparing" ? "Preparing" :
       health === "never_ran" ? "Never Ran" : "—"}
    </span>
  );
}

function formatTimeAgo(epochMs: number): string {
  const diffMs = Date.now() - epochMs;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
