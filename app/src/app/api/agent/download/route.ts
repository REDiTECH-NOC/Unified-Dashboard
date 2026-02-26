/**
 * GET /api/agent/download — Download the relay agent as a .tar.gz archive.
 *
 * Requires an authenticated dashboard session (logged-in user).
 * Serves the relay-agent source directory (mounted at /app/relay-agent-src)
 * as a downloadable tarball.
 */

import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const RELAY_SRC = "/app/relay-agent-src";

export async function GET() {
  // Require authenticated session
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the relay-agent source is mounted
  if (!existsSync(RELAY_SRC)) {
    return NextResponse.json(
      { error: "Relay agent source not available" },
      { status: 404 }
    );
  }

  try {
    // Create tarball in memory using system tar (available on Alpine)
    const tarball = execSync(
      `tar czf - -C "${RELAY_SRC}" --transform='s,^\\.,reditech-relay-agent,' .`,
      { maxBuffer: 10 * 1024 * 1024 }
    );

    return new NextResponse(tarball, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition":
          "attachment; filename=reditech-relay-agent.tar.gz",
        "Content-Length": String(tarball.length),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    // Fallback: tar --transform may not be available on all systems
    try {
      const tarball = execSync(`tar czf - -C "${RELAY_SRC}" .`, {
        maxBuffer: 10 * 1024 * 1024,
      });

      return new NextResponse(tarball, {
        headers: {
          "Content-Type": "application/gzip",
          "Content-Disposition":
            "attachment; filename=reditech-relay-agent.tar.gz",
          "Content-Length": String(tarball.length),
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "Failed to create archive", detail: message },
        { status: 500 }
      );
    }
  }
}
