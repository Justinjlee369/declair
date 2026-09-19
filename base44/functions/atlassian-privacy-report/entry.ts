import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";
import { secrets } from "base44:runtime";
import { extractAccountIds, redactPayload } from "../../shared/atlassian-privacy.ts";

// Atlassian Personal Data Reporting API (GDPR) for 3LO (OAuth 2.0) apps.
// Docs: POST https://api.atlassian.com/app/report-accounts/ with Basic auth
// (clientId:clientSecret), body { accounts: [{ accountId, updatedAt }] }.
// Response { accounts: [{ accountId, status: "closed" | "updated" }] }.
// "closed" => erase personal data; "updated" => refresh (we re-poll on schedule).

const REPORT_URL = "https://api.atlassian.com/app/report-accounts/";
const BATCH_SIZE = 90;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Admin-only when invoked by a user; scheduled workflow runs have no user.
    try {
      const me = await base44.auth.me();
      if (me && me.role !== "admin") {
        return Response.json({ error: "Admin only" }, { status: 403 });
      }
    } catch { /* scheduled run: no user context */ }

    const clientId = secrets.get("ATLASSIAN_CLIENT_ID");
    const secret = secrets.get("ATLASSIAN_CLIENT_SECRET");
    if (!clientId || !secret) {
      return Response.json({ error: "Atlassian credentials not configured." }, { status: 503 });
    }

    // 1. Aggregate every accountId we store personal data for, with the OLDEST
    //    retrieval timestamp (age) per account.
    const age = new Map<string, string>();
    const touch = (id: string, ts: string) => {
      if (!id || id === "unknown") return;
      const t = ts ? new Date(ts).toISOString() : new Date().toISOString();
      const cur = age.get(id);
      if (!cur || new Date(t).getTime() < new Date(cur).getTime()) age.set(id, t);
    };

    const tokens = await base44.asServiceRole.entities.AtlassianToken.list("-created_date", 200);
    for (const t of tokens) touch(t.account_id, t.created_date);

    const conns = await base44.asServiceRole.entities.AtlassianConnection.list("-created_date", 200);
    for (const c of conns) touch(c.account_id, c.created_date);

    const events = await base44.asServiceRole.entities.SourceEvent.list("-created_date", 1000);
    for (const e of events) {
      const ids = Array.isArray(e.account_ids) && e.account_ids.length
        ? e.account_ids
        : Array.from(extractAccountIds(e.payload));
      for (const id of ids) touch(id, e.created_date);
    }

    const accounts = Array.from(age.entries()).map(([accountId, updatedAt]) => ({ accountId, updatedAt }));
    if (accounts.length === 0) {
      return Response.json({ ok: true, reported: 0, accounts: 0, erased: 0, refreshed: 0, failures: 0 });
    }

    // 2. Report to Atlassian in batches of 90.
    const authHeader = "Basic " + btoa(`${clientId}:${secret}`);
    let reported = 0, erased = 0, refreshed = 0, failures = 0;
    const eraseIds: string[] = [];

    for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
      const batch = accounts.slice(i, i + BATCH_SIZE);
      reported += batch.length;
      try {
        const r = await fetch(REPORT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": authHeader
          },
          body: JSON.stringify({ accounts: batch })
        });
        if (!r.ok) { failures++; continue; }
        const body = await r.json();
        if (body && Array.isArray(body.accounts)) {
          for (const a of body.accounts) {
            if (a.status === "closed") { erased++; eraseIds.push(a.accountId); }
            else if (a.status === "updated") refreshed++;
          }
        }
      } catch {
        failures++;
      }
    }

    // 3. Erase personal data for closed accounts.
    for (const accId of eraseIds) {
      try {
        const tks = await base44.asServiceRole.entities.AtlassianToken.filter({ account_id: accId });
        for (const t of tks) await base44.asServiceRole.entities.AtlassianToken.delete(t.id);
      } catch { /* continue */ }
      try {
        const cs = await base44.asServiceRole.entities.AtlassianConnection.filter({ account_id: accId });
        for (const c of cs) await base44.asServiceRole.entities.AtlassianConnection.delete(c.id);
      } catch { /* continue */ }
      try {
        for (const e of events) {
          const ids = Array.isArray(e.account_ids) && e.account_ids.length
            ? e.account_ids
            : Array.from(extractAccountIds(e.payload));
          if (!ids.includes(accId)) continue;
          const redacted = redactPayload(e.payload, accId);
          const remaining = ids.filter((x: string) => x !== accId);
          await base44.asServiceRole.entities.SourceEvent.update(e.id, {
            payload: redacted,
            account_ids: remaining
          });
        }
      } catch { /* continue */ }
    }

    return Response.json({ ok: true, reported, accounts: accounts.length, erased, refreshed, failures });
  } catch (e) {
    return Response.json({ error: e?.message || "Privacy report failed" }, { status: 500 });
  }
}