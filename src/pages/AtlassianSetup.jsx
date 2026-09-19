import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Settings, ExternalLink, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AtlassianSetup() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const res = await base44.functions.invoke("atlassian-oauth-status", {});
      setStatus(res.data);
    } catch {
      setStatus({ connected: false });
    }
  };

  useEffect(() => { load(); }, []);

  const connect = async () => {
    setWorking(true);
    setMessage("");
    try {
      const res = await base44.functions.invoke("atlassian-oauth-start", {});
      const authorizationUrl = res.data?.authorization_url;
      if (!authorizationUrl) throw new Error(res.data?.error || "Could not start Atlassian OAuth.");
      window.location.href = authorizationUrl;
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message || "Could not start Atlassian OAuth.");
      setWorking(false);
    }
  };

  const pollNow = async () => {
    setWorking(true);
    setMessage("");
    try {
      const res = await base44.functions.invoke("atlassian-poll-events", {});
      const c = res.data?.created ?? 0;
      setMessage(c > 0 ? `Fetched ${c} new event${c === 1 ? "" : "s"} from Jira & Confluence.` : "No new activity since the last fetch.");
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message || "Could not fetch Atlassian activity.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0D14] text-[#F8FAFC] p-6 md:p-10">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-[#64748B] hover:text-[#F8FAFC] text-sm mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Declair
        </button>

        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-5 h-5 text-[#06B6D4]" />
          <h1 className="text-xl font-semibold">Atlassian connections</h1>
        </div>
        <p className="text-sm text-[#64748B] mb-8">
          Connect your Atlassian account so Declair can reconstruct project context from live Jira and Confluence changes.
        </p>

        <div className="rounded-xl border border-[#1E293B] bg-[#0E131F] p-5 mb-4">
          <h2 className="font-medium mb-1">1. Connect your Jira account</h2>
          <p className="text-sm text-[#94A3B8] mb-4">
            Each Declair user authorizes their own Jira account. Base44 securely manages the OAuth credential; Declair never stores your Jira access or refresh token.
          </p>
          <Button onClick={connect} disabled={working} className="bg-[#06B6D4] text-[#0A0D14] hover:bg-[#00F0FF]">
            {status?.connected ? "Reconnect Jira" : "Connect Jira"}
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
          <p className="text-xs text-[#64748B] mt-3">
            Declair uses your Atlassian OAuth 2.0 app directly. Your OAuth secret stays server-side and is never sent to the browser.
          </p>
        </div>

        <div className="rounded-xl border border-[#1E293B] bg-[#0E131F] p-5 mb-4">
          <h2 className="font-medium mb-1">2. Live Jira & Confluence updates</h2>
          <p className="text-sm text-[#94A3B8] mb-4">
            Declair polls your connected Jira and Confluence accounts every 5 minutes for new activity and feeds it into the Living Stream.
          </p>
          <Button onClick={pollNow} disabled={working || !status?.connected} variant="outline" className="border-[#334155]">
            {working ? "Fetching…" : "Fetch recent activity now"}
          </Button>
          {status?.connected && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 mt-3">
              <CheckCircle2 className="w-4 h-4" /> Polling active (every 5 min)
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#1E293B] bg-[#0E131F] p-5">
          <h2 className="font-medium mb-1">Confluence</h2>
          <p className="text-sm text-[#94A3B8]">
            Declair uses the same Atlassian user connection for Confluence. If your Atlassian OAuth connector includes Confluence read scopes, your accessible Confluence site will appear here automatically.
          </p>
          <div className="mt-3 text-sm">
            {status?.confluence ? (
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Connected: {status.confluence.site_name}
              </div>
            ) : status?.connected ? (
              <div className="text-amber-400">
                Atlassian connected, but no Confluence resource was returned. The connector needs Confluence read scopes.
              </div>
            ) : (
              <div className="text-[#64748B]">Connect Jira above to authorize your Atlassian account.</div>
            )}
          </div>
        </div>

        {message && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#334155] bg-[#121824] p-3 text-sm text-[#CBD5E1]">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {message}
          </div>
        )}
      </div>
    </div>
  );
}