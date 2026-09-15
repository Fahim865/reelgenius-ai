import { createHmac, timingSafeEqual } from "crypto";

function sign(payload: string) {
  const secret = process.env['OAUTH_STATE_SECRET'];
  if (!secret) throw new Error("OAuth is not configured.");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function makeState(userId: string) {
  const payload = `${userId}.${Date.now()}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function readState(state: string): string | null {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;
  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [userId, issued] = payload.split(".");
  if (!userId || !issued) return null;
  if (Date.now() - Number(issued) > 15 * 60 * 1000) return null;
  return userId;
}

export function appOrigin(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
