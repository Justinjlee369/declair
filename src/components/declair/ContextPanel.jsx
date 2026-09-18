import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import EventCard from './EventCard';

export default function ContextPanel({ events, onAnchorChange }) {
  const [scrub, setScrub] = useState(100);

  const anchorLabel = scrub >= 98
    ? 'Live Now'
    : (() => {
        const hours = ((100 - scrub) / 100) * 12;
        if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`;
        return `${hours.toFixed(1)}h ago`;
      })();

  useEffect(() => {
    onAnchorChange?.(anchorLabel);
  }, [anchorLabel]);

  return (
    <aside className="flex flex-col w-full h-full bg-[#0E131F] border-l border-[#1E293B]">
      <div className="h-14 shrink-0 border-b border-[#1E293B] flex items-center gap-2 px-4">
        <Activity className="w-3.5 h-3.5 text-[#06B6D4]" />
        <span className="font-mono text-[13px] text-[#F8FAFC]">Living Stream</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 declair-pulse" />
          <span className="font-mono text-[11px] text-[#64748B]">{events.length} events</span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto declair-scroll p-3 space-y-2 min-h-0">
        {events.length === 0 && <div className="text-[12px] text-[#64748B] px-1">Waiting for source events…</div>}
        {events.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>

      {/* timeline scrubber */}
      <div className="shrink-0 border-t border-[#1E293B] p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#64748B]">Timeline</span>
          <span className="font-mono text-[11px] text-[#00F0FF]">{anchorLabel}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={scrub}
          onChange={(e) => setScrub(Number(e.target.value))}
          className="declair-range w-full"
        />
        <div className="flex justify-between mt-1 font-mono text-[10px] text-[#64748B]">
          <span>12h ago</span>
          <span>now</span>
        </div>
      </div>
    </aside>
  );
}