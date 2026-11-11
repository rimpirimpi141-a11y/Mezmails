/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  BOT_DISPLAY_NAME,
  InlineButton,
  KVStoreSnapshot,
  SUPER_ADMIN_ID,
  SUPPORT_GROUP_URL,
  SimChatMessage,
  createInitialKVSnapshot,
} from './engine/botSimulatorEngine';
import {
  processBotCallbackQuery,
  processBotTextCommand,
} from './engine/botCommandProcessor';
import { INDEX_JS_SOURCE } from './data/workerSource';
import { TelegramSimulator } from './components/TelegramSimulator';
import { KVStoreInspector } from './components/KVStoreInspector';
import { WorkerCodeViewer } from './components/WorkerCodeViewer';
import { DeploymentAndWebhookGuide } from './components/DeploymentAndWebhookGuide';
import { Copy, Check, Download, Terminal, Shield, Play, ShoppingCart, Upload, Users } from 'lucide-react';

function getInitialMessages(kv: KVStoreSnapshot): SimChatMessage[] {
  const cfg = kv['config:settings'];
  const stock = kv['config:stock'];
  const totalStock =
    stock.standard.length + stock.twofa.length + stock.aged.length;

  return [
    {
      id: 1,
      sender: 'user',
      text: '/start',
      timestamp: '00:01',
    },
    {
      id: 2,
      sender: 'bot',
      text:
        `✨ <b>Welcome to ${BOT_DISPLAY_NAME} — Buy & Sell Gmail Hub</b> ✨\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👋 Namaste <b>Super Admin</b>! Instant automated <b>Buy Gmail</b> & <b>Sell Gmail</b> marketplace in Indian Rupees (₹).\n\n` +
        `🟩 📤 <b>Sell Gmail Reward:</b> Earn <code>₹${cfg.sellGmailReward.toFixed(2)}</code> per approved account\n` +
        `🟩 🛒 <b>Live Buy Stock Available:</b> <code>${totalStock} Accounts</code>\n` +
        `  ├ 📩 Standard Gmail: <code>₹${cfg.standardGmailPrice.toFixed(2)}</code> (${stock.standard.length} in stock)\n` +
        `  ├ 🔐 2FA Verified Gmail: <code>₹${cfg.twofaGmailPrice.toFixed(2)}</code> (${stock.twofa.length} in stock)\n` +
        `  └ 💎 Aged Gmail: <code>₹${cfg.agedGmailPrice.toFixed(2)}</code> (${stock.aged.length} in stock)\n` +
        `🟦 👥 <b>Referral Link:</b> <code>https://t.me/Mezmailsbot?start=ref_${SUPER_ADMIN_ID}</code> (+₹${cfg.referralBonus}/ref)\n` +
        `💬 <b>Support Group:</b> <a href="${SUPPORT_GROUP_URL}">${SUPPORT_GROUP_URL}</a>\n\n` +
        `👇 <i>Tap any vibrant Green, Blue, or Red control button below to test all workflows:</i>`,
      timestamp: '00:01',
    },
  ];
}

