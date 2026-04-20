/**
 * HMAC-SHA256 helpers for the SAINS Integration API v1.2.
 * Signature 1 = HMAC(secret, clientId + unixTimeMs)
 * Signature 2 = HMAC(secret, clientId + accessToken + unixTimeMs)
 * Both UPPERCASE hex. Verification uses `timingSafeEqual` — constant-time.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function computeSignature1(secret: string, clientId: string, unixTimeMs: string): string {
  return createHmac("sha256", secret).update(clientId + unixTimeMs).digest("hex").toUpperCase();
}

export function computeSignature2(secret: string, clientId: string, accessToken: string, unixTimeMs: string): string {
  return createHmac("sha256", secret).update(clientId + accessToken + unixTimeMs).digest("hex").toUpperCase();
}

export function verify(expected: string, actual: string): boolean {
  if (!expected || !actual || expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected, "ascii"), Buffer.from(actual, "ascii"));
}

export function isWithinWindow(timestampMs: number, nowMs: number, windowMs: number): boolean {
  return Math.abs(nowMs - timestampMs) <= windowMs;
}
