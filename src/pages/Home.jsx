import React, { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import LeftRail from '@/components/declair/LeftRail';
import ChatCanvas from '@/components/declair/ChatCanvas';
import ContextPanel from '@/components/declair/ContextPanel';
import { agoString } from '@/lib/mockEvents';

export default function Home() {
  const isMobile = useIsMobile();
  const [threads, setThreads] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [anchor, setAnchor] = useState('Live Now');
  const [mobileThreads, setMobileThreads] = useState(false);
  const [mobileContext, setMobileContext] = useState(false);

  const loadThreads = useCallback(async () => {
    try {
      const list = await base44.entities.Thread.list('-updated_date', 50);
      setThreads(list);
      if (list.length > 0) setCurrentId((cur) => cur || list[0].id);
    } catch {
      setThreads([]);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!currentId) {
      setMessages([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const list = await base44.entities.Message.filter({ thread_id: currentId }, 'created_date', 100);
        if (active) setMessages(list);
      } catch {
        if (active) setMessages([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [currentId]);

  const mapEvent = (e) => ({
    id: e.id,
    source: e.source,
    type: e.event_type,
    title: e.title,
    ref: e.ref,
    delta: e.delta,
    url: e.url,
    content: e.payload?.content || e.payload?.page?.body?.storage?.value || '',
    timestamp: e.occurred_at ? new Date(e.occurred_at).getTime() : new Date(e.created_date).getTime()
  });

  const loadEvents = useCallback(async () => {
    try {
      const list = await base44.entities.SourceEvent.list('-created_date', 50);
      setEvents(list.map(mapEvent));
    } catch {
      setEvents([]);
    }
  }, []);

  // live source events from connected integrations
  useEffect(() => {
    loadEvents();
    const unsubscribe = base44.entities.SourceEvent.subscribe((event) => {
      if (event.type === 'create') {
        setEvents((prev) => {
          if (prev.some((e) => e.id === event.data.id)) return prev;
          return [mapEvent(event.data), ...prev].slice(0, 50);
        });
      } else if (event.type === 'delete') {
        setEvents((prev) => prev.filter((e) => e.id !== event.data.id));
      }
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [loadEvents]);

  const eventCounts = events.reduce((acc, e) => {
    acc[e.source] = (acc[e.source] || 0) + 1;
    return acc;
  }, {});

  const handleNewThread = () => {
    setCurrentId(null);
    setMessages([]);
    setMobileThreads(false);
  };

  const handleSelectThread = (id) => {
    setCurrentId(id);
    setMobileThreads(false);
  };

  const handleSend = async (text, filters) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const activeSources = Object.keys(filters).filter((k) => filters[k]);
    const ctxEvents = events
      .filter((e) => activeSources.includes(e.source))
      .slice(0, 20)
      .map((e) => ({
        source: e.source,
        ref: e.ref,
        title: e.title,
        delta: e.delta,
        content: e.content,
        ago: agoString(e.timestamp)
      }));

    let threadId = currentId;
    try {
      if (!threadId) {
        const title = text.slice(0, 42) + (text.length > 42 ? '…' : '');
        const t = await base44.entities.Thread.create({ title, last_message: text });
        threadId = t.id;
        setCurrentId(t.id);
        setThreads((prev) => [t, ...prev]);
      } else {
        await base44.entities.Thread.update(threadId, { last_message: text });
      }
      await base44.entities.Message.create({ thread_id: threadId, role: 'user', content: text });
    } catch {
      /* persistence best-effort */
    }

    try {
      const res = await base44.functions.invoke('chatWithDeclair', {
        message: text,
        history,
        events: ctxEvents
      });
      const reply = res.data?.reply || '*(no response)*';
      const citations = res.data?.citations || [];
      const assistantMsg = { role: 'assistant', content: reply, citations };
      setMessages((prev) => [...prev, assistantMsg]);
      try {
        await base44.entities.Message.create({
          thread_id: threadId,
          role: 'assistant',
          content: reply,
          citations
        });
      } catch {
        /* ignore */
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'I could not reconstruct a response right now. Try again in a moment.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#0A0D14] text-[#F8FAFC]">
      {!isMobile && (
        <div className="w-[220px] shrink-0 h-full">
          <LeftRail
            threads={threads}
            currentThreadId={currentId}
            onSelectThread={handleSelectThread}
            onNewThread={handleNewThread}
            eventCounts={eventCounts}
          />
        </div>
      )}

      <ChatCanvas
        messages={messages}
        onSend={handleSend}
        loading={loading}
        anchor={anchor}
        onOpenThreads={() => setMobileThreads(true)}
        onOpenContext={() => setMobileContext(true)}
        isMobile={isMobile}
      />

      {!isMobile && (
        <div className="w-[320px] shrink-0 h-full">
          <ContextPanel events={events} onAnchorChange={setAnchor} />
        </div>
      )}

      {isMobile && (
        <>
          <Drawer open={mobileThreads} onOpenChange={setMobileThreads}>
            <DrawerContent className="bg-[#0E131F] border-t border-[#1E293B]">
              <div className="h-[70vh]">
                <LeftRail
                  threads={threads}
                  currentThreadId={currentId}
                  onSelectThread={handleSelectThread}
                  onNewThread={handleNewThread}
                  eventCounts={eventCounts}
                />
              </div>
            </DrawerContent>
          </Drawer>
          <Drawer open={mobileContext} onOpenChange={setMobileContext}>
            <DrawerContent className="bg-[#0E131F] border-t border-[#1E293B]">
              <div className="h-[75vh]">
                <ContextPanel events={events} onAnchorChange={setAnchor} />
              </div>
            </DrawerContent>
          </Drawer>
        </>
      )}
    </div>
  );
}