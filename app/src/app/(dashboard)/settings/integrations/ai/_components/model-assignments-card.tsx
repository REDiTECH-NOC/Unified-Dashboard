"use client";

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface ProviderConfig {
  id: string;
  providerType: string;
  complexModel: string;
  simpleModel: string;
  embeddingModel: string;
  [key: string]: unknown;
}

export function ModelAssignmentsCard({
  providerConfig,
}: {
  providerConfig: ProviderConfig | null | undefined;
}) {
  const { data: assignments, refetch } =
    trpc.ai.listModelAssignments.useQuery();

  const updateMutation = trpc.ai.updateModelAssignment.useMutation({
    onSuccess: () => refetch(),
  });
  const resetMutation = trpc.ai.resetModelAssignment.useMutation({
    onSuccess: () => refetch(),
  });

  function handleTierChange(functionName: string, tier: string) {
    updateMutation.mutate({
      functionName,
      modelTier: tier as "complex" | "simple",
    });
  }

  function handleReset(functionName: string) {
    resetMutation.mutate({ functionName });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Model Assignments</h3>
        <p className="text-sm text-muted-foreground">
          Control which model tier each AI function uses.{" "}
          {providerConfig && (
            <span>
              Complex ={" "}
              <span className="text-blue-400">{providerConfig.complexModel}</span>,
              Simple ={" "}
              <span className="text-green-400">{providerConfig.simpleModel}</span>
            </span>
          )}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-3 pr-4 font-medium text-muted-foreground">Function</th>
              <th className="pb-3 pr-4 font-medium text-muted-foreground">Description</th>
              <th className="pb-3 pr-4 font-medium text-muted-foreground">Default</th>
              <th className="pb-3 pr-4 font-medium text-muted-foreground">Model Tier</th>
              <th className="pb-3 font-medium text-muted-foreground w-10"></th>
            </tr>
          </thead>
          <tbody>
            {assignments?.map((fn) => (
              <tr
                key={fn.functionName}
                className="border-b border-border/50 hover:bg-accent/30"
              >
                <td className="py-3 pr-4">
                  <code className="text-xs bg-accent px-1.5 py-0.5 rounded">
                    {fn.functionName}
                  </code>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {fn.description}
                </td>
                <td className="py-3 pr-4">
                  <Badge
                    variant="outline"
                    className={
                      fn.defaultTier === "complex"
                        ? "border-blue-500/50 text-blue-400"
                        : "border-green-500/50 text-green-400"
                    }
                  >
                    {fn.defaultTier}
                  </Badge>
                </td>
                <td className="py-3 pr-4">
                  <Select
                    value={fn.currentTier}
                    onValueChange={(val) =>
                      handleTierChange(fn.functionName, val)
                    }
                  >
                    <SelectTrigger className="w-[130px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="complex">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          Complex
                        </span>
                      </SelectItem>
                      <SelectItem value="simple">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          Simple
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="py-3">
                  {fn.hasOverride && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleReset(fn.functionName)}
                      title="Reset to default"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!providerConfig && (
        <p className="text-sm text-yellow-400/80">
          Configure an AI provider above to see which models these tiers resolve to.
        </p>
      )}
    </div>
  );
}
