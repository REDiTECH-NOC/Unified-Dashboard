"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, AlertCircle, Copy, Check } from "lucide-react";

export default function SetupTotpPage() {
  const { data: session, update } = useSession();
  const router = useRouter();

  const [secret, setSecret] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Redirect non-local users or those who don't need setup
  useEffect(() => {
    if (session && !(session.user as any).mustSetupTotp) {
      router.replace("/dashboard");
    }
  }, [session, router]);

  // Generate TOTP secret on mount
  useEffect(() => {
    fetch("/api/auth/totp")
      .then((res) => res.json())
      .then(async (data) => {
        if (data.secret) {
          setSecret(data.secret);
          setOtpauthUri(data.otpauthUri);
          setQrDataUrl(data.qrDataUrl);
        }
      })
      .catch(() => setError("Failed to generate setup code."));
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();
      if (data.success) {
        // Refresh the session JWT to clear mustSetupTotp flag
        await update({ mustSetupTotp: false });
        router.replace("/dashboard");
      } else {
        setError(data.error || "Invalid code. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-red-500/10">
            <ShieldCheck className="h-7 w-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground">
            Set Up Two-Factor Authentication
          </h1>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Scan the QR code with your authenticator app (Microsoft
            Authenticator, Google Authenticator, or similar), then enter the
            6-digit code to verify.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card-light dark:shadow-card space-y-6">
          {/* QR Code */}
          {qrDataUrl ? (
            <div className="flex justify-center">
              <div className="rounded-lg bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="TOTP QR Code"
                  width={200}
                  height={200}
                />
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-8">
              <p className="text-sm text-muted-foreground">
                Generating QR code...
              </p>
            </div>
          )}

          {/* Manual secret */}
          {secret && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Can't scan? Enter this key manually:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono text-foreground break-all">
                  {secret}
                </code>
                <button
                  onClick={copySecret}
                  className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Verification form */}
          <form onSubmit={handleVerify} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Verification code
              </p>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                autoComplete="one-time-code"
                className="text-center text-lg tracking-[0.5em] font-mono"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || code.length !== 6}
            >
              {loading ? "Verifying..." : "Verify & Enable MFA"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
