/**
 * n8n External Hooks for OIDC Authentication (Entra ID)
 *
 * Adapted from cweagans/n8n-oidc (MIT License).
 * Implements OIDC authorization code flow using only Node.js built-ins.
 *
 * Features:
 *   - OIDC discovery endpoint support
 *   - Authorization code flow with CSRF protection (signed state cookies)
 *   - JIT user provisioning from OIDC claims
 *   - Optional email allow-list (N8N_OIDC_ALLOWED_EMAILS)
 *   - Frontend customization: "Sign in with Microsoft" button
 *   - Emergency fallback: ?showLogin=true shows email/password form
 *
 * Required Environment Variables:
 *   OIDC_ISSUER_URL      - e.g. https://login.microsoftonline.com/{tenant}/v2.0
 *   OIDC_CLIENT_ID       - App registration client ID
 *   OIDC_CLIENT_SECRET   - App registration client secret
 *   OIDC_REDIRECT_URI    - e.g. https://n8n.example.com/auth/oidc/callback
 *
 * Optional:
 *   OIDC_SCOPES              - Space-separated (default: "openid email profile")
 *   N8N_OIDC_ALLOWED_EMAILS  - Comma-separated allow-list. If set, only these
 *                               emails can log in via OIDC. If empty, all
 *                               authenticated Entra users are allowed.
 */

const https = require("https");
const http = require("http");
const crypto = require("crypto");
const { URL, URLSearchParams } = require("url");

// ─── Configuration ──────────────────────────────────────────────────
const config = {
  issuerUrl: process.env.OIDC_ISSUER_URL,
  clientId: process.env.OIDC_CLIENT_ID,
  clientSecret: process.env.OIDC_CLIENT_SECRET,
  redirectUri: process.env.OIDC_REDIRECT_URI,
  scopes: process.env.OIDC_SCOPES || "openid email profile",
};

// Parse allowed emails from env (comma-separated, lowercased, trimmed)
const ALLOWED_EMAILS = (() => {
  const raw = process.env.N8N_OIDC_ALLOWED_EMAILS || "";
  if (!raw.trim()) return null; // null = allow all
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
})();

function validateConfig() {
  const missing = [];
  if (!config.issuerUrl) missing.push("OIDC_ISSUER_URL");
  if (!config.clientId) missing.push("OIDC_CLIENT_ID");
  if (!config.clientSecret) missing.push("OIDC_CLIENT_SECRET");
  if (!config.redirectUri) missing.push("OIDC_REDIRECT_URI");
  return missing;
}

// ─── OIDC Discovery Cache ───────────────────────────────────────────
let discoveryCache = null;
let discoveryCacheTime = 0;
const DISCOVERY_CACHE_TTL = 3600000; // 1 hour

// ─── HTTP Helpers ───────────────────────────────────────────────────

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === "https:" ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || "GET",
      headers: options.headers || {},
    };

    const req = protocol.request(reqOptions, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });

    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function fetchDiscoveryDocument() {
  const now = Date.now();
  if (discoveryCache && now - discoveryCacheTime < DISCOVERY_CACHE_TTL) {
    return discoveryCache;
  }

  const discoveryUrl = config.issuerUrl.replace(/\/$/, "") + "/.well-known/openid-configuration";
  const response = await makeRequest(discoveryUrl);

  if (response.statusCode !== 200) {
    throw new Error(`Failed to fetch OIDC discovery document: ${response.statusCode}`);
  }

  discoveryCache = JSON.parse(response.body);
  discoveryCacheTime = now;
  return discoveryCache;
}

// ─── Crypto Helpers ─────────────────────────────────────────────────

function generateRandomString(length = 32) {
  return crypto.randomBytes(length).toString("hex");
}

function base64UrlEncode(input) {
  const base64 = Buffer.isBuffer(input) ? input.toString("base64") : Buffer.from(input).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecode(input) {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return Buffer.from(base64, "base64");
}

function decodeJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  return JSON.parse(base64UrlDecode(parts[1]).toString("utf8"));
}

