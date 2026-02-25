"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, Square, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimerState {
  startedAt: number | null; // Date.now() when started
  accumulated: number; // ms accumulated from previous runs
  running: boolean;
}

const STORAGE_PREFIX = "rcc:timer:";

function loadTimer(ticketId: string): TimerState {
  if (typeof window === "undefined") return { startedAt: null, accumulated: 0, running: false };
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${ticketId}`);
    if (!raw) return { startedAt: null, accumulated: 0, running: false };
    return JSON.parse(raw);
  } catch {
    return { startedAt: null, accumulated: 0, running: false };
  }
}

function saveTimer(ticketId: string, state: TimerState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_PREFIX}${ticketId}`, JSON.stringify(state));
}

function clearTimer(ticketId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${STORAGE_PREFIX}${ticketId}`);
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function msToHours(ms: number): number {
  return Math.round((ms / 3600000) * 100) / 100;
}

interface TicketStopwatchProps {
  ticketId: string;
  onLogTime?: (hours: number) => void;
  compact?: boolean;
}

export function TicketStopwatch({ ticketId, onLogTime, compact = false }: TicketStopwatchProps) {
  const [timer, setTimer] = useState<TimerState>(() => loadTimer(ticketId));
  const [displayMs, setDisplayMs] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // Calculate current display time
  const getCurrentMs = useCallback(() => {
    if (timer.running && timer.startedAt) {
      return timer.accumulated + (Date.now() - timer.startedAt);
    }
    return timer.accumulated;
  }, [timer]);

  // Tick every second when running
  useEffect(() => {
    if (timer.running) {
      setDisplayMs(getCurrentMs());
      intervalRef.current = setInterval(() => {
        setDisplayMs(getCurrentMs());
      }, 1000);
    } else {
      setDisplayMs(timer.accumulated);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timer.running, timer.startedAt, timer.accumulated, getCurrentMs]);

  // Reload timer state when ticketId changes
  useEffect(() => {
    const loaded = loadTimer(ticketId);
    setTimer(loaded);
  }, [ticketId]);

  const start = useCallback(() => {
    const newState: TimerState = {
      startedAt: Date.now(),
      accumulated: timer.accumulated,
      running: true,
    };
    setTimer(newState);
    saveTimer(ticketId, newState);
  }, [ticketId, timer.accumulated]);

  const pause = useCallback(() => {
    const elapsed = timer.startedAt ? Date.now() - timer.startedAt : 0;
    const newState: TimerState = {
      startedAt: null,
      accumulated: timer.accumulated + elapsed,
      running: false,
    };
    setTimer(newState);
    saveTimer(ticketId, newState);
  }, [ticketId, timer]);

  const stop = useCallback(() => {
    const totalMs = getCurrentMs();
    const hours = msToHours(totalMs);
    if (hours > 0 && onLogTime) {
      onLogTime(hours);
    }
    const newState: TimerState = { startedAt: null, accumulated: 0, running: false };
    setTimer(newState);
    clearTimer(ticketId);
  }, [ticketId, getCurrentMs, onLogTime]);

  const hasTime = displayMs > 0;

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {hasTime && (
          <span className={cn(
            "text-[11px] font-mono tabular-nums",
            timer.running ? "text-green-400" : "text-muted-foreground"
          )}>
            {formatElapsed(displayMs)}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); timer.running ? pause() : start(); }}
          className={cn(
            "h-6 w-6 flex items-center justify-center rounded transition-colors",
            timer.running
              ? "text-green-400 bg-green-500/10 hover:bg-green-500/20"
              : hasTime
                ? "text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
          title={timer.running ? "Pause timer" : hasTime ? "Resume timer" : "Start timer"}
        >
          {timer.running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </button>
        {hasTime && !timer.running && (
          <button
            onClick={(e) => { e.stopPropagation(); stop(); }}
            className="h-6 w-6 flex items-center justify-center rounded text-red-400 hover:bg-red-500/10 transition-colors"
            title="Stop & log time"
          >
            <Square className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/5">
      <Clock className={cn("h-4 w-4 flex-shrink-0", timer.running ? "text-green-400" : "text-muted-foreground")} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-lg font-mono tabular-nums font-semibold",
            timer.running ? "text-green-400" : hasTime ? "text-foreground" : "text-muted-foreground"
          )}>
            {formatElapsed(displayMs)}
          </span>
          {timer.running && (
            <span className="flex items-center gap-1 text-[10px] text-green-400/70">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              Running
            </span>
          )}
          {hasTime && !timer.running && (
            <span className="text-[10px] text-yellow-400/70">Paused</span>
          )}
        </div>
        {hasTime && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {msToHours(displayMs)} hours
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={timer.running ? pause : start}
          className={cn(
            "h-8 w-8 flex items-center justify-center rounded-lg transition-colors",
            timer.running
              ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          )}
          title={timer.running ? "Pause" : "Start"}
        >
          {timer.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        {hasTime && (
          <button
            onClick={stop}
            className="h-8 px-3 flex items-center gap-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            title="Stop timer and log time"
          >
            <Square className="h-3 w-3" />
            Log {msToHours(displayMs)}h
          </button>
        )}
      </div>
    </div>
  );
}

/** Check if any ticket has a running timer (for showing indicators in the table) */
export function getRunningTimerTicketId(): string | null {
  if (typeof window === "undefined") return null;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      try {
        const state: TimerState = JSON.parse(localStorage.getItem(key) ?? "");
        if (state.running) return key.replace(STORAGE_PREFIX, "");
      } catch { /* skip */ }
    }
  }
  return null;
}
