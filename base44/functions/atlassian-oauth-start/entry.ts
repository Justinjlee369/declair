import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";
import { secrets } from "base44:runtime";

const DEFAULT_SCOPES = [
  "offline_access",
  "read:jira-work",
  "read:jira-user",
  "read:confluence-content.all",
  "read:confluence-space.summary",
  "read:confluence-user",
  "search:confluence",
].join(" ");

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: "Authentication required" }, { status: 401 });

    const clientId = await secrets.get("ATLASSIAN_CLIENT_ID");
    if (!clientId) return Response.json({ error: "ATLASSIAN_CLIENT_ID is not configured in Base44 secrets" }, { status: 500 });

    const url = new URL(req.url);
    const origin = url.origin;
    const state = crypto.randomUUID();

    const authUrl = new URL("https://auth.atlassian.com/authorize");
    authUrl.searchParams.set("audience", "api.atlassian.com");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("scope", DEFAULT_SCOPES);
    authUrl.searchParams.set("redirect_uri", `${origin}/api/functions/atlassian-oauth-callback`);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("prompt", "consent");

    // OAuth state is bound to the logged-in Base44 user.
    await base44.asServiceRole.entities.User.update(me.id, {
      atlassian_oauth_state: state,
    });

    return Response.json({ authorization_url: authUrl.toString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
