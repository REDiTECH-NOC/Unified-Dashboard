"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ExternalLink, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const CIPP_URL = "https://cipp.reditech.com";
const AUTH_STORAGE_KEY = "cipp-auth-done";

/**
 * CIPP Embed — Popup-auth iframe.
 *
 * Flow:
 * 1. Open a small popup to cipp.reditech.com to trigger Azure SWA EasyAuth SSO
 * 2. User completes sign-in, then clicks "I've signed in" (or closes popup)
 * 3. Load cipp.reditech.com in the iframe — cookies exist, no auth redirect needed
 *
 * Auth state is persisted in sessionStorage so navigating away and back
 * doesn't require re-authentication within the same browser session.
 */
export function CIPPEmbed() {
  const [authState, setAuthState] = useState<
    "idle" | "authenticating" | "authenticated" | "error"
  >(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (stored === "true") return "authenticated";
    }
    return "idle";
  });
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const markAuthenticated = useCallback(() => {
    setAuthState("authenticated");
    try {
      sessionStorage.setItem(AUTH_STORAGE_KEY, "true");
    } catch {
      // sessionStorage may be unavailable
    }
  }, []);

  const clearAuthStorage = useCallback(() => {
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Close the popup — navigate to about:blank first (always allowed cross-origin),
  // then close. This works reliably in Edge/Chrome for cross-origin popups.
  const closePopup = useCallback(() => {
    const popup = popupRef.current;
    if (!popup || popup.closed) return;
    try {
      popup.location.href = "about:blank";
    } catch {
      // ignore cross-origin navigation errors
    }
    setTimeout(() => {
      try { popup.close(); } catch { /* ignore */ }
    }, 50);
  }, []);

  const startAuth = useCallback(() => {
    setAuthState("authenticating");
    setErrorMsg("");

    const w = 500;
    const h = 600;
    const left = window.screenX + (window.innerWidth - w) / 2;
    const top = window.screenY + (window.innerHeight - h) / 2;

    const popup = window.open(
      CIPP_URL,
      "cipp-auth",
      `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,location=yes,status=no`
    );

    if (!popup) {
      setAuthState("error");
      setErrorMsg(
        "Popup blocked by browser. Please allow popups for this site and try again."
      );
      return;
    }

    popupRef.current = popup;

    // Poll for manual popup close
    pollRef.current = setInterval(() => {
      if (!popup || popup.closed) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        popupRef.current = null;
        markAuthenticated();
      }
    }, 500);

    // Safety timeout — 3 minutes
    setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        closePopup();
        popupRef.current = null;
        setAuthState("error");
        setErrorMsg("Authentication timed out. Please try again.");
      }
    }, 180_000);
  }, [markAuthenticated, closePopup]);

  const handleSignedIn = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    closePopup();
    popupRef.current = null;
    markAuthenticated();
  }, [closePopup, markAuthenticated]);

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
  }, []);

  const handleRetry = useCallback(() => {
    setAuthState("idle");
    setIframeLoaded(false);
    setErrorMsg("");
    clearAuthStorage();
  }, [clearAuthStorage]);

  const handleReload = useCallback(() => {
    if (iframeRef.current) {
      setIframeLoaded(false);
      iframeRef.current.src = CIPP_URL;
    }
  }, []);

  // ─── Idle ──────────────────────────────────────────────────────────
  if (authState === "idle") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <ExternalLink className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-sm font-medium mb-2">
          Load the full CIPP interface
        </p>
        <p className="text-xs mb-6 max-w-md text-center">
          A popup will open briefly to authenticate with CIPP via Microsoft SSO.
          Once authenticated, the full CIPP UI will load here.
        </p>
        <button
          onClick={startAuth}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-medium transition-colors hover:bg-red-700"
        >
          <ExternalLink className="h-4 w-4" />
          Authenticate & Load CIPP
        </button>
      </div>
    );
  }

  // ─── Authenticating ────────────────────────────────────────────────
  if (authState === "authenticating") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-10 w-10 mb-4 animate-spin opacity-40" />
        <p className="text-sm font-medium">Authenticating with CIPP...</p>
        <p className="text-xs mt-1 opacity-60">
          Complete the sign-in in the popup window, then click below.
        </p>
        <button
          onClick={handleSignedIn}
          className="mt-6 flex items-center gap-2 h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-medium transition-colors hover:bg-red-700"
        >
          I&apos;ve signed in — load CIPP
        </button>
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────────────────────
  if (authState === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <AlertCircle className="h-10 w-10 mb-4 text-red-400 opacity-60" />
        <p className="text-sm font-medium text-red-400">
          Authentication failed
        </p>
        <p className="text-xs mt-1 mb-4 max-w-md text-center">{errorMsg}</p>
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-card text-sm text-foreground transition-colors hover:bg-accent"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ─── Authenticated: Show iframe ────────────────────────────────────
  // Iframe is made slightly wider than its overflow:hidden container to
  // clip the browser scrollbar. Content scrolls via mouse wheel / trackpad.
  return (
    <div className="relative w-full">
      {!iframeLoaded && (
        <div className="h-[calc(100vh-14rem)] flex flex-col items-center justify-center bg-card rounded-lg border border-border">
          <Loader2 className="h-8 w-8 mb-3 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading CIPP...</p>
        </div>
      )}

      {iframeLoaded && (
        <div className="flex items-center justify-end gap-1.5 pb-2">
          <button
            onClick={handleReload}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-card/90 border border-border text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground backdrop-blur-sm"
          >
            <RefreshCw className="h-3 w-3" />
            Reload
          </button>
          <button
            onClick={handleRetry}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-card/90 border border-border text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground backdrop-blur-sm"
          >
            Re-authenticate
          </button>
        </div>
      )}

      <div
        className={cn(
          "overflow-hidden rounded-lg border border-border",
          iframeLoaded ? "h-[calc(100vh-14rem)]" : "h-0"
        )}
      >
        <iframe
          ref={iframeRef}
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
