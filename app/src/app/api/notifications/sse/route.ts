/**
 * SSE (Server-Sent Events) endpoint for real-time notifications.
 *
 * GET /api/notifications/sse
 *
 * Authenticated users connect via EventSource. This endpoint subscribes to
 * Redis Pub/Sub channel `notifications:{userId}` and streams events.
 *
 * Works across multiple container replicas because Redis Pub/Sub handles fan-out.
 */

import { auth } from "@/lib/auth";
import Redis from "ioredis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  // Authenticate
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const channel = `notifications:${userId}`;

  // Create a dedicated Redis subscriber connection (separate from command connection)
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const subscriber = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });

  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial keep-alive comment
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Subscribe to user's notification channel
      subscriber.subscribe(channel).catch((err) => {
        console.error("[sse] Redis subscribe error:", err);
      });

      subscriber.on("message", (_ch: string, message: string) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${message}\n\n`)
          );
        } catch {
          // Stream was closed
          closed = true;
        }
      });

      // Keep-alive ping every 30 seconds to prevent proxy/LB timeouts
      const keepAlive = setInterval(() => {
        if (closed) {
          clearInterval(keepAlive);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
          clearInterval(keepAlive);
        }
      }, 30_000);

      // Clean up when client disconnects
      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(keepAlive);
        subscriber.unsubscribe(channel).catch(() => {});
        subscriber.quit().catch(() => {});
        try {
          controller.close();
        } catch {}
      });
    },

    cancel() {
      closed = true;
      subscriber.unsubscribe(channel).catch(() => {});
      subscriber.quit().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
