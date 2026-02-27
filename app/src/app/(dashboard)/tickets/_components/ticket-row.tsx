"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  ChevronRight, ChevronDown, Building2, User, LayoutGrid,
  Clock, Loader2, CalendarDays, Users, FileText, MessageSquare, Info,
  PanelRightOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PriorityDot, PRIORITY_CONFIG, PRIORITY_TO_CW, type Priority } from "./priority-badge";
import { TicketNotesThread } from "./ticket-notes-thread";
import { TicketTimeEntry } from "./ticket-time-entry";
import { TicketStopwatch } from "./ticket-stopwatch";
import { GRID_COLS, GRID_COLS_ACTIONS } from "./grid-layout";
import { useTicketBubbles } from "@/contexts/ticket-bubble-context";
import type { TicketHub } from "./use-ticket-hub";

export interface TicketRowData {
  sourceId: string;
  summary: string;
  description?: string;
  status: string;
  priority: string;
  board?: string;
  boardId?: string;
  companyName?: string;
  companySourceId?: string;
  contactName?: string;
  contactEmail?: string;
  assignedTo?: string;
  createdAt: Date;
  updatedAt?: Date;
  _raw?: any;
}

interface TicketRowProps {
  ticket: TicketRowData;
  expanded: boolean;
  onToggle: (id: string) => void;
  showQuickActions?: boolean;
  hub: TicketHub;
}

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes("new")) return "bg-blue-500/10 text-blue-400";
  if (s.includes("progress")) return "bg-yellow-500/10 text-yellow-400";
  if (s.includes("waiting")) return "bg-orange-500/10 text-orange-400";
  if (s.includes("complete")) return "bg-green-500/10 text-green-400";
  if (s.includes("closed")) return "bg-zinc-500/10 text-zinc-400";
  if (s.includes("scheduled")) return "bg-purple-500/10 text-purple-400";
  if (s.includes("pending")) return "bg-amber-500/10 text-amber-400";
  return "bg-muted text-muted-foreground";
}

export function TicketRow({ ticket, expanded, onToggle, showQuickActions = false, hub }: TicketRowProps) {
  const { openTicket } = useTicketBubbles();
  return (
    <div className={cn("transition-colors", expanded && "bg-muted/5")}>
      {/* Row header */}
      <button
        onClick={() => onToggle(ticket.sourceId)}
        className={cn(
          "w-full py-3.5 text-left hover:bg-muted/10 transition-colors",
          "grid items-center gap-x-3 px-5",
          showQuickActions ? GRID_COLS_ACTIONS : GRID_COLS
        )}
      >
        <span className="text-muted-foreground/40">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
        <PriorityDot priority={ticket.priority} />
        <span className="text-xs font-mono text-muted-foreground/70">{ticket.sourceId}</span>
        <span className="text-[13px] truncate font-medium">{ticket.summary}</span>
        <span className="text-[10px] text-muted-foreground/60 truncate hidden md:block">{ticket.board ?? "\u2014"}</span>
        <span className="text-xs text-muted-foreground/70 truncate hidden lg:block">{ticket.companyName ?? "\u2014"}</span>
        <span className={cn("text-[10px] px-2.5 py-1 rounded-full font-medium text-center", statusColor(ticket.status))}>
          {ticket.status}
        </span>
        <span className="text-[11px] text-muted-foreground/60 text-right tabular-nums hidden md:block">
          {(ticket._raw as any)?.actualHours != null ? `${Number((ticket._raw as any).actualHours).toFixed(1)}h` : "\u2014"}
        </span>
        <span className="text-[10px] text-muted-foreground/60 truncate hidden xl:block">{(ticket._raw as any)?.item?.name ?? "\u2014"}</span>
        <span className="text-[11px] text-muted-foreground/60 text-right hidden sm:block">
          {hub.relative(ticket.updatedAt ?? ticket.createdAt)}
        </span>
        {showQuickActions && (
          <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => openTicket(ticket.sourceId)}
              className="p-1 rounded hover:bg-muted/30 text-muted-foreground/50 hover:text-primary transition-colors"
              title="Pop out ticket"
            >
              <PanelRightOpen className="h-3.5 w-3.5" />
            </button>
            <TicketStopwatch ticketId={ticket.sourceId} compact onLogTime={(hours) => {
              hub.addTime.mutate({ ticketId: ticket.sourceId, hoursWorked: hours });
            }} />
          </span>
        )}
      </button>

      {/* Expanded detail panel */}
      {expanded && <TicketExpandedDetail ticket={ticket} hub={hub} />}
    </div>
  );
}

