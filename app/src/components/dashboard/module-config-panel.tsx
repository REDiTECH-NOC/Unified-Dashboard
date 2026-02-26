"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModuleConfigPanelProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function ModuleConfigPanel({ title, open, onClose, children }: ModuleConfigPanelProps) {
  // SSR-safe: only portal after client mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  // Portal to document.body so the overlay escapes CSS transform containment
  // from react-grid-layout's useCSSTransforms + overflow-hidden on module-wrapper
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm h-full bg-card border-l border-border overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-card border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-4 space-y-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// Shared form elements for config panels
export function ConfigSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function ConfigSelect({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-8 px-3 rounded-lg bg-accent border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-red-500/50"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function ConfigToggle({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded" />
      {label}
    </label>
  );
}

export function ConfigChip({ label, active, onClick, color }: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
        active
          ? "border-red-500/50 bg-red-500/10 text-red-400"
          : "border-border bg-transparent text-muted-foreground hover:text-foreground"
      }`}
      style={color ? {
        borderColor: active ? color + "80" : color + "30",
        backgroundColor: active ? color + "20" : "transparent",
        color: active ? color : undefined,
      } : undefined}
    >
      {label}
    </button>
  );
}
