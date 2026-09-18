import React from 'react';
import { Plus, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const SOURCES = [
  { name: 'Slack', color: '#36C5F0' },
  { name: 'Jira', color: '#2684FF' },
  { name: 'Confluence', color: '#00B2D9' }
];

export default function LeftRail({ threads, currentThreadId, onSelectThread, onNewThread, eventCounts }) {
  return (
    <aside className="flex flex-col w-full h-full bg-[#0E131F] border-r border-[#1E293B]">
      {/* brand */}
      <div className="px-4 h-14 flex items-center gap-2 border-b border-[#1E293B] shrink-0">
        <span className="w-2 h-2 rounded-full bg-[#06B6D4] declair-pulse" />
        <span className="font-mono font-semibold text-[#F8FAFC] text-[15px] tracking-tight">Declair</span>
      </div>

      {/* new thread */}
      <div className="p-3 shrink-0">
        <button
          onClick={onNewThread}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-[6px] bg-[#06B6D4] text-[#0A0D14] font-medium text-[13px] hover:bg-[#00F0FF] transition-colors"
          style={{ boxShadow: '0 0 14px rgba(6,182,212,0.35)' }}
        >
          <Plus className="w-4 h-4" /> New Thread
        </button>
      </div>

      {/* connections */}
      <div className="px-3 pb-3 shrink-0">
        <div className="font-mono text-[11px] uppercase tracking-wider text-[#64748B] px-1 mb-2">Sources</div>
        <div className="space-y-1.5">
          {SOURCES.map((s) => (
            <div key={s.name} className="flex items-center justify-between h-8 px-2 rounded-[6px] bg-[#121824] border border-[#1E293B]">
              <div className="flex items-center gap-2">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-green-500 opacity-60 declair-pulse" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-green-400" />
                </span>
                <span className="text-[13px] text-[#F8FAFC]">{s.name}</span>
              </div>
              <span className="font-mono text-[11px] text-[#64748B]">{eventCounts?.[s.name] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* threads */}
      <div className="flex-1 overflow-y-auto declair-scroll px-3 pb-3 min-h-0">
        <div className="font-mono text-[11px] uppercase tracking-wider text-[#64748B] px-1 mb-2">Threads</div>
        <div className="space-y-1">
          {threads.length === 0 && (
            <div className="px-1 text-[12px] text-[#64748B]">No threads yet.</div>
          )}
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelectThread(t.id)}
              className={cn(
                'w-full text-left flex items-start gap-2 px-2 py-2 rounded-[6px] text-[13px] transition-colors',
                t.id === currentThreadId
                  ? 'bg-[#121824] text-[#F8FAFC] border border-[#1E293B]'
                  : 'text-[#64748B] hover:text-[#F8FAFC] hover:bg-[#121824]/60 border border-transparent'
              )}
            >
              <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-60" />
              <span className="truncate">{t.title}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}