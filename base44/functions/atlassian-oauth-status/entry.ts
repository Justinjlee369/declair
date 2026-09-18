import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ connected: false }, { status: 401 });
    const mine = await base44.asServiceRole.entities.AtlassianConnection.filter({ owner_user_id: me.id });
    return Response.json({ connected: mine.length > 0, connection: mine[0] || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
