import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Settings, ExternalLink, CheckCircle2, AlertCircle, ArrowLeft, RefreshCw, Clock3 } from "lucide-react";
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
    <div className="min-h-screen bg-[#0A0D14] text-[#F8FAFC] p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-[#64748B] hover:text-[#F8FAFC] text-sm mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Declair
        </button>

        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-5 h-5 text-[#06B6D4]" />
          <h1 className="text-2xl font-semibold">Atlassian connections</h1>
        </div>
        <p className="text-sm text-[#64748B] mb-8">
          Keep your Jira and Confluence context up to date.
        </p>

        <div className="rounded-2xl border border-[#1E293B] bg-[#0E131F] p-6 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Jira</h2>
              <p className="text-sm text-[#94A3B8] mt-1">Issues, comments and changes.</p>
            </div>
            {status?.connected ? (
              <div className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-sm text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Connected
              </div>
            ) : null}
          </div>

          {!status?.connected && (
            <Button onClick={connect} disabled={working} className="mt-5 bg-[#06B6D4] text-[#0A0D14] hover:bg-[#00F0FF]">
              Connect Jira <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          )}

          {status?.connected && (
            <div className="mt-5 pt-4 border-t border-[#1E293B] flex items-center gap-2 text-sm text-[#94A3B8]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Webhooks enabled
            </div>
          )}

          {authUrl && (
            <div className="mt-4 rounded-lg border border-[#06B6D4]/40 bg-[#06B6D4]/10 p-3">
              <p className="text-sm text-[#F8FAFC] mb-2">Open Atlassian to approve access.</p>
              <a href={authUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#06B6D4] text-[#0A0D14] font-medium px-3 py-2 rounded-md hover:bg-[#00F0FF] text-sm">
                Open Atlassian <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#1E293B] bg-[#0E131F] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Confluence</h2>
              <p className="text-sm text-[#94A3B8] mt-1">Pages and comments.</p>
            </div>
            {status?.confluence ? (
              <div className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-sm text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> In sync
              </div>
            ) : null}
          </div>

          {status?.confluence ? (
            <div className="mt-5 pt-4 border-t border-[#1E293B] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                <Clock3 className="w-4 h-4" />
                Last synced {formatSync()}
              </div>
              <Button onClick={pollNow} disabled={working} className="bg-[#1683FF] text-white hover:bg-[#3696FF]">
                <RefreshCw className={`w-4 h-4 mr-2 ${working ? "animate-spin" : ""}`} />
                {working ? "Syncing…" : "Sync now"}
              </Button>
            </div>
          ) : (
            <div className="mt-5 pt-4 border-t border-[#1E293B]">
              {!status?.connected ? (
                <p className="text-sm text-[#64748B]">Connect Jira to connect Confluence.</p>
              ) : (
                <p className="text-sm text-amber-400">Confluence access is not available for this Atlassian account.</p>
              )}
            </div>
          )}
        </div>

        {status?.connected && status?.confluence && (
          <div className="mt-5 flex items-center gap-2 text-sm text-[#64748B]">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Jira and Confluence are connected. Context updates automatically.
          </div>
        )}

        {message && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#334155] bg-[#121824] p-3 text-sm text-[#CBD5E1]">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {message}
          </div>
        )}
      </div>
    </div>
  );
}
