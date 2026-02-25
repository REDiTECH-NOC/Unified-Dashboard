"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { ConfigureDialog } from "../../_components/configure-dialog";
import { Loader2, Zap, Settings2, Check, X } from "lucide-react";

export function ConnectionStatusCard() {
  const { data: integrations, refetch } = trpc.integration.list.useQuery();
  const cw = integrations?.find((t) => t.toolId === "connectwise");

  const [credDialogOpen, setCredDialogOpen] = useState(false);

  const testConnection = trpc.integration.testConnection.useMutation();

  function handleTest() {
    testConnection.mutate({ toolId: "connectwise" });
  }

  const statusColor =
    cw?.status === "connected"
      ? "bg-green-500"
      : cw?.status === "error"
        ? "bg-red-500"
        : cw?.status === "degraded"
          ? "bg-yellow-500"
          : "bg-muted-foreground/30";

  const statusText =
    cw?.status === "connected"
      ? "Connected"
      : cw?.status === "error"
        ? "Error"
        : cw?.status === "unconfigured"
          ? "Not configured"
          : cw?.status ?? "Unknown";

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
                {cw?.lastHealthCheck && (
                  <p className="text-[10px] text-muted-foreground">
                    Last checked{" "}
                    {new Date(cw.lastHealthCheck).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testConnection.isPending}
              >
                {testConnection.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                )}
                Test
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCredDialogOpen(true)}
              >
                <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                Credentials
              </Button>
            </div>
          </div>

          {testConnection.data && (
            <div
              className={
                "mt-3 rounded-md border p-2.5 text-xs flex items-center gap-2 " +
                (testConnection.data.success
                  ? "border-green-500/30 bg-green-500/5 text-green-400"
                  : "border-red-500/30 bg-red-500/5 text-red-400")
              }
            >
              {testConnection.data.success ? (
                <Check className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <X className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              <span className="flex-1">{testConnection.data.message}</span>
              {testConnection.data.latencyMs != null && (
                <span className="text-muted-foreground">
                  {testConnection.data.latencyMs}ms
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfigureDialog
        toolId={credDialogOpen ? "connectwise" : null}
        onClose={() => setCredDialogOpen(false)}
        onSaved={() => {
          setCredDialogOpen(false);
          refetch();
        }}
      />
    </>
  );
}
