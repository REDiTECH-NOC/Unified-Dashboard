"use client";

import { Suspense, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  HardDrive,
  RefreshCw,
  Search,
  Server,
  Monitor,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Users,
  Loader2,
  Cloud,
  Clock,
  X,
  Copy,
  Check,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BackupSummaryCards } from "./_components/backup-summary-cards";
import { BackupDeviceTable } from "./_components/backup-device-table";
import { BackupCharts } from "./_components/backup-charts";
import { ColorBarLegend } from "./_components/color-bar";

/* ─── Tab Types ──────────────────────────────────────────────── */

type ProviderTab = "cove" | "dropsuite";
type ViewTab = "devices" | "customers";

/* ─── Customer Summary Component ─────────────────────────────── */

interface CustomerRow {
  sourceId: string;
  name: string;
  totalDevices: number;
  healthyDevices: number;
  warningDevices: number;
  failedDevices: number;
  overdueDevices: number;
  offlineDevices: number;
  overallStatus: string;
  totalStorageBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
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

const STATUS_ORDER: Record<string, number> = {
  failed: 0,
  overdue: 1,
  offline: 2,
  warning: 3,
  healthy: 4,
  never_ran: 5,
  unknown: 6,
};

/* ─── Customer Expanded Row ──────────────────────────────────── */

function CustomerExpandedRow({ customer }: { customer: CustomerRow }) {
  const [copiedUid, setCopiedUid] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteLoaded, setNoteLoaded] = useState(false);

  const noteQuery = trpc.backup.getCustomerNote.useQuery(
    { covePartnerId: customer.sourceId },
    { staleTime: 60_000 }
  );
  const setNoteMutation = trpc.backup.setCustomerNote.useMutation();

  // Initialize note text from query
  if (noteQuery.data && !noteLoaded) {
    setNoteText(noteQuery.data.note);
    setNoteLoaded(true);
  }

