import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";
import { secrets } from "base44:runtime";
const CLIENT_ID="WsS93BP6XkmKryIqHi7ywLyNUfMWH16F";
function bytes(s:string){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
function b64(x:Uint8Array){let s="";for(const b of x)s+=String.fromCharCode(b);return btoa(s);}
async function key(secret:string){const m=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),"PBKDF2",false,["deriveKey"]);return crypto.subtle.deriveKey({name:"PBKDF2",salt:new TextEncoder().encode("declair-atlassian-token-v1"),iterations:100000,hash:"SHA-256"},m,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);}
async function dec(v:string,secret:string){const [iv,data]=v.split(".");const p=await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(iv)},await key(secret),bytes(data));return new TextDecoder().decode(p);}
async function enc(v:string,secret:string){const iv=crypto.getRandomValues(new Uint8Array(12));const c=await crypto.subtle.encrypt({name:"AES-GCM",iv},await key(secret),new TextEncoder().encode(v));return b64(iv)+"."+b64(new Uint8Array(c));}
export default async function(req:Request):Promise<Response>{
 try{
  const base44=createClientFromRequest(req),me=await base44.auth.me();if(!me)return Response.json({error:"Authentication required"},{status:401});
  const rows=await base44.asServiceRole.entities.AtlassianToken.filter({owner_user_id:me.id}),token=rows?.[0];if(!token)return Response.json({error:"Connect Atlassian first."},{status:400});
  const secret=secrets.get("ATLASSIAN_CLIENT_SECRET");if(!secret)return Response.json({error:"Atlassian OAuth server secret is not configured."},{status:503});
  let access=await dec(token.access_token_encrypted,secret);
  if(new Date(token.expires_at).getTime()<Date.now()+60000 && token.refresh_token_encrypted){
   const refresh=await dec(token.refresh_token_encrypted,secret);
   const tr=await fetch("https://auth.atlassian.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({grant_type:"refresh_token",client_id:CLIENT_ID,client_secret:secret,refresh_token:refresh})});
   const td=await tr.json();
   if(!tr.ok||!td.access_token)return Response.json({error:"Atlassian token refresh failed.",detail:td},{status:502});
   access=td.access_token;
   await base44.asServiceRole.entities.AtlassianToken.update(token.id,{access_token_encrypted:await enc(access,secret),refresh_token_encrypted:td.refresh_token?await enc(td.refresh_token,secret):token.refresh_token_encrypted,expires_at:new Date(Date.now()+Number(td.expires_in||3600)*1000).toISOString()});
  }
  const rr=await fetch("https://api.atlassian.com/oauth/token/accessible-resources",{headers:{Authorization:"Bearer "+access,Accept:"application/json"}});
  const resources=await rr.json();if(!rr.ok||!Array.isArray(resources))return Response.json({error:"Could not read Atlassian resources.",detail:resources},{status:502});
  const jira=resources.find((r:any)=>r.scopes?.some((s:string)=>s.startsWith("read:jira")));if(!jira)return Response.json({error:"No accessible Jira site was returned for this user."},{status:403});
  const webhookUrl=new URL(req.url);webhookUrl.pathname="/api/functions/jira-webhook";webhookUrl.search="";
  const apiUrl=`https://api.atlassian.com/ex/jira/${jira.id}/rest/api/3/webhook`;
  const wr=await fetch(apiUrl,{method:"POST",headers:{Authorization:"Bearer "+access,"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({url:webhookUrl.toString(),webhooks:[{events:["jira:issue_created","jira:issue_updated","jira:issue_deleted","comment_created","comment_updated"],jqlFilter:"order by updated DESC",excludeBody:false}]})});
  const wd=await wr.json();if(!wr.ok)return Response.json({error:"Could not register Jira webhook",detail:wd},{status:wr.status});
  const ids=(wd.webhookRegistrationResult||wd.webhooks||[]).map((w:any)=>String(w.createdWebhookId||w.id||w.webhookId)).filter((x:string)=>x&&x!=="undefined");
  const existing=await base44.asServiceRole.entities.AtlassianConnection.filter({owner_user_id:me.id});
  const metadata={owner_user_id:me.id,provider:"Jira",cloud_id:jira.id,site_url:jira.url||"",site_name:jira.name||jira.url||"",account_id:"",scope:token.scope||"",webhooks_registered:true,webhook_ids:ids};
  if(existing?.[0])await base44.asServiceRole.entities.AtlassianConnection.update(existing[0].id,metadata);else await base44.asServiceRole.entities.AtlassianConnection.create(metadata);
  return Response.json({ok:true,webhook_ids:ids,cloud_id:jira.id,site_url:jira.url,note:"Jira OAuth dynamic webhooks expire after 30 days and must be refreshed."});
 }catch(e){return Response.json({error:e?.message||"Webhook registration failed"},{status:500});}
}