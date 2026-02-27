"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TicketBubble } from "@/components/ticket-bubble";

/* ─── Types ──────────────────────────────────────────────── */

export interface BubbleEntry {
  ticketId: string;
  minimized: boolean;
}

interface TicketBubbleContextValue {
  bubbles: BubbleEntry[];
  openTicket: (ticketId: string) => void;
  closeTicket: (ticketId: string) => void;
  toggleMinimize: (ticketId: string) => void;
  minimizeAll: () => void;
}

const MAX_BUBBLES = 4;

const TicketBubbleContext = createContext<TicketBubbleContextValue | null>(null);

/* ─── Hook ───────────────────────────────────────────────── */

export function useTicketBubbles() {
  const ctx = useContext(TicketBubbleContext);
  if (!ctx) throw new Error("useTicketBubbles must be used within TicketBubbleProvider");
  return ctx;
}

/* ─── Container (renders portal) ─────────────────────────── */

function TicketBubbleContainer({ bubbles, onClose, onToggle }: {
  bubbles: BubbleEntry[];
  onClose: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  if (bubbles.length === 0) return null;

  return (
    <div className="fixed bottom-0 right-0 z-[45] flex items-end gap-3 p-3">
      {bubbles.map((b) => (
        <div key={b.ticketId}>
          <TicketBubble
            ticketId={b.ticketId}
            minimized={b.minimized}
            onClose={() => onClose(b.ticketId)}
            onToggleMinimize={() => onToggle(b.ticketId)}
          />
        </div>
      ))}
    </div>
  );
}

/* ─── Provider ───────────────────────────────────────────── */

export function TicketBubbleProvider({ children }: { children: ReactNode }) {
  const [bubbles, setBubbles] = useState<BubbleEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const openTicket = useCallback((ticketId: string) => {
    setBubbles((prev) => {
      // If already open, just expand it
      const existing = prev.find((b) => b.ticketId === ticketId);
      if (existing) {
        return prev.map((b) => b.ticketId === ticketId ? { ...b, minimized: false } : b);
      }
      // If at max, minimize the oldest and add new
      let next = [...prev];
      if (next.length >= MAX_BUBBLES) {
        next = next.map((b, i) => i === 0 ? { ...b, minimized: true } : b);
      }
      return [...next.slice(-(MAX_BUBBLES - 1)), { ticketId, minimized: false }];
    });
  }, []);

  const closeTicket = useCallback((ticketId: string) => {
    setBubbles((prev) => prev.filter((b) => b.ticketId !== ticketId));
  }, []);

  const toggleMinimize = useCallback((ticketId: string) => {
    setBubbles((prev) =>
      prev.map((b) => b.ticketId === ticketId ? { ...b, minimized: !b.minimized } : b)
    );
  }, []);

  const minimizeAll = useCallback(() => {
    setBubbles((prev) => prev.map((b) => ({ ...b, minimized: true })));
  }, []);

  return (
    <TicketBubbleContext.Provider value={{ bubbles, openTicket, closeTicket, toggleMinimize, minimizeAll }}>
      {children}
      {mounted && createPortal(
        <TicketBubbleContainer
          bubbles={bubbles}
          onClose={closeTicket}
          onToggle={toggleMinimize}
        />,
        document.body
      )}
    </TicketBubbleContext.Provider>
  );
}
