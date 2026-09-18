import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Settings, ExternalLink, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const JIRA_CONNECTOR_ID = "Jozm6bBpODbSmcMpCrSDmFBAvT1jNXgb";

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
      const authorizationUrl = await base44.connectors.connectAppUser(JIRA_CONNECTOR_ID);
      window.location.href = authorizationUrl;
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message || "Could not start Jira OAuth.");
      setWorking(false);
    }
  };

  const registerJira = async () => {
    setWorking(true);
    setMessage("");
    try {
      const res = await base44.functions.invoke("atlassian-register-jira-webhook", {});
      setMessage(res.data?.ok ? "Jira webhook registered. Changes will now flow into Declair." : "Jira webhook registration completed.");
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message || "Could not register Jira webhook.");
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
          Connect Jira so Declair can reconstruct project context from live source changes.
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
            The Jira connector is configured in Base44 with your OAuth client ID, secret and requested scopes. You do not need to enter the secret into Declair.
          </p>
        </div>

        <div className="rounded-xl border border-[#1E293B] bg-[#0E131F] p-5 mb-4">
          <h2 className="font-medium mb-1">2. Turn on live Jira updates</h2>
          <p className="text-sm text-[#94A3B8] mb-4">
            After OAuth, register Declair as a Jira webhook listener for issues and comments that your Jira account can access.
          </p>
          <Button onClick={registerJira} disabled={working || !status?.connected} variant="outline" className="border-[#334155]">
            Register Jira webhook
          </Button>
          {status?.connection?.webhooks_registered && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 mt-3">
              <CheckCircle2 className="w-4 h-4" /> Jira webhook registered
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
