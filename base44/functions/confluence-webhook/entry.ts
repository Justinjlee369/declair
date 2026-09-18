import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";

export default async function(req: Request): Promise<Response> {
  if (req.method === "GET") {
    return Response.json({ ok: true, source: "confluence", status: "ready" });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    const base44 = createClientFromRequest(req);

    // Atlassian includes a stable webhook identifier on deliveries where
    // supported. Fall back to a deterministic-enough event key for older
    // Confluence payloads; the raw payload is retained for reconstruction.
    const webhookId =
      req.headers.get("x-atlassian-webhook-identifier") ||
      payload.webhookEventId ||
      `${payload.eventType || "unknown"}:${payload.content?.id || payload.page?.id || ""}:${payload.timestamp || ""}`;

    const existing = await base44.asServiceRole.entities.SourceEvent.filter({
      external_id: webhookId,
    });
    if (existing?.length) {
      return Response.json({ ok: true, duplicate: true });
    }

    const content = payload.content || payload.page || {};
    const title = content.title || payload.title || "Confluence page";
    const eventType = payload.eventType || payload.event || "unknown";
    const ref = content.id || payload.contentId || payload.pageId || "";

    const sourceEvent = await base44.asServiceRole.entities.SourceEvent.create({
      source: "Confluence",
      event_type: eventType,
      external_id: webhookId,
      ref: String(ref),
      title,
      delta: eventType.replace(/_/g, " "),
      url: content._links?.webui || content._links?.base || "",
      occurred_at: payload.timestamp
        ? new Date(payload.timestamp).toISOString()
        : new Date().toISOString(),
      payload,
    });

    return Response.json({
      ok: true,
      event_id: sourceEvent?.id,
      event_type: eventType,
      ref: String(ref || ""),
    });
  } catch (error) {
    console.error("confluence-webhook", error);
    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }
}
