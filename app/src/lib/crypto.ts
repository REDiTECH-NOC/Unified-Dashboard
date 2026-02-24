/**
 * App-layer encryption for sensitive fields stored in the database.
 * Uses AES-256-GCM with a key derived from ENCRYPTION_KEY env var.
 *
 * In production, prefer Azure Key Vault references. This provides
 * defense-in-depth for fields that must be stored locally (like 3CX
 * per-instance passwords).
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

// Cache derived key to avoid re-running scrypt on every call
let _cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (_cachedKey) return _cachedKey;
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY environment variable is required");
  const salt = process.env.ENCRYPTION_SALT || "reditech-rcc-salt";
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
