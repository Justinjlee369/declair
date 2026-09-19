import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";
import { secrets } from "base44:runtime";

function bytes(s: string) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function b64(x: Uint8Array) { let s = ""; for (const b of x) s += String.fromCharCode(b); return btoa(s); }
async function key(secret: string) {
  const m = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: new TextEncoder().encode("declair-atlassian-token-v1"), iterations: 120000, hash: "SHA-256" }, m, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function dec(v: string, secret: string) {
  const [iv, data] = v.split(".");
  const p = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(iv) }, await key(secret), bytes(data));
  return new TextDecoder().decode(p);
}
async function enc(v: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(secret), new TextEncoder().encode(v));
  return b64(iv) + "." + b64(new Uint8Array(c));
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const clientId = secrets.get("ATLASSIAN_CLIENT_ID");
    const secret = secrets.get("ATLASSIAN_CLIENT_SECRET");
    if (!clientId || !secret) return Response.json({ error: "Atlassian credentials not configured." }, { status: 503 });

    let me: any = null;
    try { me = await base44.auth.me(); } catch { /* scheduled run: no user */ }

    let tokens: any[];
    if (me) tokens = await base44.asServiceRole.entities.AtlassianToken.filter({ owner_user_id: me.id });
    else tokens = await base44.asServiceRole.entities.AtlassianToken.list("-created_date", 100);

    if (!tokens || tokens.length === 0) return Response.json({ ok: true, processed: 0, created: 0 });

    let created = 0, processed = 0;
    for (const token of tokens) {
      try {
        let access = await dec(token.access_token_encrypted, secret);
        if (new Date(token.expires_at).getTime() < Date.now() + 60000 && token.refresh_token_encrypted) {
          const refresh = await dec(token.refresh_token_encrypted, secret);
          const tr = await fetch("https://auth.atlassian.com/oauth/token", {
            method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ grant_type: "refresh_token", client_id: clientId, client_secret: secret, refresh_token: refresh })
          });
          const td = await tr.json();
          if (tr.ok && td.access_token) {
            access = td.access_token;
            await base44.asServiceRole.entities.AtlassianToken.update(token.id, {
              access_token_encrypted: await enc(access, secret),
              refresh_token_encrypted: td.refresh_token ? await enc(td.refresh_token, secret) : token.refresh_token_encrypted,
              expires_at: new Date(Date.now() + Number(td.expires_in || 3600) * 1000).toISOString()
            });
          }
        }

        const rr = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", { headers: { Authorization: "Bearer " + access, Accept: "application/json" } });
        const resources = await rr.json();
        if (!rr.ok || !Array.isArray(resources)) continue;
        processed++;

        const jira = resources.find((r: any) => r.scopes?.some((s: string) => s.startsWith("read:jira")));
        const conf = resources.find((r: any) => r.scopes?.some((s: string) => s.startsWith("read:confluence")));

        if (jira) {
          try {
            const jr = await fetch(`https://api.atlassian.com/ex/jira/${jira.id}/rest/api/3/search?jql=${encodeURIComponent("updated >= -10m ORDER BY updated DESC")}&fields=summary,status,issuetype,updated&maxResults=50`, { headers: { Authorization: "Bearer " + access, Accept: "application/json" } });
            const jd = await jr.json();
            if (jr.ok && Array.isArray(jd.issues)) {
              for (const issue of jd.issues) {
                const external_id = `jira:${jira.id}:${issue.id}:${issue.fields?.updated || ""}`;
                const dup = await base44.asServiceRole.entities.SourceEvent.filter({ external_id });
                if (dup && dup.length) continue;
                await base44.asServiceRole.entities.SourceEvent.create({
                  source: "Jira", event_type: "issue_updated", external_id,
                  ref: issue.key, title: issue.fields?.summary || issue.key,
                  delta: issue.fields?.status?.name ? `Status: ${issue.fields.status.name}` : "",
                  url: `${jira.url}/browse/${issue.key}`,
                  occurred_at: issue.fields?.updated ? new Date(issue.fields.updated).toISOString() : new Date().toISOString(),
                  payload: { issue }
                });
                created++;
              }
            }
          } catch { /* ignore per-resource errors */ }
        }

        if (conf) {
          try {
            const cr = await fetch(`https://api.atlassian.com/ex/confluence/${conf.id}/rest/api/search?cql=${encodeURIComponent('lastmodified >= now("-10m")')}&limit=50`, { headers: { Authorization: "Bearer " + access, Accept: "application/json" } });
            const cd = await cr.json();
            if (cr.ok && Array.isArray(cd.results)) {
              for (const page of cd.results) {
                const external_id = `confluence:${conf.id}:${page.id || page.content?.id}:${page.version?.when || ""}`;
                const dup = await base44.asServiceRole.entities.SourceEvent.filter({ external_id });
                if (dup && dup.length) continue;
                await base44.asServiceRole.entities.SourceEvent.create({
                  source: "Confluence", event_type: "page_updated", external_id,
                  ref: String(page.id || page.content?.id || ""),
                  title: page.title || page.content?.title || "Confluence page",
                  delta: page.version?.number ? `Version ${page.version.number}` : "",
                  url: `${conf.url}${page.url || ""}`,
                  occurred_at: page.version?.when ? new Date(page.version.when).toISOString() : new Date().toISOString(),
                  payload: { page }
                });
                created++;
              }
            }
          } catch { /* ignore per-resource errors */ }
        }
      } catch { /* ignore per-token errors */ }
    }
    return Response.json({ ok: true, processed, created });
  } catch (e) {
    return Response.json({ error: e?.message || "Poll failed" }, { status: 500 });
  }
}