// ─── Token Exchange ─────────────────────────────────────────────────

async function exchangeCodeForTokens(code, discovery) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await makeRequest(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (response.statusCode !== 200) {
    console.error("[OIDC] Token exchange failed:", response.body);
    throw new Error(`Token exchange failed: ${response.statusCode}`);
  }

  return JSON.parse(response.body);
}

async function fetchUserInfo(accessToken, discovery) {
  const response = await makeRequest(discovery.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.statusCode !== 200) {
    console.error("[OIDC] UserInfo fetch failed:", response.body);
    throw new Error(`UserInfo fetch failed: ${response.statusCode}`);
  }

  return JSON.parse(response.body);
}

// ─── Signed Cookie (CSRF State) ─────────────────────────────────────

function createSignedCookie(payload, secret, expiresInSeconds = 900) {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const data = JSON.stringify({ ...payload, exp });
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(data);
  const signature = hmac.digest("hex");
  return base64UrlEncode(data) + "." + signature;
}

function verifySignedCookie(cookie, secret) {
  try {
    const [dataB64, signature] = cookie.split(".");
    const data = base64UrlDecode(dataB64).toString("utf8");

    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(data);
    const expectedSignature = hmac.digest("hex");

    if (signature !== expectedSignature) return null;

    const payload = JSON.parse(data);
    if (payload.exp && payload.exp < Date.now() / 1000) return null;

    return payload;
  } catch {
    return null;
  }
}

function getCookieSecret() {
  const baseKey = process.env.N8N_ENCRYPTION_KEY || process.env.OIDC_CLIENT_SECRET || "n8n-oidc-hook-secret";
  return crypto.createHash("sha256").update(baseKey + "-oidc-state").digest("hex");
}

// ─── n8n Auth Token ─────────────────────────────────────────────────

function createAuthToken(user, jwtService) {
  const payload = {
    id: user.id,
    hash: createUserHash(user),
    usedMfa: false,
  };
  return jwtService.sign(payload, { expiresIn: "7d" });
}

