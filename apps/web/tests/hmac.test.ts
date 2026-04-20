import { describe, it, expect } from "vitest";
import { computeSignature1, computeSignature2, verify, isWithinWindow } from "@/server/hmac";

describe("HMAC helpers", () => {
  it("sig1 returns uppercase hex", () => {
    const sig = computeSignature1("secret", "clientid", "1700000000000");
    expect(sig).toMatch(/^[0-9A-F]{64}$/);
  });

  it("sig2 differs when access token changes", () => {
    const a = computeSignature2("secret", "clientid", "tokA", "1700000000000");
    const b = computeSignature2("secret", "clientid", "tokB", "1700000000000");
    expect(a).not.toBe(b);
  });

  it("verify is constant-time correct", () => {
    const a = "AAAABBBBCCCCDDDD";
    const b = "AAAABBBBCCCCDDDE";
    expect(verify(a, a)).toBe(true);
    expect(verify(a, b)).toBe(false);
  });

  it("rejects replay outside window", () => {
    const now = 1_700_000_000_000;
    expect(isWithinWindow(now - 30_000, now, 60_000)).toBe(true);
    expect(isWithinWindow(now - 120_000, now, 60_000)).toBe(false);
  });
});
