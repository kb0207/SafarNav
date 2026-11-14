import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import { AppError, isDemo } from "@/lib/http";
import { demoSnapshot } from "@/lib/providers/demo";
import type { Snapshot } from "@/types";
// Authenticated, encrypted, expiring snapshots survive serverless cold starts without storing journeys.
function key() {
  let secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (!isDemo())
      throw new AppError(
        503,
        "Set SESSION_SECRET before enabling real-data mode.",
      );
    secret = "safarnav-public-demo-only-do-not-use-for-live";
  }
  return createHash("sha256").update(secret).digest();
}
export function seal(snapshot: Snapshot) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), nonce);
  const encrypted = Buffer.concat([
    cipher.update(
      deflateSync(JSON.stringify({ snapshot, expires: Date.now() + 3600000 })),
    ),
    cipher.final(),
  ]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export function unseal(token: string): Snapshot {
  try {
    const raw = Buffer.from(token, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      raw.subarray(0, 12),
    );
    decipher.setAuthTag(raw.subarray(12, 28));
    const value = JSON.parse(
      inflateSync(
        Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]),
        { maxOutputLength: 8_000_000 },
      ).toString(),
    );
    if (value.expires < Date.now() || value.snapshot.demo !== isDemo())
      throw Error();
    if (isDemo()) {
      if (!["walking", "driving"].includes(value.snapshot.mode)) throw Error();
      return demoSnapshot(value.snapshot.mode);
    }
    return value.snapshot;
  } catch {
    throw new AppError(
      401,
      "Route session expired or invalid. Calculate your routes again.",
      "SESSION_EXPIRED",
    );
  }
}