function createUserHash(user) {
  const payload = [user.email, user.password || ""];
  if (user.mfaEnabled && user.mfaSecret) {
    payload.push(user.mfaSecret.substring(0, 3));
  }
  return crypto.createHash("sha256").update(payload.join(":")).digest("base64").substring(0, 10);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── n8n Module Paths (Docker image layout) ─────────────────────────
const N8N_DI_PATH = "/usr/local/lib/node_modules/n8n/node_modules/@n8n/di";
const N8N_JWT_SERVICE_PATH = "/usr/local/lib/node_modules/n8n/dist/services/jwt.service.js";

// ═══════════════════════════════════════════════════════════════════════
// Hook Exports
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
  n8n: {
    ready: [
      async function (server) {
        const missing = validateConfig();
        if (missing.length > 0) {
          console.warn(`[OIDC] Missing configuration: ${missing.join(", ")}. OIDC disabled.`);
          return;
        }

        console.log("[OIDC] Initializing OIDC authentication...");
        if (ALLOWED_EMAILS) {
          console.log(`[OIDC] Email allow-list active: ${ALLOWED_EMAILS.size} address(es)`);
        } else {
          console.log("[OIDC] No email allow-list — all authenticated Entra users can access n8n");
        }

        // Get n8n's JwtService from the DI container
        const { Container } = require(N8N_DI_PATH);
        const { JwtService } = require(N8N_JWT_SERVICE_PATH);
        const jwtService = Container.get(JwtService);

        const { app } = server;
        const cookieSecret = getCookieSecret();

        const cookieOptions = {
          httpOnly: true,
          secure: process.env.N8N_PROTOCOL === "https",
          sameSite: "lax",
          maxAge: 15 * 60 * 1000, // 15 min
        };

        const authCookieOptions = {
          httpOnly: true,
          secure: process.env.N8N_PROTOCOL === "https",
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        };

        // ── GET /auth/oidc/login ──────────────────────────────────────
        app.get("/auth/oidc/login", async (req, res) => {
          try {
            // Block SSO if owner setup not complete (blank owner = setup wizard pending)
            const { User } = this.dbCollections;
            const owner = await User.findOne({
              where: { role: { slug: "global:owner" } },
              relations: ["role"],
            });
            if (!owner || !owner.email) {
              console.warn("[OIDC] SSO attempted but owner setup not complete. Redirecting.");
              return res.redirect("/signin?showLogin=true&error=" + encodeURIComponent("n8n setup not complete. Create the owner account first."));
            }

            const discovery = await fetchDiscoveryDocument();

            const state = generateRandomString();
            const nonce = generateRandomString();

            res.cookie("n8n-oidc-state", createSignedCookie({ state }, cookieSecret), cookieOptions);
            res.cookie("n8n-oidc-nonce", createSignedCookie({ nonce }, cookieSecret), cookieOptions);

            const authUrl = new URL(discovery.authorization_endpoint);
            authUrl.searchParams.set("client_id", config.clientId);
            authUrl.searchParams.set("redirect_uri", config.redirectUri);
            authUrl.searchParams.set("response_type", "code");
            authUrl.searchParams.set("scope", config.scopes);
            authUrl.searchParams.set("state", state);
            authUrl.searchParams.set("nonce", nonce);

            res.redirect(authUrl.toString());
          } catch (error) {
            console.error("[OIDC] Login error:", error);
            res.status(500).send("OIDC configuration error. Please check the logs.");
          }
        });

        // ── GET /auth/oidc/callback ───────────────────────────────────
        app.get("/auth/oidc/callback", async (req, res) => {
          try {
            const { code, state, error, error_description } = req.query;

            if (error) {
              console.error("[OIDC] Provider error:", error, error_description);
              return res.redirect("/signin?error=" + encodeURIComponent(error_description || error));
            }

            if (!code || !state) {
              return res.redirect("/signin?error=" + encodeURIComponent("Missing authorization code or state"));
            }

            // Verify CSRF state
            const stateCookie = req.cookies["n8n-oidc-state"];
            const nonceCookie = req.cookies["n8n-oidc-nonce"];

            if (!stateCookie || !nonceCookie) {
              return res.redirect("/signin?error=" + encodeURIComponent("Session expired — please try again"));
            }

            const statePayload = verifySignedCookie(stateCookie, cookieSecret);
            const noncePayload = verifySignedCookie(nonceCookie, cookieSecret);

            if (!statePayload || statePayload.state !== state) {
              return res.redirect("/signin?error=" + encodeURIComponent("Invalid state — possible CSRF attack"));
            }

            res.clearCookie("n8n-oidc-state");
            res.clearCookie("n8n-oidc-nonce");

            // Exchange authorization code for tokens
            const discovery = await fetchDiscoveryDocument();
            const tokens = await exchangeCodeForTokens(code, discovery);

            // Verify nonce in ID token
            if (tokens.id_token) {
              const idTokenClaims = decodeJwt(tokens.id_token);
              if (noncePayload && idTokenClaims.nonce !== noncePayload.nonce) {
                return res.redirect("/signin?error=" + encodeURIComponent("Invalid nonce — possible replay attack"));
              }
            }

            // Get user info from OIDC provider
            let userInfo;
            try {
              userInfo = await fetchUserInfo(tokens.access_token, discovery);
            } catch (e) {
              if (tokens.id_token) {
                userInfo = decodeJwt(tokens.id_token);
              } else {
                throw e;
              }
            }

            if (!userInfo.email || !isValidEmail(userInfo.email)) {
              return res.redirect("/signin?error=" + encodeURIComponent("No valid email in OIDC response"));
            }

            // ── Email allow-list check ──────────────────────────────
            if (ALLOWED_EMAILS && !ALLOWED_EMAILS.has(userInfo.email.toLowerCase())) {
              console.warn(`[OIDC] Access denied for ${userInfo.email} — not in allow-list`);
              return res.redirect("/signin?error=" + encodeURIComponent("Access denied. Contact your administrator."));
            }

            // ── Shared owner login ──────────────────────────────────
            // All OIDC users log into the single owner account so
            // everyone shares the same workflows, credentials, and
            // execution history. Individual access is gated by the
            // RCC permission system (tools.n8n).
            //
            // The owner account MUST be created manually first via
            // n8n's setup wizard. OIDC will NOT auto-create it.
            const { User } = this.dbCollections;

            // Find the owner account via role relation
            let user = await User.findOne({
              where: { role: { slug: "global:owner" } },
              relations: ["role"],
            });

            if (!user) {
              console.warn(`[OIDC] ${userInfo.email} tried to SSO but no owner account exists. Complete n8n setup first.`);
              return res.redirect("/signin?error=" + encodeURIComponent("n8n owner account not set up yet. An admin must complete the initial setup at " + (config.redirectUri || "").replace("/auth/oidc/callback", "?showLogin=true")));
            }

            console.log(`[OIDC] ${userInfo.email} logged in as shared owner (${user.email})`);

            // Set n8n auth cookie and redirect home
            const authToken = createAuthToken(user, jwtService);
            res.cookie("n8n-auth", authToken, authCookieOptions);
            res.redirect("/");
          } catch (error) {
            console.error("[OIDC] Callback error:", error);
            res.redirect("/signin?error=" + encodeURIComponent("Authentication failed: " + error.message));
          }
        });

        // ── GET /auth/oidc/status ────────────────────────────────────
        // Lightweight check: is SSO ready? (owner account must exist first)
        app.get("/auth/oidc/status", async (req, res) => {
          try {
            const { User } = this.dbCollections;
            // n8n auto-creates a blank owner on first start — check for
            // a real owner (one that has an email = setup wizard completed)
            const owner = await User.findOne({
              where: { role: { slug: "global:owner" } },
              relations: ["role"],
            });
            res.json({ ssoReady: !!(owner && owner.email) });
          } catch {
            res.json({ ssoReady: false });
          }
        });

        // ── GET /assets/oidc-frontend-hook.js ─────────────────────────
        app.get("/assets/oidc-frontend-hook.js", (req, res) => {
          res.type("text/javascript; charset=utf-8");
          res.set("Cache-Control", "no-cache, no-store, must-revalidate");
          res.send(getFrontendScript());
        });

        console.log("[OIDC] Routes registered:");
        console.log("  GET /auth/oidc/login");
        console.log("  GET /auth/oidc/callback");
        console.log("  GET /assets/oidc-frontend-hook.js");
      },
    ],
  },

  frontend: {
    settings: [
      async function (frontendSettings) {
        const missing = validateConfig();
        if (missing.length > 0) return;

        // Don't override n8n's auth method — it breaks the setup wizard
        // on fresh installs. Our frontend script handles SSO injection.
        console.log("[OIDC] Hooks loaded (frontend script handles SSO UI)");
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════
// Frontend Script (injected into browser)
// ═══════════════════════════════════════════════════════════════════════

function getFrontendScript() {
  return `
(function() {
  'use strict';

  function shouldShowNormalLogin() {
    return new URLSearchParams(window.location.search).get('showLogin') === 'true';
  }

  function isSigninPage() {
    return window.location.pathname === '/signin' || window.location.pathname === '/login';
  }

  function displayError(form) {
    var error = new URLSearchParams(window.location.search).get('error');
    if (!error || !form || form.querySelector('#oidc-error')) return;

    var errorDiv = document.createElement('div');
    errorDiv.id = 'oidc-error';
    errorDiv.style.cssText = 'background: #2a1f1f; border: 1px solid #5c2020; color: #f87171; padding: 12px; border-radius: 8px; margin: 16px 0; font-size: 13px;';
    errorDiv.textContent = decodeURIComponent(error);

    var heading = form.querySelector('div[class*="_heading_"]');
    if (heading) heading.after(errorDiv);
    else form.prepend(errorDiv);
  }

  var _ssoReady = null; // null = unknown, true/false after check

  function checkSsoReady(callback) {
    if (_ssoReady !== null) return callback(_ssoReady);
    fetch('/auth/oidc/status').then(function(r) { return r.json(); }).then(function(d) {
      _ssoReady = !!d.ssoReady;
      callback(_ssoReady);
    }).catch(function() {
      _ssoReady = false;
      callback(false);
    });
  }

  function injectSsoButton() {
    if (shouldShowNormalLogin()) return;
    if (!isSigninPage()) return;

    // Don't touch the page until we know SSO is ready (owner exists)
    checkSsoReady(function(ready) {
      if (!ready) return; // Let n8n's normal setup/login form show
      doInjectSsoButton();
    });
  }

  function doInjectSsoButton() {
    var form = document.querySelector('[data-test-id="auth-form"]');
    if (!form || form.querySelector('#oidc-sso-button')) return;

    // Hide the default form elements
    form.querySelectorAll('div[class*="_inputsContainer_"], div[class*="_buttonsContainer_"], div[class*="_actionContainer_"]')
      .forEach(function(el) { el.style.display = 'none'; });

    var ssoContainer = document.createElement('div');
    ssoContainer.id = 'oidc-sso-container';
    ssoContainer.style.cssText = 'text-align: center; padding: 8px 0;';

    // Microsoft-branded SSO button (shown only when auto-redirect fails)
    var button = document.createElement('button');
    button.id = 'oidc-sso-button';
    button.type = 'button';
    button.innerHTML = '<svg style="width:18px;height:18px;margin-right:10px;vertical-align:middle" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg><span style="vertical-align:middle">Sign in with Microsoft</span>';
    button.onclick = function() { window.location.href = '/auth/oidc/login'; };
    button.style.cssText = 'width: 100%; padding: 12px 24px; font-size: 14px; font-weight: 600; color: #fff; background: #1a1a2e; border: 1px solid #333; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s;';
    button.onmouseenter = function() { this.style.background = '#252540'; };
    button.onmouseleave = function() { this.style.background = '#1a1a2e'; };

    var adminLink = document.createElement('p');
    adminLink.style.cssText = 'margin-top: 16px; font-size: 12px; color: #666;';
    adminLink.innerHTML = 'Admin? <a href="?showLogin=true" style="color: #ea4b30;">Sign in with email</a>';

    ssoContainer.appendChild(button);
    ssoContainer.appendChild(adminLink);

    var heading = form.querySelector('div[class*="_heading_"]');
    if (heading) heading.after(ssoContainer);
    else form.prepend(ssoContainer);

    displayError(form);
  }

  function observeAndInject() {
    if (shouldShowNormalLogin() || !isSigninPage()) return;

    injectSsoButton();

    var observer = new MutationObserver(function() {
      if (isSigninPage() && !shouldShowNormalLogin()) {
        var form = document.querySelector('[data-test-id="auth-form"]');
        if (form && !form.querySelector('#oidc-sso-button')) {
          injectSsoButton();
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(function() { observer.disconnect(); }, 10000);
  }

  function handleNavigation() {
    var origPush = history.pushState;
    var origReplace = history.replaceState;

    history.pushState = function() {
      origPush.apply(this, arguments);
      setTimeout(observeAndInject, 100);
    };

    history.replaceState = function() {
      origReplace.apply(this, arguments);
      setTimeout(observeAndInject, 100);
    };

    window.addEventListener('popstate', function() {
      setTimeout(observeAndInject, 100);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      observeAndInject();
      handleNavigation();
    });
  } else {
    observeAndInject();
    handleNavigation();
  }

  setTimeout(observeAndInject, 500);
  setTimeout(observeAndInject, 1000);

  console.log('[OIDC] Frontend hook loaded');
})();
`;
}
