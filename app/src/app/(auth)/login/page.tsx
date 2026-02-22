"use client";

import { Suspense, useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Lock, AlertCircle } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background"><p className="text-sm text-muted-foreground">Loading...</p></div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const errorParam = searchParams.get("error");

  const [ssoAvailable, setSsoAvailable] = useState<boolean | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if Microsoft SSO is available
  useEffect(() => {
    fetch("/api/auth/providers")
      .then((res) => res.json())
      .then((providers) => {
        setSsoAvailable(!!providers?.["microsoft-entra-id"]);
        // If SSO is not available, auto-expand admin login
        if (!providers?.["microsoft-entra-id"]) {
          setShowAdmin(true);
        }
      })
      .catch(() => setSsoAvailable(false));
  }, []);

  const handleMicrosoftSignIn = () => {
    fetch("/api/auth/csrf")
      .then((res) => res.json())
      .then((data) => {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/api/auth/signin/microsoft-entra-id";

        const csrfInput = document.createElement("input");
        csrfInput.type = "hidden";
        csrfInput.name = "csrfToken";
        csrfInput.value = data.csrfToken;
        form.appendChild(csrfInput);

        const callbackInput = document.createElement("input");
        callbackInput.type = "hidden";
        callbackInput.name = "callbackUrl";
        callbackInput.value = callbackUrl;
        form.appendChild(callbackInput);

        document.body.appendChild(form);
        form.submit();
      });
  };

  const handleLocalSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Step 1: Validate credentials and check if TOTP is needed
      if (!needsTotp) {
        const check = await fetch("/api/auth/pre-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const checkData = await check.json();

        if (!checkData.ok) {
          setError("Invalid email or password.");
          setLoading(false);
          return;
        }

        if (checkData.needsTotp) {
          setNeedsTotp(true);
          setLoading(false);
          return;
        }
      }

      // Step 2: Sign in with all credentials
      const result = await signIn("local", {
        email,
        password,
        totpCode: totpCode || "",
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        if (needsTotp) {
          setError("Invalid verification code. Please try again.");
          setTotpCode("");
        } else {
          setError("Invalid email or password.");
        }
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="REDiTECH"
            className="h-16 w-auto object-contain"
          />
          <p className="text-sm text-muted-foreground">Command Center</p>
        </div>

        {/* Main card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card-light dark:shadow-card space-y-6">
          {/* Error from OAuth redirect */}
          {errorParam && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>
                {errorParam === "AccessDenied"
                  ? "Access denied. Contact your administrator."
                  : "Sign in failed. Please try again."}
              </span>
            </div>
          )}

          {/* Microsoft SSO — only show if configured */}
          {ssoAvailable && (
            <Button
              className="w-full h-11 gap-3 text-sm font-medium"
              onClick={handleMicrosoftSignIn}
            >
              <svg className="h-5 w-5" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
              Sign in with Microsoft
            </Button>
          )}

          {/* Divider / Admin login toggle */}
          {ssoAvailable ? (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAdmin(!showAdmin)}
                  className="flex items-center gap-1.5 bg-card px-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Lock className="h-3 w-3" />
                  Administrator Login
                  {showAdmin ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
          ) : ssoAvailable === false ? (
            // SSO not configured — show local login as primary
            <p className="text-xs text-center text-muted-foreground">
              Sign in with your account credentials
            </p>
          ) : null}

          {/* Admin login form */}
          {showAdmin && (
            <form onSubmit={handleLocalSignIn} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={needsTotp}
                  autoComplete="email"
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={needsTotp}
                  autoComplete="current-password"
                />
                {needsTotp && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Enter the 6-digit code from your authenticator app.
                    </p>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="000000"
                      value={totpCode}
                      onChange={(e) =>
                        setTotpCode(e.target.value.replace(/\D/g, ""))
                      }
                      required
                      autoFocus
                      autoComplete="one-time-code"
                      className="text-center text-lg tracking-[0.5em] font-mono"
                    />
                  </div>
                )}
              </div>

              <Button
                type="submit"
                variant={ssoAvailable ? "outline" : "default"}
                className="w-full"
                disabled={loading}
              >
                {loading
                  ? "Signing in..."
                  : needsTotp
                  ? "Verify & Sign In"
                  : "Sign In"}
              </Button>

              {needsTotp && (
                <button
                  type="button"
                  onClick={() => {
                    setNeedsTotp(false);
                    setTotpCode("");
                    setError("");
                  }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back to login
                </button>
              )}
            </form>
          )}
        </div>

        <p className="text-center text-[10px] text-muted-foreground">
          REDiTECH Command Center v0.1.0
        </p>
      </div>
    </div>
  );
}
