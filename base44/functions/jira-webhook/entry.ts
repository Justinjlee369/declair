import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";
import { secrets } from "base44:runtime";

function b64urlToBytes(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - input.length % 4) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function b64urlToJson(input: string) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(input)));
}
async function verifyJwt(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const header = b64urlToJson(parts[0]);
  const claims = b64urlToJson(parts[1]);
  if (header.alg !== "HS256") return false;
  if (claims.exp && Number(claims.exp) < Math.floor(Date.now() / 1000)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, b64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
}

async function hmacSha256(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export default async function(req: Request): Promise<Response> {
  if (req.method === "GET") {
    return Response.json({ ok: true, source: "jira", status: "ready" });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    const clientSecret = await secrets.get("ATLASSIAN_CLIENT_SECRET");
    const authorization = req.headers.get("authorization") || "";

    // OAuth 2.0 dynamic Jira webhooks use an Atlassian-signed bearer JWT.
    // Keep HMAC verification as a fallback for manually configured webhooks.
    if (authorization.startsWith("Bearer ")) {
      if (!clientSecret || !(await verifyJwt(authorization.slice(7), clientSecret))) {
        return new Response("Invalid webhook authorization", { status: 401 });
      }
    } else {
      const secret = await secrets.get("JIRA_WEBHOOK_SECRET");
      const signature = req.headers.get("x-hub-signature");
      if (secret) {
        if (!signature) return new Response("Missing signature", { status: 401 });
        const [method, received] = signature.split("=", 2);
        if (method !== "sha256" || !received) return new Response("Invalid signature", { status: 401 });
        const expected = await hmacSha256(secret, rawBody);
        if (!safeEqual(expected, received)) return new Response("Invalid signature", { status: 401 });
      }
    }
    const base44 = createClientFromRequest(req);
    const webhookId =
      req.headers.get("x-atlassian-webhook-identifier") ||
      payload.webhookEventId ||
      payload.timestamp?.toString() ||
      crypto.randomUUID();

    // Jira may retry a delivery. Treat the Atlassian webhook identifier as
    // the idempotency key so retries do not create duplicate context events.
    const existing = await base44.asServiceRole.entities.SourceEvent.filter({
      external_id: webhookId,
    });
    if (existing?.length) {
      return Response.json({ ok: true, duplicate: true });
    }

    const issue = payload.issue || {};
    const fields = issue.fields || {};
    const changelog = payload.changelog?.items || [];
    const delta = changelog.length
      ? changelog
          .map((c: any) => `${c.field}: ${c.fromString ?? "—"} → ${c.toString ?? "—"}`)
          .join("; ")
      : payload.webhookEvent || "Jira issue changed";

    const sourceEvent = await base44.asServiceRole.entities.SourceEvent.create({
      source: "Jira",
      event_type: payload.webhookEvent || "unknown",
      external_id: webhookId,
      ref: issue.key || issue.id || "",
      title: fields.summary || issue.key || "Jira issue",
      delta,
      url: issue.self || "",
      occurred_at: payload.timestamp
        ? new Date(payload.timestamp).toISOString()
        : new Date().toISOString(),
      payload,
    });

    return Response.json({
      ok: true,
      event_id: sourceEvent?.id,
      event_type: payload.webhookEvent || "unknown",
      ref: issue.key || issue.id || null,
    });
  } catch (error) {
    console.error("jira-webhook", error);
    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }
}
