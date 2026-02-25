"use client";

import { useState } from "react";
import { Loader2, Clock, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TicketHub } from "./use-ticket-hub";

type BillableOption = "Billable" | "DoNotBill" | "NoCharge" | "NoDefault";

interface TicketTimeEntryProps {
  ticketId: string;
  hub: TicketHub;
}

export function TicketTimeEntry({ ticketId, hub }: TicketTimeEntryProps) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [workType, setWorkType] = useState("");
  const [billable, setBillable] = useState<BillableOption>("Billable");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const workTypes = trpc.psa.getWorkTypes.useQuery(undefined, {
    staleTime: 10 * 60_000,
    retry: 1,
    enabled: open,
  });

  function submit() {
    const h = parseFloat(hours);
    if (!h || h <= 0) return;
    hub.addTime.mutate(
      {
        ticketId,
        hoursWorked: h,
        notes: notes.trim() || undefined,
        workType: workType || undefined,
        timeStart: timeStart || undefined,
        timeEnd: timeEnd || undefined,
        billableOption: billable,
      },
      {
        onSuccess: () => {
          setHours("");
          setNotes("");
          setWorkType("");
          setBillable("Billable");
          setTimeStart("");
          setTimeEnd("");
          setShowAdvanced(false);
          setOpen(false);
        },
      }
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Clock className="h-3 w-3" /> Time Entry
        </label>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 text-[10px] font-medium text-primary/80 hover:text-primary transition-colors"
          >
            <Plus className="h-3 w-3" /> Log Time
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/5">
          {/* Main row: hours + notes */}
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Hours"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-24 h-8 text-xs"
              min="0.01"
              max="24"
              step="0.25"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
            <Input
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex-1 h-8 text-xs"
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
          </div>

          {/* Work type + billable row */}
          <div className="flex items-center gap-2">
            <select
              value={workType}
              onChange={(e) => setWorkType(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs flex-1"
            >
              <option value="">Work Type (optional)</option>
              {workTypes.data?.map((wt) => (
                <option key={wt.id} value={wt.name}>{wt.name}</option>
              ))}
            </select>
            <select
              value={billable}
              onChange={(e) => setBillable(e.target.value as BillableOption)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="Billable">Billable</option>
              <option value="DoNotBill">Do Not Bill</option>
              <option value="NoCharge">No Charge</option>
              <option value="NoDefault">No Default</option>
            </select>
          </div>

          {/* Advanced: start/end times */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Start / End Times
          </button>

          {showAdvanced && (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[9px] text-muted-foreground mb-0.5 block">Start Time</label>
                <Input
                  type="datetime-local"
                  value={timeStart}
                  onChange={(e) => setTimeStart(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-muted-foreground mb-0.5 block">End Time</label>
                <Input
                  type="datetime-local"
                  value={timeEnd}
                  onChange={(e) => setTimeEnd(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={submit} disabled={hub.addTime.isPending || !hours}>
              {hub.addTime.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Save Time Entry
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
