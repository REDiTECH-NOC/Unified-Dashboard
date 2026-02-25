"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ConfigureDialog } from "../../_components/configure-dialog";
import { Loader2, Zap, Settings2, Check, X } from "lucide-react";

export function CoveConnectionCard() {
  const { data: integrations, refetch } = trpc.integration.list.useQuery();
  const cove = integrations?.find((t) => t.toolId === "cove");

  const [credDialogOpen, setCredDialogOpen] = useState(false);

  const testConnection = trpc.integration.testConnection.useMutation();

  function handleTest() {
    testConnection.mutate({ toolId: "cove" });
  }

  const statusColor =
    cove?.status === "connected"
      ? "bg-green-500"
      : cove?.status === "error"
        ? "bg-red-500"
        : cove?.status === "degraded"
          ? "bg-yellow-500"
          : "bg-muted-foreground/30";

  const statusText =
    cove?.status === "connected"
      ? "Connected"
      : cove?.status === "error"
        ? "Error"
        : cove?.status === "unconfigured"
          ? "Not configured"
          : cove?.status ?? "Unknown";

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Connection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
              <div>
                <p className="text-sm font-medium">{statusText}</p>
                {cove?.lastHealthCheck && (
                  <p className="text-[10px] text-muted-foreground">
                    Last checked{" "}
                    {new Date(cove.lastHealthCheck).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {testConnection.isSuccess && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <Check className="h-3 w-3" />
                  {testConnection.data?.latencyMs}ms
                </span>
              )}
              {testConnection.isError && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <X className="h-3 w-3" />
                  Failed
                </span>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={handleTest}
                disabled={testConnection.isPending}
              >
                {testConnection.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                Test
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setCredDialogOpen(true)}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Credentials
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {credDialogOpen && (
        <ConfigureDialog
          toolId="cove"
          onClose={() => {
            setCredDialogOpen(false);
            refetch();
          }}
          onSaved={() => {
            setCredDialogOpen(false);
            refetch();
          }}
        />
      )}
    </>
  );
}
