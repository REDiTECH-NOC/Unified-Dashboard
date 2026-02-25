"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Loader2 } from "lucide-react";

export function BudgetConfigCard() {
  const { data: budgets, refetch } = trpc.ai.listBudgetConfigs.useQuery();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Budgets & Rate Limits</h3>
          <p className="text-sm text-muted-foreground">
            Set token budgets and rate limits per user or per role. Leave empty for unlimited.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Budget
        </Button>
      </div>

      {budgets && budgets.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Type</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Target</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Daily Tokens</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Monthly Tokens</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Req/Hour</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Status</th>
                <th className="pb-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => (
                <BudgetRow key={b.id} budget={b} onDeleted={refetch} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No budgets configured. AI usage is unlimited until you add limits.
        </div>
      )}

      <BudgetDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setDialogOpen(false);
          refetch();
        }}
      />
    </div>
  );
}

function BudgetRow({
  budget,
  onDeleted,
}: {
  budget: {
    id: string;
    entityType: string;
    entityId: string;
    dailyTokenLimit: number | null;
    monthlyTokenLimit: number | null;
    rateLimitPerHour: number | null;
    isActive: boolean;
  };
  onDeleted: () => void;
}) {
  const deleteMutation = trpc.ai.deleteBudgetConfig.useMutation({
    onSuccess: onDeleted,
  });

  function formatTokens(n: number | null) {
    if (n === null) return "Unlimited";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
  }

  return (
    <tr className="border-b border-border/50 hover:bg-accent/30">
      <td className="py-3 pr-4 capitalize">{budget.entityType}</td>
      <td className="py-3 pr-4">
        <code className="text-xs bg-accent px-1.5 py-0.5 rounded">
          {budget.entityId}
        </code>
      </td>
      <td className="py-3 pr-4">{formatTokens(budget.dailyTokenLimit)}</td>
      <td className="py-3 pr-4">{formatTokens(budget.monthlyTokenLimit)}</td>
      <td className="py-3 pr-4">
        {budget.rateLimitPerHour ?? "Unlimited"}
      </td>
      <td className="py-3 pr-4">
        <span
          className={`inline-flex items-center gap-1 text-xs ${
            budget.isActive ? "text-green-400" : "text-muted-foreground"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              budget.isActive ? "bg-green-500" : "bg-muted-foreground"
            }`}
          />
          {budget.isActive ? "Active" : "Disabled"}
        </span>
      </td>
      <td className="py-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-400 hover:text-red-300"
          onClick={() => deleteMutation.mutate({ id: budget.id })}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

function BudgetDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [entityType, setEntityType] = useState<"user" | "role">("role");
  const [entityId, setEntityId] = useState("");
  const [dailyTokenLimit, setDailyTokenLimit] = useState("");
  const [monthlyTokenLimit, setMonthlyTokenLimit] = useState("");
  const [rateLimitPerHour, setRateLimitPerHour] = useState("");
  const [saving, setSaving] = useState(false);

  const upsertMutation = trpc.ai.upsertBudgetConfig.useMutation();
  const { data: users } = trpc.user.list.useQuery(undefined, {
    enabled: entityType === "user",
  });

  async function handleSave() {
    if (!entityId) return;
    setSaving(true);
    try {
      await upsertMutation.mutateAsync({
        entityType,
        entityId,
        dailyTokenLimit: dailyTokenLimit ? parseInt(dailyTokenLimit) : null,
        monthlyTokenLimit: monthlyTokenLimit ? parseInt(monthlyTokenLimit) : null,
        rateLimitPerHour: rateLimitPerHour ? parseInt(rateLimitPerHour) : null,
        maxConcurrent: 1,
        isActive: true,
      });
      // Reset form
      setEntityId("");
      setDailyTokenLimit("");
      setMonthlyTokenLimit("");
      setRateLimitPerHour("");
      onSaved();
    } catch {
      // Error handled by mutation
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Budget / Rate Limit</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Entity Type */}
          <div className="space-y-2">
            <Label>Apply To</Label>
            <Select
              value={entityType}
              onValueChange={(v) => {
                setEntityType(v as "user" | "role");
                setEntityId("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="role">Role (applies to all users with this role)</SelectItem>
                <SelectItem value="user">Specific User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Entity ID */}
          <div className="space-y-2">
            {entityType === "role" ? (
              <>
                <Label>Role</Label>
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="USER">User (Technician)</SelectItem>
                    <SelectItem value="CLIENT">Client</SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : (
              <>
                <Label>User</Label>
                <Select value={entityId} onValueChange={setEntityId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map((u: { id: string; name: string | null; email: string }) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {/* Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="daily">Daily Token Limit</Label>
              <Input
                id="daily"
                type="number"
                value={dailyTokenLimit}
                onChange={(e) => setDailyTokenLimit(e.target.value)}
                placeholder="Empty = unlimited"
              />
              <p className="text-xs text-muted-foreground">e.g., 50000</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly">Monthly Token Limit</Label>
              <Input
                id="monthly"
                type="number"
                value={monthlyTokenLimit}
                onChange={(e) => setMonthlyTokenLimit(e.target.value)}
                placeholder="Empty = unlimited"
              />
              <p className="text-xs text-muted-foreground">e.g., 1000000</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rate">Requests Per Hour</Label>
            <Input
              id="rate"
              type="number"
              value={rateLimitPerHour}
              onChange={(e) => setRateLimitPerHour(e.target.value)}
              placeholder="Empty = unlimited"
            />
            <p className="text-xs text-muted-foreground">Max AI conversations per hour</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !entityId}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Budget
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
