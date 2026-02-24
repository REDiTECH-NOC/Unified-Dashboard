"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Plus,
  Eye,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Table2,
  Key,
  Loader2,
  Trash2,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CreateDatabaseDialog } from "./create-database-dialog";
import { ConnectionDetailsDialog } from "./connection-details-dialog";
import { CreateIndexDialog } from "./create-index-dialog";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

type TableTab = "columns" | "indexes";

function TableDetail({
  databaseName,
  tableName,
  schemaName,
}: {
  databaseName: string;
  tableName: string;
  schemaName: string;
}) {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<TableTab>("columns");
  const [createIndexOpen, setCreateIndexOpen] = useState(false);
  const [confirmDropIndex, setConfirmDropIndex] = useState<string | null>(null);
  const [droppingIndex, setDroppingIndex] = useState<string | null>(null);

  const schemaQuery = trpc.infrastructure.getTableSchema.useQuery(
    { databaseName, tableName, schemaName },
    { staleTime: 60_000 }
  );

  const indexesQuery = trpc.infrastructure.getTableIndexes.useQuery(
    { databaseName, tableName, schemaName },
    { enabled: tab === "indexes", staleTime: 30_000 }
  );

  const dropMutation = trpc.infrastructure.dropIndex.useMutation({
    onSuccess: () => {
      utils.infrastructure.getTableIndexes.invalidate();
      utils.infrastructure.getDatabaseTables.invalidate();
      setConfirmDropIndex(null);
      setDroppingIndex(null);
    },
    onError: () => {
      setDroppingIndex(null);
    },
  });

  function handleDropIndex(indexName: string) {
    setDroppingIndex(indexName);
    dropMutation.mutate({ databaseName, indexName, schemaName });
  }

  const columns = schemaQuery.data?.columns || [];
  const indexes = indexesQuery.data?.indexes || [];

  return (
    <div className="ml-7 mt-1 mb-2 rounded border border-border overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center border-b border-border bg-muted/10">
        <button
          onClick={() => setTab("columns")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium transition-colors",
            tab === "columns"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Columns
          {columns.length > 0 && (
            <span className="ml-1 text-[10px] text-muted-foreground">
              ({columns.length})
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("indexes")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium transition-colors",
            tab === "indexes"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Indexes
          {indexes.length > 0 && (
            <span className="ml-1 text-[10px] text-muted-foreground">
              ({indexes.length})
            </span>
          )}
        </button>
        {tab === "indexes" && (
          <button
            onClick={() => setCreateIndexOpen(true)}
            className="ml-auto mr-2 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <Plus className="h-3 w-3" />
            New Index
          </button>
        )}
      </div>

      {/* Columns tab */}
      {tab === "columns" && (
        <>
          {schemaQuery.isLoading ? (
            <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading schema...
            </div>
          ) : schemaQuery.error ? (
            <div className="p-3 text-xs text-red-400">
              {schemaQuery.error.message}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                    Column
                  </th>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="text-center px-2 py-1.5 font-medium text-muted-foreground w-16">
                    Null
                  </th>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                    Default
                  </th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col) => (
                  <tr
                    key={col.name}
                    className="border-b border-border last:border-0 hover:bg-muted/10"
                  >
                    <td className="px-2 py-1.5 font-mono text-foreground">
                      <span className="flex items-center gap-1.5">
                        {col.isPrimaryKey && (
                          <Key className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                        )}
                        {col.name}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 font-mono text-muted-foreground">
                      {col.type}
                      {col.maxLength ? `(${col.maxLength})` : ""}
                    </td>
                    <td className="px-2 py-1.5 text-center text-muted-foreground">
                      {col.nullable ? "yes" : "no"}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-muted-foreground truncate max-w-[150px]">
                      {col.default || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* Indexes tab */}
      {tab === "indexes" && (
        <>
          {indexesQuery.isLoading ? (
            <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading indexes...
            </div>
          ) : indexesQuery.error ? (
            <div className="p-3 text-xs text-red-400">
              {indexesQuery.error.message}
            </div>
          ) : indexes.length === 0 ? (
            <div className="p-4 text-center">
              <Zap className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                No indexes on this table
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Add indexes to speed up frequently queried columns
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {indexes.map((idx) => {
                const isConfirming = confirmDropIndex === idx.name;
                const isDropping = droppingIndex === idx.name;

                return (
                  <div
                    key={idx.name}
                    className="px-2 py-2 hover:bg-muted/10"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-foreground truncate flex-1">
                        {idx.name}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {idx.isPrimary && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 text-yellow-500 border-yellow-500/30"
                          >
                            PK
                          </Badge>
                        )}
                        {idx.isUnique && !idx.isPrimary && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 text-blue-400 border-blue-400/30"
                          >
                            UNIQUE
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {formatBytes(idx.sizeBytes)}
                        </span>
                        {!idx.isPrimary && (
                          <>
                            {isConfirming ? (
                              <div className="flex items-center gap-0.5">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDropIndex(idx.name)}
                                  disabled={isDropping}
                                  className="h-5 text-[10px] px-1.5"
                                >
                                  {isDropping ? (
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  ) : (
                                    "Drop"
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setConfirmDropIndex(null)}
                                  className="h-5 text-[10px] px-1.5"
                                >
                                  No
                                </Button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDropIndex(idx.name)}
                                className="p-0.5 text-muted-foreground hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {idx.columns.join(", ")}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">
                        {idx.definition
                          .match(/USING (\w+)/)?.[1]
                          ?.toUpperCase() || "BTREE"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Drop error */}
          {dropMutation.error && (
            <div className="flex items-center gap-2 p-2 text-[10px] text-red-400 border-t border-border">
              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
              {dropMutation.error.message}
            </div>
          )}
        </>
      )}

      {/* Create Index Dialog */}
      <CreateIndexDialog
        open={createIndexOpen}
        onOpenChange={setCreateIndexOpen}
        databaseName={databaseName}
        tableName={tableName}
        schemaName={schemaName}
        availableColumns={columns.map((c) => c.name)}
      />
    </div>
  );
}

// Known 3CX tables that have recommended indexes
const INDEXABLE_3CX_TABLES = new Set([
  "cdroutput", "cdrbilling", "recordings", "callcent_queuecalls",
  "cl_calls", "cl_participants", "cl_segments", "callhistory3",
]);

function DatabaseExplorer({ databaseName }: { databaseName: string }) {
  const utils = trpc.useUtils();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const tablesQuery = trpc.infrastructure.getDatabaseTables.useQuery(
    { databaseName },
    { staleTime: 30_000 }
  );

  const applyMutation = trpc.infrastructure.applyRecommendedIndexes.useMutation({
    onSuccess: () => {
      utils.infrastructure.getDatabaseTables.invalidate();
      utils.infrastructure.getTableIndexes.invalidate();
    },
  });

  if (tablesQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading tables...
      </div>
    );
  }

  if (tablesQuery.error) {
    return (
      <div className="flex items-center gap-2 p-3 text-xs text-red-400">
        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
        {tablesQuery.error.message}
      </div>
    );
  }

  const tables = tablesQuery.data?.tables || [];
  const totalSize = tables.reduce((sum, t) => sum + t.totalBytes, 0);
  const totalRows = tables.reduce((sum, t) => sum + t.rowCount, 0);
  const tablesWithIndexes = tables.filter((t) => t.indexCount > 0).length;

  // Check if any tables are known 3CX tables that can be auto-indexed
  const indexableTables = tables.filter((t) => INDEXABLE_3CX_TABLES.has(t.name));
  const hasIndexableTables = indexableTables.length > 0;

  return (
    <div className="border-t border-border mt-2 pt-3 space-y-3">
      {/* Quick stats + Index All button */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-muted-foreground">
            {tables.length} table{tables.length !== 1 ? "s" : ""}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {totalRows.toLocaleString()} rows
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatBytes(totalSize)}
          </span>
          <span className={cn(
            "text-[10px]",
            tablesWithIndexes > 0 ? "text-green-500" : "text-muted-foreground"
          )}>
            {tablesWithIndexes}/{tables.length} indexed
          </span>
        </div>
        {hasIndexableTables && (
          <button
            onClick={() => applyMutation.mutate({ databaseName })}
            disabled={applyMutation.isPending}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {applyMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Zap className="h-3 w-3" />
            )}
            Index All
          </button>
        )}
      </div>

      {/* Apply results banner */}
      {applyMutation.data && (
        <div className="flex items-center gap-2 px-2 py-2 rounded bg-green-500/10 border border-green-500/20 text-xs text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {applyMutation.data.created} created, {applyMutation.data.skipped} already existed
            {applyMutation.data.errors > 0 && `, ${applyMutation.data.errors} errors`}
          </span>
          <button
            onClick={() => applyMutation.reset()}
            className="ml-auto text-[10px] text-green-500/60 hover:text-green-400"
          >
            dismiss
          </button>
        </div>
      )}

      {applyMutation.error && (
        <div className="flex items-center gap-2 px-2 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          {applyMutation.error.message}
        </div>
      )}

      {tables.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 px-1">
          No tables in this database
        </p>
      ) : (
        <div className="space-y-1">
          {tables.map((table) => {
            const isIndexable = INDEXABLE_3CX_TABLES.has(table.name);
            const hasIndexes = table.indexCount > 0;

            return (
              <div key={`${table.schema}.${table.name}`}>
                <button
                  onClick={() =>
                    setSelectedTable(
                      selectedTable === table.name ? null : table.name
                    )
                  }
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted/30 transition-colors",
                    selectedTable === table.name && "bg-muted/30"
                  )}
                >
                  {selectedTable === table.name ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  )}
                  <Table2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="font-mono text-foreground truncate">
                    {table.name}
                  </span>
                  {/* Index status indicator */}
                  {hasIndexes ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                      <Zap className="h-2.5 w-2.5" />
                      {table.indexCount}
                    </span>
                  ) : isIndexable ? (
                    <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded flex-shrink-0">
                      no indexes
                    </span>
                  ) : null}
                  <span className="ml-auto text-muted-foreground flex-shrink-0">
                    {table.rowCount.toLocaleString()} rows
                  </span>
                  <span className="text-muted-foreground flex-shrink-0 w-16 text-right">
                    {formatBytes(table.totalBytes)}
                  </span>
                </button>

                {/* Column schema + Indexes */}
                {selectedTable === table.name && (
                  <TableDetail
                    databaseName={databaseName}
                    tableName={table.name}
                    schemaName={table.schema}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DatabaseTab() {
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsDb, setDetailsDb] = useState<string | null>(null);
  const [expandedDb, setExpandedDb] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch } =
    trpc.infrastructure.listDatabases.useQuery(undefined, {
      staleTime: 30_000,
    });

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
            {data.source === "unavailable"
              ? "Azure Not Detected"
              : "Not Configured"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.message ||
              "Configure your PostgreSQL server in the Configuration tab first."}
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
            <RefreshCw
              className={cn("h-3 w-3", isFetching && "animate-spin")}
            />
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
            <p className="text-sm text-muted-foreground">
              No databases found
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first 3CX client database to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {databases.map((db) => {
            const is3cx = db.name.endsWith("3cx_database");
            const isExpanded = expandedDb === db.name;

            return (
              <div
                key={db.name}
                className="rounded-lg border border-border bg-card"
              >
                <div className="flex items-center gap-4 p-3">
                  <button
                    onClick={() =>
                      setExpandedDb(isExpanded ? null : db.name)
                    }
                    className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/40 flex-shrink-0 hover:bg-muted/60 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Database className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() =>
                      setExpandedDb(isExpanded ? null : db.name)
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground font-mono">
                        {db.name}
                      </span>
                      {is3cx && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
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

                {/* Expandable database explorer */}
                {isExpanded && (
                  <div className="px-3 pb-3">
                    <DatabaseExplorer databaseName={db.name} />
                  </div>
                )}
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
        onOpenChange={(open) => {
          if (!open) setDetailsDb(null);
        }}
      />
    </div>
  );
}
