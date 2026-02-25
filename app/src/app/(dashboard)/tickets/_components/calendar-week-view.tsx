"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { PriorityDot, type Priority } from "./priority-badge";

export interface ScheduleBlock {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  type?: string;
  ticketId?: string;
}

export interface DeadlineItem {
  ticketId: string;
  summary: string;
  priority: string;
  dueDate: Date;
}

interface CalendarWeekViewProps {
  weekStart: Date;
  scheduleEntries: ScheduleBlock[];
  deadlines: DeadlineItem[];
  onSelectTicket: (id: string) => void;
}

const HOURS = Array.from({ length: 11 }, (_, i) => i + 7); // 7 AM to 5 PM
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDayHeader(d: Date): string {
  return `${DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]} ${d.getDate()}`;
}

export function CalendarWeekView({ weekStart, scheduleEntries, deadlines, onSelectTicket }: CalendarWeekViewProps) {
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const today = new Date();

  // Group schedule entries by day
  const entriesByDay = useMemo(() => {
    const map = new Map<number, ScheduleBlock[]>();
    for (let i = 0; i < 5; i++) map.set(i, []);
    for (const entry of scheduleEntries) {
      const dayIdx = days.findIndex((d) => isSameDay(d, entry.startTime));
      if (dayIdx >= 0) map.get(dayIdx)!.push(entry);
    }
    return map;
  }, [days, scheduleEntries]);

  // Group deadlines by day
  const deadlinesByDay = useMemo(() => {
    const map = new Map<number, DeadlineItem[]>();
    for (let i = 0; i < 5; i++) map.set(i, []);
    for (const dl of deadlines) {
      const dayIdx = days.findIndex((d) => isSameDay(d, dl.dueDate));
      if (dayIdx >= 0) map.get(dayIdx)!.push(dl);
    }
    return map;
  }, [days, deadlines]);

  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(5,1fr)] border-b border-border/50">
        <div className="px-2 py-2" />
        {days.map((d, i) => (
          <div
            key={i}
            className={cn(
              "px-2 py-2 text-xs font-medium text-center border-l border-border/30",
              isSameDay(d, today) && "bg-primary/5 text-primary"
            )}
          >
            {formatDayHeader(d)}
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="relative">
        {HOURS.map((hour) => (
          <div key={hour} className="grid grid-cols-[60px_repeat(5,1fr)] border-b border-border/10 min-h-[48px]">
            <div className="px-2 py-1 text-[10px] text-muted-foreground text-right pr-3">
              {hour > 12 ? `${hour - 12}p` : hour === 12 ? "12p" : `${hour}a`}
            </div>
            {days.map((d, dayIdx) => {
              const dayEntries = (entriesByDay.get(dayIdx) ?? []).filter((e) => {
                const startHour = e.startTime.getHours();
                return startHour === hour;
              });

              return (
                <div key={dayIdx} className="border-l border-border/10 px-1 py-0.5 relative">
                  {dayEntries.map((entry) => {
                    const durationHours = (entry.endTime.getTime() - entry.startTime.getTime()) / 3600000;
                    const heightPx = Math.max(24, Math.min(durationHours * 48, 192));
                    return (
                      <button
                        key={entry.id}
                        onClick={() => entry.ticketId && onSelectTicket(entry.ticketId)}
                        className={cn(
                          "w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate border transition-colors",
                          entry.type === "time-entry"
                            ? "bg-green-500/10 border-green-500/30 text-green-300 hover:bg-green-500/20 cursor-pointer"
                            : entry.ticketId
                              ? "bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20 cursor-pointer"
                              : "bg-zinc-500/10 border-zinc-500/30 text-zinc-400"
                        )}
                        style={{ height: `${heightPx}px` }}
                      >
                        {entry.title}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Deadlines row */}
      <div className="grid grid-cols-[60px_repeat(5,1fr)] border-t border-border/50 bg-muted/10">
        <div className="px-2 py-2 text-[10px] text-muted-foreground text-right pr-3">Due</div>
        {days.map((d, dayIdx) => {
          const dayDeadlines = deadlinesByDay.get(dayIdx) ?? [];
          return (
            <div key={dayIdx} className="border-l border-border/10 px-1 py-1.5 space-y-0.5">
              {dayDeadlines.map((dl) => (
                <button
                  key={dl.ticketId}
                  onClick={() => onSelectTicket(dl.ticketId)}
                  className="w-full text-left flex items-center gap-1 rounded px-1 py-0.5 text-[10px] hover:bg-muted/30 transition-colors"
                >
                  <PriorityDot priority={dl.priority} className="h-1.5 w-1.5" />
                  <span className="truncate">#{dl.ticketId}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