type ExpandedTab = "notes" | "details" | "time" | "resources";

/* ─── Expanded Detail (Tabbed Layout) ─── */
function TicketExpandedDetail({ ticket, hub }: { ticket: TicketRowData; hub: TicketHub }) {
  const [descCollapsed, setDescCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<ExpandedTab>("notes");
  const router = useRouter();

  // Fetch full ticket to get initialDescription (list API doesn't include it)
  const fullTicket = trpc.psa.getTicketById.useQuery(
    { id: ticket.sourceId },
    { staleTime: 60_000, retry: 1 }
  );

  const notes = trpc.psa.getTicketNotes.useQuery(
    { ticketId: ticket.sourceId },
    { retry: 1 }
  );

  // CW stores email-sourced descriptions as a note with detailDescriptionFlag=true
  // Use that as the description fallback when initialDescription is empty
  const detailNote = useMemo(() => {
    if (!notes.data) return null;
    return (notes.data as Array<{ noteType?: string; text: string }>).find(
      (n) => n.noteType === "detail"
    ) ?? null;
  }, [notes.data]);

  const description = fullTicket.data?.description
    ?? (fullTicket.data?._raw as any)?.initialDescription
    ?? detailNote?.text
    ?? ticket.description;

  // Filter out the detail note from the notes list to avoid duplication
  const displayNotes = useMemo(() => {
    if (!notes.data) return undefined;
    if (!detailNote) return notes.data;
    return notes.data.filter((n) => (n as any).noteType !== "detail");
  }, [notes.data, detailNote]);

  const timeEntries = trpc.psa.getTimeEntries.useQuery(
    { ticketId: ticket.sourceId },
    { retry: 1, staleTime: 30_000 }
  );

  // Stable date range — memoize so query key doesn't change every render
  const scheduleRange = useMemo(() => ({
    dateStart: new Date(Date.now() - 30 * 86400000),
    dateEnd: new Date(Date.now() + 14 * 86400000),
  }), []);

  // Schedule entries for this ticket (resources)
  const schedule = trpc.psa.getScheduleEntries.useQuery(
    scheduleRange,
    { retry: 1, staleTime: 5 * 60_000 }
  );

  const ticketSchedule = useMemo(() => {
    if (!schedule.data || !Array.isArray(schedule.data)) return [];
    return schedule.data.filter((e: any) =>
      e.objectId && String(e.objectId) === ticket.sourceId
    );
  }, [schedule.data, ticket.sourceId]);

  // Extract unique resource names from schedule entries + ticket data
  const resourceNames = useMemo(() => {
    const names = new Set<string>();
    for (const entry of ticketSchedule) {
      if ((entry as any).memberName) names.add((entry as any).memberName);
    }
    if (ticket.assignedTo) names.add(ticket.assignedTo);
    const rawResources = (ticket._raw as any)?.resources;
    if (typeof rawResources === "string" && rawResources) {
      rawResources.split(",").map((r: string) => r.trim()).filter(Boolean).forEach((r: string) => names.add(r));
    }
    return Array.from(names);
  }, [ticketSchedule, ticket.assignedTo, ticket._raw]);

  // Resolve boardId for status changes
  const boardId = useMemo(() => {
    if (!ticket.board || !hub.boards.data) return null;
    const match = hub.boards.data.find((b) => b.name === ticket.board);
    return match?.id ?? null;
  }, [ticket.board, hub.boards.data]);

  const boardStatuses = trpc.psa.getBoardStatuses.useQuery(
    { boardId: boardId! },
    { enabled: !!boardId, staleTime: 5 * 60_000, retry: 1 }
  );

  // Total time logged
  const totalHours = useMemo(() => {
    if (!timeEntries.data) return 0;
    return timeEntries.data.reduce((sum, e) => sum + e.actualHours, 0);
  }, [timeEntries.data]);

  // Extract extra detail fields from _raw
  const raw = ticket._raw as Record<string, any> | undefined;
  const ticketType = raw?.type?.name;
  const ticketSubType = raw?.subType?.name;
  const ticketItem = raw?.item?.name;
  const slaName = raw?.sla?.name;
  const impact = raw?.impact;
  const severity = raw?.severity;
  const siteName = raw?.siteName;
  const requiredDate = raw?.requiredDate;
  const budgetHours = raw?.budgetHours;
  const actualHours = raw?.actualHours;
  const recordType = raw?.recordType;
  const source = raw?.source?.name;
  const agreement = raw?.agreement?.name;

  function navigateCompany() {
    router.push(`/tickets?tab=all&company=${ticket.companySourceId ?? ""}`);
  }

  function navigateContact() {
    router.push(`/tickets?tab=all&contact=${encodeURIComponent(ticket.contactName ?? "")}`);
  }

  const TABS: { id: ExpandedTab; label: string; icon: typeof MessageSquare; badge?: string }[] = [
    { id: "notes", label: "Notes", icon: MessageSquare, badge: displayNotes ? String(displayNotes.length) : undefined },
    { id: "details", label: "Details", icon: Info },
    { id: "time", label: "Time", icon: Clock, badge: totalHours > 0 ? `${totalHours.toFixed(1)}h` : undefined },
    { id: "resources", label: "Resources & Meetings", icon: Users, badge: ticketSchedule.length > 0 ? String(ticketSchedule.length) : undefined },
  ];

  return (
    <div className="border-t border-border/15 bg-muted/3">
      {/* Top bar: quick actions + navigation */}
      <div className="px-6 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-wrap items-center gap-2.5">
            {boardStatuses.data && boardStatuses.data.length > 0 && (
              <select
                className="h-7 rounded-md border border-border/50 bg-background px-2 text-xs"
                value={ticket.status}
                onChange={(e) => hub.updateTicket.mutate({ id: ticket.sourceId, status: e.target.value })}
                disabled={hub.updateTicket.isPending}
              >
                {boardStatuses.data.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            )}
            <select
              className="h-7 rounded-md border border-border/50 bg-background px-2 text-xs"
              value={ticket.priority}
              onChange={(e) => hub.updateTicket.mutate({
                id: ticket.sourceId,
                priority: PRIORITY_TO_CW[e.target.value as Priority] ?? e.target.value,
              })}
              disabled={hub.updateTicket.isPending}
            >
              {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
              ))}
            </select>
            {hub.members.data && hub.members.data.length > 0 && (
              <select
                className="h-7 rounded-md border border-border/50 bg-background px-2 text-xs"
                value=""
                onChange={(e) => {
                  if (e.target.value) hub.updateTicket.mutate({ id: ticket.sourceId, assignTo: e.target.value });
                }}
                disabled={hub.updateTicket.isPending}
              >
                <option value="">Reassign{ticket.assignedTo ? ` (${ticket.assignedTo})` : ""}...</option>
                {hub.members.data.map((m) => (
                  <option key={m.id} value={m.identifier}>{m.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {ticket.companyName && (
              <button
                onClick={navigateCompany}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md border border-border/30 hover:border-border/50 hover:bg-muted/10"
              >
                <Building2 className="h-3 w-3" /> Company Tickets
              </button>
            )}
            {ticket.contactName && (
              <button
                onClick={navigateContact}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md border border-border/30 hover:border-border/50 hover:bg-muted/10"
              >
                <User className="h-3 w-3" /> Contact Tickets
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible description — fetched on expand since list API doesn't include it */}
      <div className="px-6 pb-3">
        {fullTicket.isLoading ? (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading description...
          </div>
        ) : fullTicket.isError ? (
          <p className="text-[10px] text-red-400/60">Failed to load ticket details</p>
        ) : description ? (
          <>
            <button
              onClick={() => setDescCollapsed(!descCollapsed)}
              className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 hover:text-foreground transition-colors"
            >
              {descCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Description
            </button>
            {!descCollapsed && (
              <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed rounded-lg border border-border/15 bg-background/30 p-4 max-h-40 overflow-y-auto">
                {description}
              </p>
            )}
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground/30 uppercase tracking-wider">No description</span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 border-t border-border/15">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px",
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.badge && (
                <span className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                  activeTab === tab.id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="px-6 py-5">
        {activeTab === "notes" && (
          <div className="flex gap-5">
            {/* Notes — left side */}
            <div className="flex-1 min-w-0">
              <TicketNotesThread
                ticketId={ticket.sourceId}
                notes={displayNotes}
                isLoading={notes.isLoading}
                hub={hub}
                contactName={ticket.contactName}
                contactEmail={ticket.contactEmail}
                resourceNames={resourceNames}
                existingCcEmails={raw?.automaticEmailCc}
              />
            </div>
            {/* Sidebar — compact resources + time summary */}
            <div className="w-64 flex-shrink-0 space-y-4 border-l border-border/15 pl-5">
              <ResourcesSection
                ticketSchedule={ticketSchedule}
                resourceNames={resourceNames}
                hub={hub}
                isLoading={schedule.isLoading}
                isError={schedule.isError}
                compact
              />
              <div className="border-t border-border/15 pt-3">
                <TimeSection
                  ticket={ticket}
                  hub={hub}
                  timeEntries={timeEntries.data}
                  isLoading={timeEntries.isLoading}
                  compact
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "details" && (
          <DetailsTab
            ticket={ticket}
            hub={hub}
            boardStatuses={boardStatuses.data}
            ticketType={ticketType}
            ticketSubType={ticketSubType}
            ticketItem={ticketItem}
            slaName={slaName}
            impact={impact}
            severity={severity}
            siteName={siteName}
            requiredDate={requiredDate}
            budgetHours={budgetHours}
            actualHours={actualHours}
            totalHours={totalHours}
            recordType={recordType}
            source={source}
            agreement={agreement}
          />
        )}

        {activeTab === "time" && (
          <TimeSection
            ticket={ticket}
            hub={hub}
            timeEntries={timeEntries.data}
            isLoading={timeEntries.isLoading}
          />
        )}

        {activeTab === "resources" && (
          <ResourcesSection
            ticketSchedule={ticketSchedule}
            resourceNames={resourceNames}
            hub={hub}
            isLoading={schedule.isLoading}
            isError={schedule.isError}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Details Tab (Editable) ─── */
function DetailsTab({
  ticket, hub, boardStatuses, ticketType, ticketSubType, ticketItem, slaName,
  impact, severity, siteName, requiredDate, budgetHours, actualHours,
  totalHours, recordType, source, agreement,
}: {
  ticket: TicketRowData; hub: TicketHub; boardStatuses?: Array<{ id: string; name: string }>;
  ticketType?: string; ticketSubType?: string; ticketItem?: string;
  slaName?: string; impact?: string; severity?: string; siteName?: string;
  requiredDate?: string; budgetHours?: number; actualHours?: number;
  totalHours: number; recordType?: string; source?: string; agreement?: string;
}) {
  // Resolve current board ID + member identifier for select values
  const currentBoardId = useMemo(() => {
    if (!ticket.board || !hub.boards.data) return undefined;
    const match = hub.boards.data.find((b) => b.name === ticket.board);
    return match ? String(match.id) : undefined;
  }, [ticket.board, hub.boards.data]);

  const currentAssignedId = useMemo(() => {
    if (!ticket.assignedTo || !hub.members.data) return undefined;
    const match = hub.members.data.find((m) => m.name === ticket.assignedTo);
    return match?.identifier;
  }, [ticket.assignedTo, hub.members.data]);

  // Editable fields — dropdowns
  const editableFields: Array<{
    label: string;
    value: string | undefined;
    options?: Array<{ value: string; label: string }>;
    onChange?: (val: string) => void;
  }> = [
    {
      label: "Board",
      value: currentBoardId ?? ticket.board,
      options: hub.boards.data?.map((b) => ({ value: String(b.id), label: b.name })),
      onChange: (val) => hub.updateTicket.mutate({ id: ticket.sourceId, boardId: val }),
    },
    {
      label: "Status",
      value: ticket.status,
      options: boardStatuses?.map((s) => ({ value: s.name, label: s.name })),
      onChange: (val) => hub.updateTicket.mutate({ id: ticket.sourceId, status: val }),
    },
    {
      label: "Priority",
      value: ticket.priority,
      options: (Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => ({
        value: p,
        label: PRIORITY_CONFIG[p].label,
      })),
      onChange: (val) => hub.updateTicket.mutate({
        id: ticket.sourceId,
        priority: PRIORITY_TO_CW[val as Priority] ?? val,
      }),
    },
    {
      label: "Assigned To",
      value: currentAssignedId ?? ticket.assignedTo,
      options: hub.members.data?.map((m) => ({ value: m.identifier, label: m.name })),
      onChange: (val) => hub.updateTicket.mutate({ id: ticket.sourceId, assignTo: val }),
    },
  ];

  // Read-only fields
  const readOnlyFields: Array<{ label: string; value: string | undefined | null }> = [
    { label: "Company", value: ticket.companyName },
    { label: "Contact", value: ticket.contactName },
    { label: "Contact Email", value: ticket.contactEmail },
    { label: "Type", value: ticketType },
    { label: "Sub Type", value: ticketSubType },
    { label: "Item", value: ticketItem },
    { label: "SLA", value: slaName },
    { label: "Impact", value: impact },
    { label: "Severity", value: severity },
    { label: "Record Type", value: recordType },
    { label: "Source", value: source },
    { label: "Site", value: siteName },
    { label: "Agreement", value: agreement },
    { label: "Due Date", value: requiredDate ? new Date(requiredDate).toLocaleDateString() : undefined },
    { label: "Budget Hours", value: budgetHours != null ? `${budgetHours}h` : undefined },
    { label: "Actual Hours", value: actualHours != null ? `${actualHours}h` : undefined },
    { label: "Logged Hours", value: totalHours > 0 ? `${totalHours.toFixed(2)}h` : undefined },
    { label: "Created", value: hub.dateTime(ticket.createdAt) },
    { label: "Updated", value: ticket.updatedAt ? hub.dateTime(ticket.updatedAt) : undefined },
    { label: "Ticket ID", value: ticket.sourceId },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
      {/* Editable dropdowns */}
      {editableFields.map((f) => (
        <div key={f.label}>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{f.label}</span>
          {f.options && f.options.length > 0 && f.onChange ? (
            <select
              className="mt-0.5 w-full h-7 rounded-md border border-border/50 bg-background px-2 text-xs"
              value={f.value ?? ""}
              onChange={(e) => f.onChange!(e.target.value)}
              disabled={hub.updateTicket.isPending}
            >
              {!f.options.some((o) => o.value === f.value || o.label === f.value) && f.value && (
                <option value={f.value}>{f.value}</option>
              )}
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-foreground mt-0.5">{f.value ?? "\u2014"}</p>
          )}
        </div>
      ))}
      {/* Read-only fields */}
      {readOnlyFields.filter((f) => f.value).map((f) => (
        <div key={f.label}>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{f.label}</span>
          <p className="text-xs text-foreground mt-0.5">{f.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Resources Section ─── */
function ResourcesSection({
  ticketSchedule,
  resourceNames,
  hub,
  isLoading,
  isError,
  compact,
}: {
  ticketSchedule: any[];
  resourceNames: string[];
  hub: TicketHub;
  isLoading: boolean;
  isError?: boolean;
  compact?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5 block">
        <Users className="h-3 w-3" /> Resources
        {ticketSchedule.length > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-medium ml-1">
            {ticketSchedule.length}
          </span>
        )}
      </label>

      {/* Resource list */}
      {resourceNames.length > 0 && (
        <div className={cn("flex flex-wrap gap-1.5", compact ? "mb-2" : "mb-4")}>
          {resourceNames.map((name) => (
            <span key={name} className={cn(
              "inline-flex items-center gap-1 rounded-md border border-border/30 bg-background/30",
              compact ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
            )}>
              <User className="h-3 w-3 text-muted-foreground" /> {name}
            </span>
          ))}
        </div>
      )}

      {/* Schedule entries */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading...
        </div>
      ) : isError ? (
        <p className="text-[10px] text-amber-400/60 py-2">Schedule data unavailable — CW API key may need Schedule read permissions</p>
      ) : ticketSchedule.length > 0 ? (
        <div className={cn("space-y-1.5", compact && "max-h-32 overflow-y-auto")}>
          {ticketSchedule.map((entry: any) => (
            <div key={entry.id} className={cn(
              "rounded-lg border border-border/15 bg-background/30 text-xs",
              compact ? "px-2.5 py-2" : "flex items-center gap-3 px-4 py-3"
            )}>
              {compact ? (
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-3 w-3 text-purple-400 flex-shrink-0" />
                    <span className="font-medium text-[11px] truncate">{entry.memberName ?? "Unknown"}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                    {new Date(entry.dateStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" "}
                    {new Date(entry.dateStart).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    {entry.hours && <span className="ml-1">({entry.hours}h)</span>}
                  </div>
                </div>
              ) : (
                <>
                  <CalendarDays className="h-4 w-4 text-purple-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{entry.memberName ?? "Unknown"}</span>
                    <span className="text-muted-foreground/70 ml-2">
                      {new Date(entry.dateStart).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      {" "}
                      {new Date(entry.dateStart).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      {entry.dateEnd && (
                        <>
                          {" \u2014 "}
                          {new Date(entry.dateEnd).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </>
                      )}
                    </span>
                    {entry.hours && <span className="text-muted-foreground/50 ml-2">({entry.hours}h)</span>}
                  </div>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full flex-shrink-0",
                    entry.status === "Done" ? "bg-green-500/10 text-green-400" : "bg-muted text-muted-foreground"
                  )}>
                    {entry.status ?? entry.type}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className={cn("text-muted-foreground/50 text-center", compact ? "text-[10px] py-2" : "text-xs py-4")}>
          {resourceNames.length > 0 ? "No scheduled entries" : "No resources assigned"}
        </p>
      )}
    </div>
  );
}

/* ─── Time Section ─── */
function TimeSection({
  ticket, hub, timeEntries, isLoading, compact,
}: {
  ticket: TicketRowData;
  hub: TicketHub;
  timeEntries?: Array<{
    id: string; member?: string; actualHours: number;
    notes?: string; workType?: string; timeStart?: string;
    timeEnd?: string; dateEntered?: string;
  }>;
  isLoading: boolean;
  compact?: boolean;
}) {
  const total = useMemo(() => {
    if (!timeEntries) return 0;
    return timeEntries.reduce((sum, e) => sum + e.actualHours, 0);
  }, [timeEntries]);

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {/* Stopwatch + Add time */}
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="h-3 w-3" /> Time
          {total > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium ml-1">
              {total.toFixed(2)}h
            </span>
          )}
        </label>
        {!compact && (
          <TicketStopwatch
            ticketId={ticket.sourceId}
            compact
            onLogTime={(hours) => {
              hub.addTime.mutate({ ticketId: ticket.sourceId, hoursWorked: hours });
            }}
          />
        )}
      </div>

      {/* Time entry form — only in full view */}
      {!compact && <TicketTimeEntry ticketId={ticket.sourceId} hub={hub} />}

      {/* Time entries list */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading...
        </div>
      ) : timeEntries && timeEntries.length > 0 ? (
        <div className={cn("space-y-1.5 overflow-y-auto pr-1", compact ? "max-h-32" : "max-h-60")}>
          {timeEntries.map((entry) => (
            <div key={entry.id} className={cn(
              "rounded-lg border border-border/15 bg-background/30 text-xs",
              compact ? "px-2.5 py-1.5" : "flex items-center gap-2 px-3 py-2"
            )}>
              {compact ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-primary tabular-nums flex-shrink-0">{entry.actualHours.toFixed(2)}h</span>
                  <span className="text-muted-foreground truncate text-[10px]">{entry.member ?? "Unknown"}</span>
                </div>
              ) : (
                <>
                  <span className="font-semibold text-primary tabular-nums w-12 flex-shrink-0">{entry.actualHours.toFixed(2)}h</span>
                  <span className="text-muted-foreground flex-shrink-0 truncate max-w-[80px]">{entry.member ?? "Unknown"}</span>
                  <span className="flex-1 truncate text-foreground/60">{entry.notes ?? ""}</span>
                  {entry.dateEntered && (
                    <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">
                      {hub.relative(new Date(entry.dateEntered))}
                    </span>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className={cn("text-muted-foreground/50 text-center", compact ? "text-[10px] py-1" : "text-xs py-2")}>No time entries</p>
      )}
    </div>
  );
}
