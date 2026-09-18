import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";
import { secrets } from "base44:runtime";

const CLIENT_ID = "WsS93BP6XkmKryIqHi7ywLyNUfMWH16F";

function b64(bytes: Uint8Array) { let s=""; for (const b of bytes) s+=String.fromCharCode(b); return btoa(s); }
async function key(secret: string) {
  const m=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt:new TextEncoder().encode("declair-atlassian-token-v1"),iterations:120000,hash:"SHA-256"},m,{name:"AES-GCM",length:256},false,["encrypt"]);
}
async function enc(value:string,secret:string) {
  const iv=crypto.getRandomValues(new Uint8Array(12)); const k=await key(secret);
  const c=await crypto.subtle.encrypt({name:"AES-GCM",iv},k,new TextEncoder().encode(value));
  return b64(iv)+"."+b64(new Uint8Array(c));
}

export default async function(req: Request): Promise<Response> {
  const base44=createClientFromRequest(req);
  try {
    const u=new URL(req.url), code=u.searchParams.get("code"), state=u.searchParams.get("state");
    if (u.searchParams.get("error")) return new Response("OAuth was denied.",{status:400});
    if (!code || !state) return new Response("Missing OAuth code/state.",{status:400});

    const states=await base44.asServiceRole.entities.AtlassianOAuthState.filter({state});
    const s=states?.[0];
    if (!s || new Date(s.expires_at).getTime()<Date.now()) return new Response("OAuth state is invalid or expired. Start again from Declair.",{status:400});

    const secret=secrets.get("ATLASSIAN_CLIENT_SECRET");
    if (!secret) return new Response("Atlassian OAuth server secret is not configured.",{status:503});

    const tr=await fetch("https://auth.atlassian.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({
      grant_type:"authorization_code",client_id:CLIENT_ID,client_secret:secret,code,redirect_uri:s.redirect_uri
    })});
    const td=await tr.json();
    if (!tr.ok || !td.access_token) return new Response("Atlassian token exchange failed: "+(td.error_description||td.error||"unknown error"),{status:502});

    const rr=await fetch("https://api.atlassian.com/oauth/token/accessible-resources",{headers:{Authorization:"Bearer "+td.access_token,Accept:"application/json"}});
    const resources=await rr.json();
    if (!rr.ok || !Array.isArray(resources)) return new Response("OAuth succeeded, but Atlassian resources could not be read.",{status:502});
    const jira=resources.find((r:any)=>r.scopes?.some((x:string)=>x.startsWith("read:jira")));
    const conf=resources.find((r:any)=>r.scopes?.some((x:string)=>x.startsWith("read:confluence")));
    if (!jira && !conf) return new Response("OAuth succeeded, but no Jira or Confluence resource was granted.",{status:403});

    const old=await base44.asServiceRole.entities.AtlassianToken.filter({owner_user_id:s.owner_user_id});
    const record={owner_user_id:s.owner_user_id,access_token_encrypted:await enc(td.access_token,secret),refresh_token_encrypted:td.refresh_token?await enc(td.refresh_token,secret):"",expires_at:new Date(Date.now()+Number(td.expires_in||3600)*1000).toISOString(),scope:td.scope||"",cloud_id:(jira||conf).id,site_url:(jira||conf).url||"",site_name:(jira||conf).name||(jira||conf).url||""};
    if(old?.[0]) await base44.asServiceRole.entities.AtlassianToken.update(old[0].id,record);
    else await base44.asServiceRole.entities.AtlassianToken.create(record);
    await base44.asServiceRole.entities.AtlassianOAuthState.delete(s.id);

    const dest=new URL(s.redirect_uri); dest.pathname="/settings/atlassian"; dest.search="?connected=1";
    return Response.redirect(dest.toString(),302);
  } catch(e) { return new Response(e?.message||"OAuth callback failed.",{status:500}); }
}