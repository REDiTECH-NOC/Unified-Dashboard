"use client";

import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Shield,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Loader2,
  Building2,
  Globe,
  Search,
  Wifi,
  Monitor,
  AppWindow,
  Lock,
  ListFilter,
  AlertTriangle,
} from "lucide-react";

/* ─── Types ────────────────────────────────────────────── */

interface PolicyEditorProps {
  organizationIds?: string[];
}

type PolicyTab =
  | "categories"
  | "threats"
  | "safesearch"
  | "appaware"
  | "allowlist"
  | "blocklist";

const POLICY_TABS: { id: PolicyTab; label: string; icon: React.ElementType }[] = [
  { id: "categories", label: "Categories", icon: ListFilter },
  { id: "threats", label: "Threats", icon: ShieldAlert },
  { id: "safesearch", label: "Safe Search", icon: Search },
  { id: "appaware", label: "AppAware", icon: AppWindow },
  { id: "allowlist", label: "Allow List", icon: Globe },
  { id: "blocklist", label: "Block List", icon: Lock },
];

/* ═══════════════════════════════════════════════════════════
   TOGGLE SWITCH — custom div-based toggle
   ═══════════════════════════════════════════════════════════ */

function Toggle({
  checked,
  onChange,
  disabled,
  size = "sm",
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const w = size === "sm" ? "w-8" : "w-10";
  const h = size === "sm" ? "h-[18px]" : "h-5";
  const dot = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const translate = size === "sm" ? "translate-x-[14px]" : "translate-x-[20px]";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors duration-200",
        w,
        h,
        checked ? "bg-violet-600" : "bg-zinc-600",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block rounded-full bg-white shadow-sm transition-transform duration-200",
          dot,
          "mt-[2px] ml-[2px]",
          checked ? translate : "translate-x-0"
        )}
      />
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   CATEGORIES TAB
   ═══════════════════════════════════════════════════════════ */

