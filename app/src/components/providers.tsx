"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink } from "@trpc/client";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import superjson from "superjson";

// Queries that hit external services and can be slow (8s+ timeouts).
// These must NOT block fast queries like permissions and dashboard layout.
const SLOW_QUERIES = new Set([
  "system.health",
  "system.updateInfo",
  "system.containerInfo",
]);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Prevent immediate refetch when components remount during navigation
            staleTime: 30_000,
            // Keep showing old data while refetching in background
            refetchOnWindowFocus: false,
          },
        },
      })
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        splitLink({
          // Slow health/update queries go via individual httpLink so they
          // don't block the fast batch that populates the dashboard shell.
          condition: (op) => SLOW_QUERIES.has(op.path),
          true: httpLink({
            url: "/api/trpc",
            transformer: superjson,
          }),
          false: httpBatchLink({
            url: "/api/trpc",
            transformer: superjson,
          }),
        }),
      ],
    })
  );

  return (
    <SessionProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </trpc.Provider>
    </SessionProvider>
  );
}
