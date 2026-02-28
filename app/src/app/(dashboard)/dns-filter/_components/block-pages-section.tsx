"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Loader2,
  Building2,
  Save,
  Mail,
  Tag,
  Image,
} from "lucide-react";

interface BlockPagesSectionProps {
  organizationIds?: string[];
}

/* ─── Single Block Page Card (expandable + editable) ──── */

function BlockPageCard({
  blockPage,
  orgName,
}: {
  blockPage: {
    id: string;
    name: string;
    organizationId?: string;
    orgName?: string | null;
    email?: string | null;
    logoUuid?: string | null;
  };
  orgName: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editName, setEditName] = useState(blockPage.name);
  const [editOrgName, setEditOrgName] = useState(blockPage.orgName ?? "");
  const [editEmail, setEditEmail] = useState(blockPage.email ?? "");
  const [isDirty, setIsDirty] = useState(false);

  const utils = trpc.useUtils();

  const updateBlockPage = trpc.dnsFilter.updateBlockPage.useMutation({
    onSuccess: () => {
      utils.dnsFilter.getBlockPages.invalidate();
      setIsDirty(false);
    },
  });

  function handleFieldChange(
    field: "name" | "orgName" | "email",
    value: string
  ) {
    if (field === "name") setEditName(value);
    else if (field === "orgName") setEditOrgName(value);
    else setEditEmail(value);
    setIsDirty(true);
  }

  function handleSave() {
    updateBlockPage.mutate({
      blockPageId: blockPage.id,
      name: editName !== blockPage.name ? editName : undefined,
      orgName: editOrgName !== (blockPage.orgName ?? "") ? editOrgName : undefined,
      email: editEmail !== (blockPage.email ?? "") ? editEmail : undefined,
    });
  }

  // Reset local state when block page data changes (e.g. after refetch)
  const resetToServer = () => {
    setEditName(blockPage.name);
    setEditOrgName(blockPage.orgName ?? "");
    setEditEmail(blockPage.email ?? "");
    setIsDirty(false);
  };

  return (
    <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
      <button
        onClick={() => {
          if (!isExpanded) resetToServer();
          setIsExpanded(!isExpanded);
        }}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <FileText className="h-3.5 w-3.5 text-orange-400" />
        <span className="text-sm font-medium text-foreground flex-1">
          {blockPage.name}
        </span>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {blockPage.orgName && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {blockPage.orgName}
            </span>
          )}
          {blockPage.email && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {blockPage.email}
            </span>
          )}
          {blockPage.logoUuid && (
            <span className="flex items-center gap-1">
              <Image className="h-3 w-3" />
              Logo
            </span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 py-3 border-t border-border/50 space-y-3">
          {/* Editable Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Name */}
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <Tag className="h-3 w-3" />
                Block Page Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                className="w-full h-8 px-3 rounded-md bg-accent border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-violet-500/50 transition-colors"
              />
            </div>

            {/* Organization Display Name */}
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <Building2 className="h-3 w-3" />
                Organization Name (Display)
              </label>
              <input
                type="text"
                value={editOrgName}
                onChange={(e) => handleFieldChange("orgName", e.target.value)}
                placeholder="Shown on block page"
                className="w-full h-8 px-3 rounded-md bg-accent border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-violet-500/50 transition-colors"
              />
            </div>

            {/* Notice Email */}
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                <Mail className="h-3 w-3" />
                Notice Email
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => handleFieldChange("email", e.target.value)}
                placeholder="admin@example.com"
                className="w-full h-8 px-3 rounded-md bg-accent border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-violet-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Logo UUID (read-only) */}
          {blockPage.logoUuid && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Image className="h-3 w-3" />
              <span>Logo UUID: {blockPage.logoUuid}</span>
            </div>
          )}

          {/* Org context */}
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span>Organization: {orgName}</span>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-2 pt-1">
            {updateBlockPage.isError && (
              <span className="text-[10px] text-red-400">
                Save failed. Please try again.
              </span>
            )}
            {updateBlockPage.isSuccess && !isDirty && (
              <span className="text-[10px] text-green-400">Saved</span>
            )}
            <button
              onClick={handleSave}
              disabled={!isDirty || updateBlockPage.isPending}
              className={cn(
                "flex items-center gap-1.5 h-8 px-4 rounded-md text-xs font-medium transition-colors",
                isDirty
                  ? "bg-violet-600 hover:bg-violet-700 text-white"
                  : "bg-accent text-muted-foreground cursor-not-allowed"
              )}
            >
              {updateBlockPage.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Org Block Pages Group ───────────────────────────── */

function OrgBlockPagesGroup({
  orgName,
  blockPages,
  defaultExpanded,
}: {
  orgName: string;
  blockPages: Array<{
    id: string;
    name: string;
    organizationId?: string;
    orgName?: string | null;
    email?: string | null;
    logoUuid?: string | null;
  }>;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Building2 className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-medium text-foreground flex-1">
          {orgName}
        </span>
        <span className="text-xs text-muted-foreground">
          {blockPages.length}{" "}
          {blockPages.length === 1 ? "block page" : "block pages"}
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-2">
          {blockPages.map((bp) => (
            <BlockPageCard key={bp.id} blockPage={bp} orgName={orgName} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── MAIN BLOCK PAGES SECTION ─────────────────────────── */

export function BlockPagesSection({
  organizationIds,
}: BlockPagesSectionProps) {
  const blockPages = trpc.dnsFilter.getBlockPages.useQuery(undefined, {
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

  // Group block pages by org, respecting org filter
  const groupedByOrg = useMemo(() => {
    if (!blockPages.data) return new Map<string, NonNullable<typeof blockPages.data>>();

    const map = new Map<string, NonNullable<typeof blockPages.data>>();

    for (const bp of blockPages.data) {
      const orgId = bp.organizationId ?? "unknown";

      // Filter by selected orgs if applicable
      if (organizationIds?.length && !organizationIds.includes(orgId)) {
        continue;
      }

      if (!map.has(orgId)) map.set(orgId, []);
      map.get(orgId)!.push(bp);
    }

    return map;
  }, [blockPages.data, organizationIds]);

  // Sort org groups alphabetically
  const sortedOrgEntries = useMemo(() => {
    return Array.from(groupedByOrg.entries()).sort((a, b) =>
      (orgNameMap.get(a[0]) ?? "").localeCompare(orgNameMap.get(b[0]) ?? "")
    );
  }, [groupedByOrg, orgNameMap]);

  if (blockPages.isLoading || organizations.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3 px-1">
        <FileText className="h-4 w-4 text-orange-400" />
        <span className="text-xs text-muted-foreground">
          {blockPages.data?.length ?? 0} block{" "}
          {(blockPages.data?.length ?? 0) === 1 ? "page" : "pages"} across{" "}
          {sortedOrgEntries.length}{" "}
          {sortedOrgEntries.length === 1 ? "organization" : "organizations"}
        </span>
      </div>

      {/* Org Groups */}
      <div className="space-y-2">
        {sortedOrgEntries.map(([orgId, orgBlockPages]) => (
          <OrgBlockPagesGroup
            key={orgId}
            orgName={orgNameMap.get(orgId) ?? orgId}
            blockPages={orgBlockPages}
            defaultExpanded={organizationIds?.includes(orgId)}
          />
        ))}
      </div>

      {sortedOrgEntries.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No block pages found
        </div>
      )}
    </div>
  );
}
