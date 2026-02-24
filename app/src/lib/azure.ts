/**
 * Shared Azure helpers for managed identity, Management API, and Key Vault.
 * Used by system.ts (container updates) and infrastructure.ts (databases, firewall, monitoring).
 */

// ─── Token Cache ────────────────────────────────────────────────────

interface CachedToken {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

// ─── Environment Detection ──────────────────────────────────────────

/** Check if running on Azure Container Apps with managed identity */
export function isAzureEnvironment(): boolean {
  return !!(
    process.env.IDENTITY_ENDPOINT &&
    process.env.IDENTITY_HEADER &&
    process.env.AZURE_SUBSCRIPTION_ID &&
    process.env.AZURE_RESOURCE_GROUP
  );
}

// ─── Managed Identity Token ─────────────────────────────────────────

/**
 * Get an Azure managed identity access token.
 * @param resource - The Azure resource URI to request a token for.
 *   - Management API: "https://management.azure.com/" (default)
 *   - Key Vault: "https://vault.azure.net"
 */
export async function getAzureToken(
  resource: string = "https://management.azure.com/"
): Promise<string> {
  // Check cache (tokens last ~1hr, we cache for 50min)
  const cached = tokenCache.get(resource);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const endpoint = process.env.IDENTITY_ENDPOINT;
  const header = process.env.IDENTITY_HEADER;
  if (!endpoint || !header) {
    throw new Error("Managed identity not configured on this container.");
  }

  const res = await fetch(
    `${endpoint}?api-version=2019-08-01&resource=${encodeURIComponent(resource)}`,
    { headers: { "X-IDENTITY-HEADER": header } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get managed identity token (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { access_token: string };

  // Cache for 50 minutes
  tokenCache.set(resource, {
    token: data.access_token,
    expiresAt: Date.now() + 50 * 60_000,
  });

  return data.access_token;
}

// ─── URL Builders ───────────────────────────────────────────────────

/** Build the base Azure Management API URL for the resource group */
export function getResourceGroupBaseUrl(): string {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
  if (!subscriptionId || !resourceGroup) {
    throw new Error("AZURE_SUBSCRIPTION_ID and AZURE_RESOURCE_GROUP must be set.");
  }
  return `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}`;
}

/** Build the Azure Management API URL for a subscription-level resource */
export function getSubscriptionBaseUrl(): string {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  if (!subscriptionId) {
    throw new Error("AZURE_SUBSCRIPTION_ID must be set.");
  }
  return `https://management.azure.com/subscriptions/${subscriptionId}`;
}

/** Build the Azure Management API URL for a PostgreSQL Flexible Server */
export function getPostgresServerUrl(serverName: string): string {
  return `${getResourceGroupBaseUrl()}/providers/Microsoft.DBforPostgreSQL/flexibleServers/${serverName}`;
}

// ─── Key Vault ──────────────────────────────────────────────────────

/** Store a secret in Azure Key Vault */
export async function storeKeyVaultSecret(
  vaultName: string,
  secretName: string,
  value: string
): Promise<void> {
  const token = await getAzureToken("https://vault.azure.net");
  const res = await fetch(
    `https://${vaultName}.vault.azure.net/secrets/${secretName}?api-version=7.4`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Key Vault PUT failed (${res.status}): ${body}`);
  }
}

/** Retrieve a secret from Azure Key Vault */
export async function getKeyVaultSecret(
  vaultName: string,
  secretName: string
): Promise<string | null> {
  const token = await getAzureToken("https://vault.azure.net");
  const res = await fetch(
    `https://${vaultName}.vault.azure.net/secrets/${secretName}?api-version=7.4`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Key Vault GET failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { value: string };
  return data.value;
}

// ─── Generic Azure Management API Helpers ───────────────────────────

/** Make an authenticated GET request to the Azure Management API */
export async function azureGet<T>(url: string): Promise<T> {
  const token = await getAzureToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Azure API GET failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

/** Make an authenticated PUT request to the Azure Management API */
export async function azurePut<T>(url: string, body: unknown): Promise<T> {
  const token = await getAzureToken();
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const responseBody = await res.text();
    throw new Error(`Azure API PUT failed (${res.status}): ${responseBody}`);
  }
  return res.json() as Promise<T>;
}

/** Make an authenticated POST request to the Azure Management API */
export async function azurePost<T>(url: string, body: unknown): Promise<T> {
  const token = await getAzureToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const responseBody = await res.text();
    throw new Error(`Azure API POST failed (${res.status}): ${responseBody}`);
  }
  return res.json() as Promise<T>;
}

/** Make an authenticated PATCH request to the Azure Management API */
export async function azurePatch<T>(url: string, body: unknown): Promise<T> {
  const token = await getAzureToken();
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const responseBody = await res.text();
    throw new Error(`Azure API PATCH failed (${res.status}): ${responseBody}`);
  }
  // Some Azure APIs (e.g. Container Apps) return 202 with empty body
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

/** Make an authenticated DELETE request to the Azure Management API */
export async function azureDelete(url: string): Promise<void> {
  const token = await getAzureToken();
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  // 200, 202, 204 are all valid success responses for DELETE
  if (!res.ok && res.status !== 202 && res.status !== 204) {
    const body = await res.text();
    throw new Error(`Azure API DELETE failed (${res.status}): ${body}`);
  }
}
