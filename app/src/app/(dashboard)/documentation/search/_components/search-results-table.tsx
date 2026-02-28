"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Key,
  FileText,
  Monitor,
  Users,
  File,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Loader2,
  Globe,
  User,
  Lock,
  StickyNote,
  Tag,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

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

// ── Copyable field (click to copy, flash green) ──

function CopyField({ value, masked }: { value: string; masked?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [value]);

  const display = masked && !shown ? "••••••••••••" : value;

  return (
    <div className="flex items-center gap-1.5 group">
      <span className={cn("text-sm font-mono select-all", copied ? "text-emerald-400" : "text-white")}>
        {display}
      </span>
      {masked && (
        <button
          onClick={() => setShown(!shown)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
          title={shown ? "Hide" : "Show"}
        >
          {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
      <button
        onClick={handleCopy}
        className={cn("transition-colors", copied ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300")}
        title="Copy"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Detail field row ──

function DetailField({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="flex items-center gap-2 w-28 shrink-0">
        <Icon className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ── Expanded password detail panel ──

function PasswordDetailPanel({ itGlueId, accessMode }: { itGlueId: string; accessMode: ITGlueAccessMode }) {
  const revealMutation = trpc.documentation.getPasswordById.useMutation();
  const [credential, setCredential] = useState<{
    username?: string;
    password?: string;
    url?: string;
    notes?: string;
    resourceType?: string;
    otpSecret?: string;
    currentOtpCode?: string;
    updatedAt?: string;
  } | null>(null);
  const autoClearRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-clear password from memory after 60s
  useEffect(() => {
    return () => {
      if (autoClearRef.current) clearTimeout(autoClearRef.current);
    };
  }, []);

  const handleReveal = useCallback(() => {
    revealMutation.mutate(
      { id: itGlueId },
      {
        onSuccess: (data) => {
          setCredential({
            username: data.username,
            password: data.password,
            url: data.url,
            notes: data.notes,
            resourceType: data.resourceType,
            otpSecret: data.otpSecret,
            currentOtpCode: data.currentOtpCode,
            updatedAt: data.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : undefined,
          });
          // Auto-clear password after 60 seconds
          autoClearRef.current = setTimeout(() => {
            setCredential((prev) => prev ? { ...prev, password: undefined, otpSecret: undefined, currentOtpCode: undefined } : null);
          }, 60_000);
        },
      }
    );
  }, [itGlueId, revealMutation]);

  if (!credential && !revealMutation.isPending) {
    return (
      <div className="px-6 py-4 bg-zinc-900/50 border-t border-zinc-800/50">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleReveal}
            disabled={accessMode === "DENIED"}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Reveal Details
          </Button>
          {accessMode === "DENIED" && (
            <span className="text-xs text-red-400">Access denied for this asset</span>
          )}
          <span className="text-[10px] text-zinc-600 ml-auto">Revealing is audit-logged</span>
        </div>
      </div>
    );
  }

  if (revealMutation.isPending) {
    return (
      <div className="px-6 py-6 bg-zinc-900/50 border-t border-zinc-800/50 flex items-center gap-2 text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Fetching credentials...</span>
      </div>
    );
  }

  if (revealMutation.isError) {
    return (
      <div className="px-6 py-4 bg-zinc-900/50 border-t border-zinc-800/50">
        <span className="text-sm text-red-400">
          {revealMutation.error.message || "Failed to retrieve credentials"}
        </span>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 bg-zinc-900/50 border-t border-zinc-800/50 space-y-0.5">
      {credential?.username && (
        <DetailField icon={User} label="Username">
          <CopyField value={credential.username} />
        </DetailField>
      )}
      {credential?.password && (
        <DetailField icon={Lock} label="Password">
          <CopyField value={credential.password} masked />
        </DetailField>
      )}
      {credential?.currentOtpCode && (
        <DetailField icon={ShieldCheck} label="TOTP Code">
          <CopyField value={credential.currentOtpCode} />
        </DetailField>
      )}
      {credential?.url && (
        <DetailField icon={Globe} label="URL">
          <div className="flex items-center gap-1.5">
            <a
              href={credential.url.startsWith("http") ? credential.url : `https://${credential.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 truncate"
            >
              {credential.url}
            </a>
            <ExternalLink className="h-3 w-3 text-zinc-500 shrink-0" />
          </div>
        </DetailField>
      )}
      {credential?.resourceType && (
        <DetailField icon={Tag} label="Type">
          <span className="text-sm text-zinc-300">{credential.resourceType}</span>
        </DetailField>
      )}
      {credential?.notes && (
        <DetailField icon={StickyNote} label="Notes">
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{credential.notes}</p>
        </DetailField>
      )}
      {credential?.updatedAt && (
        <DetailField icon={Clock} label="Updated">
          <span className="text-sm text-zinc-400">{credential.updatedAt}</span>
        </DetailField>
      )}
      {!credential?.password && credential?.username && (
        <div className="pt-2 text-[10px] text-zinc-600">
          Password auto-cleared from memory (60s security timeout)
        </div>
      )}
    </div>
  );
}

// ── Non-password asset detail panel (configs, contacts, documents) ──

function GenericDetailPanel({ item }: { item: SearchResult }) {
  return (
    <div className="px-6 py-4 bg-zinc-900/50 border-t border-zinc-800/50">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        <DetailField icon={FileText} label="Section">
          <span className="text-sm text-zinc-300">{SECTION_LABELS[item.section] ?? item.section}</span>
        </DetailField>
        <DetailField icon={Tag} label="Category">
          <span className="text-sm text-zinc-300">{item.categoryName ?? "—"}</span>
        </DetailField>
        <DetailField icon={Users} label="Organization">
          <span className="text-sm text-zinc-300">{item.orgName}</span>
        </DetailField>
        <DetailField icon={Key} label="IT Glue ID">
          <span className="text-sm font-mono text-zinc-400">{item.itGlueId}</span>
        </DetailField>
      </div>
    </div>
  );
}

// ── Main table ──

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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Collapse on page/query change
  useEffect(() => {
    setExpandedId(null);
  }, [page, query]);

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
          const isExpanded = expandedId === item.itGlueId;
          const isPassword = item.section === "passwords";

          return (
            <div key={item.itGlueId}>
              <div
                className={cn(
                  "grid grid-cols-[1fr_180px_160px_140px_80px] gap-4 px-4 py-3 border-t border-zinc-800/50 transition-colors cursor-pointer",
                  isExpanded ? "bg-zinc-800/40" : "hover:bg-zinc-800/30"
                )}
                onClick={() => setExpandedId(isExpanded ? null : item.itGlueId)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-zinc-500 flex-shrink-0 transition-transform",
                      !isExpanded && "-rotate-90"
                    )}
                  />
                  <Icon className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                  <span className="text-white truncate">{item.name}</span>
                </div>
                <div className="text-zinc-400 truncate">{item.orgName}</div>
                <div className="text-zinc-400">{SECTION_LABELS[item.section] ?? item.section}</div>
                <div className="text-zinc-500 truncate">{item.categoryName ?? "—"}</div>
                <div><AccessModeBadge mode={item.accessMode} /></div>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && (
                isPassword ? (
                  <PasswordDetailPanel itGlueId={item.itGlueId} accessMode={item.accessMode} />
                ) : (
                  <GenericDetailPanel item={item} />
                )
              )}
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
