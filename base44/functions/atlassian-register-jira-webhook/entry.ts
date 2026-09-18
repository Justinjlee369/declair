import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";

const ATLASSIAN_CONNECTOR_ID = "Jozm6bBpODbSmcMpCrSDmFBAvT1jNXgb";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: "Authentication required" }, { status: 401 });

    const { accessToken } =
      await base44.asServiceRole.connectors.getCurrentAppUserConnection(
        ATLASSIAN_CONNECTOR_ID,
      );

    const resourcesRes = await fetch(
      "https://api.atlassian.com/oauth/token/accessible-resources",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
    );
    const resources = await resourcesRes.json();
    if (!resourcesRes.ok || !Array.isArray(resources) || !resources.length) {
      return Response.json(
        { error: "No accessible Atlassian resources were returned for this user." },
        { status: 400 },
      );
    }

    const jiraResource =
      resources.find((r: any) => r.scopes?.some((s: string) => s.startsWith("read:jira"))) ||
      resources[0];

    if (!jiraResource?.id) {
      return Response.json({ error: "No accessible Jira site was returned for this user." }, { status: 400 });
    }

    const origin = new URL(req.url).origin;
    const webhookUrl = `${origin}/api/functions/jira-webhook`;
    const apiUrl = `https://api.atlassian.com/ex/jira/${jiraResource.id}/rest/api/2/webhook`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        url: webhookUrl,
        webhooks: [{
          events: [
            "jira:issue_created",
            "jira:issue_updated",
            "jira:issue_deleted",
            "comment_created",
            "comment_updated",
          ],
          jqlFilter: "order by updated DESC",
          excludeBody: false,
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return Response.json(
        { error: "Could not register Jira webhook", detail: data },
        { status: response.status },
      );
    }

    const ids = (data.webhookRegistrationResult || data.webhooks || [])
      .map((w: any) => String(w.createdWebhookId || w.id || w.webhookId))
      .filter((x: string) => x && x !== "undefined");

    const existing = await base44.asServiceRole.entities.AtlassianConnection.filter({
      owner_user_id: me.id,
    });

    const metadata = {
      owner_user_id: me.id,
      provider: "Jira",
      cloud_id: jiraResource.id,
      site_url: jiraResource.url || "",
      site_name: jiraResource.name || jiraResource.url || "",
      account_id: "",
      scope: "",
      webhooks_registered: true,
      webhook_ids: ids,
    };

    if (existing?.[0]) {
      await base44.asServiceRole.entities.AtlassianConnection.update(existing[0].id, metadata);
    } else {
      await base44.asServiceRole.entities.AtlassianConnection.create(metadata);
    }

    return Response.json({
      ok: true,
      jira_webhook_url: webhookUrl,
      webhook_ids: ids,
      cloud_id: jiraResource.id,
      site_url: jiraResource.url,
      note: "Jira webhooks registered. Jira REST webhooks expire after 30 days and need periodic refresh.",
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Webhook registration failed" },
      { status: 500 },
    );
  }
}
