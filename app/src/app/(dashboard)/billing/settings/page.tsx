"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Sliders, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

export default function BillingSettingsPage() {
  const settingsQuery = trpc.billing.getBillingSettings.useQuery(undefined, {
    staleTime: 60_000,
  });

  const updateMutation = trpc.billing.updateBillingSettings.useMutation({
    onSuccess: () => {
      settingsQuery.refetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    defaultEffectiveDate: "today" as "today" | "cycle_start" | "custom",
    customEffectiveDay: null as number | null,
    defaultContractView: "active_only" as "all" | "active_only" | "discrepancies_only",
    autoApproveMatches: true,
    showCostData: true,
  });

  // Hydrate form from server data
  useEffect(() => {
    if (settingsQuery.data) {
      setForm({
        defaultEffectiveDate: settingsQuery.data.defaultEffectiveDate as typeof form.defaultEffectiveDate,
        customEffectiveDay: settingsQuery.data.customEffectiveDay,
        defaultContractView: settingsQuery.data.defaultContractView as typeof form.defaultContractView,
        autoApproveMatches: settingsQuery.data.autoApproveMatches,
        showCostData: settingsQuery.data.showCostData,
      });
    }
  }, [settingsQuery.data]);

  const handleSave = () => {
    updateMutation.mutate({
      defaultEffectiveDate: form.defaultEffectiveDate,
      customEffectiveDay: form.defaultEffectiveDate === "custom" ? form.customEffectiveDay : null,
      defaultContractView: form.defaultContractView,
      autoApproveMatches: form.autoApproveMatches,
      showCostData: form.showCostData,
    });
  };

  if (settingsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/billing"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-500/10 border border-zinc-500/20">
          <Sliders className="h-5 w-5 text-zinc-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Reconciliation Settings</h1>
          <p className="text-sm text-zinc-500">Configure default behavior for billing reconciliation</p>
        </div>
      </div>

      {/* Settings Form */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 divide-y divide-zinc-800">
        {/* Default Effective Date */}
        <div className="px-5 py-4">
          <label className="block text-sm font-medium text-zinc-200 mb-1">
            Default Effective Date
          </label>
          <p className="text-xs text-zinc-500 mb-3">
            When adjusted quantities take effect in ConnectWise
          </p>
          <select
            value={form.defaultEffectiveDate}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                defaultEffectiveDate: e.target.value as typeof f.defaultEffectiveDate,
              }))
            }
            className="h-9 w-full max-w-xs rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
          >
            <option value="today">Today</option>
            <option value="cycle_start">Start of billing cycle</option>
            <option value="custom">Custom day of month</option>
          </select>

          {form.defaultEffectiveDate === "custom" && (
            <div className="mt-3">
              <label className="block text-xs text-zinc-500 mb-1">Day of month (1-28)</label>
              <input
                type="number"
                min={1}
                max={28}
                value={form.customEffectiveDay ?? 1}
                onChange={(e) =>
                  setForm((f) => ({ ...f, customEffectiveDay: parseInt(e.target.value) || 1 }))
                }
                className="h-9 w-24 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Default Contract View */}
        <div className="px-5 py-4">
          <label className="block text-sm font-medium text-zinc-200 mb-1">
            Default Contract View
          </label>
          <p className="text-xs text-zinc-500 mb-3">
            Default filter when viewing the company list
          </p>
          <select
            value={form.defaultContractView}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                defaultContractView: e.target.value as typeof f.defaultContractView,
              }))
            }
            className="h-9 w-full max-w-xs rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-zinc-700 focus:outline-none"
          >
            <option value="all">All companies</option>
            <option value="active_only">Active contracts only</option>
            <option value="discrepancies_only">With discrepancies only</option>
          </select>
        </div>

        {/* Auto-approve matches */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-zinc-200">
              Auto-approve matches
            </label>
            <p className="text-xs text-zinc-500 mt-0.5">
              Automatically approve items with 0 discrepancy during reconciliation
            </p>
          </div>
          <button
            onClick={() => setForm((f) => ({ ...f, autoApproveMatches: !f.autoApproveMatches }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              form.autoApproveMatches ? "bg-green-600" : "bg-zinc-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                form.autoApproveMatches ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Show cost data */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-zinc-200">
              Show cost data
            </label>
            <p className="text-xs text-zinc-500 mt-0.5">
              Display cost and profit columns to account managers
            </p>
          </div>
          <button
            onClick={() => setForm((f) => ({ ...f, showCostData: !f.showCostData }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              form.showCostData ? "bg-green-600" : "bg-zinc-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                form.showCostData ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="flex items-center gap-1.5 h-9 px-4 rounded-md bg-green-600 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Settings
        </button>
        {saved && (
          <span className="text-sm text-green-400">Settings saved</span>
        )}
        {updateMutation.isError && (
          <span className="text-sm text-red-400">Failed to save</span>
        )}
      </div>
    </div>
  );
}
