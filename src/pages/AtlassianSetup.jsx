import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Settings, ExternalLink, CheckCircle2, AlertCircle, ArrowLeft, RefreshCw, Clock3, ListChecks, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AtlassianSetup() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [authUrl, setAuthUrl] = useState("");
  const [lastSynced, setLastSynced] = useState(null);

  const load = async () => {
    try {
      const res = await base44.functions.invoke("atlassian-oauth-status", {});
      setStatus(res.data);
    } catch {
      setStatus({ connected: false });
    }
    try {
      const saved = window.localStorage.getItem("declair_atlassian_last_sync");
      if (saved) setLastSynced(new Date(saved));
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const connect = async () => {
    setWorking(true);
    setMessage("");
    setAuthUrl("");
    try {
      const res = await base44.functions.invoke("atlassian-oauth-start", {});
      const authorizationUrl = res?.data?.authorization_url || res?.authorization_url;
      if (!authorizationUrl) throw new Error(res?.data?.error || "Could not start Atlassian OAuth.");
      setAuthUrl(authorizationUrl);
      window.top.location.href = authorizationUrl;
    } catch (e) {
      const status = e?.response?.status || e?.status;
      const code = e?.response?.data?.code || e?.code;
      const body = e?.response?.data?.error || e?.response?.data?.message || e?.data?.error;
      setMessage(([body, e?.message, code ? `[${code}]` : null, status ? `(HTTP ${status})` : null].filter(Boolean).join(" ")) || "Could not start Atlassian OAuth.");
    } finally {
      setWorking(false);
    }
  };

  const pollNow = async () => {
    setWorking(true);
    setMessage("");
    try {
      const res = await base44.functions.invoke("atlassian-poll-events", {});
      const now = new Date();
      const c = res.data?.created ?? 0;
      setLastSynced(now);
      try { window.localStorage.setItem("declair_atlassian_last_sync", now.toISOString()); } catch {}
      setMessage(c > 0 ? `Fetched ${c} new event${c === 1 ? "" : "s"}.` : "Already up to date.");
    } catch (e) {
      const status = e?.response?.status || e?.status;
      const body = e?.response?.data?.error || e?.response?.data?.message || e?.data?.error;
      setMessage(([body, e?.message, status ? `(HTTP ${status})` : null].filter(Boolean).join(" ")) || "Could not sync Atlassian activity.");
    } finally {
      setWorking(false);
    }
  };

  const formatSync = () => {
    if (!lastSynced) return "Not synced yet";
    const mins = Math.max(0, Math.floor((Date.now() - lastSynced.getTime()) / 60000));
    if (mins < 1) return "Just now";
    if (mins === 1) return "1 min ago";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="relative min-h-screen bg-[#0b0e14] text-[#F8FAFC] px-6 py-10 md:px-10 overflow-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-48 left-1/2 -translate-x-1/2 h-80 w-[44rem] rounded-full bg-[#06B6D4]/10 blur-[130px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#06B6D4]/40 to-transparent" />

      <div className="relative max-w-3xl mx-auto">
        <button onClick={() => navigate("/")} className="group flex items-center gap-2 text-[#64748B] hover:text-[#F8FAFC] text-sm mb-10 transition-colors">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" /> Back to Declair
        </button>

        {/* header */}
        <div className="mb-10">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#06B6D4]/20 to-[#2684FF]/10 ring-1 ring-[#06B6D4]/30 shadow-[0_0_24px_rgba(6,182,212,0.25)]">
            <Settings className="w-5 h-5 text-[#06B6D4]" />
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight bg-gradient-to-r from-white via-white to-[#94A3B8] bg-clip-text text-transparent">
            Atlassian connections
          </h1>
          <p className="text-sm text-[#64748B] mt-2">Keep your Jira and Confluence context up to date.</p>
        </div>

        {/* Jira card */}
        <div className="group relative rounded-2xl border border-[#1c2431] bg-gradient-to-b from-[#141a24] to-[#10151e] p-6 mb-4 transition-colors hover:border-[#2684FF]/40 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]">
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#2684FF]/50 to-transparent opacity-60" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#2684FF]/10 ring-1 ring-[#2684FF]/30 shadow-[0_0_18px_rgba(38,132,255,0.25)]">
                <ListChecks className="w-5 h-5 text-[#2684FF]" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-white">Jira</h2>
                <p className="text-sm text-[#94A3B8] mt-0.5">Issues, comments and changes.</p>
              </div>
            </div>
            {status?.connected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-400/30 shadow-[0_0_12px_rgba(52,211,153,0.25)]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" /> Connected
              </span>
            ) : null}
          </div>

          <div className="mt-6">
            {status?.connected ? (
              <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Webhooks enabled — updates flow in automatically.
              </div>
            ) : (
              <Button onClick={connect} disabled={working} className="bg-gradient-to-r from-[#08c1d5] to-[#06B6D4] text-[#04141a] hover:from-[#19d4e7] hover:to-[#22d3ee] font-semibold shadow-[0_0_20px_rgba(8,193,213,0.35)] border-0">
                Connect Jira <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>

        {/* Confluence card */}
        <div className="group relative rounded-2xl border border-[#1c2431] bg-gradient-to-b from-[#141a24] to-[#10151e] p-6 transition-colors hover:border-[#06B6D4]/40 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]">
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#06B6D4]/50 to-transparent opacity-60" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#0052CC]/10 ring-1 ring-[#0052CC]/30 shadow-[0_0_18px_rgba(0,82,204,0.25)]">
                <FileText className="w-5 h-5 text-[#3b82f6]" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-white">Confluence</h2>
                <p className="text-sm text-[#94A3B8] mt-0.5">Pages and comments.</p>
              </div>
            </div>
            {status?.confluence ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-400/30 shadow-[0_0_12px_rgba(52,211,153,0.25)]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" /> In sync
              </span>
            ) : null}
          </div>

          <div className="mt-6">
            {status?.confluence ? (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                  <Clock3 className="w-4 h-4" /> Last synced {formatSync()}
                </div>
                <Button onClick={pollNow} disabled={working} variant="outline" className="border-[#1c2431] bg-transparent text-[#CBD5E1] hover:bg-[#1c2431] hover:text-white">
                  <RefreshCw className={`w-4 h-4 mr-2 ${working ? "animate-spin" : ""}`} />
                  {working ? "Syncing…" : "Sync now"}
                </Button>
              </div>
            ) : (
              <Button onClick={connect} disabled={working} className="bg-gradient-to-r from-[#08c1d5] to-[#06B6D4] text-[#04141a] hover:from-[#19d4e7] hover:to-[#22d3ee] font-semibold shadow-[0_0_20px_rgba(8,193,213,0.35)] border-0">
                Connect Confluence <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>

        {authUrl && (
          <div className="mt-4 rounded-xl border border-[#06B6D4]/30 bg-[#06B6D4]/10 p-4">
            <p className="text-sm text-[#F8FAFC] mb-2">If Atlassian didn't open automatically, approve access here.</p>
            <a href={authUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#06B6D4] text-[#04141a] font-medium px-3 py-2 rounded-lg hover:bg-[#00F0FF] text-sm transition-colors">
              Open Atlassian <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {message && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#334155] bg-[#121824] p-3 text-sm text-[#CBD5E1]">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {message}
          </div>
        )}
      </div>
    </div>
  );
}