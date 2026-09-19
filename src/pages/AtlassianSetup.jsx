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
    <div className="min-h-screen bg-[#0b0e14] text-[#F8FAFC] px-6 py-10 md:px-10">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-[#64748B] hover:text-[#F8FAFC] text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Declair
        </button>

        <div className="flex items-center gap-3 mb-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#06B6D4]/10 ring-1 ring-[#06B6D4]/30">
            <Settings className="w-5 h-5 text-[#06B6D4]" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Atlassian connections</h1>
        </div>
        <p className="text-sm text-[#64748B] mb-8">Keep your Jira and Confluence context up to date.</p>

        {/* Jira card */}
        <div className="rounded-2xl border border-[#1c2431] bg-[#131821] p-6 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#2684FF]/10 ring-1 ring-[#2684FF]/30">
                <ListChecks className="w-5 h-5 text-[#2684FF]" />
              </span>
              <div>
                <h2 className="text-base font-semibold">Jira</h2>
                <p className="text-sm text-[#94A3B8] mt-0.5">Issues, comments and changes.</p>
              </div>
            </div>
            {status?.connected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-400/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Connected
              </span>
            ) : null}
          </div>

          <div className="mt-5">
            {status?.connected ? (
              <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Webhooks enabled — updates flow in automatically.
              </div>
            ) : (
              <Button onClick={connect} disabled={working} className="bg-[#08c1d5] text-[#0b0e14] hover:bg-[#06B6D4] font-medium">
                Connect Jira <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>

        {/* Confluence card */}
        <div className="rounded-2xl border border-[#1c2431] bg-[#131821] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#06B6D4]/10 ring-1 ring-[#06B6D4]/30">
                <FileText className="w-5 h-5 text-[#06B6D4]" />
              </span>
              <div>
                <h2 className="text-base font-semibold">Confluence</h2>
                <p className="text-sm text-[#94A3B8] mt-0.5">Pages and comments.</p>
              </div>
            </div>
            {status?.confluence ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-400/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> In sync
              </span>
            ) : null}
          </div>

          <div className="mt-5">
            {status?.confluence ? (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                  <Clock3 className="w-4 h-4" /> Last synced {formatSync()}
                </div>
                <Button onClick={pollNow} disabled={working} variant="outline" className="border-[#1c2431] text-[#CBD5E1] hover:bg-[#1c2431]">
                  <RefreshCw className={`w-4 h-4 mr-2 ${working ? "animate-spin" : ""}`} />
                  {working ? "Syncing…" : "Sync now"}
                </Button>
              </div>
            ) : (
              <Button onClick={connect} disabled={working} className="bg-[#08c1d5] text-[#0b0e14] hover:bg-[#06B6D4] font-medium">
                Connect Confluence <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>

        {authUrl && (
          <div className="mt-4 rounded-xl border border-[#06B6D4]/30 bg-[#06B6D4]/10 p-4">
            <p className="text-sm text-[#F8FAFC] mb-2">If Atlassian didn't open automatically, approve access here.</p>
            <a href={authUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#06B6D4] text-[#0b0e14] font-medium px-3 py-2 rounded-lg hover:bg-[#00F0FF] text-sm">
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