"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { ExternalLink, Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const CIPP_URL = "https://cipp.reditech.com";

/**
 * Persistent CIPP iframe that lives in the dashboard layout.
 *
 * - Activates on first visit to /cipp?tab=fullui
 * - Stays in the DOM (hidden) when navigating to other pages
 * - Shows instantly when returning to the fullui tab
 * - Fixed overlay positioned below the header and right of sidebar
 */
function PersistentCIPPIframeInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activated, setActivated] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const helpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActive =
    pathname === "/cipp" && searchParams.get("tab") === "fullui";

  // Activate on first visit to fullui tab — iframe persists after that
  useEffect(() => {
    if (isActive && !activated) {
      setActivated(true);
    }
  }, [isActive, activated]);

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    if (helpTimerRef.current) {
      clearTimeout(helpTimerRef.current);
      helpTimerRef.current = null;
    }
  }, []);

  const handleReload = useCallback(() => {
    if (iframeRef.current) {
      setIframeLoaded(false);
      setShowHelp(false);
      iframeRef.current.src = CIPP_URL;
      helpTimerRef.current = setTimeout(() => setShowHelp(true), 15_000);
    }
  }, []);

  const handleIframeRef = useCallback(
    (el: HTMLIFrameElement | null) => {
      iframeRef.current = el;
      if (el && !iframeLoaded) {
        helpTimerRef.current = setTimeout(() => setShowHelp(true), 15_000);
      }
    },
    [iframeLoaded]
  );

  // Don't render anything until first activated
  if (!activated) return null;

  return (
    <div
      className={cn(
        // Fixed overlay — below header (z-30), below sidebar (z-50)
        "fixed z-20 bg-background",
        "bottom-0 right-0",
        // Start below header (~61px)
        "top-[61px]",
        // Match sidebar margins at each breakpoint
        "left-0 lg:left-18 xl:left-sidebar",
        // Hide when not on fullui tab (keeps iframe alive in DOM)
        isActive ? "" : "pointer-events-none invisible"
      )}
    >
      <div className="h-full flex flex-col p-4 sm:p-5 lg:p-6 xl:p-8">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 pb-3">
          <button
            onClick={() => router.push("/cipp")}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-card border border-border text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to CIPP tabs
          </button>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleReload}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-card border border-border text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <RefreshCw className="h-3 w-3" />
              Reload
            </button>
            <a
              href={CIPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-card border border-border text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              Open in new tab
            </a>
          </div>
        </div>

        {/* Loading state */}
        {!iframeLoaded && (
          <div className="flex-1 flex flex-col items-center justify-center bg-card rounded-lg border border-border">
            <Loader2 className="h-8 w-8 mb-3 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading CIPP...</p>
            {showHelp && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  Not loading? You may need to sign in first.
                </p>
                <div className="flex items-center gap-2">
                  <a
                    href={CIPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card text-xs text-foreground transition-colors hover:bg-accent"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open CIPP to sign in
                  </a>
                  <button
                    onClick={handleReload}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-medium transition-colors hover:bg-red-700"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Iframe — wider than container to clip scrollbar */}
        <div
          className={cn(
            "overflow-hidden rounded-lg border border-border",
            iframeLoaded ? "flex-1" : "h-0"
          )}
        >
          <iframe
            ref={handleIframeRef}
            src={CIPP_URL}
            onLoad={handleIframeLoad}
            className="h-full border-0"
            style={{ width: "calc(100% + 20px)" }}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
            title="CIPP — CyberDrain Improved Partner Portal"
          />
        </div>
      </div>
    </div>
  );
}

export function PersistentCIPPIframe() {
  return (
    <Suspense>
      <PersistentCIPPIframeInner />
    </Suspense>
  );
}
