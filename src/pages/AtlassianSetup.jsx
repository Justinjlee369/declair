import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      window.location.href = res.data.authorization_url;
    } catch (e) {
      setMessage(e?.response?.data?.error || e.message || "Could not start Atlassian OAuth.");
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
          Connect Jira and Confluence so Declair can reconstruct project context from live source changes.
        </p>

        <div className="rounded-xl border border-[#1E293B] bg-[#0E131F] p-5 mb-4">
          <h2 className="font-medium mb-1">1. Configure OAuth credentials</h2>
          <p className="text-sm text-[#94A3B8] mb-4">
            Keep the client secret server-side. Add these two values to your Base44 backend secrets:
          </p>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-[#64748B] mb-1">ATLASSIAN_CLIENT_ID</div>
              <Input readOnly value="Set this in Base44 Secrets" className="bg-[#121824] border-[#1E293B] text-[#94A3B8]" />
            </div>
            <div>
              <div className="text-xs text-[#64748B] mb-1">ATLASSIAN_CLIENT_SECRET</div>
              <Input readOnly value="Set this in Base44 Secrets — never commit it" className="bg-[#121824] border-[#1E293B] text-[#94A3B8]" />
            </div>
          </div>
          <p className="text-xs text-[#64748B] mt-4">
            In Atlassian Developer Console, configure the callback URL as the deployed Declair URL plus
            <code className="mx-1 text-[#CBD5E1]">/api/functions/atlassian-oauth-callback</code>.
          </p>
        </div>

        <div className="rounded-xl border border-[#1E293B] bg-[#0E131F] p-5 mb-4">
          <h2 className="font-medium mb-1">2. Connect Atlassian</h2>
          <p className="text-sm text-[#94A3B8] mb-4">
            OAuth requests Jira and Confluence read access plus the Jira webhook-management scope.
          </p>
          <Button onClick={connect} disabled={working} className="bg-[#06B6D4] text-[#0A0D14] hover:bg-[#00F0FF]">
            {status?.connected ? "Reconnect Atlassian" : "Connect Jira + Confluence"}
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </div>

        <div className="rounded-xl border border-[#1E293B] bg-[#0E131F] p-5 mb-4">
          <h2 className="font-medium mb-1">3. Turn on live Jira updates</h2>
          <p className="text-sm text-[#94A3B8] mb-4">
            After OAuth, register Declair as a Jira webhook listener.
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
          <h2 className="font-medium mb-1">Confluence webhook</h2>
          <p className="text-sm text-[#94A3B8]">
            Confluence Cloud does not currently provide a documented OAuth 2.0 API for dynamically creating webhooks.
            For this prototype, create the Confluence webhook in Confluence Admin and point it to
            <code className="mx-1 text-[#CBD5E1]">/api/functions/confluence-webhook</code>.
          </p>
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