  const handleCopyUid = () => {
    navigator.clipboard.writeText(customer.sourceId);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleSaveNote = () => {
    setNoteMutation.mutate({
      covePartnerId: customer.sourceId,
      note: noteText,
    });
  };

  return (
    <div className="px-6 py-3 bg-zinc-900/30 border-t border-zinc-800/30">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: UID + device breakdown */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Partner UID:</span>
            <code className="text-zinc-300 font-mono bg-zinc-800 px-1.5 py-0.5 rounded">
              {customer.sourceId}
            </code>
            <button
              onClick={handleCopyUid}
              className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Copy UID"
            >
              {copiedUid ? (
                <Check className="h-3 w-3 text-green-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-zinc-800/50 rounded p-2">
              <div className="text-green-400 font-medium text-sm">{customer.healthyDevices}</div>
              <div className="text-zinc-500">Healthy</div>
            </div>
            <div className="bg-zinc-800/50 rounded p-2">
              <div className="text-amber-400 font-medium text-sm">{customer.warningDevices}</div>
              <div className="text-zinc-500">Warning</div>
            </div>
            <div className="bg-zinc-800/50 rounded p-2">
              <div className="text-red-400 font-medium text-sm">{customer.failedDevices}</div>
              <div className="text-zinc-500">Failed</div>
            </div>
            <div className="bg-zinc-800/50 rounded p-2">
              <div className="text-orange-400 font-medium text-sm">{customer.overdueDevices}</div>
              <div className="text-zinc-500">Overdue</div>
            </div>
            <div className="bg-zinc-800/50 rounded p-2">
              <div className="text-zinc-400 font-medium text-sm">{customer.offlineDevices}</div>
              <div className="text-zinc-500">Offline</div>
            </div>
            <div className="bg-zinc-800/50 rounded p-2">
              <div className="text-zinc-300 font-medium text-sm">{formatBytes(customer.totalStorageBytes)}</div>
              <div className="text-zinc-500">Storage</div>
            </div>
          </div>
        </div>

        {/* Right: Notes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-medium">Backup Notes</span>
            {setNoteMutation.isPending && (
              <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />
            )}
            {setNoteMutation.isSuccess && (
              <span className="text-[10px] text-green-400">Saved</span>
            )}
          </div>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onBlur={handleSaveNote}
            placeholder="Add notes about this customer's backup setup..."
            className="w-full h-24 text-xs bg-zinc-800/50 border border-zinc-700 rounded-lg p-2 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 resize-none"
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Customer Summary Table ─────────────────────────────────── */

type SortColumn = "name" | "totalDevices" | "healthyDevices" | "warningDevices" | "failedDevices" | "overdueDevices" | "offlineDevices" | "totalStorageBytes";
type SortDir = "asc" | "desc";

function SortableHeader({
  label,
  column,
  currentSort,
  currentDir,
  onSort,
  align = "center",
  colorClass,
}: {
  label: string;
  column: SortColumn;
  currentSort: SortColumn;
  currentDir: SortDir;
  onSort: (col: SortColumn) => void;
  align?: "left" | "center" | "right";
  colorClass?: string;
}) {
  const isActive = currentSort === column;
  const alignClass = align === "left" ? "text-left justify-start" : align === "right" ? "text-right justify-end" : "text-center justify-center";
  return (
    <th className={cn("py-2.5 font-medium", colorClass)}>
      <button
        onClick={() => onSort(column)}
        className={cn(
          "flex items-center gap-0.5 w-full transition-colors",
          alignClass,
          isActive ? "text-zinc-200" : "hover:text-zinc-300"
        )}
      >
        {label}
        {isActive ? (
          currentDir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />
        )}
      </button>
    </th>
  );
}

function CustomerSummaryTable({
  customers,
  isLoading,
  onSelectCustomer,
  searchTerm,
}: {
  customers: CustomerRow[];
  isLoading: boolean;
  onSelectCustomer: (id: string) => void;
  searchTerm: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortColumn>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  };

  const filtered = useMemo(() => {
    if (!searchTerm) return customers;
    const q = searchTerm.toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, searchTerm]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "name") {
        cmp = a.name.localeCompare(b.name);
      } else {
        cmp = (a[sortCol] as number) - (b[sortCol] as number);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin mr-3" />
        Loading customers...
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-zinc-400 border-b border-zinc-800 text-xs">
            <th className="w-8" />
            <SortableHeader label="Customer" column="name" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} align="left" />
            <SortableHeader label="Devices" column="totalDevices" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} />
            <SortableHeader label="Healthy" column="healthyDevices" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} colorClass="text-green-400" />
            <SortableHeader label="Warning" column="warningDevices" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} colorClass="text-amber-400" />
            <SortableHeader label="Failed" column="failedDevices" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} colorClass="text-red-400" />
            <SortableHeader label="Overdue" column="overdueDevices" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} colorClass="text-orange-400" />
            <SortableHeader label="Offline" column="offlineDevices" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} colorClass="text-zinc-400" />
            <SortableHeader label="Storage" column="totalStorageBytes" currentSort={sortCol} currentDir={sortDir} onSort={handleSort} align="right" />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center py-12 text-zinc-500 text-sm">
                {searchTerm ? "No customers match your search" : "No customers found"}
              </td>
            </tr>
          )}
          {sorted.map((c) => {
            const isExpanded = expandedId === c.sourceId;
            return (
              <tr key={c.sourceId} className="group">
                <td colSpan={9} className="p-0">
                  <div className={cn(
                    "border-b border-zinc-800/50 transition-colors",
                    isExpanded ? "bg-zinc-900/50" : "hover:bg-zinc-900/30"
                  )}>
                    <div className="flex items-center py-2.5">
                      {/* Expand arrow */}
                      <button
                        className="w-8 flex items-center justify-center"
                        onClick={() => setExpandedId(isExpanded ? null : c.sourceId)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                        )}
                      </button>
                      {/* Customer name — click to filter devices */}
                      <button
                        className="flex-1 text-left text-zinc-200 font-medium hover:text-teal-400 transition-colors"
                        onClick={() => onSelectCustomer(c.sourceId)}
                        title="View devices for this customer"
                      >
                        {c.name}
                      </button>
                      <div className="w-[80px] text-center text-zinc-400">{c.totalDevices}</div>
                      <div className="w-[80px] text-center">
                        <span className={cn(c.healthyDevices > 0 ? "text-green-400" : "text-zinc-600")}>
                          {c.healthyDevices}
                        </span>
                      </div>
                      <div className="w-[80px] text-center">
                        <span className={cn(c.warningDevices > 0 ? "text-amber-400" : "text-zinc-600")}>
                          {c.warningDevices}
                        </span>
                      </div>
                      <div className="w-[80px] text-center">
                        <span className={cn(c.failedDevices > 0 ? "text-red-400 font-semibold" : "text-zinc-600")}>
                          {c.failedDevices}
                        </span>
                      </div>
                      <div className="w-[80px] text-center">
                        <span className={cn(c.overdueDevices > 0 ? "text-orange-400" : "text-zinc-600")}>
                          {c.overdueDevices}
                        </span>
                      </div>
                      <div className="w-[80px] text-center">
                        <span className={cn(c.offlineDevices > 0 ? "text-zinc-400" : "text-zinc-600")}>
                          {c.offlineDevices}
                        </span>
                      </div>
                      <div className="w-[90px] text-right text-xs text-zinc-400 pr-2">
                        {formatBytes(c.totalStorageBytes)}
                      </div>
                    </div>
                    {isExpanded && <CustomerExpandedRow customer={c} />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Client-Side Summary Computation ────────────────────────── */

interface DeviceLike {
  overallStatus: string;
  usedStorageBytes: number;
  selectedSizeBytes: number;
  protectedSizeBytes: number;
  osType: "workstation" | "server" | null;
  dataSources: Array<{
    type: string;
    lastSessionStatus: string | null;
    lastSuccessfulTimestamp: string | null;
    licenseItems?: number | null;
  }>;
  lastSuccessfulTimestamp: string | null;
}

function isM365Device(d: DeviceLike): boolean {
  const hasM365Source = d.dataSources.some(
    (ds) => ds.type === "m365_exchange" || ds.type === "m365_onedrive"
  );
  return hasM365Source && !d.osType;
}

function computeSummaryFromDevices(deviceList: DeviceLike[]) {
  const byStatus: Record<string, number> = {};
  let totalStorage = 0;
  let totalProtected = 0;
  let totalSelected = 0;
  const byDeviceType = { servers: 0, workstations: 0, m365: 0, unknown: 0 };
  const bySessionStatus = { completed: 0, completedWithErrors: 0, inProcess: 0, failed: 0, noBackups: 0 };
  const backedUpRecency = { lessThan1h: 0, oneToFourHours: 0, fourTo24Hours: 0, twentyFourTo48Hours: 0, moreThan48Hours: 0, noBackups: 0 };
  const m365Summary = { tenantCount: 0, licenseCount: 0, totalSelectedBytes: 0, totalUsedBytes: 0 };
  const now = Date.now();

  for (const d of deviceList) {
    byStatus[d.overallStatus] = (byStatus[d.overallStatus] ?? 0) + 1;
    totalStorage += d.usedStorageBytes;
    totalProtected += d.protectedSizeBytes;
    totalSelected += d.selectedSizeBytes;

    if (isM365Device(d)) {
      byDeviceType.m365++;
      m365Summary.tenantCount++;
      m365Summary.totalSelectedBytes += d.selectedSizeBytes;
      m365Summary.totalUsedBytes += d.usedStorageBytes;
      const exLic = d.dataSources.find((ds) => ds.type === "m365_exchange")?.licenseItems ?? 0;
      const odLic = d.dataSources.find((ds) => ds.type === "m365_onedrive")?.licenseItems ?? 0;
      m365Summary.licenseCount += Math.max(exLic, odLic);
    } else if (d.osType === "server") {
      byDeviceType.servers++;
    } else if (d.osType === "workstation") {
      byDeviceType.workstations++;
    } else {
      byDeviceType.unknown++;
    }

    if (d.overallStatus === "healthy") bySessionStatus.completed++;
    else if (d.overallStatus === "warning") bySessionStatus.completedWithErrors++;
    else if (d.overallStatus === "failed") bySessionStatus.failed++;
    else if (d.dataSources.some((ds) => ds.lastSessionStatus === "in_process")) bySessionStatus.inProcess++;
    else bySessionStatus.noBackups++;

    const lastSuccess = d.lastSuccessfulTimestamp ? new Date(d.lastSuccessfulTimestamp).getTime() : null;
    if (!lastSuccess || isNaN(lastSuccess)) {
      backedUpRecency.noBackups++;
    } else {
      const ageHours = (now - lastSuccess) / 3_600_000;
      if (ageHours < 1) backedUpRecency.lessThan1h++;
      else if (ageHours < 4) backedUpRecency.oneToFourHours++;
      else if (ageHours < 24) backedUpRecency.fourTo24Hours++;
      else if (ageHours < 48) backedUpRecency.twentyFourTo48Hours++;
      else backedUpRecency.moreThan48Hours++;
    }
  }

  return {
    totalDevices: deviceList.length,
    totalCustomers: 1,
    byStatus,
    totalStorageBytes: totalStorage,
    totalProtectedBytes: totalProtected,
    totalSelectedBytes: totalSelected,
    byDeviceType,
    bySessionStatus,
    backedUpRecency,
    m365Summary,
  };
}

/* ─── Main Page ──────────────────────────────────────────────── */

export default function BackupsPage() {
  return (
    <Suspense>
      <BackupsPageInner />
    </Suspense>
  );
}

function BackupsPageInner() {
  const searchParams = useSearchParams();
  const initialDeviceId = searchParams.get("device") ?? undefined;
  const [provider, setProvider] = useState<ProviderTab>("cove");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<"workstation" | "server" | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<ViewTab>("devices");

  const STALE_TIME = 10 * 60 * 1000; // 10 min

  const summary = trpc.backup.getDashboardSummary.useQuery(undefined, {
    retry: false,
    staleTime: STALE_TIME,
    refetchInterval: 60_000,
    refetchOnMount: true,
  });

  const devices = trpc.backup.getDevices.useQuery(
    {
      customerId: customerFilter,
      status: statusFilter as undefined,
      deviceType: deviceTypeFilter,
      searchTerm: searchTerm || undefined,
    },
    {
      retry: false,
      staleTime: STALE_TIME,
      refetchInterval: 60_000,
      refetchOnMount: true,
      placeholderData: (prev) => prev,
    }
  );

  const customers = trpc.backup.getCustomers.useQuery(undefined, {
    retry: false,
    staleTime: STALE_TIME,
    refetchInterval: 120_000,
    refetchOnMount: true,
    enabled: activeTab === "customers",
  });

  // Lightweight customer names — always enabled so the dropdown works on all tabs
  const customerNamesQuery = trpc.backup.getCustomerNames.useQuery(undefined, {
    retry: false,
    staleTime: STALE_TIME,
    refetchInterval: 120_000,
  });

  const cacheInfo = trpc.backup.getCacheInfo.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const isNotConnected = summary.isError && summary.error?.message?.includes("not configured");

  const sortedCustomerNames = useMemo(() => {
    if (!customerNamesQuery.data) return [];
    return [...customerNamesQuery.data].sort((a, b) => a.name.localeCompare(b.name));
  }, [customerNamesQuery.data]);

  const selectedCustomerName = useMemo(() => {
    if (!customerFilter || !sortedCustomerNames.length) return null;
    return sortedCustomerNames.find((c) => c.id === customerFilter)?.name ?? null;
  }, [customerFilter, sortedCustomerNames]);

  // Compute per-customer summary when a customer filter is active
  const filteredSummary = useMemo(() => {
    if (!customerFilter || !devices.data || devices.data.length === 0) return null;
    return computeSummaryFromDevices(devices.data as DeviceLike[]);
  }, [customerFilter, devices.data]);

  // Use filtered summary when customer selected, otherwise global summary
  const activeSummary = customerFilter && filteredSummary ? filteredSummary : summary.data ?? null;

  const handleSelectCustomer = (id: string) => {
    setCustomerFilter(id);
    setActiveTab("devices");
  };

  const handleRefresh = () => {
    summary.refetch();
    devices.refetch();
    if (activeTab === "customers") customers.refetch();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HardDrive className="h-6 w-6 text-teal-400" />
          <h1 className="text-2xl font-bold text-zinc-100">Backups</h1>
        </div>
        <div className="flex items-center gap-2">
          {provider === "cove" && <ColorBarLegend />}
          {provider === "cove" && cacheInfo.data?.devicesCachedAt && (
            <span className="text-[11px] text-zinc-500 tabular-nums">
              Updated {formatTimeAgo(cacheInfo.data.devicesCachedAt)}
              {(summary.isFetching || devices.isFetching) && !summary.isLoading && !devices.isLoading && (
                <span className="text-zinc-600 ml-1">· refreshing</span>
              )}
            </span>
          )}
          <button
            onClick={handleRefresh}
            className="ml-2 p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", (summary.isFetching || devices.isFetching) && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Provider Tabs */}
      <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-0.5 border border-zinc-800 w-fit">
        <button
          onClick={() => setProvider("cove")}
          className={cn(
            "px-4 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5",
            provider === "cove"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:text-zinc-300"
          )}
        >
          <Cloud className="h-3.5 w-3.5" />
          Cove Data Protection
        </button>
        <button
          onClick={() => setProvider("dropsuite")}
          className={cn(
            "px-4 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5",
            provider === "dropsuite"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:text-zinc-300"
          )}
        >
          <Cloud className="h-3.5 w-3.5" />
          DropSuite (NinjaOne SaaS)
        </button>
      </div>

      {/* DropSuite (NinjaOne SaaS Backup) — Coming Soon */}
      {provider === "dropsuite" && (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
          <Clock className="h-12 w-12 mb-4 text-zinc-600" />
          <p className="text-lg font-medium text-zinc-400 mb-1">
            DropSuite (NinjaOne SaaS Backup) — Coming Soon
          </p>
          <p className="text-sm">
            M365 email backup and archiving monitoring will be available in a future update
          </p>
        </div>
      )}

      {/* Cove — Not Connected */}
      {provider === "cove" && isNotConnected && (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
          <HardDrive className="h-12 w-12 mb-4 text-zinc-600" />
          <p className="text-lg font-medium text-zinc-400 mb-1">
            Cove Data Protection not configured
          </p>
          <p className="text-sm">
            Go to Settings &gt; Integrations to add your Cove credentials
          </p>
        </div>
      )}

      {/* Cove Content */}
      {provider === "cove" && !isNotConnected && (
        <>
          {/* Summary Cards */}
          <BackupSummaryCards
            totalDevices={activeSummary?.totalDevices ?? 0}
            totalCustomers={activeSummary?.totalCustomers ?? 0}
            byStatus={activeSummary?.byStatus ?? {}}
            isLoading={summary.isLoading}
            activeFilter={statusFilter}
            onFilterChange={setStatusFilter}
          />

          {/* Charts */}
          <BackupCharts
            summary={activeSummary}
            isLoading={summary.isLoading}
          />

          {/* Tabs + Filters */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* View Tabs */}
            <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
              <button
                onClick={() => setActiveTab("devices")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5",
                  activeTab === "devices"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-300"
                )}
              >
                <Monitor className="h-3.5 w-3.5" />
                Devices
              </button>
              <button
                onClick={() => setActiveTab("customers")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5",
                  activeTab === "customers"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-300"
                )}
              >
                <Users className="h-3.5 w-3.5" />
                Customers
              </button>
            </div>

            {/* Filters */}
            {activeTab === "devices" ? (
              <div className="flex items-center gap-3 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search devices..."
                    className="pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 w-[200px]"
                  />
                </div>

                {/* Customer filter with clear button */}
                <div className="relative flex items-center">
                  <div className="relative">
                    <select
                      value={customerFilter ?? ""}
                      onChange={(e) => setCustomerFilter(e.target.value || undefined)}
                      className="appearance-none bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 pl-3 pr-8 py-1.5 focus:outline-none focus:border-zinc-600"
                    >
                      <option value="">All Customers</option>
                      {sortedCustomerNames.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
                  </div>
                  {customerFilter && (
                    <button
                      onClick={() => setCustomerFilter(undefined)}
                      className="ml-1 p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                      title={`Clear filter: ${selectedCustomerName}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Device type filter */}
                <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
                  <button
                    onClick={() => setDeviceTypeFilter(undefined)}
                    className={cn(
                      "px-2 py-1 rounded text-xs transition-colors",
                      !deviceTypeFilter ? "bg-zinc-800 text-zinc-200" : "text-zinc-500 hover:text-zinc-400"
                    )}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setDeviceTypeFilter("server")}
                    className={cn(
                      "px-2 py-1 rounded text-xs transition-colors flex items-center gap-1",
                      deviceTypeFilter === "server" ? "bg-zinc-800 text-zinc-200" : "text-zinc-500 hover:text-zinc-400"
                    )}
                  >
                    <Server className="h-3 w-3" />
                    Servers
                  </button>
                  <button
                    onClick={() => setDeviceTypeFilter("workstation")}
                    className={cn(
                      "px-2 py-1 rounded text-xs transition-colors flex items-center gap-1",
                      deviceTypeFilter === "workstation" ? "bg-zinc-800 text-zinc-200" : "text-zinc-500 hover:text-zinc-400"
                    )}
                  >
                    <Monitor className="h-3 w-3" />
                    Workstations
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {/* Customer search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                    placeholder="Search customers..."
                    className="pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 w-[250px]"
                  />
                  {customerSearchTerm && (
                    <button
                      onClick={() => setCustomerSearchTerm("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 overflow-hidden">
            {activeTab === "devices" ? (
              <BackupDeviceTable
                devices={(devices.data ?? []) as Parameters<typeof BackupDeviceTable>[0]["devices"]}
                isLoading={devices.isLoading}
                initialExpandedId={initialDeviceId}
              />
            ) : (
              <CustomerSummaryTable
                customers={(customers.data ?? []) as CustomerRow[]}
                isLoading={customers.isLoading}
                onSelectCustomer={handleSelectCustomer}
                searchTerm={customerSearchTerm}
              />
            )}
          </div>

          {/* Footer: count */}
          {activeTab === "devices" && devices.data && (
            <div className="text-xs text-zinc-500">
              Showing {devices.data.length} device{devices.data.length !== 1 ? "s" : ""}
              {customerFilter && selectedCustomerName && ` for ${selectedCustomerName}`}
            </div>
          )}
          {activeTab === "customers" && customers.data && (
            <div className="text-xs text-zinc-500">
              {customers.data.length} customer{customers.data.length !== 1 ? "s" : ""}
              {customerSearchTerm && ` · filtered by "${customerSearchTerm}"`}
            </div>
          )}
        </>
      )}
    </div>
  );
}
