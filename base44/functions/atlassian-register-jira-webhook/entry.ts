import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";
import { secrets } from "base44:runtime";

async function refreshIfNeeded(connection: any) {
  if (connection.expires_at && new Date(connection.expires_at).getTime() > Date.now() + 60000) return connection;
  const clientId = await secrets.get("ATLASSIAN_CLIENT_ID");
  const clientSecret = await secrets.get("ATLASSIAN_CLIENT_SECRET");
  if (!clientId || !clientSecret || !connection.refresh_token) throw new Error("Atlassian OAuth credentials or refresh token missing");

  const res = await fetch("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refresh_token,
    }),
  });
  const token = await res.json();
  if (!res.ok) throw new Error(token.error_description || "Atlassian token refresh failed");

  const base44 = createClientFromRequest(new Request("https://declair.internal"));
  const updated = {
    access_token: token.access_token,
    refresh_token: token.refresh_token || connection.refresh_token,
    expires_at: new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString(),
    scope: token.scope || connection.scope || "",
  };
  await base44.asServiceRole.entities.AtlassianConnection.update(connection.id, updated);
  return {...connection, ...updated};
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({error: "Authentication required"}, {status: 401});

    const rows = await base44.asServiceRole.entities.AtlassianConnection.filter({owner_user_id: me.id});
    const connection = rows?.[0];
    if (!connection) return Response.json({error: "Connect Jira/Confluence first"}, {status: 400});

    const c = await refreshIfNeeded(connection);
    const origin = new URL(req.url).origin;
    const webhookUrl = `${origin}/api/functions/jira-webhook`;

    const apiUrl = `https://api.atlassian.com/ex/jira/${c.cloud_id}/rest/api/2/webhook`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        url: webhookUrl,
        webhooks: [{
          events: ["jira:issue_created", "jira:issue_updated", "jira:issue_deleted", "comment_created", "comment_updated"],
          jqlFilter: "order by updated DESC",
          excludeBody: false,
        }],
      }),
    });
    const data = await response.json();
    if (!response.ok) return Response.json({error: "Could not register Jira webhook", detail: data}, {status: response.status});

    const ids = (data.webhookRegistrationResult || data.webhooks || [])
      .map((w: any) => String(w.createdWebhookId || w.id || w.webhookId))
      .filter((x: string) => x && x !== "undefined");

    await base44.asServiceRole.entities.AtlassianConnection.update(c.id, {
      webhooks_registered: true,
      webhook_ids: ids,
    });

    return Response.json({
      ok: true,
      jira_webhook_url: webhookUrl,
      webhook_ids: ids,
      note: "Jira webhooks registered. Jira REST webhooks expire after 30 days and need periodic refresh.",
    });
  } catch (error) {
    return Response.json({error: error.message || "Webhook registration failed"}, {status: 500});
  }
}
