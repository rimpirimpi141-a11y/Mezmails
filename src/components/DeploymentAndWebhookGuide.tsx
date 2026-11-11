import React, { useState } from 'react';
import { SUPER_ADMIN_ID, SUPPORT_GROUP_URL } from '../engine/botSimulatorEngine';
import { Globe, Terminal, Check, Copy, ExternalLink, RefreshCw, Trash2, Link2 } from 'lucide-react';

export const DeploymentAndWebhookGuide: React.FC = () => {
  const [botToken, setBotToken] = useState('');
  const [workerUrl, setWorkerUrl] = useState('https://mez-mails-bot.your-subdomain.workers.dev');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const cleanToken = botToken.trim() || '<YOUR_BOT_TOKEN>';
  const cleanUrl = workerUrl.trim() || 'https://mez-mails-bot.your-subdomain.workers.dev';

  const curlCommand = webhookSecret.trim()
    ? `curl -X POST "https://api.telegram.org/bot${cleanToken}/setWebhook" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url": "${cleanUrl}", "secret_token": "${webhookSecret.trim()}", "allowed_updates": ["message", "callback_query"]}'`
    : `curl -X POST "https://api.telegram.org/bot${cleanToken}/setWebhook" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url": "${cleanUrl}", "allowed_updates": ["message", "callback_query"]}'`;

  const handleCopyCurl = async () => {
    await navigator.clipboard.writeText(curlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const callTelegramWebhookApi = async (action: 'setWebhook' | 'getWebhookInfo' | 'deleteWebhook') => {
    if (!botToken.trim()) {
      setApiResponse(
        JSON.stringify(
          {
            ok: false,
            error: 'Please enter your Telegram Bot Token from @BotFather first to execute live API calls.',
          },
          null,
          2
        )
      );
      return;
    }

    setIsLoading(true);
    setApiResponse(null);
    try {
      const endpoint = `https://api.telegram.org/bot${botToken.trim()}/${action}`;
      const body: Record<string, any> = {};
      if (action === 'setWebhook') {
        body.url = cleanUrl;
        body.allowed_updates = ['message', 'callback_query'];
        if (webhookSecret.trim()) {
          body.secret_token = webhookSecret.trim();
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'getWebhookInfo' ? undefined : JSON.stringify(body),
      });
      const data = await res.json();
      setApiResponse(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setApiResponse(
        JSON.stringify(
          {
            ok: false,
            error: err?.message || 'Network request failed',
          },
          null,
          2
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Section 1: Live Telegram Webhook Registration Tool */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="font-display font-semibold text-base text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-400" />
              <span>Live Telegram Webhook Configurator & cURL Generator</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Connect your deployed single-file Cloudflare Worker URL directly to the Telegram Bot API or copy the ready-to-run terminal command.
            </p>
          </div>
          <a
            href={SUPPORT_GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium whitespace-nowrap shrink-0"
          >
            <span>Support Group ({SUPPORT_GROUP_URL})</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-5">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Telegram Bot Token (from @BotFather)
              </label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="e.g. 7491028391:AAH_x92kLp01mZ..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Cloudflare Worker Endpoint URL (POST /)
              </label>
              <input
                type="url"
                value={workerUrl}
                onChange={(e) => setWorkerUrl(e.target.value)}
                placeholder="https://mez-mails-bot.your-subdomain.workers.dev"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Optional Webhook Secret Token (<code className="text-sky-400 font-mono">WEBHOOK_SECRET</code>)
              </label>
              <input
                type="text"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Optional X-Telegram-Bot-Api-Secret-Token string"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => callTelegramWebhookApi('setWebhook')}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Register Webhook (setWebhook)</span>
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => callTelegramWebhookApi('getWebhookInfo')}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check Webhook Status</span>
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => callTelegramWebhookApi('deleteWebhook')}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Webhook</span>
              </button>
            </div>
          </div>

          <div className="space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-sky-400" />
                  <span>Generated Terminal cURL Command</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyCurl}
                  className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
                >
                  {copiedCurl ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy cURL</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-sky-300 overflow-x-auto whitespace-pre-wrap">
                {curlCommand}
              </pre>
            </div>

            {apiResponse && (
              <div>
                <div className="text-xs font-medium text-slate-300 mb-1">
                  Telegram API Live Response:
                </div>
                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto max-h-40">
                  {apiResponse}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Step-by-Step Standard Worker & wrangler.toml Deployment Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-emerald-400 mb-1">01. Pure Standard Worker Fix</div>
            <h4 className="font-display font-semibold text-sm text-white">
              worker.js + Clean wrangler.toml
            </h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Our clean <code className="text-emerald-300 font-mono">wrangler.toml</code> sets <code className="text-sky-300 font-mono">main = "worker.js"</code>, <code className="text-sky-300 font-mono">[build] command = ""</code>, and zero <code className="text-rose-300 font-mono">[assets]</code> blocks—so GitHub & Wrangler auto-deployments run as a 100% pure serverless Worker.
            </p>
          </div>
          <pre className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
{`name = "mez-mails-bot"
main = "worker.js"
[build]
command = ""`}
          </pre>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-sky-400 mb-1">02. Bind BOT_KV & BOT_USERNAME</div>
            <h4 className="font-display font-semibold text-sm text-white">
              KV Namespace & Bot Variables
            </h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Bind your KV namespace as <code className="text-sky-300 font-mono">BOT_KV</code> (or <code className="text-sky-300 font-mono">MEZ_KV</code>), set <code className="text-sky-300 font-mono">BOT_USERNAME = "@Mezmailsbot"</code>, and add your <code className="text-sky-300 font-mono">BOT_TOKEN</code> under <strong>Variables and Secrets</strong>.
            </p>
          </div>
          <pre className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
{`[[kv_namespaces]]
binding = "BOT_KV"
BOT_USERNAME = "@Mezmailsbot"
SUPPORT_GROUP_URL = "https://t.me/mezmail"`}
          </pre>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-sky-400 mb-1">03. UPI QR & Buy/Sell Gmail</div>
            <h4 className="font-display font-semibold text-sm text-white">
              In-Bot Admin Configuration
            </h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Open your bot on Telegram as Super Admin (<code className="text-slate-200 font-mono">{SUPER_ADMIN_ID}</code>), tap <strong>🟥 🛡️ Admin Panel</strong>, browse users with <strong>🟦 👥 View Users List</strong> (10/page), upload QR via <strong>🟦 🖼️ Add/Update UPI QR</strong>, and manage stock.
            </p>
          </div>
          <pre className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
{`Support: https://t.me/mezmail
Referral: https://t.me/Mezmailsbot?start=ref_<id>
Users List: Paginated 10/page`}
          </pre>
        </div>
      </div>
    </div>
  );
};
