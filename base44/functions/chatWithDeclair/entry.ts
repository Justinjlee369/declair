import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Best-effort auth: the app is login-gated, but don't block the LLM call if
    // a user context isn't present (e.g. dashboard test runs).
    try { await base44.auth.me(); } catch (_) { /* no user context */ }

    const body = await req.json().catch(() => ({}));
    const message = (body?.message ?? '').toString().slice(0, 4000);
    const history = Array.isArray(body?.history) ? body.history.slice(-12) : [];
    const events = Array.isArray(body?.events) ? body.events.slice(0, 40) : [];

    if (!message) {
      return Response.json({ error: 'Message required' }, { status: 400 });
    }

    const eventsBlock = events.length
      ? events.map((e, i) => {
          const head = `[${i + 1}] ${e.source} ${e.ref || ''} — ${e.title} (${e.ago || ''})`;
          const url = e.url ? `\n    url: ${e.url}` : '';
          const delta = e.delta ? `\n    delta: ${e.delta}` : '';
          const content = e.content ? `\n    content: ${e.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 12000)}` : '';
          return head + url + delta + content;
        }).join('\n')
      : '(no live events have arrived yet)';

    const historyBlock = history.length
      ? history.map((h) => `${h.role === 'user' ? 'User' : 'Declair'}: ${h.content}`).join('\n')
      : '(none)';

    const prompt = `You are Declair, a living project context layer for product and engineering teams. You remember how a project got to its current state. You reconstruct narratives from connected source events arriving from Slack, Jira, and Confluence.

Voice: precise, confident, terminal-voiced — no filler, no preamble. Answer in well-structured markdown:
- Open with a one-line direct answer.
- Then use short titled sections (## or bold) when the answer has more than one part; use bullet lists for enumerated facts or steps.
- Preserve concrete detail the user would need (names, statuses, dates, owners, page/ticket titles) — do not over-summarize away specifics.
- When you reference a specific page, ticket, or message, link it inline as markdown using its url from the LIVE PROJECT EVENTS block (e.g. [KEY-123](https://...)). Only link when you actually have the url.
- Close with a "## Sources" section listing each cited source as a bullet with its title as a link and a short note of what it contributed.
When the events support a claim, reference them in prose. If you don't have enough signal to answer confidently, say so plainly in one line and suggest what to ask next.

LIVE PROJECT EVENTS (most recent first):
${eventsBlock}

CONVERSATION SO FAR:
${historyBlock}

User question: ${message}

Respond as JSON with a markdown "reply" and a "citations" array of the source events you relied on. Only cite events that genuinely support the reply.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          reply: { type: 'string', description: 'Markdown answer to the user' },
          citations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                source: { type: 'string', description: 'Slack | Jira | Confluence' },
                ref: { type: 'string', description: 'Ticket id or channel' },
                url: { type: 'string', description: 'Canonical source URL to link to, if present in the event' },
                ago: { type: 'string', description: 'Relative time, e.g. 2h ago' }
              },
              required: ['source', 'ref', 'url', 'ago']
            }
          }
        },
        required: ['reply', 'citations']
      }
    });

    return Response.json({
      reply: (result && result.reply) || '*(no response)*',
      citations: Array.isArray(result && result.citations) ? result.citations : []
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}