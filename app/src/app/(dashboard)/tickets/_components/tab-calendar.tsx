"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarWeekView, type ScheduleBlock, type DeadlineItem } from "./calendar-week-view";
import type { TicketHub } from "./use-ticket-hub";

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 4);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = start.toLocaleDateString("en-US", opts);
  const endStr = end.toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${startStr} - ${endStr}`;
}

interface TabCalendarProps {
  hub: TicketHub;
  onSelectTicket?: (id: string) => void;
}

export function TabCalendar({ hub, onSelectTicket }: TabCalendarProps) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));

  const weekEnd = useMemo(() => {
    const end = addDays(weekStart, 5);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [weekStart]);

  // Try to fetch schedule entries (may 403 if API key lacks Schedule permissions)
  const scheduleQuery = trpc.psa.getScheduleEntries.useQuery(
    {
      memberIdentifier: hub.myIdentifier ?? undefined,
      dateStart: weekStart,
      dateEnd: weekEnd,
    },
    {
      enabled: !!hub.myIdentifier,
      staleTime: 2 * 60_000,
      retry: false,
    }
  );

  // Fetch time entries for this member/week — always available, used as calendar fallback
  const timeEntriesQuery = trpc.psa.getMemberTimeEntries.useQuery(
    {
      memberIdentifier: hub.myIdentifier!,
      dateStart: weekStart,
      dateEnd: weekEnd,
    },
    {
      enabled: !!hub.myIdentifier,
      staleTime: 2 * 60_000,
      retry: 1,
    }
  );

  // Get tickets with due dates for this week
  const ticketsQuery = trpc.psa.getTickets.useQuery(
    {
      assignedTo: hub.myIdentifier!,
      createdAfter: addDays(weekStart, -365),
      pageSize: 100,
    },
    {
      enabled: !!hub.myIdentifier,
      staleTime: 2 * 60_000,
      retry: 1,
    }
  );

  // Map schedule entries to blocks (if available)
  const scheduleBlocks: ScheduleBlock[] = useMemo(() => {
    if (!scheduleQuery.data || !Array.isArray(scheduleQuery.data)) return [];
    return scheduleQuery.data.map((e: any) => ({
      id: String(e.id),
      title: e.memberName ?? e.type ?? "Schedule",
      startTime: new Date(e.dateStart),
      endTime: new Date(e.dateEnd),
      type: e.type,
      ticketId: e.objectId ? String(e.objectId) : undefined,
    }));
  }, [scheduleQuery.data]);

  // Map time entries to blocks (fallback when schedule API is unavailable)
  const timeBlocks: ScheduleBlock[] = useMemo(() => {
    if (!timeEntriesQuery.data) return [];
    return timeEntriesQuery.data
      .filter((e) => e.timeStart && e.dateEntered)
      .map((e) => {
        const dateBase = e.dateEntered!.split("T")[0];
        const start = new Date(`${dateBase}T${e.timeStart ?? "08:00:00"}`);
        const durationMs = e.actualHours * 3600000;
        let end: Date;
        if (e.timeEnd) {
          end = new Date(`${dateBase}T${e.timeEnd}`);
        } else {
          end = new Date(start.getTime() + durationMs);
        }
        // Clamp to avoid zero-duration blocks
        if (end.getTime() <= start.getTime()) {
          end = new Date(start.getTime() + Math.max(durationMs, 1800000));
        }
        return {
          id: `te-${e.id}`,
          title: e.companyName ?? e.notes ?? `#${e.ticketId}`,
          startTime: start,
          endTime: end,
          type: "time-entry",
          ticketId: e.ticketId,
        };
      });
  }, [timeEntriesQuery.data]);

  // Use schedule entries if available, otherwise fall back to time entries
  const calendarBlocks = scheduleBlocks.length > 0 ? scheduleBlocks : timeBlocks;

  // Extract deadlines from tickets (using _raw.requiredDate)
  const deadlines: DeadlineItem[] = useMemo(() => {
    if (!ticketsQuery.data?.data) return [];
    const items: DeadlineItem[] = [];
    for (const t of ticketsQuery.data.data) {
      const raw = t._raw as Record<string, unknown> | undefined;
      const requiredDate = raw?.requiredDate as string | undefined;
      if (requiredDate) {
        const due = new Date(requiredDate);
        if (due >= weekStart && due <= weekEnd) {
          items.push({
            ticketId: t.sourceId,
            summary: t.summary,
            priority: t.priority,
            dueDate: due,
          });
        }
      }
    }
    return items;
  }, [ticketsQuery.data, weekStart, weekEnd]);

  const isToday = getMonday(new Date()).getTime() === weekStart.getTime();
  const isLoading = (scheduleQuery.isLoading && timeEntriesQuery.isLoading) || ticketsQuery.isLoading;

  return (
    <div className="space-y-3">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[200px] text-center">{formatWeekRange(weekStart)}</span>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {!isToday && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setWeekStart(getMonday(new Date()))}>
            Today
          </Button>
        )}
      </div>

      {/* Calendar body */}
      {!hub.myIdentifier ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground rounded-lg border border-border/50 bg-card">
          <CalendarDays className="mb-3 h-10 w-10 opacity-50" />
          <p className="text-sm font-medium">Map your CW account to view calendar</p>
          <p className="text-xs mt-1">Link your ConnectWise member in Settings to see your schedule.</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {scheduleQuery.isError && timeBlocks.length > 0 && (
            <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-md px-3 py-2 mb-2">
              CW Schedule API unavailable — showing logged time entries instead. Enable Schedule read permissions on the CW API key for full schedule data.
            </div>
          )}
          {scheduleQuery.isError && timeBlocks.length === 0 && (
            <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-md px-3 py-2 mb-2">
              CW Schedule API unavailable — enable Schedule read permissions on the CW API key. Showing ticket deadlines only.
            </div>
          )}
          <CalendarWeekView
            weekStart={weekStart}
            scheduleEntries={calendarBlocks}
            deadlines={deadlines}
            onSelectTicket={onSelectTicket ?? (() => {})}
          />
        </>
      )}
    </div>
  );
}
