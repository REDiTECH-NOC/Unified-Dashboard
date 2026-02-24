"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertTriangle, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type IndexMethod = "btree" | "hash" | "gin" | "gist";

interface CreateIndexDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  databaseName: string;
  tableName: string;
  schemaName?: string;
  availableColumns: string[];
}

const METHOD_INFO: Record<IndexMethod, string> = {
  btree: "Default. Best for equality and range queries (=, <, >, BETWEEN)",
  hash: "Fast equality-only lookups (=). Smaller than btree for this case",
  gin: "Best for full-text search, array/JSONB containment, multi-value columns",
  gist: "Geometric/spatial data, range types, full-text search (alternative to GIN)",
};

export function CreateIndexDialog({
  open,
  onOpenChange,
  databaseName,
  tableName,
  schemaName = "public",
  availableColumns,
}: CreateIndexDialogProps) {
  const utils = trpc.useUtils();
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [indexName, setIndexName] = useState("");
  const [unique, setUnique] = useState(false);
  const [method, setMethod] = useState<IndexMethod>("btree");
  const [concurrent, setConcurrent] = useState(true);

  const createMutation = trpc.infrastructure.createIndex.useMutation({
    onSuccess: () => {
      utils.infrastructure.getTableIndexes.invalidate();
      handleClose();
    },
  });

  function handleClose() {
    setSelectedColumns([]);
    setIndexName("");
    setUnique(false);
    setMethod("btree");
    setConcurrent(true);
    createMutation.reset();
    onOpenChange(false);
  }

  function toggleColumn(col: string) {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  }

  function handleCreate() {
    createMutation.mutate({
      databaseName,
      tableName,
      schemaName,
      columns: selectedColumns,
      indexName: indexName.trim() || undefined,
      unique,
      method,
      concurrent,
    });
  }

  const autoName = `idx_${tableName}_${selectedColumns.join("_")}`;
  const displayName = indexName.trim() || (selectedColumns.length > 0 ? autoName : "");
  const canSubmit = selectedColumns.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Index</DialogTitle>
          <DialogDescription>
            Add an index on{" "}
            <span className="font-mono font-medium">{tableName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Column selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Columns (select in order)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {availableColumns.map((col) => {
                const isSelected = selectedColumns.includes(col);
                const order = selectedColumns.indexOf(col) + 1;
                return (
                  <button
                    key={col}
                    onClick={() => toggleColumn(col)}
                    disabled={createMutation.isPending}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono transition-colors border",
                      isSelected
                        ? "bg-primary/20 border-primary/40 text-foreground"
                        : "bg-muted/20 border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                    )}
                  >
                    {isSelected && (
                      <span className="text-[10px] font-sans font-bold text-primary w-3.5 text-center">
                        {order}
                      </span>
                    )}
                    {col}
                  </button>
                );
              })}
            </div>
            {selectedColumns.length === 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Select one or more columns to index
              </p>
            )}
          </div>

          {/* Index name (optional) */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Index Name (optional)
            </label>
            <Input
              placeholder={selectedColumns.length > 0 ? autoName : "idx_tablename_column"}
              value={indexName}
              onChange={(e) =>
                setIndexName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
              }
              disabled={createMutation.isPending}
            />
            {displayName && (
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                {displayName}
              </p>
            )}
          </div>

          {/* Options row */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={unique}
                onChange={(e) => setUnique(e.target.checked)}
                disabled={createMutation.isPending}
                className="h-3.5 w-3.5 rounded border-border"
              />
              Unique
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={concurrent}
                onChange={(e) => setConcurrent(e.target.checked)}
                disabled={createMutation.isPending}
                className="h-3.5 w-3.5 rounded border-border"
              />
              Concurrent
            </label>
          </div>

          {/* Index method */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Index Method
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(METHOD_INFO) as IndexMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  disabled={createMutation.isPending}
                  className={cn(
                    "text-left px-2.5 py-2 rounded border text-xs transition-colors",
                    method === m
                      ? "bg-primary/10 border-primary/30 text-foreground"
                      : "bg-muted/10 border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                  )}
                >
                  <span className="font-medium uppercase">{m}</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    {METHOD_INFO[m]}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Concurrent info */}
          {concurrent && (
            <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
              <Zap className="h-3 w-3 mt-0.5 flex-shrink-0 text-yellow-500" />
              <span>
                Concurrent indexing won&apos;t lock the table for writes, but takes longer.
                Recommended for production databases.
              </span>
            </div>
          )}

          {createMutation.error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              {createMutation.error.message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!canSubmit || createMutation.isPending}
          >
            {createMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Create Index
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
