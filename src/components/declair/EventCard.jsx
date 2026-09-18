import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { agoString } from '@/lib/mockEvents';

const SOURCE_COLOR = { Slack: '#36C5F0', Jira: '#2684FF', Confluence: '#00B2D9' };

export default function EventCard({ event }) {
  const [open, setOpen] = useState(false);
  const color = SOURCE_COLOR[event.source] || '#06B6D4';

  return (
    <div className="rounded-[6px] bg-[#121824] border border-[#1E293B] overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left p-2.5 flex items-start gap-2.5">
        <span
          className="mt-1 w-2 h-2 rounded-full shrink-0"
          style={{ background: color, boxShadow: `0 0 8px ${color}80` }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B]">{event.source}</span>
            <span className="font-mono text-[10px] text-[#64748B]">{event.ref}</span>
            <span className="ml-auto font-mono text-[10px] text-[#64748B]">{agoString(event.timestamp)}</span>
          </div>
          <div className="text-[13px] text-[#F8FAFC] leading-snug">{event.title}</div>
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-[#64748B] mt-1 transition-transform', open && 'rotate-180')} />
      </button>
      {open && event.delta && (
        <div className="px-2.5 pb-2.5 pl-7 font-mono text-[12px] text-[#94A3B8] whitespace-pre-wrap border-t border-[#1E293B] pt-2">
          {event.delta}
        </div>
      )}
    </div>
  );
}