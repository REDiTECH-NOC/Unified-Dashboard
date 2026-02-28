"use client";

import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  ChevronRight,
  ChevronDown,
  Search,
  Loader2,
  Key,
  Layers,
  Monitor,
  UserRound,
  FileText,
  Building2,
  Globe,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

// ── Types ──────────────────────────────────────────────────────────

type AccessMode = "READ_WRITE" | "READ_ONLY" | "DENIED";

interface ExistingRule {
  id: string;
  orgId: string;
  section: string | null;
  categoryId: string | null;
  assetId: string | null;
  accessMode: AccessMode;
}

interface ITGlueOrgPermissionTreeProps {
  groupId: string;
  existingRules: ExistingRule[];
}

// ── Constants ──────────────────────────────────────────────────────

const SECTIONS = [
  { key: "passwords", label: "Passwords", icon: Key },
  { key: "flexible_assets", label: "Flexible Assets", icon: Layers },
  { key: "configurations", label: "Configurations", icon: Monitor },
  { key: "contacts", label: "Contacts", icon: UserRound },
  { key: "documents", label: "Documents", icon: FileText },
] as const;

const MODE_LABELS: Record<AccessMode, string> = {
  READ_WRITE: "Read/Write",
  READ_ONLY: "Read Only",
  DENIED: "Denied",
};

const MODE_COLORS: Record<AccessMode | "NONE", string> = {
  READ_WRITE: "text-emerald-400",
  READ_ONLY: "text-amber-400",
  DENIED: "text-red-400",
  NONE: "text-zinc-500",
};

// ── Rule Index Helper ──────────────────────────────────────────────

function makeRuleKey(
  orgId: string,
  section?: string | null,
  categoryId?: string | null,
  assetId?: string | null
): string {
  if (assetId) return `${orgId}:${section ?? ""}:${categoryId ?? ""}:${assetId}`;
  if (categoryId) return `${orgId}:${section}:${categoryId}`;
  if (section) return `${orgId}:${section}`;
  return orgId;
}

function buildRuleIndex(rules: ExistingRule[]) {
  const map = new Map<string, { id: string; accessMode: AccessMode }>();
  for (const rule of rules) {
    const key = makeRuleKey(rule.orgId, rule.section, rule.categoryId, rule.assetId);
    map.set(key, { id: rule.id, accessMode: rule.accessMode });
  }
  return map;
}

function getEffectiveAccess(
  ruleIndex: Map<string, { id: string; accessMode: AccessMode }>,
  orgId: string,
  section?: string | null,
  categoryId?: string | null,
  assetId?: string | null
): { mode: AccessMode | null; isExplicit: boolean } {
  // Check from most specific to least specific
  const keys: string[] = [];
  if (assetId) keys.push(makeRuleKey(orgId, section, categoryId, assetId));
  if (categoryId) keys.push(makeRuleKey(orgId, section, categoryId));
  if (section) keys.push(makeRuleKey(orgId, section));
  keys.push(makeRuleKey(orgId));
  // Wildcard "*" as final fallback (global default)
  if (orgId !== "*") keys.push(makeRuleKey("*"));

  for (let i = 0; i < keys.length; i++) {
    const rule = ruleIndex.get(keys[i]);
    if (rule) {
      return { mode: rule.accessMode, isExplicit: i === 0 };
    }
  }
  return { mode: null, isExplicit: false };
}

// ── Access Dropdown ────────────────────────────────────────────────

