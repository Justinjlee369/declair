import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Radio, Menu, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChatMessage from './ChatMessage';

const SOURCE_TAGS = [
  { name: 'Slack', color: '#36C5F0' },
  { name: 'Jira', color: '#2684FF' },
  { name: 'Confluence', color: '#00B2D9' }
];

const EXAMPLES = [
  'How did we end up shipping the auth refactor?',
  'Why is DEV-901 blocked right now?',
  'What changed on the onboarding flow this week?',
  'Reconstruct the decision around key rotation.'
];

function EmptyState({ onPick }) {
  return (
    <div className="py-16">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4] declair-pulse" />
        <span className="font-mono text-[12px] text-[#64748B]">Declair ready</span>
      </div>
      <h1 className="font-mono font-semibold text-[#F8FAFC] mb-3" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)' }}>
        Ask how the project got here.
      </h1>
      <p className="text-[15px] text-[#64748B] mb-6 max-w-md leading-relaxed">
        Declair reconstructs the narrative from your connected sources — Slack, Jira, Confluence — and remembers how decisions were made.
      </p>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className="text-left text-[13px] text-[#F8FAFC] bg-[#121824] border border-[#1E293B] hover:border-[#06B6D4] rounded-[6px] px-3 py-2 transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4] declair-pulse" />
        <span className="font-mono text-[12px] text-[#64748B]">
          Declair is reconstructing
          <span className="inline-flex ml-1">
            <span className="declair-dot">.</span>
            <span className="declair-dot" style={{ animationDelay: '0.2s' }}>.</span>
            <span className="declair-dot" style={{ animationDelay: '0.4s' }}>.</span>
          </span>
        </span>
      </div>
    </div>
  );
}

export default function ChatCanvas({ messages, onSend, loading, anchor, onOpenThreads, onOpenContext, isMobile }) {
  const [text, setText] = useState('');
  const [filters, setFilters] = useState({ Slack: true, Jira: true, Confluence: true });
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const submit = () => {
    if (!text.trim() || loading) return;
    onSend(text.trim(), filters);
    setText('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <section className="flex flex-col flex-1 min-w-0 h-full bg-[#0A0D14]">
      {/* top bar */}
      <div className="h-14 shrink-0 border-b border-[#1E293B] flex items-center justify-between px-3 sm:px-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {isMobile && (
            <button
              onClick={onOpenThreads}
              className="flex items-center justify-center w-9 h-9 rounded-[6px] border border-[#1E293B] bg-[#121824] text-[#F8FAFC]"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <Radio className="w-3.5 h-3.5 text-[#06B6D4] shrink-0" />
            <span className="font-mono text-[13px] text-[#64748B] shrink-0">Project State:</span>
            <span className="font-mono text-[13px] font-semibold text-[#00F0FF] truncate">{anchor || 'Live Now'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:flex items-center gap-1.5 px-2 h-7 rounded-[6px] bg-[#121824] border border-[#1E293B]">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 declair-pulse" />
            <span className="font-mono text-[11px] text-[#64748B]">live</span>
          </span>
          {isMobile && (
            <button
              onClick={onOpenContext}
              className="flex items-center gap-1.5 h-9 px-2.5 rounded-[6px] border border-[#1E293B] bg-[#121824] text-[#F8FAFC]"
            >
              <Waves className="w-4 h-4" />
              <span className="font-mono text-[11px]">stream</span>
            </button>
          )}
        </div>
      </div>

      {/* stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto declair-scroll min-h-0">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {messages.length === 0 ? (
            <EmptyState onPick={(p) => setText(p)} />
          ) : (
            messages.map((m, i) => <ChatMessage key={i} message={m} />)
          )}
          {loading && <Thinking />}
        </div>
      </div>

      {/* input deck */}
      <div className="shrink-0 border-t border-[#1E293B] bg-[#0E131F] p-3">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-[6px] border border-[#1E293B] bg-[#121824] focus-within:border-[#06B6D4] transition-colors">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={3}
              placeholder="Ask Declair how the project got here…"
              className="w-full bg-transparent resize-none px-3 py-2.5 text-[15px] text-[#F8FAFC] placeholder:text-[#64748B] outline-none font-body"
            />
            <div className="flex items-center justify-between px-2.5 pb-2.5 gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {SOURCE_TAGS.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => setFilters((f) => ({ ...f, [s.name]: !f[s.name] }))}
                    className={cn(
                      'flex items-center gap-1.5 h-7 px-2 rounded-[6px] border text-[12px] font-mono transition-colors',
                      filters[s.name]
                        ? 'bg-[#0A0D14] border-[#1E293B] text-[#F8FAFC]'
                        : 'bg-transparent border-[#1E293B] text-[#64748B]'
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </button>
                ))}
              </div>
              <button
                onClick={submit}
                disabled={!text.trim() || loading}
                className="flex items-center justify-center w-9 h-9 rounded-[6px] bg-[#06B6D4] text-[#0A0D14] hover:bg-[#00F0FF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                style={{ boxShadow: text.trim() && !loading ? '0 0 16px rgba(6,182,212,0.45)' : 'none' }}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="mt-2 px-1 font-mono text-[11px] text-[#64748B]">Enter to send · Shift+Enter for newline</div>
        </div>
      </div>
    </section>
  );
}