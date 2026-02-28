"use client";

import { useEffect } from "react";

export default function DnsFilterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dns-filter] Page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-lg font-bold text-foreground">DNS Filter page error</h2>
      <pre className="max-w-xl text-xs text-red-400 bg-red-500/10 p-4 rounded-lg border border-red-500/20 overflow-auto whitespace-pre-wrap">
        {error.message}
        {error.stack && (
          <>
            {"\n\n"}
            {error.stack}
          </>
        )}
      </pre>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-foreground hover:bg-accent/80 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
