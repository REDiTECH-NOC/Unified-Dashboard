"use client";

import { useState, useCallback, useRef } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const CIPP_URL = "https://cipp.reditech.com";

/**
 * CIPP Embed — direct iframe load.
 *
 * Since dashboard.reditech.com and cipp.reditech.com are same-site,
 * the browser sends CIPP's EasyAuth cookies automatically in the iframe.
 * No popup auth needed — just load the iframe directly.
 *
 * If the user hasn't signed into CIPP before (no cookies), the iframe
 * will show a blank page. A fallback link lets them open CIPP in a new
 * tab to authenticate, then reload.
 */
export function CIPPEmbed() {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const helpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    // Clear the help timer — iframe loaded successfully
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
      // Show help link after 15 seconds if iframe hasn't loaded
      helpTimerRef.current = setTimeout(() => setShowHelp(true), 15_000);
    }
  }, []);

  // Show help link after 15 seconds if iframe hasn't loaded on mount
  const handleIframeRef = useCallback((el: HTMLIFrameElement | null) => {
    iframeRef.current = el;
    if (el && !iframeLoaded) {
      helpTimerRef.current = setTimeout(() => setShowHelp(true), 15_000);
    }
  }, [iframeLoaded]);

  return (
    <div className="relative w-full">
      {/* Loading overlay */}
      {!iframeLoaded && (
        <div className="h-[calc(100vh-14rem)] flex flex-col items-center justify-center bg-card rounded-lg border border-border">
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

      {/* Toolbar */}
      {iframeLoaded && (
        <div className="flex items-center justify-end gap-1.5 pb-2">
          <button
            onClick={handleReload}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-card/90 border border-border text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground backdrop-blur-sm"
          >
            <RefreshCw className="h-3 w-3" />
            Reload
          </button>
          <a
            href={CIPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-card/90 border border-border text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground backdrop-blur-sm"
          >
            <ExternalLink className="h-3 w-3" />
            Open in new tab
          </a>
        </div>
      )}

      {/* Iframe — slightly wider than container to clip scrollbar */}
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-border",
          iframeLoaded ? "h-[calc(100vh-14rem)]" : "h-0"
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
  );
}
