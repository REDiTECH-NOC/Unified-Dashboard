"use client";

import {
  Users,
  FileText,
  FolderOpen,
  UsersRound,
  Shield,
  AlertTriangle,
  HardDrive,
} from "lucide-react";

interface CompanyDetailProps {
  company: {
    sourceId: string;
    name: string;
    status: string;
    plan: string;
    licensesUsed: number;
    licensesTotal: number;
    storageUsedBytes: number;
    storageTotalBytes: number;
    addOns: string[];
    totalUsers: number;
    activeUsers: number;
    totalRecords: number;
    totalSharedFolders: number;
    totalTeams: number;
    securityAuditScore?: number | null;
    breachWatchRecordsAtRisk?: number | null;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color = "text-blue-400",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
}) {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-zinc-400">{label}</span>
      </div>
      <p className="text-lg font-semibold text-zinc-100">{value}</p>
      {subtext && <p className="text-xs text-zinc-500 mt-0.5">{subtext}</p>}
    </div>
  );
}

export function KeeperCompanyDetail({ company }: CompanyDetailProps) {
  const licensePercent =
    company.licensesTotal > 0
      ? Math.round((company.licensesUsed / company.licensesTotal) * 100)
      : 0;

  return (
    <div className="px-4 py-3 bg-zinc-900/50 border-t border-zinc-800">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <StatCard
          icon={Users}
          label="Users"
          value={company.activeUsers}
          subtext={`${company.totalUsers} total`}
          color="text-blue-400"
        />
        <StatCard
          icon={FileText}
          label="Records"
          value={company.totalRecords.toLocaleString()}
          color="text-emerald-400"
        />
        <StatCard
          icon={FolderOpen}
          label="Shared Folders"
          value={company.totalSharedFolders}
          color="text-amber-400"
        />
        <StatCard
          icon={UsersRound}
          label="Teams"
          value={company.totalTeams}
          color="text-purple-400"
        />
        <StatCard
          icon={HardDrive}
          label="Storage"
          value={formatBytes(company.storageUsedBytes)}
          subtext={`of ${formatBytes(company.storageTotalBytes)}`}
          color="text-cyan-400"
        />
        <StatCard
          icon={Shield}
          label="Security Score"
          value={
            company.securityAuditScore != null
              ? `${company.securityAuditScore}%`
              : "N/A"
          }
          color={
            company.securityAuditScore != null && company.securityAuditScore >= 80
              ? "text-emerald-400"
              : company.securityAuditScore != null && company.securityAuditScore >= 50
                ? "text-amber-400"
                : "text-red-400"
          }
        />
        <StatCard
          icon={AlertTriangle}
          label="BreachWatch"
          value={
            company.breachWatchRecordsAtRisk != null
              ? company.breachWatchRecordsAtRisk.toLocaleString()
              : "N/A"
          }
          subtext={company.breachWatchRecordsAtRisk != null ? "at risk" : undefined}
          color={
            company.breachWatchRecordsAtRisk != null && company.breachWatchRecordsAtRisk > 0
              ? "text-red-400"
              : "text-emerald-400"
          }
        />
      </div>

      {/* License bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
          <span>
            Licenses: {company.licensesUsed} / {company.licensesTotal}
          </span>
          <span>{licensePercent}%</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              licensePercent >= 90
                ? "bg-red-500"
                : licensePercent >= 70
                  ? "bg-amber-500"
                  : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(licensePercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Add-ons */}
      {company.addOns.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {company.addOns.map((addon) => (
            <span
              key={addon}
              className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700"
            >
              {addon}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
