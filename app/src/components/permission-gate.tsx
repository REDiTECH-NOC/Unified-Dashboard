"use client";

import { usePermissions } from "@/hooks/use-permissions";
import { ShieldOff, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

/**
 * Wraps dashboard content. If the user has zero granted permissions
 * (and permissions have finished loading), shows a full-page "no access" message
 * instead of the dashboard. Admins always pass through.
 */
export function PermissionGate({ children }: { children: React.ReactNode }) {
  const { permissions, isLoading } = usePermissions();

  // Still loading — render nothing (prevents flash)
  if (isLoading) return null;

  // User has at least one permission — render the dashboard
  if (permissions.size > 0) return <>{children}</>;

  // Zero permissions — show "no access" message
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <ShieldOff className="h-8 w-8 text-red-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">No Access</h1>
          <p className="text-muted-foreground">
            Your account doesn&apos;t have any permissions assigned. This usually means
            your Microsoft 365 group hasn&apos;t been linked to a permission role yet.
          </p>
          <p className="text-muted-foreground">
            Contact your administrator to get access.
          </p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="inline-flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
