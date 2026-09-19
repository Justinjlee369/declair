// Shared helpers for Atlassian Personal Data Reporting (GDPR) compliance.
// Used by atlassian-poll-events (indexing) and atlassian-privacy-report (reporting/erasure).

// Recursively collect every Atlassian accountId referenced in a payload.
// Skips the reserved "unknown" id per Atlassian guidance.
export function extractAccountIds(value: any, out: Set<string> = new Set()): Set<string> {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const v of value) extractAccountIds(v, out);
    return out;
  }
  for (const [k, v] of Object.entries(value)) {
    if ((k === "accountId" || k === "account_id") && typeof v === "string" && v && v !== "unknown") {
      out.add(v);
    } else {
      extractAccountIds(v, out);
    }
  }
  return out;
}

// Fields that constitute personal data on an Atlassian user object.
const REDACT_KEYS = new Set([
  "accountId",
  "account_id",
  "accountIdByProvider",
  "email",
  "emailAddress",
  "displayName",
  "name",
  "self",
  "avatarUrls",
  "timeZone",
  "locale"
]);

// Deep-clone a payload, redacting personal data for the given (closed) accountId.
// Only objects whose accountId matches the target are redacted, so non-user
// objects (issue fields, page metadata) are preserved for project history.
export function redactPayload(value: any, target: string): any {
  if (Array.isArray(value)) return value.map((v) => redactPayload(v, target));
  if (!value || typeof value !== "object") return value;
  const isSubject = typeof value.accountId === "string" && value.accountId === target;
  const out: any = {};
  for (const [k, v] of Object.entries(value)) {
    if (isSubject && REDACT_KEYS.has(k)) {
      out[k] = "[redacted]";
    } else {
      out[k] = redactPayload(v, target);
    }
  }
  return out;
}