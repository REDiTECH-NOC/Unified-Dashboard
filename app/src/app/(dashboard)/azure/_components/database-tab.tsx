"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Plus, Eye, RefreshCw, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CreateDatabaseDialog } from "./create-database-dialog";
import { ConnectionDetailsDialog } from "./connection-details-dialog";

export function DatabaseTab() {
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsDb, setDetailsDb] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch } = trpc.infrastructure.listDatabases.useQuery(
    undefined,
    { staleTime: 30_000 }
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-muted/20 animate-pulse" />
        ))}
      </div>
    );
  }

  if (data?.source === "unavailable" || data?.source === "not_configured") {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-400">
            {data.source === "unavailable" ? "Azure Not Detected" : "Not Configured"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.message || "Configure your PostgreSQL server in the Configuration tab first."}
          </p>
        </div>
      </div>
    );
  }

  const databases = data?.databases || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            Refresh
          </button>
          <span className="text-xs text-muted-foreground">
            {databases.length} database{databases.length !== 1 ? "s" : ""}
          </span>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Create Database
        </Button>
      </div>

      {/* Database list */}
      {databases.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Database className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No databases found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first 3CX client database to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {databases.map((db) => {
            const is3cx = db.name.endsWith("3cx_database");
            return (
              <div
                key={db.name}
                className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/40 flex-shrink-0">
                  <Database className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground font-mono">
                      {db.name}
                    </span>
                    {is3cx && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        3CX
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{db.charset}</span>
                    <span className="text-border">|</span>
                    <span>{db.collation}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDetailsDb(db.name)}
                >
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  Details
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <CreateDatabaseDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ConnectionDetailsDialog
        databaseName={detailsDb}
        open={!!detailsDb}
        onOpenChange={(open) => { if (!open) setDetailsDb(null); }}
      />
    </div>
  );
}
