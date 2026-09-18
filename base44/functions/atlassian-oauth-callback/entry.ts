import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";
import { secrets } from "base44:runtime";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) return new Response(`Atlassian authorization failed: ${error}`, { status: 400 });
    if (!code || !state) return new Response("Missing OAuth code/state", { status: 400 });

    const users = await base44.asServiceRole.entities.User.filter({ atlassian_oauth_state: state });
    const user = users?.[0];
    if (!user) return new Response("Invalid or expired OAuth state", { status: 400 });

    const clientId = await secrets.get("ATLASSIAN_CLIENT_ID");
    const clientSecret = await secrets.get("ATLASSIAN_CLIENT_SECRET");
    if (!clientId || !clientSecret) return new Response("Atlassian OAuth credentials are not configured", { status: 500 });

    const redirectUri = `${url.origin}/api/functions/atlassian-oauth-callback`;
    const tokenRes = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok) return Response.json({ error: "Token exchange failed", detail: token.error_description || token.error }, { status: 400 });

    const resourcesRes = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" },
    });
    const resources = await resourcesRes.json();
    if (!resourcesRes.ok || !Array.isArray(resources) || !resources.length) {
      return new Response("No accessible Jira/Confluence site was returned by Atlassian", { status: 400 });
    }

    const resource = resources[0];
    await base44.asServiceRole.entities.AtlassianConnection.create({
      owner_user_id: user.id,
      provider: "Jira + Confluence",
      cloud_id: resource.id,
      site_url: resource.url,
      site_name: resource.name || resource.url,
      account_id: token.account_id || "",
      access_token: token.access_token,
      refresh_token: token.refresh_token || "",
      expires_at: new Date(Date.now() + (Number(token.expires_in || 3600) * 1000)).toISOString(),
      scope: token.scope || "",
      webhooks_registered: false,
      webhook_ids: [],
    });

    await base44.asServiceRole.entities.User.update(user.id, { atlassian_oauth_state: "" });

    const appUrl = url.origin;
    return Response.redirect(`${appUrl}/?atlassian=connected`, 302);
  } catch (error) {
    return new Response(error.message || "OAuth callback failed", { status: 500 });
  }
}
