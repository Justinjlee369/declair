import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";
import { secrets } from "base44:runtime";

const CLIENT_ID = "WsS93BP6XkmKryIqHi7ywLyNUfMWH16F";
const SCOPES = ["read:jira-work","read:jira-user","manage:jira-webhook","read:confluence-content.all","read:confluence-space.summary","search:confluence","offline_access"];

function randomState() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: "Authentication required" }, { status: 401 });
    if (!secrets.get("ATLASSIAN_CLIENT_SECRET")) {
      return Response.json({ error: "Atlassian OAuth server secret is not configured.", code: "ATLASSIAN_CLIENT_SECRET_MISSING" }, { status: 503 });
    }

    const state = randomState();
    const redirect = new URL(req.url);
    redirect.pathname = "/api/functions/atlassian-oauth-callback";
    redirect.search = "";
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const old = await base44.asServiceRole.entities.AtlassianOAuthState.filter({ owner_user_id: me.id });
    const data = { owner_user_id: me.id, state, redirect_uri: redirect.toString(), expires_at: expires };
    if (old?.[0]) await base44.asServiceRole.entities.AtlassianOAuthState.update(old[0].id, data);
    else await base44.asServiceRole.entities.AtlassianOAuthState.create(data);

    const params = new URLSearchParams({
      audience: "api.atlassian.com", client_id: CLIENT_ID, scope: SCOPES.join(" "),
      redirect_uri: redirect.toString(), state, response_type: "code", prompt: "consent"
    });
    return Response.json({ authorization_url: `https://auth.atlassian.com/authorize?${params.toString()}`, redirect_uri: redirect.toString(), scopes: SCOPES });
  } catch (e) {
    return Response.json({ error: e?.message || "Could not start Atlassian OAuth." }, { status: 500 });
  }
}