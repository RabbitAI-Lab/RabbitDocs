/**
 * AES-256-GCM 加密工具 — 用于 BYOK API Key 加密存储
 *
 * 密钥来源（优先级）：
 * 1. process.env.BYOK_ENCRYPTION_KEY（32 字节 hex）
 * 2. ~/.rabbitdocs/.byok-key 文件（首次运行自动生成）
 */

import crypto from "node:crypto";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM 推荐 12 字节
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

let _cachedKey: Buffer | null = null;

function getKeyFilePath(): string {
  return path.join(os.homedir(), ".rabbitdocs", ".byok-key");
}

function getOrCreateKey(): Buffer {
  if (_cachedKey) return _cachedKey;

  // 优先使用环境变量
  const envKey = process.env.BYOK_ENCRYPTION_KEY;
  if (envKey) {
    if (envKey.length !== 64) {
      throw new Error("BYOK_ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
    }
    _cachedKey = Buffer.from(envKey, "hex");
    return _cachedKey;
  }

  // 从文件读取或创建
  const keyPath = getKeyFilePath();
  try {
    const hex = fs.readFileSync(keyPath, "utf-8").trim();
    if (hex.length === 64) {
      _cachedKey = Buffer.from(hex, "hex");
      return _cachedKey;
    }
  } catch {
    // 文件不存在，创建新密钥
  }

  // 生成新密钥
  const newKey = crypto.randomBytes(KEY_LENGTH);
  const dir = path.dirname(keyPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(keyPath, newKey.toString("hex"), { mode: 0o600 });
  console.log("[Crypto] 生成新的 BYOK 加密密钥:", keyPath);
  _cachedKey = newKey;
  return _cachedKey;
}

/**
 * 加密 API Key
 * @returns 格式: "iv:authTag:ciphertext"（均为 base64）
 */
export function encryptApiKey(plaintext: string): string {
  const key = getOrCreateKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  let encrypted = cipher.update(plaintext, "utf-8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * 解密 API Key
 * @param encrypted 格式: "iv:authTag:ciphertext"（均为 base64）
 */
export function decryptApiKey(encrypted: string): string {
  const key = getOrCreateKey();
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format: expected iv:authTag:ciphertext");
  }
  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const ciphertext = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, "base64", "utf-8");
  decrypted += decipher.final("utf-8");
  return decrypted;
}

/**
 * 对 API Key 做遮掩处理（仅展示首尾几位）
 */
export function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 3) + "****" + key.slice(-4);
}
