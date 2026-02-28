"use client";

import { Suspense, useState } from "react";
import { trpc } from "@/lib/trpc";
import { KeyRound, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { KeeperCompaniesTable } from "./_components/keeper-companies-table";
import { KeeperNotConnected } from "./_components/keeper-not-connected";
import { ITGlueTab } from "./_components/itglue-tab";

type ProviderTab = "keeper" | "itglue";

export default function PasswordsPage() {
  return (
    <Suspense>
      <PasswordsPageInner />
    </Suspense>
  );
}

function PasswordsPageInner() {
  const { has, isLoading: permsLoading } = usePermissions();
  const [activeTab, setActiveTab] = useState<ProviderTab>("keeper");

  // Only fetch Keeper data when the Keeper tab is active
  const companiesQuery = trpc.keeper.listCompanies.useQuery(undefined, {
    enabled: activeTab === "keeper",
    retry: false,
    staleTime: 5 * 60_000,
    refetchInterval: 60_000,
  });

  const isNotConnected =
    companiesQuery.isError &&
    companiesQuery.error?.message?.includes("not configured");

  const canView = permsLoading || has("keeper.view");

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        You don't have permission to view this page.
      </div>
    );
  }

  const tabs: { id: ProviderTab; label: string; disabled?: boolean }[] = [
    { id: "keeper", label: "Keeper" },
    { id: "itglue", label: "IT Glue" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <KeyRound className="h-6 w-6 text-amber-400" />
          <h1 className="text-2xl font-bold text-zinc-100">Passwords</h1>
        </div>
        <button
          onClick={() => companiesQuery.refetch()}
          disabled={companiesQuery.isFetching}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={cn(
              "h-4 w-4",
              companiesQuery.isFetching && "animate-spin"
            )}
          />
          Refresh
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
            disabled={tab.disabled}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === tab.id
                ? "border-amber-500 text-zinc-100"
                : tab.disabled
                  ? "border-transparent text-zinc-600 cursor-not-allowed"
                  : "border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
            )}
          >
            {tab.label}
            {tab.disabled && (
              <span className="ml-1.5 text-[10px] text-zinc-600 uppercase">
                Soon
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "keeper" && (
        <>
          {isNotConnected ? (
            <KeeperNotConnected />
          ) : (
            <KeeperCompaniesTable
              companies={companiesQuery.data ?? []}
              isLoading={companiesQuery.isLoading}
            />
          )}
        </>
      )}

      {activeTab === "itglue" && <ITGlueTab />}
    </div>
  );
}