function CategoriesTab({
  policyId,
  blockedCategories,
}: {
  policyId: string;
  blockedCategories: number[];
}) {
  const [searchQ, setSearchQ] = useState("");
  const utils = trpc.useUtils();

  const categories = trpc.dnsFilter.getCategories.useQuery(undefined, {
    retry: false,
    staleTime: 60 * 60_000,
  });

  const addCategory = trpc.dnsFilter.addBlockedCategory.useMutation({
    onSuccess: () => utils.dnsFilter.getPolicies.invalidate(),
  });
  const removeCategory = trpc.dnsFilter.removeBlockedCategory.useMutation({
    onSuccess: () => utils.dnsFilter.getPolicies.invalidate(),
  });

  // Filter out security categories (those go in the Threats tab)
  const contentCategories = useMemo(() => {
    if (!categories.data) return [];
    return categories.data
      .filter((c) => !c.isSecurity)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories.data]);

  const filtered = useMemo(() => {
    if (!searchQ.trim()) return contentCategories;
    const q = searchQ.toLowerCase();
    return contentCategories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
    );
  }, [contentCategories, searchQ]);

  const blockedSet = useMemo(() => new Set(blockedCategories), [blockedCategories]);

  const handleToggle = useCallback(
    (categoryId: number) => {
      if (blockedSet.has(categoryId)) {
        removeCategory.mutate({ policyId, categoryId });
      } else {
        addCategory.mutate({ policyId, categoryId });
      }
    },
    [policyId, blockedSet, addCategory, removeCategory]
  );

  if (categories.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex items-center gap-2 h-8 px-3 rounded-md bg-accent">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Filter categories..."
          className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
        />
        {searchQ && (
          <button onClick={() => setSearchQ("")} className="text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        {blockedCategories.filter((id) => contentCategories.some((c) => Number(c.id) === id)).length} of {contentCategories.length} content categories blocked
      </p>

      {/* Category Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {filtered.map((cat) => {
          const isBlocked = blockedSet.has(Number(cat.id));
          const isPending =
            (addCategory.isPending && addCategory.variables?.categoryId === Number(cat.id)) ||
            (removeCategory.isPending && removeCategory.variables?.categoryId === Number(cat.id));

          return (
            <button
              key={cat.id}
              onClick={() => handleToggle(Number(cat.id))}
              disabled={isPending}
              title={cat.description || cat.name}
              className={cn(
                "relative px-2.5 py-1.5 rounded-md border text-xs text-left transition-all duration-150",
                isBlocked
                  ? "bg-violet-600 border-violet-500 text-white"
                  : "bg-accent border-border text-muted-foreground hover:text-foreground hover:border-zinc-500",
                isPending && "opacity-50"
              )}
            >
              <span className="truncate block">{cat.name}</span>
              {isPending && (
                <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin" />
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No categories match your search
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   THREATS TAB (security categories)
   ═══════════════════════════════════════════════════════════ */

function ThreatsTab({
  policyId,
  blockedCategories,
}: {
  policyId: string;
  blockedCategories: number[];
}) {
  const utils = trpc.useUtils();

  const categories = trpc.dnsFilter.getCategories.useQuery(undefined, {
    retry: false,
    staleTime: 60 * 60_000,
  });

  const addCategory = trpc.dnsFilter.addBlockedCategory.useMutation({
    onSuccess: () => utils.dnsFilter.getPolicies.invalidate(),
  });
  const removeCategory = trpc.dnsFilter.removeBlockedCategory.useMutation({
    onSuccess: () => utils.dnsFilter.getPolicies.invalidate(),
  });

  const securityCategories = useMemo(() => {
    if (!categories.data) return [];
    return categories.data
      .filter((c) => c.isSecurity)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories.data]);

  const blockedSet = useMemo(() => new Set(blockedCategories), [blockedCategories]);

  const handleToggle = useCallback(
    (categoryId: number) => {
      if (blockedSet.has(categoryId)) {
        removeCategory.mutate({ policyId, categoryId });
      } else {
        addCategory.mutate({ policyId, categoryId });
      }
    },
    [policyId, blockedSet, addCategory, removeCategory]
  );

  if (categories.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const blockedCount = securityCategories.filter((c) => blockedSet.has(Number(c.id))).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-orange-400" />
        <p className="text-xs text-muted-foreground">
          {blockedCount} of {securityCategories.length} security threat categories blocked
        </p>
      </div>

      {blockedCount < securityCategories.length && (
        <div className="flex items-center gap-2 rounded-md bg-orange-500/10 border border-orange-500/20 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0" />
          <p className="text-[10px] text-orange-400">
            Not all threat categories are blocked. Enable all for maximum protection.
          </p>
        </div>
      )}

      <div className="space-y-1">
        {securityCategories.map((cat) => {
          const isBlocked = blockedSet.has(Number(cat.id));
          const isPending =
            (addCategory.isPending && addCategory.variables?.categoryId === Number(cat.id)) ||
            (removeCategory.isPending && removeCategory.variables?.categoryId === Number(cat.id));

          return (
            <div
              key={cat.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors",
                isBlocked
                  ? "bg-violet-600/10 border-violet-500/30"
                  : "bg-accent/50 border-border"
              )}
            >
              <ShieldAlert className={cn("h-3.5 w-3.5 shrink-0", isBlocked ? "text-violet-400" : "text-zinc-500")} />
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-medium", isBlocked ? "text-foreground" : "text-muted-foreground")}>
                  {cat.name}
                </p>
                {cat.description && (
                  <p className="text-[10px] text-muted-foreground truncate">{cat.description}</p>
                )}
              </div>
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : (
                <Toggle checked={isBlocked} onChange={() => handleToggle(Number(cat.id))} />
              )}
            </div>
          );
        })}
      </div>

      {securityCategories.length === 0 && (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No security categories found
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SAFE SEARCH TAB
   ═══════════════════════════════════════════════════════════ */

interface SafeSearchSettings {
  googleSafesearch?: boolean;
  bingSafeSearch?: boolean;
  duckDuckGoSafeSearch?: boolean;
  ecosiaSafesearch?: boolean;
  yandexSafeSearch?: boolean;
  youtubeRestricted?: boolean;
  youtubeRestrictedLevel?: string;
  allowUnknownDomains?: boolean;
}

const SAFE_SEARCH_FIELDS: {
  key: keyof SafeSearchSettings;
  apiKey: string;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  { key: "googleSafesearch", apiKey: "google_safesearch", label: "Google SafeSearch", description: "Force SafeSearch on Google queries", icon: Search },
  { key: "bingSafeSearch", apiKey: "bing_safe_search", label: "Bing SafeSearch", description: "Force SafeSearch on Bing queries", icon: Search },
  { key: "duckDuckGoSafeSearch", apiKey: "duck_duck_go_safe_search", label: "DuckDuckGo SafeSearch", description: "Force SafeSearch on DuckDuckGo queries", icon: Search },
  { key: "ecosiaSafesearch", apiKey: "ecosia_safesearch", label: "Ecosia SafeSearch", description: "Force SafeSearch on Ecosia queries", icon: Search },
  { key: "yandexSafeSearch", apiKey: "yandex_safe_search", label: "Yandex SafeSearch", description: "Force SafeSearch on Yandex queries", icon: Search },
  { key: "youtubeRestricted", apiKey: "youtube_restricted", label: "YouTube Restricted Mode", description: "Force YouTube Restricted Mode for filtered content", icon: Globe },
];

function SafeSearchTab({
  policyId,
  settings,
}: {
  policyId: string;
  settings: SafeSearchSettings;
}) {
  const utils = trpc.useUtils();

  const updatePolicy = trpc.dnsFilter.updatePolicy.useMutation({
    onSuccess: () => utils.dnsFilter.getPolicies.invalidate(),
  });

  function handleToggle(apiKey: string, newVal: boolean) {
    updatePolicy.mutate({ policyId, updates: { [apiKey]: newVal } });
  }

  return (
    <div className="space-y-1">
      {/* Safe Search toggles */}
      {SAFE_SEARCH_FIELDS.map((field) => {
        const currentVal = settings[field.key] ?? false;
        const isPending =
          updatePolicy.isPending &&
          updatePolicy.variables?.updates &&
          field.apiKey in (updatePolicy.variables.updates as Record<string, unknown>);

        return (
          <div
            key={field.key}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors",
              currentVal
                ? "bg-violet-600/10 border-violet-500/30"
                : "bg-accent/50 border-border"
            )}
          >
            <field.icon className={cn("h-3.5 w-3.5 shrink-0", currentVal ? "text-violet-400" : "text-zinc-500")} />
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs font-medium", currentVal ? "text-foreground" : "text-muted-foreground")}>
                {field.label}
              </p>
              <p className="text-[10px] text-muted-foreground">{field.description}</p>
            </div>
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <Toggle checked={!!currentVal} onChange={(val) => handleToggle(field.apiKey, val)} />
            )}
          </div>
        );
      })}

      {/* YouTube Restricted Level */}
      {settings.youtubeRestricted && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-accent/30 ml-6">
          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Restriction Level</p>
          </div>
          <div className="flex gap-1 rounded-md bg-accent p-0.5">
            {(["moderate", "strict"] as const).map((level) => (
              <button
                key={level}
                onClick={() => updatePolicy.mutate({ policyId, updates: { youtube_restricted_level: level } })}
                className={cn(
                  "rounded px-2 py-0.5 text-[10px] font-medium transition-colors capitalize",
                  (settings.youtubeRestrictedLevel ?? "moderate") === level
                    ? "bg-violet-600 text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Block Unknown Domains toggle */}
      <div className="mt-3 pt-3 border-t border-border">
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors",
            settings.allowUnknownDomains === false
              ? "bg-violet-600/10 border-violet-500/30"
              : "bg-accent/50 border-border"
          )}
        >
          <Lock className={cn("h-3.5 w-3.5 shrink-0", settings.allowUnknownDomains === false ? "text-violet-400" : "text-zinc-500")} />
          <div className="flex-1 min-w-0">
            <p className={cn("text-xs font-medium", settings.allowUnknownDomains === false ? "text-foreground" : "text-muted-foreground")}>
              Block Unknown Domains
            </p>
            <p className="text-[10px] text-muted-foreground">
              Block domains that have not yet been categorized by DNSFilter
            </p>
          </div>
          {updatePolicy.isPending &&
          updatePolicy.variables?.updates &&
          "allow_unknown_domains" in (updatePolicy.variables.updates as Record<string, unknown>) ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <Toggle
              checked={settings.allowUnknownDomains === false}
              onChange={(val) => handleToggle("allow_unknown_domains", !val)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   APPAWARE TAB
   ═══════════════════════════════════════════════════════════ */

function AppAwareTab({
  policyId,
  blockApplications,
}: {
  policyId: string;
  blockApplications: string[];
}) {
  const [searchQ, setSearchQ] = useState("");
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const applications = trpc.dnsFilter.getApplications.useQuery(undefined, {
    retry: false,
    staleTime: 60 * 60_000,
  });

  const appCategories = trpc.dnsFilter.getApplicationCategories.useQuery(undefined, {
    retry: false,
    staleTime: 60 * 60_000,
  });

  const blockApp = trpc.dnsFilter.addBlockedApplication.useMutation({
    onSuccess: () => utils.dnsFilter.getPolicies.invalidate(),
  });
  const unblockApp = trpc.dnsFilter.removeBlockedApplication.useMutation({
    onSuccess: () => utils.dnsFilter.getPolicies.invalidate(),
  });

  const blockedSet = useMemo(() => new Set(blockApplications ?? []), [blockApplications]);

  // Build category lookup
  const catNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of appCategories.data ?? []) {
      map.set(cat.id, cat.name);
    }
    return map;
  }, [appCategories.data]);

  // Group apps by their first category
  const groupedApps = useMemo(() => {
    if (!applications.data) return new Map<string, NonNullable<typeof applications.data>>();
    const map = new Map<string, NonNullable<typeof applications.data>>();

    let filtered = applications.data;
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      filtered = filtered.filter(
        (app) =>
          app.name.toLowerCase().includes(q) ||
          app.displayName?.toLowerCase().includes(q) ||
          app.description?.toLowerCase().includes(q)
      );
    }

    for (const app of filtered) {
      const catId = app.categoryIds?.[0] ?? "uncategorized";
      if (!map.has(catId)) map.set(catId, []);
      map.get(catId)!.push(app);
    }

    return map;
  }, [applications.data, searchQ]);

  // Sort categories by name
  const sortedCatEntries = useMemo(() => {
    return Array.from(groupedApps.entries()).sort((a, b) => {
      const nameA = catNameMap.get(a[0]) ?? "Uncategorized";
      const nameB = catNameMap.get(b[0]) ?? "Uncategorized";
      return nameA.localeCompare(nameB);
    });
  }, [groupedApps, catNameMap]);

  const handleToggle = useCallback(
    (appName: string) => {
      if (blockedSet.has(appName)) {
        unblockApp.mutate({ policyId, name: appName });
      } else {
        blockApp.mutate({ policyId, name: appName });
      }
    },
    [policyId, blockedSet, blockApp, unblockApp]
  );

  if (applications.isLoading || appCategories.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex items-center gap-2 h-8 px-3 rounded-md bg-accent">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Filter applications..."
          className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
        />
        {searchQ && (
          <button onClick={() => setSearchQ("")} className="text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        {blockedSet.size} application{blockedSet.size !== 1 ? "s" : ""} blocked
      </p>

      {/* App categories */}
      <div className="space-y-1.5">
        {sortedCatEntries.map(([catId, apps]) => {
          const catName = catNameMap.get(catId) ?? "Uncategorized";
          const isExpanded = expandedCat === catId || !!searchQ.trim();
          const blockedInCat = (apps ?? []).filter((a) => blockedSet.has(a.name)).length;

          return (
            <div key={catId} className="rounded-lg border border-border bg-card/50 overflow-hidden">
              <button
                onClick={() => setExpandedCat(isExpanded && !searchQ.trim() ? null : catId)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent/30 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
                <AppWindow className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-xs font-medium text-foreground flex-1">{catName}</span>
                <span className="text-[10px] text-muted-foreground">
                  {(apps ?? []).length} apps
                </span>
                {blockedInCat > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-600/20 text-violet-400 border border-violet-500/20">
                    {blockedInCat} blocked
                  </span>
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-border/50 divide-y divide-border/30">
                  {(apps ?? []).map((app) => {
                    const isBlocked = blockedSet.has(app.name);
                    const isPending =
                      (blockApp.isPending && blockApp.variables?.name === app.name) ||
                      (unblockApp.isPending && unblockApp.variables?.name === app.name);

                    return (
                      <div key={app.id} className="flex items-center gap-3 px-3 py-1.5 pl-9 hover:bg-accent/20 transition-colors">
                        {app.icon ? (
                          <img
                            src={app.icon}
                            alt=""
                            className="h-4 w-4 rounded shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <AppWindow className="h-4 w-4 text-zinc-500 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs", isBlocked ? "text-foreground font-medium" : "text-muted-foreground")}>
                            {app.displayName || app.name}
                          </p>
                          {app.description && (
                            <p className="text-[10px] text-muted-foreground truncate">{app.description}</p>
                          )}
                        </div>
                        {isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : (
                          <Toggle checked={isBlocked} onChange={() => handleToggle(app.name)} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sortedCatEntries.length === 0 && (
        <div className="py-6 text-center text-xs text-muted-foreground">
          {searchQ ? "No applications match your search" : "No applications found"}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DOMAIN LIST TAB (Allow List & Block List)
   ═══════════════════════════════════════════════════════════ */

function DomainListTab({
  policyId,
  domains,
  type,
}: {
  policyId: string;
  domains: string[];
  type: "allow" | "block";
}) {
  const [newDomain, setNewDomain] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const utils = trpc.useUtils();

  const addAllow = trpc.dnsFilter.addAllowDomain.useMutation({
    onSuccess: () => {
      utils.dnsFilter.getPolicies.invalidate();
      setNewDomain("");
      setShowAdd(false);
    },
  });
  const addBlock = trpc.dnsFilter.addBlockDomain.useMutation({
    onSuccess: () => {
      utils.dnsFilter.getPolicies.invalidate();
      setNewDomain("");
      setShowAdd(false);
    },
  });
  const removeAllow = trpc.dnsFilter.removeAllowDomain.useMutation({
    onSuccess: () => utils.dnsFilter.getPolicies.invalidate(),
  });
  const removeBlock = trpc.dnsFilter.removeBlockDomain.useMutation({
    onSuccess: () => utils.dnsFilter.getPolicies.invalidate(),
  });

  const addMut = type === "allow" ? addAllow : addBlock;
  const removeMut = type === "allow" ? removeAllow : removeBlock;

  const filtered = useMemo(() => {
    if (!searchQ.trim()) return domains;
    const q = searchQ.toLowerCase();
    return domains.filter((d) => d.toLowerCase().includes(q));
  }, [domains, searchQ]);

  function handleAdd() {
    if (!newDomain.trim()) return;
    addMut.mutate({ policyId, domain: newDomain.trim() });
  }

  const colorScheme = type === "allow"
    ? { chip: "bg-green-500/10 text-green-400 border-green-500/20", btn: "bg-green-600 hover:bg-green-700" }
    : { chip: "bg-red-500/10 text-red-400 border-red-500/20", btn: "bg-red-600 hover:bg-red-700" };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          {domains.length} domain{domains.length !== 1 ? "s" : ""} in {type} list
        </p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" /> Add Domain
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/30 border border-border">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Enter domain (e.g., example.com)"
            className="flex-1 h-8 px-3 rounded-md bg-accent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            autoFocus
          />
          <button
            onClick={handleAdd}
            disabled={!newDomain.trim() || addMut.isPending}
            className={cn(
              "h-8 px-3 rounded-md text-xs font-medium text-white transition-colors",
              colorScheme.btn,
              (addMut.isPending || !newDomain.trim()) && "opacity-50"
            )}
          >
            {addMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : type === "allow" ? "Allow" : "Block"}
          </button>
          <button onClick={() => { setShowAdd(false); setNewDomain(""); }} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search (only show when there are domains) */}
      {domains.length > 5 && (
        <div className="flex items-center gap-2 h-8 px-3 rounded-md bg-accent">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Filter domains..."
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
          {searchQ && (
            <button onClick={() => setSearchQ("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Domain Chips */}
      <div className="flex flex-wrap gap-1.5">
        {filtered.length === 0 ? (
          <div className="py-6 w-full text-center text-xs text-muted-foreground">
            {searchQ ? "No domains match your filter" : `No domains in ${type} list`}
          </div>
        ) : (
          filtered.map((d) => {
            const isRemoving = removeMut.isPending && removeMut.variables?.domain === d;
            return (
              <span
                key={d}
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-opacity",
                  colorScheme.chip,
                  isRemoving && "opacity-40"
                )}
              >
                {d}
                <button
                  onClick={() => removeMut.mutate({ policyId, domain: d })}
                  disabled={isRemoving}
                  className={cn(
                    "transition-colors",
                    type === "allow" ? "hover:text-red-400" : "hover:text-green-400"
                  )}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EXPANDED POLICY DETAIL (inner tabs)
   ═══════════════════════════════════════════════════════════ */

function PolicyDetail({
  policy,
}: {
  policy: {
    id: string;
    name: string;
    allowedDomains: string[];
    blockedDomains: string[];
    blockedCategories: number[];
    allowUnknownDomains?: boolean;
    googleSafesearch?: boolean;
    bingSafeSearch?: boolean;
    duckDuckGoSafeSearch?: boolean;
    ecosiaSafesearch?: boolean;
    yandexSafeSearch?: boolean;
    youtubeRestricted?: boolean;
    youtubeRestrictedLevel?: string;
    blockApplications?: string[];
    canEdit?: boolean;
  };
}) {
  const [activeTab, setActiveTab] = useState<PolicyTab>("categories");

  return (
    <div className="border-t border-border">
      {/* Tab Navigation */}
      <div className="flex gap-0.5 px-4 pt-2 pb-0 overflow-x-auto border-b border-border bg-accent/20">
        {POLICY_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md transition-colors whitespace-nowrap border-b-2 -mb-px",
              activeTab === tab.id
                ? "text-foreground border-violet-500 bg-card"
                : "text-muted-foreground border-transparent hover:text-foreground hover:border-zinc-500"
            )}
          >
            <tab.icon className="h-3 w-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-4 py-3">
        {activeTab === "categories" && (
          <CategoriesTab policyId={policy.id} blockedCategories={policy.blockedCategories} />
        )}
        {activeTab === "threats" && (
          <ThreatsTab policyId={policy.id} blockedCategories={policy.blockedCategories} />
        )}
        {activeTab === "safesearch" && (
          <SafeSearchTab
            policyId={policy.id}
            settings={{
              googleSafesearch: policy.googleSafesearch,
              bingSafeSearch: policy.bingSafeSearch,
              duckDuckGoSafeSearch: policy.duckDuckGoSafeSearch,
              ecosiaSafesearch: policy.ecosiaSafesearch,
              yandexSafeSearch: policy.yandexSafeSearch,
              youtubeRestricted: policy.youtubeRestricted,
              youtubeRestrictedLevel: policy.youtubeRestrictedLevel,
              allowUnknownDomains: policy.allowUnknownDomains,
            }}
          />
        )}
        {activeTab === "appaware" && (
          <AppAwareTab
            policyId={policy.id}
            blockApplications={policy.blockApplications ?? []}
          />
        )}
        {activeTab === "allowlist" && (
          <DomainListTab
            policyId={policy.id}
            domains={policy.allowedDomains}
            type="allow"
          />
        )}
        {activeTab === "blocklist" && (
          <DomainListTab
            policyId={policy.id}
            domains={policy.blockedDomains}
            type="block"
          />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   POLICY CARD (expandable)
   ═══════════════════════════════════════════════════════════ */

function PolicyCard({
  policy,
  orgName,
  isExpanded,
  onToggle,
}: {
  policy: {
    id: string;
    name: string;
    organizationId?: string;
    allowedDomains: string[];
    blockedDomains: string[];
    blockedCategories: number[];
    allowUnknownDomains?: boolean;
    googleSafesearch?: boolean;
    bingSafeSearch?: boolean;
    duckDuckGoSafeSearch?: boolean;
    ecosiaSafesearch?: boolean;
    yandexSafeSearch?: boolean;
    youtubeRestricted?: boolean;
    youtubeRestrictedLevel?: string;
    blockApplications?: string[];
    canEdit?: boolean;
    networkCount?: number;
    agentCount?: number;
  };
  orgName?: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <Shield className="h-4 w-4 text-violet-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{policy.name}</p>
          {orgName && <p className="text-[10px] text-muted-foreground">{orgName}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {(policy.networkCount ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Wifi className="h-3 w-3" />
              {policy.networkCount}
            </span>
          )}
          {(policy.agentCount ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Monitor className="h-3 w-3" />
              {policy.agentCount}
            </span>
          )}
          <span className="text-[10px] text-violet-400">{policy.blockedCategories.length} categories</span>
          <span className="text-[10px] text-green-400">{policy.allowedDomains.length} allowed</span>
          <span className="text-[10px] text-red-400">{policy.blockedDomains.length} blocked</span>
        </div>
      </button>

      {isExpanded && <PolicyDetail policy={policy} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN EXPORT — PolicyEditorSection
   ═══════════════════════════════════════════════════════════ */

export function PolicyEditorSection({ organizationIds }: PolicyEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");

  const policies = trpc.dnsFilter.getPolicies.useQuery(undefined, {
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

  // Filter and group policies
  const { policiesByOrg, ungroupedPolicies } = useMemo(() => {
    if (!policies.data) return { policiesByOrg: new Map<string, NonNullable<typeof policies.data>>(), ungroupedPolicies: [] as NonNullable<typeof policies.data> };

    // Filter out "Allow All" global policies
    let filteredPolicies = policies.data.filter((p) => {
      if (p.isGlobalPolicy && p.name.toLowerCase().includes("allow all")) return false;
      return true;
    });

    // Filter by organizationIds prop
    if (organizationIds?.length) {
      filteredPolicies = filteredPolicies.filter(
        (p) => p.organizationId && organizationIds.includes(p.organizationId)
      );
    }

    // Filter by search
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      filteredPolicies = filteredPolicies.filter((p) => {
        const orgName = p.organizationId ? orgNameMap.get(p.organizationId) : undefined;
        return (
          p.name.toLowerCase().includes(q) ||
          orgName?.toLowerCase().includes(q)
        );
      });
    }

    // Group by org
    const byOrg = new Map<string, NonNullable<typeof policies.data>>();
    const ungrouped: NonNullable<typeof policies.data> = [];

    for (const pol of filteredPolicies) {
      if (pol.organizationId) {
        if (!byOrg.has(pol.organizationId)) byOrg.set(pol.organizationId, []);
        byOrg.get(pol.organizationId)!.push(pol);
      } else {
        ungrouped.push(pol);
      }
    }

    return { policiesByOrg: byOrg, ungroupedPolicies: ungrouped };
  }, [policies.data, organizationIds, searchQ, orgNameMap]);

  // Sort org groups alphabetically
  const sortedOrgEntries = useMemo(() => {
    return Array.from(policiesByOrg.entries()).sort((a, b) =>
      (orgNameMap.get(a[0]) ?? "").localeCompare(orgNameMap.get(b[0]) ?? "")
    );
  }, [policiesByOrg, orgNameMap]);

  const totalPolicies = (ungroupedPolicies?.length ?? 0) + sortedOrgEntries.reduce((sum, [, p]) => sum + (p?.length ?? 0), 0);

  // Loading state
  if (policies.isLoading || organizations.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (policies.isError) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-card p-8 text-center">
        <Shield className="h-8 w-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-400 mb-1">Failed to load policies</p>
        <p className="text-[10px] text-muted-foreground">{policies.error?.message ?? "Unknown error"}</p>
        <button
          onClick={() => policies.refetch()}
          className="mt-3 text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Search */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 h-8 px-3 rounded-md bg-accent flex-1 max-w-md">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search policies or organizations..."
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
          {searchQ && (
            <button onClick={() => setSearchQ("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {totalPolicies} {totalPolicies === 1 ? "policy" : "policies"}
        </span>
      </div>

      {/* Global / Ungrouped Policies */}
      {ungroupedPolicies.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            Global Policies
          </h3>
          {ungroupedPolicies.map((policy) => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              isExpanded={expandedId === policy.id}
              onToggle={() => setExpandedId(expandedId === policy.id ? null : policy.id)}
            />
          ))}
        </div>
      )}

      {/* Per-Org Policies */}
      {sortedOrgEntries.length > 0 && (
        <div className="space-y-2">
          {ungroupedPolicies.length > 0 && (
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
              Organization Policies
            </h3>
          )}
          {sortedOrgEntries.map(([orgId, orgPolicies]) => (
            <div key={orgId} className="space-y-1.5">
              <div className="flex items-center gap-2 px-1">
                <Building2 className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-xs font-medium text-foreground">{orgNameMap.get(orgId) ?? orgId}</span>
                <span className="text-[10px] text-muted-foreground">
                  {(orgPolicies ?? []).length} {(orgPolicies ?? []).length === 1 ? "policy" : "policies"}
                </span>
              </div>
              {(orgPolicies ?? []).map((policy) => (
                <PolicyCard
                  key={policy.id}
                  policy={policy}
                  orgName={orgNameMap.get(orgId)}
                  isExpanded={expandedId === policy.id}
                  onToggle={() => setExpandedId(expandedId === policy.id ? null : policy.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {totalPolicies === 0 && (
        <div className="text-center py-12">
          <Shield className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {searchQ ? "No policies match your search" : "No policies found"}
          </p>
        </div>
      )}
    </div>
  );
}
