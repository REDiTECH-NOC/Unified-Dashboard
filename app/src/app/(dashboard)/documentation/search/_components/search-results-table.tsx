"use client";

import { Key, FileText, Monitor, Users, File, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
type ITGlueAccessMode = "READ_WRITE" | "READ_ONLY" | "DENIED";

interface SearchResult {
  itGlueId: string;
  name: string;
  orgId: string;
  orgName: string;
  section: string;
  categoryId: string | null;
  categoryName: string | null;
  accessMode: ITGlueAccessMode;
}

interface SearchResultsTableProps {
  data: SearchResult[];
  total: number;
  totalBeforeFilter: number;
  hasMore: boolean;
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  query: string;
}

const SECTION_ICONS: Record<string, typeof Key> = {
  passwords: Key,
  flexible_assets: FileText,
  configurations: Monitor,
  contacts: Users,
  documents: File,
};

const SECTION_LABELS: Record<string, string> = {
  passwords: "Password",
  flexible_assets: "Flexible Asset",
  configurations: "Configuration",
  contacts: "Contact",
  documents: "Document",
};

function AccessModeBadge({ mode }: { mode: ITGlueAccessMode }) {
  if (mode === "READ_WRITE") {
    return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">R/W</Badge>;
  }
  if (mode === "READ_ONLY") {
    return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">R/O</Badge>;
  }
  return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Denied</Badge>;
}

export function SearchResultsTable({
  data,
  total,
  totalBeforeFilter,
  hasMore,
  isLoading,
  page,
  onPageChange,
  query,
}: SearchResultsTableProps) {
  if (!query) {
    return (
      <div className="text-center py-16 text-zinc-500">
        Type a search query to find IT Glue assets.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-16 text-zinc-400">
        Searching...
      </div>
    );
  }

  if (data.length === 0 && !isLoading) {
    return (
      <div className="text-center py-16 text-zinc-500">
        {totalBeforeFilter > 0
          ? `No results — ${totalBeforeFilter} assets matched but were filtered by your permissions.`
          : `No results for "${query}".`}
      </div>
    );
  }

  const filtered = totalBeforeFilter - total;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_180px_160px_140px_80px] gap-4 px-4 py-2.5 bg-zinc-900/50 text-xs font-medium text-zinc-400 uppercase tracking-wider">
          <div>Name</div>
          <div>Organization</div>
          <div>Section</div>
          <div>Category</div>
          <div>Access</div>
        </div>

        {/* Rows */}
        {data.map((item) => {
          const Icon = SECTION_ICONS[item.section] ?? File;
          return (
            <div
              key={item.itGlueId}
              className="grid grid-cols-[1fr_180px_160px_140px_80px] gap-4 px-4 py-3 border-t border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                <span className="text-white truncate">{item.name}</span>
              </div>
              <div className="text-zinc-400 truncate">{item.orgName}</div>
              <div className="text-zinc-400">{SECTION_LABELS[item.section] ?? item.section}</div>
              <div className="text-zinc-500 truncate">{item.categoryName ?? "—"}</div>
              <div><AccessModeBadge mode={item.accessMode} /></div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-zinc-400">
        <div>
          {total} result{total !== 1 ? "s" : ""}
          {filtered > 0 && (
            <span className="text-zinc-500"> ({filtered} filtered by permissions)</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="border-zinc-700 text-zinc-400 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-zinc-400 text-sm">Page {page}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={!hasMore}
            className="border-zinc-700 text-zinc-400 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