export default function App() {
  const [kv, setKv] = useState<KVStoreSnapshot>(() => createInitialKVSnapshot());
  const [activeUserId, setActiveUserId] = useState<number>(SUPER_ADMIN_ID);
  const [keyboardMode, setKeyboardMode] = useState<'user' | 'admin'>('user');
  const [userJoinedChannels, setUserJoinedChannels] = useState<boolean>(true);
  const [messages, setMessages] = useState<SimChatMessage[]>(() =>
    getInitialMessages(createInitialKVSnapshot())
  );
  const [callbackToast, setCallbackToast] = useState<string | null>(null);
  const [copiedWorkerTop, setCopiedWorkerTop] = useState<boolean>(false);

  const nowTimeStr = () => {
    const d = new Date();
    return d.toTimeString().slice(0, 5);
  };

  const triggerToast = (msg: string) => {
    setCallbackToast(msg);
    setTimeout(() => {
      setCallbackToast((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const handleSendText = (text: string, isScreenshot = false) => {
    const userMsg: SimChatMessage = {
      id: Date.now(),
      sender: 'user',
      text,
      timestamp: nowTimeStr(),
      isScreenshotAttachment: isScreenshot,
    };

    const result = processBotTextCommand(
      text,
      activeUserId,
      keyboardMode,
      userJoinedChannels,
      kv,
      isScreenshot
    );

    const botMessages: SimChatMessage[] = result.replies.map((r, idx) => ({
      id: Date.now() + idx + 1,
      sender: 'bot',
      text: r.text,
      timestamp: nowTimeStr(),
      inlineKeyboard: r.inlineKeyboard,
      showUpiQrCard: r.showUpiQrCard,
    }));

    setKv(result.kv);
    setKeyboardMode(result.keyboardMode);
    setMessages((prev) => [...prev, userMsg, ...botMessages]);
    if (result.callbackNotice) {
      triggerToast(result.callbackNotice);
    }
  };

  const handleClickInline = (btn: InlineButton) => {
    if (!btn.callback_data) return;

    const result = processBotCallbackQuery(
      btn.callback_data,
      activeUserId,
      keyboardMode,
      userJoinedChannels,
      kv
    );

    const botMessages: SimChatMessage[] = result.replies.map((r, idx) => ({
      id: Date.now() + idx + 1,
      sender: 'bot',
      text: r.text,
      timestamp: nowTimeStr(),
      inlineKeyboard: r.inlineKeyboard,
      showUpiQrCard: r.showUpiQrCard,
    }));

    setKv(result.kv);
    setKeyboardMode(result.keyboardMode);
    if (botMessages.length > 0) {
      setMessages((prev) => [...prev, ...botMessages]);
    }
    if (result.callbackNotice) {
      triggerToast(result.callbackNotice);
    }
  };

  const handleResetSimulator = () => {
    const freshKv = createInitialKVSnapshot();
    setKv(freshKv);
    setActiveUserId(SUPER_ADMIN_ID);
    setKeyboardMode('user');
    setUserJoinedChannels(true);
    setMessages(getInitialMessages(freshKv));
    triggerToast('Simulator & BOT_KV reset to defaults');
  };

  const handleUpdateKvFromInspector = (
    updater: (draft: KVStoreSnapshot) => void,
    toastMsg?: string
  ) => {
    const next = structuredClone(kv);
    updater(next);
    setKv(next);
    if (toastMsg) {
      triggerToast(toastMsg);
    }
  };

  const handleCopyTopWorker = async () => {
    await navigator.clipboard.writeText(INDEX_JS_SOURCE);
    setCopiedWorkerTop(true);
    setTimeout(() => setCopiedWorkerTop(false), 2000);
  };

  const handleDownloadTopWorker = () => {
    const blob = new Blob([INDEX_JS_SOURCE], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'worker.js';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalStock =
    kv['config:stock'].standard.length +
    kv['config:stock'].twofa.length +
    kv['config:stock'].aged.length;
  const pendingOrdersCount = kv['index:orders'].filter((o) => o.status === 'pending').length;
  const pendingSellSubsCount = kv['index:submissions'].filter((s) => s.status === 'pending').length;
  const pendingPayoutsCount = kv['index:payouts'].filter((p) => p.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 Zones (Brand Wordmark — 4 Nav Links — 1 Primary Action) */}
      <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-6 py-3.5 flex items-center justify-between gap-8">
        <a
          href="#top"
          className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          𝐌𝐄𝐙 𝐌𝐀𝐈𝐋𝐒 Worker Studio
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <a
            href="#simulator"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Bot Simulator
          </a>
          <a
            href="#kv-inspector"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            BOT_KV Inventory
          </a>
          <a
            href="#worker-script"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            worker.js Script
          </a>
          <a
            href="#deployment"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Webhook Setup
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleCopyTopWorker}
            className="px-4 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {copiedWorkerTop ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied worker.js</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy worker.js</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main id="top" className="max-w-[1380px] w-full mx-auto px-6 py-8 space-y-12 flex-1">
        {/* Hero / Architecture Summary Bar */}
        <section className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-800 pb-6">
            <div className="space-y-2 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono">
                <span>Pure Serverless (worker.js + BOT_KV)</span>
                <span aria-hidden="true">·</span>
                <span>Bot: @Mezmailsbot</span>
                <span aria-hidden="true">·</span>
                <span>Super Admin ID: {SUPER_ADMIN_ID}</span>
                <span aria-hidden="true">·</span>
                <a
                  href={SUPPORT_GROUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:underline"
                >
                  Support: t.me/mezmail
                </a>
              </div>
              <h1
                className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                Buy & Sell Gmail Hub Bot (Vibrant Control Panel UI)
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                100% pure serverless Cloudflare Worker (<code className="text-slate-200 font-mono">worker.js</code> + <code className="text-sky-300 font-mono">BOT_KV</code>) featuring the color-coded <strong>🟩 Green / 🟦 Blue / 🟥 Red Control Panel UI</strong>, <strong>Paginated Users List (10/page with Prev/Next)</strong>, <code className="text-emerald-400 font-mono">https://t.me/Mezmailsbot?start=ref_&lt;userId&gt;</code> referral links, and <code className="text-sky-300 font-mono">https://t.me/mezmail</code> official support.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleSendText('🟩 🛒 Buy Gmail')}
                className="px-3 py-2 rounded-lg bg-[#5bb85d] hover:bg-[#4ea850] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Test 🛒 Buy Gmail</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendText('🟩 📤 Sell Gmail')}
                className="px-3 py-2 rounded-lg bg-[#5bb85d] hover:bg-[#4ea850] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Test 📤 Sell Gmail</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setKeyboardMode('admin');
                  handleSendText('🟦 👥 View Users List');
                }}
                className="px-3 py-2 rounded-lg bg-[#4ea4f5] hover:bg-[#3b94e8] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Test 👥 Paginated Users</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendText('🟥 🛡️ Admin Panel')}
                className="px-3 py-2 rounded-lg bg-[#e06b6b] hover:bg-[#d15858] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Open 🛡️ Admin Panel</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTopWorker}
                className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download worker.js</span>
              </button>
            </div>
          </div>

          {/* Live Telemetry Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400">Live Buy Stock & Sell Queue</div>
              <div className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                {totalStock} In Stock · {pendingSellSubsCount} Sell Pending
              </div>
              <div className="mt-1 text-[11px] text-slate-400 font-mono tabular-nums">
                Std: {kv['config:stock'].standard.length} · 2FA: {kv['config:stock'].twofa.length} · Aged: {kv['config:stock'].aged.length}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400">Buy Prices & Sell Reward (₹)</div>
              <div className="mt-1 font-mono text-lg font-semibold text-emerald-400 tabular-nums">
                Buy: ₹{kv['config:settings'].standardGmailPrice}/₹{kv['config:settings'].twofaGmailPrice} · Sell: +₹{kv['config:settings'].sellGmailReward}
              </div>
              <div className="mt-1 text-[11px] text-slate-400 font-mono tabular-nums">
                Aged: ₹{kv['config:settings'].agedGmailPrice} · Ref: ₹{kv['config:settings'].referralBonus} · Min UPI: ₹{kv['config:settings'].minWithdrawal}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400">Merchant UPI & Order Queue</div>
              <div className="mt-1 font-mono text-base font-semibold text-sky-400 truncate">
                {kv['config:settings'].upiId}
              </div>
              <div className="mt-1 text-[11px] text-slate-400 font-mono tabular-nums">
                Pending Buy Orders: {pendingOrdersCount} · Pending Sells: {pendingSellSubsCount}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xs text-slate-400">UPI Withdrawals Gate</div>
              <div className="mt-1 font-display text-lg font-semibold text-white flex items-center gap-2">
                {kv['config:settings'].withdrawalsEnabled ? (
                  <span className="text-emerald-400">🟢 UPI Active</span>
                ) : (
                  <span className="text-rose-400">🔴 UPI Paused</span>
                )}
              </div>
              <div className="mt-1 text-[11px] text-slate-400 font-mono tabular-nums">
                Pending UPI Payouts: {pendingPayoutsCount}
              </div>
            </div>
          </div>
        </section>

        {/* Section 1: Interactive Telegram Simulator + Real-Time MEZ_KV Store */}
        <section id="simulator" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-sky-400" />
                <span>Interactive Telegram Buy & Sell Simulator + Live MEZ_KV Store</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Test selling Gmails for ₹ rewards, buying Gmails with UPI QR + Screenshot upload, approving & auto-dispatching stock from <code className="font-mono text-sky-300">MEZ_KV</code>, and processing ₹ UPI withdrawals.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-6">
              <TelegramSimulator
                kv={kv}
                activeUserId={activeUserId}
                setActiveUserId={setActiveUserId}
                keyboardMode={keyboardMode}
                setKeyboardMode={setKeyboardMode}
                userJoinedChannels={userJoinedChannels}
                setUserJoinedChannels={setUserJoinedChannels}
                messages={messages}
                onSendText={handleSendText}
                onClickInline={handleClickInline}
                onResetSimulator={handleResetSimulator}
                callbackToast={callbackToast}
              />
            </div>

            <div id="kv-inspector" className="lg:col-span-6">
              <KVStoreInspector kv={kv} onUpdateKv={handleUpdateKvFromInspector} />
            </div>
          </div>
        </section>

        {/* Section 2: Pure Serverless Cloudflare Standard Worker Script (worker.js & wrangler.toml) */}
        <section id="worker-script" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-sky-400" />
                <span>Pure Serverless Standard Worker Script (worker.js) & Clean wrangler.toml</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                100% pure serverless ES Module (<code className="font-mono text-slate-200">main = "worker.js"</code>) paired with a clean <code className="font-mono text-emerald-300">wrangler.toml</code> (<code className="font-mono text-sky-300">BOT_KV</code>, <code className="font-mono text-sky-300">BOT_USERNAME = "@Mezmailsbot"</code>, <code className="font-mono text-sky-300">[build] command = ""</code>, zero <code className="font-mono text-rose-300">[assets]</code> blocks).
              </p>
            </div>
          </div>

          <WorkerCodeViewer />
        </section>

        {/* Section 3: Webhook Registration & Cloudflare Deployment Guide */}
        <section id="deployment" className="space-y-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              Webhook Registration & Single-File Cloudflare Worker Setup
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Bind your <code className="font-mono text-sky-300">BOT_KV</code> namespace, configure your <code className="font-mono text-sky-300">BOT_TOKEN</code> secret, and connect your webhook.
            </p>
          </div>

          <DeploymentAndWebhookGuide />
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-900 px-6 py-6 text-xs text-slate-500">
        <div className="max-w-[1380px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <span>𝐌𝐄𝐙 𝐌𝐀𝐈𝐋𝐒 Serverless Telegram Bot (worker.js + BOT_KV)</span>
            <span className="mx-2">·</span>
            <span className="font-mono">Bot: @Mezmailsbot</span>
            <span className="mx-2">·</span>
            <span className="font-mono">Super Admin: {SUPER_ADMIN_ID}</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={SUPPORT_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              Official Support Group (t.me/mezmail)
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
