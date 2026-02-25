/**
 * App-layer encryption for sensitive fields stored in the database.
 * Uses AES-256-GCM with a key derived from ENCRYPTION_KEY env var.
 *
 * In production, prefer Azure Key Vault references. This provides
 * defense-in-depth for fields that must be stored locally (like 3CX
 * per-instance passwords and integration API keys).
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

/**
 * Authoritative server-side list of field names that contain secrets
 * in integration config JSONB. Used for encryption and masking.
 * This MUST NOT be controlled by the client (H-6 fix).
 */
export const INTEGRATION_SECRET_FIELDS = new Set([
  "apiKey",
  "apiToken",
  "clientSecret",
  "password",
  "secret",
  "webhookSecret",
  "privateKey",
  "publicKey",
  "token",
  "accessToken",
  "accessKey",
  "apiSecret",
  "applicationSecret",
]);

/** Mask string used to replace secrets in API responses */
export const SECRET_MASK = "••••••••";

// Cache derived key to avoid re-running scrypt on every call
let _cachedKey: Buffer | null = null;

/** Check whether encryption is configured (ENCRYPTION_KEY env var is set) */
export function isEncryptionConfigured(): boolean {
  return !!process.env.ENCRYPTION_KEY;
}

function getKey(): Buffer {
  if (_cachedKey) return _cachedKey;
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY environment variable is required");
  const salt = process.env.ENCRYPTION_SALT;
  if (!salt)
    throw new Error(
      "ENCRYPTION_SALT environment variable is required when ENCRYPTION_KEY is set"
    );
  _cachedKey = crypto.scryptSync(key, salt, 32);
  return _cachedKey;
}

/** Encrypt plaintext → hex string (iv:tag:ciphertext) */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

/** Decrypt hex string (iv:tag:ciphertext) → plaintext */
export function decrypt(encryptedStr: string): string {
  const key = getKey();
  const parts = encryptedStr.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted string format");
  const [ivHex, tagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/** Check if a string matches our encrypted format (hex:hex:hex) */
export function isEncrypted(value: string): boolean {
  return /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/.test(value);
}

/** Decrypt a value, returning the original if it's not encrypted or decryption fails */
export function safeDecrypt(value: string): string {
  if (!isEncryptionConfigured() || !isEncrypted(value)) return value;
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

/**
 * Encrypt secret fields in an integration config object.
 * Non-secret fields and already-encrypted values are left untouched.
 * No-op if ENCRYPTION_KEY is not configured.
 */
export function encryptConfigSecrets(
  config: Record<string, unknown>
): Record<string, unknown> {
  if (!isEncryptionConfigured()) return config;
  const result = { ...config };
  for (const key of Object.keys(result)) {
    if (
      INTEGRATION_SECRET_FIELDS.has(key) &&
      typeof result[key] === "string" &&
      result[key] &&
      !isEncrypted(result[key] as string)
    ) {
      result[key] = encrypt(result[key] as string);
    }
  }
  return result;
}

/**
 * Decrypt secret fields in an integration config object.
 * Handles both encrypted and plaintext values gracefully.
 * No-op if ENCRYPTION_KEY is not configured.
 */
export function decryptConfigSecrets(
  config: Record<string, unknown>
): Record<string, unknown> {
  if (!isEncryptionConfigured()) return config;
  const result = { ...config };
  for (const key of Object.keys(result)) {
    if (
      INTEGRATION_SECRET_FIELDS.has(key) &&
      typeof result[key] === "string" &&
      result[key]
    ) {
      result[key] = safeDecrypt(result[key] as string);
    }
  }
  return result;
}
