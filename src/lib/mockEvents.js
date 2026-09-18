// Simulated webhook event stream for the Declair "Living Stream" panel.
// In production these arrive from connected sources (Slack, Jira, Confluence).

const TEMPLATES = [
  { source: 'Jira', type: 'status', title: 'DEV-892 moved to In Review', ref: 'DEV-892', delta: 'Status: In Progress → In Review', author: 'Priya N.' },
  { source: 'Jira', type: 'created', title: 'DEV-901 opened: Auth token refresh race', ref: 'DEV-901', delta: 'Priority: High · Assignee: Marcus T.', author: 'Marcus T.' },
  { source: 'Slack', type: 'message', title: '#eng-auth decision: rotate keys on deploy', ref: '#eng-auth', delta: '"We\'ll rotate on every deploy, not on a schedule." — Priya N.', author: 'Priya N.' },
  { source: 'Confluence', type: 'updated', title: 'Auth Service Runbook updated', ref: 'AUTH-2026', delta: 'Section 3.2: token refresh flow rewritten', author: 'Sam O.' },
  { source: 'Jira', type: 'comment', title: 'DEV-874 comment: blocking on design sign-off', ref: 'DEV-874', delta: 'Comment by Lena F. — needs UX review before merge', author: 'Lena F.' },
  { source: 'Slack', type: 'thread', title: '#product thread: ship beta Friday?', ref: '#product', delta: '7 replies · resolved: target Friday 17:00', author: 'Dev R.' },
  { source: 'Confluence', type: 'published', title: 'Q3 Roadmap published', ref: 'ROADMAP-Q3', delta: '12 pages · owners assigned across squads', author: 'Dev R.' },
  { source: 'Jira', type: 'resolved', title: 'DEV-860 resolved: login redirect loop', ref: 'DEV-860', delta: 'Resolution: Fixed · verified on staging', author: 'Marcus T.' },
  { source: 'Slack', type: 'message', title: '#incidents resolved: 401 spike on /api/auth', ref: '#incidents', delta: 'Root cause: stale cache · mitigated', author: 'Sam O.' },
  { source: 'Jira', type: 'status', title: 'DEV-889 moved to Done', ref: 'DEV-889', delta: 'Status: In Review → Done', author: 'Priya N.' },
  { source: 'Confluence', type: 'updated', title: 'Onboarding Flow spec updated', ref: 'ONBOARD', delta: 'Step 2 simplified · one step removed', author: 'Lena F.' },
  { source: 'Slack', type: 'message', title: '#eng-platform: migrate to new queue lib', ref: '#eng-platform', delta: 'Decision: replace BullMQ by end of week', author: 'Marcus T.' }
];

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function makeEvent(template, ageSeconds = 0) {
  return {
    id: uid(),
    source: template.source,
    type: template.type,
    title: template.title,
    ref: template.ref,
    delta: template.delta,
    author: template.author,
    timestamp: Date.now() - ageSeconds * 1000
  };
}

export function agoString(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function seedEvents() {
  const ages = [2 * 3600, 3600, 1800, 1200, 600, 300, 120];
  return TEMPLATES.slice(0, 7).map((t, i) => makeEvent(t, ages[i] || 60));
}

export function nextEvent() {
  const t = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  return makeEvent(t, 0);
}