function AccessDropdown({
  level,
  orgId,
  section,
  categoryId,
  assetId,
  ruleIndex,
  isPending,
  onChange,
}: {
  level: "org" | "child";
  orgId: string;
  section?: string | null;
  categoryId?: string | null;
  assetId?: string | null;
  ruleIndex: Map<string, { id: string; accessMode: AccessMode }>;
  isPending: boolean;
  onChange: (value: string) => void;
}) {
  const key = makeRuleKey(orgId, section, categoryId, assetId);
  const explicitRule = ruleIndex.get(key);
  const { mode: effectiveMode } = getEffectiveAccess(ruleIndex, orgId, section, categoryId, assetId);

  // Current explicit value for this node
  const currentValue = explicitRule
    ? explicitRule.accessMode
    : level === "org"
      ? "NO_ACCESS"
      : "INHERITED";

  // Derive the parent's effective mode for "Inherited" label
  let parentEffective: { mode: AccessMode | null; isExplicit: boolean } | null = null;
  if (level === "child") {
    if (!section && !categoryId && !assetId) {
      // This is an org-level node — parent is the wildcard "*"
      const wildcardRule = ruleIndex.get(makeRuleKey("*"));
      parentEffective = wildcardRule
        ? { mode: wildcardRule.accessMode, isExplicit: true }
        : { mode: null, isExplicit: false };
    } else {
      parentEffective = getEffectiveAccess(
        ruleIndex,
        orgId,
        assetId ? section : categoryId ? section : null,
        assetId ? categoryId : null,
        null
      );
    }
  }

  const inheritedLabel =
    parentEffective?.mode
      ? `Inherited (${MODE_LABELS[parentEffective.mode]})`
      : "Inherited";

  const colorClass =
    currentValue === "NO_ACCESS"
      ? MODE_COLORS.NONE
      : currentValue === "INHERITED"
        ? MODE_COLORS.NONE
        : MODE_COLORS[currentValue as AccessMode];

  return (
    <div className="relative flex items-center gap-1.5">
      {isPending && (
        <Loader2 className="h-3 w-3 animate-spin text-zinc-400 absolute -left-5" />
      )}
      <select
        value={currentValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={isPending}
        className={`bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs font-medium focus:outline-none focus:border-zinc-500 cursor-pointer disabled:opacity-50 ${colorClass}`}
      >
        {level === "org" ? (
          <>
            <option value="NO_ACCESS" className="text-zinc-500">No Access</option>
            <option value="READ_ONLY" className="text-amber-400">Read Only</option>
            <option value="READ_WRITE" className="text-emerald-400">Read/Write</option>
          </>
        ) : (
          <>
            <option value="INHERITED" className="text-zinc-500">{inheritedLabel}</option>
            <option value="READ_ONLY" className="text-amber-400">Read Only</option>
            <option value="READ_WRITE" className="text-emerald-400">Read/Write</option>
            <option value="DENIED" className="text-red-400">Denied</option>
          </>
        )}
      </select>
    </div>
  );
}

// ── Asset Row (leaf) ───────────────────────────────────────────────

function AssetRow({
  orgId,
  section,
  categoryId,
  asset,
  ruleIndex,
  groupId,
}: {
  orgId: string;
  section: string;
  categoryId: string | null;
  asset: { itGlueId: string; name: string };
  ruleIndex: Map<string, { id: string; accessMode: AccessMode }>;
  groupId: string;
}) {
  const utils = trpc.useUtils();
  const addRule = trpc.itGluePerm.addRule.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });
  const updateRule = trpc.itGluePerm.updateRule.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });
  const removeRule = trpc.itGluePerm.removeRule.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });

  const isPending = addRule.isPending || updateRule.isPending || removeRule.isPending;

  const handleChange = useCallback(
    (value: string) => {
      const key = makeRuleKey(orgId, section, categoryId, asset.itGlueId);
      const existing = ruleIndex.get(key);

      if (value === "INHERITED") {
        if (existing) removeRule.mutate({ id: existing.id });
      } else if (existing) {
        updateRule.mutate({ id: existing.id, accessMode: value as AccessMode });
      } else {
        addRule.mutate({
          groupId,
          orgId,
          section: section as "passwords" | "flexible_assets" | "configurations" | "contacts" | "documents",
          categoryId,
          assetId: asset.itGlueId,
          accessMode: value as AccessMode,
        });
      }
    },
    [orgId, section, categoryId, asset.itGlueId, ruleIndex, groupId, addRule, updateRule, removeRule]
  );

  return (
    <div className="flex items-center justify-between py-1.5 pl-[4.5rem] pr-3 hover:bg-zinc-800/50 rounded">
      <span className="text-xs text-zinc-400 truncate mr-3">{asset.name}</span>
      <AccessDropdown
        level="child"
        orgId={orgId}
        section={section}
        categoryId={categoryId}
        assetId={asset.itGlueId}
        ruleIndex={ruleIndex}
        isPending={isPending}
        onChange={handleChange}
      />
    </div>
  );
}

// ── Category Row ───────────────────────────────────────────────────

