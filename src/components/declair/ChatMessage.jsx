import React from 'react';
import ReactMarkdown from 'react-markdown';

const SOURCE_COLOR = { Slack: '#36C5F0', Jira: '#2684FF', Confluence: '#00B2D9' };

export default function ChatMessage({ message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[80%] rounded-[6px] bg-[#121824] border border-[#1E293B] px-4 py-3 text-[15px] text-[#F8FAFC] font-body whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />
        <span className="font-mono text-[12px] text-[#64748B]">Declair</span>
      </div>
      <div className="prose-declair text-[15px] text-[#F8FAFC] font-body leading-relaxed">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
      {message.citations && message.citations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {message.citations.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 h-6 px-2 rounded-[6px] bg-[#0E131F] border border-[#1E293B] font-mono text-[11px] text-[#F8FAFC]"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: SOURCE_COLOR[c.source] || '#06B6D4' }} />
              via {c.source} {c.ref}
              {c.ago && <span className="text-[#64748B]"> · {c.ago}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}