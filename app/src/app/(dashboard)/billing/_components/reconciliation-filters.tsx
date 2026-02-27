"use client";

import { Search, Filter } from "lucide-react";

export interface FilterState {
  companyId: string | undefined;
  vendorToolId: string | undefined;
  status: string | undefined;
  discrepancyOnly: boolean;
  search: string;
}

interface Props {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  companies: Array<{ id: string; name: string }>;
}

const VENDOR_OPTIONS = [
  { value: "", label: "All Vendors" },
  { value: "ninjaone", label: "NinjaOne" },
  { value: "sentinelone", label: "SentinelOne" },
  { value: "cove", label: "Cove Backup" },
  { value: "pax8", label: "Pax8" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "dismissed", label: "Dismissed" },
  { value: "adjusted", label: "Adjusted" },
];

export function ReconciliationFilters({ filters, onFiltersChange, companies }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search products..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="h-9 w-[200px] rounded-md border border-zinc-800 bg-zinc-950 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-none"
        />
      </div>

      {/* Company filter */}
      <select
        value={filters.companyId ?? ""}
        onChange={(e) => onFiltersChange({ ...filters, companyId: e.target.value || undefined })}
        className="h-9 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300 focus:border-zinc-700 focus:outline-none"
      >
        <option value="">All Companies</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {/* Vendor filter */}
      <select
        value={filters.vendorToolId ?? ""}
        onChange={(e) => onFiltersChange({ ...filters, vendorToolId: e.target.value || undefined })}
        className="h-9 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300 focus:border-zinc-700 focus:outline-none"
      >
        {VENDOR_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Status filter */}
      <select
        value={filters.status ?? ""}
        onChange={(e) => onFiltersChange({ ...filters, status: e.target.value || undefined })}
        className="h-9 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-300 focus:border-zinc-700 focus:outline-none"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Discrepancy toggle */}
      <button
        onClick={() => onFiltersChange({ ...filters, discrepancyOnly: !filters.discrepancyOnly })}
        className={`flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm transition-colors ${
          filters.discrepancyOnly
            ? "border-red-500/30 bg-red-500/10 text-red-400"
            : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-300"
        }`}
      >
        <Filter className="h-3.5 w-3.5" />
        Discrepancies Only
      </button>
    </div>
  );
}
