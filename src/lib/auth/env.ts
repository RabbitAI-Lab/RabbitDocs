/**
 * Auth environment configuration.
 * Centralizes all auth-related env var access with sensible defaults.
 */

import { getSetting } from "./settings";

export function getJwtSecret(): string {
  return process.env.JWT_SECRET || "dev-secret-change-in-production";
}

export function getSmtpConfig(): {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
} | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port: parseInt(process.env.SMTP_PORT || "465", 10),
    secure: process.env.SMTP_SECURE !== "false",
    user,
    pass,
    fromEmail: process.env.SMTP_FROM_EMAIL || `noreply@${host}`,
  };
}

export function getAppUrl(): string {
  return getSetting("site_url") || process.env.NEXT_PUBLIC_APP_URL || "https://docs.rabbitai-lab.com";
}