function CategoryRow({
  orgId,
  section,
  category,
  ruleIndex,
  groupId,
}: {
  orgId: string;
  section: string;
  category: { itGlueId: string; name: string };
  ruleIndex: Map<string, { id: string; accessMode: AccessMode }>;
  groupId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const utils = trpc.useUtils();

  const assets = trpc.itGluePerm.getCachedAssets.useQuery(
    { orgId, section: section as "passwords" | "flexible_assets" | "configurations" | "contacts" | "documents", categoryId: category.itGlueId },
    { enabled: expanded, staleTime: 60_000 }
  );

  const addRule = trpc.itGluePerm.addRule.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });
  const updateRule = trpc.itGluePerm.updateRule.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });
  const removeRule = trpc.itGluePerm.removeRule.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });

  const isPending = addRule.isPending || updateRule.isPending || removeRule.isPending;

  const handleChange = useCallback(
    (value: string) => {
      const key = makeRuleKey(orgId, section, category.itGlueId);
      const existing = ruleIndex.get(key);

      if (value === "INHERITED") {
        if (existing) removeRule.mutate({ id: existing.id });
      } else if (existing) {
        updateRule.mutate({ id: existing.id, accessMode: value as AccessMode });
      } else {
        addRule.mutate({
          groupId,
          orgId,
          section: section as "passwords" | "flexible_assets" | "configurations" | "contacts" | "documents",
          categoryId: category.itGlueId,
          accessMode: value as AccessMode,
        });
      }
    },
    [orgId, section, category.itGlueId, ruleIndex, groupId, addRule, updateRule, removeRule]
  );

  const assetCount = assets.data?.length ?? 0;

  return (
    <div>
      <div
        className="flex items-center justify-between py-1.5 pl-12 pr-3 hover:bg-zinc-800/50 rounded cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
          )}
          <span className="text-xs text-zinc-300 truncate">{category.name}</span>
          {expanded && (
            <span className="text-[10px] text-zinc-600">{assetCount} items</span>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <AccessDropdown
            level="child"
            orgId={orgId}
            section={section}
            categoryId={category.itGlueId}
            ruleIndex={ruleIndex}
            isPending={isPending}
            onChange={handleChange}
          />
        </div>
      </div>

      {expanded && (
        <div className="border-l border-zinc-800 ml-[3.25rem]">
          {assets.isLoading ? (
            <div className="flex items-center gap-2 py-2 pl-6 text-xs text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading assets...
            </div>
          ) : assetCount === 0 ? (
            <div className="py-2 pl-6 text-xs text-zinc-600">No cached assets</div>
          ) : (
            (assets.data ?? []).map(
              (asset: { itGlueId: string; name: string }) => (
                <AssetRow
                  key={asset.itGlueId}
                  orgId={orgId}
                  section={section}
                  categoryId={category.itGlueId}
                  asset={asset}
                  ruleIndex={ruleIndex}
                  groupId={groupId}
                />
              )
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Section Row ────────────────────────────────────────────────────

function SectionRow({
  orgId,
  section,
  ruleIndex,
  groupId,
}: {
  orgId: string;
  section: (typeof SECTIONS)[number];
  ruleIndex: Map<string, { id: string; accessMode: AccessMode }>;
  groupId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const utils = trpc.useUtils();
  const Icon = section.icon;
  const hasCategories = section.key === "passwords" || section.key === "flexible_assets";

  // Category data (global, cached aggressively)
  const passwordCats = trpc.itGluePerm.getCachedPasswordCategories.useQuery(undefined, {
    enabled: expanded && section.key === "passwords",
    staleTime: 5 * 60_000,
  });
  const assetTypes = trpc.itGluePerm.getCachedAssetTypes.useQuery(undefined, {
    enabled: expanded && section.key === "flexible_assets",
    staleTime: 5 * 60_000,
  });

  // Direct assets (for sections without categories)
  const directAssets = trpc.itGluePerm.getCachedAssets.useQuery(
    { orgId, section: section.key as "passwords" | "flexible_assets" | "configurations" | "contacts" | "documents" },
    { enabled: expanded && !hasCategories, staleTime: 60_000 }
  );

  // Section-level mutations
  const addRule = trpc.itGluePerm.addRule.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });
  const updateRule = trpc.itGluePerm.updateRule.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });
  const removeRule = trpc.itGluePerm.removeRule.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });

  const isPending = addRule.isPending || updateRule.isPending || removeRule.isPending;

  const handleChange = useCallback(
    (value: string) => {
      const key = makeRuleKey(orgId, section.key);
      const existing = ruleIndex.get(key);

      if (value === "INHERITED") {
        if (existing) removeRule.mutate({ id: existing.id });
      } else if (existing) {
        updateRule.mutate({ id: existing.id, accessMode: value as AccessMode });
      } else {
        addRule.mutate({
          groupId,
          orgId,
          section: section.key as "passwords" | "flexible_assets" | "configurations" | "contacts" | "documents",
          accessMode: value as AccessMode,
        });
      }
    },
    [orgId, section.key, ruleIndex, groupId, addRule, updateRule, removeRule]
  );

  const categories =
    section.key === "passwords"
      ? passwordCats.data ?? []
      : section.key === "flexible_assets"
        ? assetTypes.data ?? []
        : [];

  const isChildLoading =
    (section.key === "passwords" && passwordCats.isLoading) ||
    (section.key === "flexible_assets" && assetTypes.isLoading) ||
    (!hasCategories && directAssets.isLoading);

  return (
    <div>
      <div
        className="flex items-center justify-between py-1.5 pl-8 pr-3 hover:bg-zinc-800/50 rounded cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
          )}
          <Icon className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
          <span className="text-xs text-zinc-300">{section.label}</span>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <AccessDropdown
            level="child"
            orgId={orgId}
            section={section.key}
            ruleIndex={ruleIndex}
            isPending={isPending}
            onChange={handleChange}
          />
        </div>
      </div>

      {expanded && (
        <div className="border-l border-zinc-800 ml-[2.25rem]">
          {isChildLoading ? (
            <div className="flex items-center gap-2 py-2 pl-6 text-xs text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </div>
          ) : hasCategories ? (
            categories.length === 0 ? (
              <div className="py-2 pl-6 text-xs text-zinc-600">No categories cached</div>
            ) : (
              (categories as { itGlueId: string; name: string }[]).map((cat) => (
                <CategoryRow
                  key={cat.itGlueId}
                  orgId={orgId}
                  section={section.key}
                  category={cat}
                  ruleIndex={ruleIndex}
                  groupId={groupId}
                />
              ))
            )
          ) : (directAssets.data ?? []).length === 0 ? (
            <div className="py-2 pl-6 text-xs text-zinc-600">No cached assets</div>
          ) : (
            (directAssets.data ?? []).map(
              (asset: { itGlueId: string; name: string }) => (
                <AssetRow
                  key={asset.itGlueId}
                  orgId={orgId}
                  section={section.key}
                  categoryId={null}
                  asset={asset}
                  ruleIndex={ruleIndex}
                  groupId={groupId}
                />
              )
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── All Organizations Row (wildcard) ───────────────────────────────

function AllOrgsRow({
  ruleIndex,
  groupId,
}: {
  ruleIndex: Map<string, { id: string; accessMode: AccessMode }>;
  groupId: string;
}) {
  const utils = trpc.useUtils();

  const addRule = trpc.itGluePerm.addRule.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });
  const updateRule = trpc.itGluePerm.updateRule.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });
  const removeRule = trpc.itGluePerm.removeRule.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });

  const isPending = addRule.isPending || updateRule.isPending || removeRule.isPending;
  const wildcardKey = makeRuleKey("*");

  const handleChange = useCallback(
    (value: string) => {
      const existing = ruleIndex.get(wildcardKey);

      if (value === "NO_ACCESS") {
        if (existing) removeRule.mutate({ id: existing.id });
      } else if (existing) {
        updateRule.mutate({ id: existing.id, accessMode: value as AccessMode });
      } else {
        addRule.mutate({
          groupId,
          orgId: "*",
          accessMode: value as AccessMode,
        });
      }
    },
    [wildcardKey, ruleIndex, groupId, addRule, updateRule, removeRule]
  );

  return (
    <div className="bg-zinc-800/50 border-b border-zinc-700">
      <div className="flex items-center justify-between py-2.5 px-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-blue-400 flex-shrink-0" />
          <span className="text-sm text-zinc-100 font-semibold">All Organizations</span>
          <span className="text-[10px] text-zinc-500">(default)</span>
        </div>
        <AccessDropdown
          level="org"
          orgId="*"
          ruleIndex={ruleIndex}
          isPending={isPending}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}

// ── Org Row ────────────────────────────────────────────────────────

function OrgRow({
  org,
  ruleIndex,
  groupId,
}: {
  org: { itGlueId: string; name: string };
  ruleIndex: Map<string, { id: string; accessMode: AccessMode }>;
  groupId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const utils = trpc.useUtils();

  const addRule = trpc.itGluePerm.addRule.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });
  const updateRule = trpc.itGluePerm.updateRule.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });
  const removeRule = trpc.itGluePerm.removeRule.useMutation({
    onSuccess: () => utils.itGluePerm.getById.invalidate({ id: groupId }),
  });

  const isPending = addRule.isPending || updateRule.isPending || removeRule.isPending;

  const orgKey = makeRuleKey(org.itGlueId);
  const { mode: effectiveMode } = getEffectiveAccess(ruleIndex, org.itGlueId);
  const hasExplicitRule = ruleIndex.has(orgKey);
  const hasAnyAccess = effectiveMode !== null;

  const handleChange = useCallback(
    (value: string) => {
      const existing = ruleIndex.get(orgKey);

      if (value === "INHERITED") {
        // Remove explicit org rule — fall back to wildcard/default
        if (existing) removeRule.mutate({ id: existing.id });
      } else if (existing) {
        updateRule.mutate({ id: existing.id, accessMode: value as AccessMode });
      } else {
        addRule.mutate({
          groupId,
          orgId: org.itGlueId,
          accessMode: value as AccessMode,
        });
      }
    },
    [orgKey, ruleIndex, groupId, org.itGlueId, addRule, updateRule, removeRule]
  );

  return (
    <div className={hasExplicitRule || hasAnyAccess ? "bg-zinc-800/30 rounded-lg" : ""}>
      <div
        className="flex items-center justify-between py-2 pl-3 pr-3 hover:bg-zinc-800/50 rounded cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-zinc-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-zinc-400 flex-shrink-0" />
          )}
          <Building2 className="h-4 w-4 text-zinc-500 flex-shrink-0" />
          <span className="text-sm text-zinc-200 truncate font-medium">{org.name}</span>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <AccessDropdown
            level="child"
            orgId={org.itGlueId}
            ruleIndex={ruleIndex}
            isPending={isPending}
            onChange={handleChange}
          />
        </div>
      </div>

      {expanded && (
        <div className="border-l border-zinc-700/50 ml-5 mb-2">
          {SECTIONS.map((section) => (
            <SectionRow
              key={section.key}
              orgId={org.itGlueId}
              section={section}
              ruleIndex={ruleIndex}
              groupId={groupId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Tree Component ────────────────────────────────────────────

export function ITGlueOrgPermissionTree({
  groupId,
  existingRules,
}: ITGlueOrgPermissionTreeProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const orgsQuery = trpc.itGluePerm.getCachedOrgs.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  const ruleIndex = useMemo(() => buildRuleIndex(existingRules), [existingRules]);

  const filteredOrgs = useMemo(() => {
    const orgs = orgsQuery.data ?? [];
    if (!searchQuery) return orgs;
    const q = searchQuery.toLowerCase();
    return orgs.filter((org: { name: string }) =>
      org.name.toLowerCase().includes(q)
    );
  }, [orgsQuery.data, searchQuery]);

  if (orgsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading organizations...
      </div>
    );
  }

  const totalOrgs = (orgsQuery.data ?? []).length;

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search organizations..."
          className="pl-9 bg-zinc-800 border-zinc-700 text-zinc-200 text-sm h-9"
        />
      </div>

      {/* Stats */}
      <div className="text-[10px] text-zinc-600 px-1">
        {totalOrgs} organizations
        {searchQuery && ` · ${filteredOrgs.length} matching "${searchQuery}"`}
      </div>

      {/* Org list */}
      <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-zinc-800 divide-y divide-zinc-800/50">
        {/* All Organizations wildcard row */}
        <AllOrgsRow ruleIndex={ruleIndex} groupId={groupId} />

        {filteredOrgs.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500">
            {totalOrgs === 0
              ? "No organizations cached. Run an IT Glue sync first."
              : "No organizations match your search."}
          </div>
        ) : (
          filteredOrgs.map((org: { itGlueId: string; name: string }) => (
            <OrgRow
              key={org.itGlueId}
              org={org}
              ruleIndex={ruleIndex}
              groupId={groupId}
            />
          ))
        )}
      </div>
    </div>
  );
}
