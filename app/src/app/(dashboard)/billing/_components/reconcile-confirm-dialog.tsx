"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  productName: string;
  companyName: string;
  vendorName: string;
  psaQty: number;
  vendorQty: number;
}

export function ReconcileConfirmDialog({
  open,
  onClose,
  onConfirm,
  productName,
  companyName,
  vendorName,
  psaQty,
  vendorQty,
}: Props) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-zinc-100 mb-1">
          Update PSA Quantity
        </h3>
        <p className="text-sm text-zinc-400 mb-4">
          This will update the ConnectWise agreement addition to match the vendor count.
        </p>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 mb-4 space-y-2">
          <div className="text-sm">
            <span className="text-zinc-400">Product:</span>{" "}
            <span className="text-zinc-100 font-medium">{productName}</span>
          </div>
          <div className="text-sm">
            <span className="text-zinc-400">Company:</span>{" "}
            <span className="text-zinc-100">{companyName}</span>
          </div>
          <div className="text-sm">
            <span className="text-zinc-400">Source:</span>{" "}
            <span className="text-zinc-100">{vendorName}</span>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-zinc-800">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">PSA Qty</div>
              <div className="text-2xl font-bold text-red-400">{psaQty}</div>
            </div>
            <ArrowRight className="h-5 w-5 text-zinc-600" />
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Vendor Qty</div>
              <div className="text-2xl font-bold text-green-400">{vendorQty}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="h-9 px-4 rounded-md border border-zinc-800 bg-zinc-900 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="h-9 px-4 rounded-md bg-green-600 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Reconcile
          </button>
        </div>
      </div>
    </div>
  );
}
