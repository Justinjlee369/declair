import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";
import { secrets } from "base44:runtime";

function bytes(s:string){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
async function key(secret:string){
 const m=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),"PBKDF2",false,["deriveKey"]);
 return crypto.subtle.deriveKey({name:"PBKDF2",salt:new TextEncoder().encode("declair-atlassian-token-v1"),iterations:100000,hash:"SHA-256"},m,{name:"AES-GCM",length:256},false,["decrypt"]);
}
async function dec(v:string,secret:string){
 const [iv,data]=v.split("."); const p=await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(iv)},await key(secret),bytes(data));
 return new TextDecoder().decode(p);
}
export default async function(req:Request):Promise<Response>{
 try{
  const base44=createClientFromRequest(req), me=await base44.auth.me();
  if(!me)return Response.json({connected:false},{status:401});
  const rows=await base44.asServiceRole.entities.AtlassianToken.filter({owner_user_id:me.id}), token=rows?.[0];
  if(!token)return Response.json({connected:false});
  const secret=secrets.get("ATLASSIAN_CLIENT_SECRET");
  if(!secret)return Response.json({connected:false,error_code:"ATLASSIAN_CLIENT_SECRET_MISSING"},{status:503});
  const access=await dec(token.access_token_encrypted,secret);
  const rr=await fetch("https://api.atlassian.com/oauth/token/accessible-resources",{headers:{Authorization:"Bearer "+access,Accept:"application/json"}});
  const resources=await rr.json();
  if(!rr.ok||!Array.isArray(resources))return Response.json({connected:false,error_code:"ATLASSIAN_RESOURCE_LOOKUP_FAILED",detail:resources},{status:502});
  const jira=resources.find((r:any)=>r.scopes?.some((s:string)=>s.startsWith("read:jira")));
  const conf=resources.find((r:any)=>r.scopes?.some((s:string)=>s.startsWith("read:confluence")));
  return Response.json({connected:true,connection:jira?{cloud_id:jira.id,site_url:jira.url,site_name:jira.name||jira.url,webhooks_registered:false}:null,confluence:conf?{cloud_id:conf.id,site_url:conf.url,site_name:conf.name||conf.url}:null,resources_count:resources.length});
 }catch(e){return Response.json({connected:false,error:e?.message||"Status check failed"},{status:500});}
}