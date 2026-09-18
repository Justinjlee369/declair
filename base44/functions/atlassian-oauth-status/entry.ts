import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";

const ATLASSIAN_CONNECTOR_ID = "Jozm6bBpODbSmcMpCrSDmFBAvT1jNXgb";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ connected: false }, { status: 401 });

    try {
      const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(
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

      if (!resourcesRes.ok || !Array.isArray(resources)) {
        return Response.json({
          connected: true,
          connection: null,
          connector_id: ATLASSIAN_CONNECTOR_ID,
          warning: "Atlassian connection exists, but accessible resources could not be read.",
        });
      }

      const jiraResource = resources.find((r: any) => r.scopes?.some((s: string) => s.startsWith("read:jira")));
      const confluenceResource = resources.find((r: any) => r.scopes?.some((s: string) => s.startsWith("read:confluence")));

      return Response.json({
        connected: true,
        connector_id: ATLASSIAN_CONNECTOR_ID,
        connection: jiraResource
          ? {
              cloud_id: jiraResource.id,
              site_url: jiraResource.url,
              site_name: jiraResource.name || jiraResource.url,
              webhooks_registered: false,
            }
          : null,
        confluence: confluenceResource
          ? {
              cloud_id: confluenceResource.id,
              site_url: confluenceResource.url,
              site_name: confluenceResource.name || confluenceResource.url,
            }
          : null,
        resources_count: resources.length,
      });
    } catch (connectionError) {
      return Response.json({
        connected: false,
        connector_id: ATLASSIAN_CONNECTOR_ID,
        error_code: "ATLASSIAN_NOT_CONNECTED",
        detail: connectionError?.message || "No Jira connector connection found.",
      });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
