"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search } from "lucide-react";
import { PRIORITY_CONFIG, type Priority } from "./priority-badge";
import type { TicketHub } from "./use-ticket-hub";

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hub: TicketHub;
}

export function CreateTicketDialog({ open, onOpenChange, hub }: CreateTicketDialogProps) {
  // Form state
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [contactId, setContactId] = useState("");
  const [boardId, setBoardId] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("rcc:lastBoard") ?? "";
    return "";
  });
  const [priority, setPriority] = useState<Priority>("medium");
  const [assignTo, setAssignTo] = useState("");
  const [showCompanySearch, setShowCompanySearch] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const handleCompanySearch = useCallback((val: string) => {
    setCompanySearch(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(val), 400);
  }, []);

  // Company search query
  const companies = trpc.psa.getCompanies.useQuery(
    { searchTerm: debouncedSearch, pageSize: 15 },
    { enabled: open && debouncedSearch.length >= 2, staleTime: 30_000, retry: 1 }
  );

  // Contacts for selected company
  const contacts = trpc.psa.getContacts.useQuery(
    { companyId, pageSize: 50 },
    { enabled: !!companyId, staleTime: 60_000, retry: 1 }
  );

  // Reset form on close
  useEffect(() => {
    if (!open) {
      setSummary("");
      setDescription("");
      setCompanyId("");
      setCompanySearch("");
      setContactId("");
      setPriority("medium");
      setAssignTo("");
      setShowCompanySearch(false);
      setDebouncedSearch("");
    }
  }, [open]);

  function selectCompany(id: string, name: string) {
    setCompanyId(id);
    setCompanySearch(name);
    setContactId("");
    setShowCompanySearch(false);
  }

  function submit() {
    if (!summary.trim() || !companyId) return;

    // Remember last used board
    if (boardId && typeof window !== "undefined") {
      localStorage.setItem("rcc:lastBoard", boardId);
    }

    hub.createTicketMutation.mutate(
      {
        summary: summary.trim(),
        description: description.trim() || undefined,
        companyId,
        contactId: contactId || undefined,
        boardId: boardId || undefined,
        priority,
        assignTo: assignTo || undefined,
      },
      {
        onSuccess: (ticket) => {
          onOpenChange(false);
        },
      }
    );
  }

  const isValid = summary.trim().length > 0 && !!companyId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Create New Ticket</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Company (typeahead search) */}
          <div className="relative">
            <Label className="text-xs mb-1 block">Company *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={companySearch}
                onChange={(e) => {
                  handleCompanySearch(e.target.value);
                  setShowCompanySearch(true);
                  if (!e.target.value) { setCompanyId(""); setContactId(""); }
                }}
                onFocus={() => { if (companySearch.length >= 2) setShowCompanySearch(true); }}
                className="pl-9 h-8 text-xs"
              />
            </div>
            {showCompanySearch && debouncedSearch.length >= 2 && (
              <div className="absolute z-10 top-full mt-1 left-0 right-0 max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                {companies.isLoading ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                  </div>
                ) : companies.data?.data && companies.data.data.length > 0 ? (
                  companies.data.data.map((c) => (
                    <button
                      key={c.sourceId}
                      onClick={() => selectCompany(c.sourceId, c.name)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
                    >
                      <span className="font-medium">{c.name}</span>
                      {c.status && <span className="ml-2 text-muted-foreground">({c.status})</span>}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No companies found</div>
                )}
              </div>
            )}
          </div>

          {/* Contact (loads after company) */}
          {companyId && (
            <div>
              <Label className="text-xs mb-1 block">Contact</Label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
              >
                <option value="">Select contact (optional)</option>
                {contacts.data?.data.map((c) => (
                  <option key={c.sourceId} value={c.sourceId}>
                    {c.firstName} {c.lastName}{c.email ? ` (${c.email})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Board */}
          <div>
            <Label className="text-xs mb-1 block">Board</Label>
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="">Select board (optional)</option>
              {hub.boards.data?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Summary */}
          <div>
            <Label className="text-xs mb-1 block">Summary *</Label>
            <Input
              placeholder="Brief ticket summary..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="h-8 text-xs"
              maxLength={500}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs mb-1 block">Description</Label>
            <textarea
              placeholder="Detailed description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-24 rounded-md border border-border bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Priority + Assign row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Priority</Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
              >
                {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Assign To</Label>
              <select
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
                className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
              >
                <option value="">Unassigned</option>
                {hub.members.data?.map((m) => (
                  <option key={m.id} value={m.identifier}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Error */}
          {hub.createTicketMutation.error && (
            <div className="text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
              {hub.createTicketMutation.error.message}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={!isValid || hub.createTicketMutation.isPending}>
            {hub.createTicketMutation.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Creating...</>
            ) : (
              "Create Ticket"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
