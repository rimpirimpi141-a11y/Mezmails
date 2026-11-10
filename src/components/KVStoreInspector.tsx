import React, { useState } from 'react';
import {
  KVStoreSnapshot,
  STOCK_CATEGORIES_META,
  SUPER_ADMIN_ID,
} from '../engine/botSimulatorEngine';
import { Database, Plus, Trash2, Check, X, Code2, Package } from 'lucide-react';

interface KVStoreInspectorProps {
  kv: KVStoreSnapshot;
  onUpdateKv: (updater: (draft: KVStoreSnapshot) => void, toastMsg?: string) => void;
}

export const KVStoreInspector: React.FC<KVStoreInspectorProps> = ({ kv, onUpdateKv }) => {
  const [activeTab, setActiveTab] = useState<
    'sell_subs' | 'stock' | 'rates' | 'payouts' | 'channels' | 'redeem' | 'users' | 'raw'
  >('sell_subs');

  // Stock addition state
  const [selectedStockCat, setSelectedStockCat] = useState<'standard' | 'twofa' | 'aged'>('standard');
  const [newStockLine, setNewStockLine] = useState('');

  // Channel state
  const [newChannelUser, setNewChannelUser] = useState('');
  const [newChannelTitle, setNewChannelTitle] = useState('');

  // Redeem code state
  const [newCodeName, setNewCodeName] = useState('');
  const [newCodeAmount, setNewCodeAmount] = useState('50');
  const [newCodeMax, setNewCodeMax] = useState('25');

  // Admin state
  const [newAdminId, setNewAdminId] = useState('');

  const settings = kv['config:settings'];
  const stock = kv['config:stock'];
  const orders = kv['index:orders'];
  const submissions = kv['index:submissions'];
  const channels = kv['config:channels'];
  const payouts = kv['index:payouts'];
  const redeemCodes = Object.values(kv['config:redeem_codes']);
  const usersList = kv['index:users'].map((id) => kv.users[id]).filter(Boolean);

  const totalStock = stock.standard.length + stock.twofa.length + stock.aged.length;
  const pendingOrdersCount = orders.filter((o) => o.status === 'pending').length;
  const pendingSubsCount = submissions.filter((s) => s.status === 'pending').length;
  const pendingPayoutsCount = payouts.filter((p) => p.status === 'pending').length;

  const handleAddStockLine = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = newStockLine
      .split(/\r?\n|,/)
      .map((l) => l.trim())
      .filter((l) => l.includes('@') && l.includes(':'));
    if (lines.length === 0) return;

    onUpdateKv((draft) => {
      draft['config:stock'][selectedStockCat].push(...lines);
    }, `Added ${lines.length} Gmail(s) to ${selectedStockCat} stock in MEZ_KV`);
    setNewStockLine('');
  };

  const handleAddChannel = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = newChannelUser.trim();
    if (!raw) return;
    const username = raw.startsWith('@') ? raw : `@${raw}`;
    const title = newChannelTitle.trim() || username;

    onUpdateKv((draft) => {
      draft['config:channels'] = draft['config:channels'].filter(
        (c) => c.username.toLowerCase() !== username.toLowerCase()
      );
      draft['config:channels'].push({
        username,
        title,
        inviteLink: `https://t.me/${username.replace(/^@/, '')}`,
        addedAt: new Date().toISOString(),
      });
    }, `Added ${username} to MEZ_KV config:channels`);

    setNewChannelUser('');
    setNewChannelTitle('');
  };

  const handleCreateCode = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCodeName.trim().toUpperCase();
    const amount = Number(newCodeAmount);
    const maxClaims = Number(newCodeMax);
    if (!code || isNaN(amount) || amount <= 0 || isNaN(maxClaims) || maxClaims < 1) return;

    onUpdateKv((draft) => {
      draft['config:redeem_codes'][code] = {
        code,
        amount,
        maxClaims,
        claimedCount: 0,
        claimedBy: [],
        createdBy: SUPER_ADMIN_ID,
        createdAt: new Date().toISOString(),
      };
    }, `Saved ₹${amount} redeem code ${code} to MEZ_KV`);
    setNewCodeName('');
  };

  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(newAdminId.trim());
    if (isNaN(num) || num < 10000) return;
    onUpdateKv((draft) => {
      if (!draft['config:admins'].includes(num)) {
        draft['config:admins'].push(num);
      }
    }, `Added Admin ID ${num} to MEZ_KV`);
    setNewAdminId('');
  };

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-full">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-sky-400" />
          <h3 className="font-display font-semibold text-sm text-white">
            Cloudflare KV Namespace Inspector (<code className="text-sky-400 font-mono">MEZ_KV</code>)
          </h3>
        </div>
        <span className="text-xs text-slate-400 font-mono tabular-nums">
          Stock: {totalStock} · Sell Queue: {pendingSubsCount}
        </span>
      </div>

      {/* Navigation Tabs */}
      <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-1 overflow-x-auto">
        {[
          { id: 'sell_subs', label: `Sell Submissions (${pendingSubsCount})` },
          { id: 'stock', label: `Buy Stock & Orders (${totalStock})` },
          { id: 'rates', label: 'Buy/Sell ₹ Rates & UPI' },
          { id: 'payouts', label: `UPI Payouts (${pendingPayoutsCount})` },
          { id: 'channels', label: `Channels (${channels.length})` },
          { id: 'redeem', label: `Redeem (${redeemCodes.length})` },
          { id: 'users', label: `Users (${usersList.length})` },
          { id: 'raw', label: 'Raw JSON' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {activeTab === 'sell_subs' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-white">
                  User Sell Gmail Submissions (<code className="font-mono text-sky-400">index:submissions</code>)
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Approving a submission automatically credits <code className="text-emerald-400 font-mono">₹{settings.sellGmailReward.toFixed(2)}</code> to the seller's wallet balance.
                </p>
              </div>
              <span className="text-slate-400 font-mono tabular-nums">
                {pendingSubsCount} pending
              </span>
            </div>

            {submissions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-950 rounded-lg border border-slate-800">
                No Sell Gmail submissions yet. Click "📤 Sell Gmail" in the simulator to submit one!
              </div>
            ) : (
              submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-semibold text-sky-400">#{sub.id}</span>
                        <span>·</span>
                        <span className="font-medium text-white">{sub.sellerName}</span>
                        <span className="font-mono text-slate-400">({sub.userId})</span>
                        <span>·</span>
                        <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                          +₹{sub.reward.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-slate-200 mt-1">
                        Email: <span className="text-sky-300">{sub.email}</span> · Pass:{' '}
                        <span className="text-amber-300">{sub.password}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Recovery/2FA: {sub.recoveryInfo} · {sub.createdAt}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {sub.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateKv((draft) => {
                                const target = draft['index:submissions'].find(
                                  (x) => x.id === sub.id
                                );
                                if (!target || target.status !== 'pending') return;
                                target.status = 'approved';
                                const seller = draft.users[target.userId];
                                if (seller) {
                                  seller.balance = Number(
                                    (seller.balance + target.reward).toFixed(2)
                                  );
                                  seller.totalEarned = Number(
                                    (seller.totalEarned + target.reward).toFixed(2)
                                  );
                                  seller.soldMailsCount = (seller.soldMailsCount || 0) + 1;
                                }
                              }, `Approved #${sub.id} & Paid +₹${sub.reward.toFixed(2)} to ${sub.sellerName}`)
                            }
                            className="px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/70 text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0"
                          >
                            <Check className="w-3 h-3" />
                            <span>Approve & Pay ₹{sub.reward}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateKv((draft) => {
                                const target = draft['index:submissions'].find(
                                  (x) => x.id === sub.id
                                );
                                if (target && target.status === 'pending') {
                                  target.status = 'rejected';
                                }
                              }, `Rejected sell submission #${sub.id}`)
                            }
                            className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-700/70 text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0"
                          >
                            <X className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : (
                        <span
                          className={`text-xs font-mono ${
                            sub.status === 'approved' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {sub.status === 'approved'
                            ? `✅ Paid +₹${sub.reward.toFixed(2)}`
                            : '❌ Rejected'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'stock' && (
          <div className="space-y-4">
            {/* Add Stock Form */}
            <form
              onSubmit={handleAddStockLine}
              className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Add Buy Gmail Stock to KV Inventory (<code className="text-sky-400 font-mono">config:stock</code>)</span>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {(['standard', 'twofa', 'aged'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedStockCat(cat)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors truncate ${
                      selectedStockCat === cat
                        ? 'bg-sky-950 border-sky-600 text-sky-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {STOCK_CATEGORIES_META[cat].title} ({stock[cat].length})
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newStockLine}
                  onChange={(e) => setNewStockLine(e.target.value)}
                  placeholder="fresh.account@gmail.com:Password123"
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Stock</span>
                </button>
              </div>

              {/* Current Stock Lines Preview */}
              <div className="max-h-28 overflow-y-auto divide-y divide-slate-800/80 border border-slate-800 rounded bg-slate-900/50">
                {stock[selectedStockCat].length === 0 ? (
                  <div className="p-2.5 text-center text-[11px] text-slate-500">
                    Category is currently Out of Stock.
                  </div>
                ) : (
                  stock[selectedStockCat].map((cred, i) => (
                    <div
                      key={i}
                      className="px-2.5 py-1.5 flex items-center justify-between text-[11px] font-mono text-slate-300"
                    >
                      <span className="truncate">{cred}</span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateKv((draft) => {
                            draft['config:stock'][selectedStockCat].splice(i, 1);
                          }, 'Removed stock credential line')
                        }
                        className="text-slate-500 hover:text-rose-400 ml-2"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </form>

            {/* Pending & Completed Gmail Purchase Orders */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">
                  Buy Gmail Orders (<code className="font-mono text-sky-400">index:orders</code>)
                </span>
                <span className="text-slate-400 font-mono tabular-nums">
                  {pendingOrdersCount} pending verification
                </span>
              </div>

              {orders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-semibold text-sky-400">#{ord.id}</span>
                        <span>·</span>
                        <span className="font-medium text-white">{ord.buyerName}</span>
                        <span>·</span>
                        <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                          ₹{ord.totalAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {ord.categoryTitle} × {ord.quantity} · {ord.screenshotRef}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {ord.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateKv((draft) => {
                                const target = draft['index:orders'].find((x) => x.id === ord.id);
                                if (!target || target.status !== 'pending') return;
                                const catStock = draft['config:stock'][target.category];
                                if (catStock.length < target.quantity) return;
                                const dispatched = catStock.splice(0, target.quantity);
                                target.status = 'approved';
                                target.accounts = dispatched;
                              }, `Approved #${ord.id} & Dispatched ${ord.quantity} Gmail(s)`)
                            }
                            className="px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/70 text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0"
                          >
                            <Check className="w-3 h-3" />
                            <span>Approve & Dispatch Stock</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateKv((draft) => {
                                const target = draft['index:orders'].find((x) => x.id === ord.id);
                                if (target && target.status === 'pending') {
                                  target.status = 'rejected';
                                }
                              }, `Rejected order #${ord.id}`)
                            }
                            className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-700/70 text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0"
                          >
                            <X className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : (
                        <span
                          className={`text-xs font-mono ${
                            ord.status === 'approved' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {ord.status === 'approved' ? '✅ Dispatched' : '❌ Rejected'}
                        </span>
                      )}
                    </div>
                  </div>

                  {ord.accounts && ord.accounts.length > 0 && (
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-sky-300">
                      Dispatched: {ord.accounts.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'rates' && (
          <div className="space-y-4">
            {/* Merchant UPI Configuration */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-white">
                Admin UPI Payment Receiver Configuration (<code className="font-mono text-sky-400">config:settings</code>)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Merchant UPI ID (<code className="font-mono text-sky-400">upiId</code>)
                  </label>
                  <input
                    type="text"
                    value={settings.upiId}
                    onChange={(e) =>
                      onUpdateKv((draft) => {
                        draft['config:settings'].upiId = e.target.value;
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Merchant Payee Name (<code className="font-mono text-sky-400">upiMerchantName</code>)
                  </label>
                  <input
                    type="text"
                    value={settings.upiMerchantName}
                    onChange={(e) =>
                      onUpdateKv((draft) => {
                        draft['config:settings'].upiMerchantName = e.target.value;
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            {/* Global Withdrawal Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <div>
                <div className="text-xs font-semibold text-white">
                  Global UPI Withdrawal Gate (<code className="font-mono text-sky-400">withdrawalsEnabled</code>)
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Synced with Admin Panel "⭕ Toggle Withdrawals".
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateKv((draft) => {
                    draft['config:settings'].withdrawalsEnabled =
                      !draft['config:settings'].withdrawalsEnabled;
                    draft['config:settings'].updatedAt = new Date().toISOString();
                  }, 'Toggled UPI withdrawalsEnabled in MEZ_KV')
                }
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                  settings.withdrawalsEnabled
                    ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300 hover:bg-emerald-900'
                    : 'bg-rose-950/80 border-rose-700 text-rose-300 hover:bg-rose-900'
                }`}
              >
                {settings.withdrawalsEnabled ? '🟢 UPI Withdrawals Open' : '🔴 UPI Withdrawals Paused'}
              </button>
            </div>

            {/* Rupees Buy/Sell Pricing & Reward Thresholds */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  key: 'sellGmailReward' as const,
                  label: '📤 Sell Gmail Reward (₹)',
                  desc: 'Paid to user when Admin approves sold Gmail',
                },
                {
                  key: 'standardGmailPrice' as const,
                  label: '🛒 Buy Standard Gmail Price (₹)',
                  desc: 'Price per Standard Fresh Gmail',
                },
                {
                  key: 'twofaGmailPrice' as const,
                  label: '🛒 Buy 2FA Gmail Price (₹)',
                  desc: 'Price per 2FA Verified Gmail',
                },
                {
                  key: 'agedGmailPrice' as const,
                  label: '🛒 Buy Aged Gmail Price (₹)',
                  desc: 'Price per Aged High-Trust Gmail',
                },
                {
                  key: 'referralBonus' as const,
                  label: '👥 Referral Bonus (₹)',
                  desc: 'Credited per referred friend',
                },
                {
                  key: 'minWithdrawal' as const,
                  label: '🏦 Min. UPI Withdrawal (₹)',
                  desc: 'Minimum ₹ balance required for payout',
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200">{item.label}</span>
                      <code className="text-[10px] font-mono text-sky-400">{item.key}</code>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                  </div>

                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span className="text-xs font-mono text-slate-400">₹</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={settings[item.key]}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (isNaN(val) || val < 0) return;
                        onUpdateKv((draft) => {
                          draft['config:settings'][item.key] = val;
                          draft['config:settings'].updatedAt = new Date().toISOString();
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-white tabular-nums focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'payouts' && (
          <div className="space-y-2.5">
            {payouts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-950 rounded-lg border border-slate-800">
                No UPI withdrawal requests in MEZ_KV.
              </div>
            ) : (
              payouts.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-sky-400">#{p.id}</span>
                      <span>·</span>
                      <span className="font-medium text-white">{p.firstName}</span>
                      <span className="font-mono text-slate-400">({p.userId})</span>
                      <span>·</span>
                      <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                        ₹{p.amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      UPI ID: <span className="text-sky-300">{p.upiId}</span> · {p.createdAt}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {p.status === 'pending' ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateKv((draft) => {
                              const target = draft['index:payouts'].find((x) => x.id === p.id);
                              if (target && target.status === 'pending') {
                                target.status = 'approved';
                                const u = draft.users[target.userId];
                                if (u) u.totalWithdrawn += target.amount;
                              }
                            }, `Marked UPI payout #${p.id} as Paid`)
                          }
                          className="px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/70 text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <Check className="w-3 h-3" />
                          <span>Mark UPI Paid</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateKv((draft) => {
                              const target = draft['index:payouts'].find((x) => x.id === p.id);
                              if (target && target.status === 'pending') {
                                target.status = 'rejected';
                                const u = draft.users[target.userId];
                                if (u) u.balance = Number((u.balance + target.amount).toFixed(2));
                              }
                            }, `Rejected & refunded ₹${p.amount} for #${p.id}`)
                          }
                          className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-700/70 text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <X className="w-3 h-3" />
                          <span>Reject & Refund</span>
                        </button>
                      </>
                    ) : (
                      <span
                        className={`text-xs font-mono ${
                          p.status === 'approved' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {p.status === 'approved' ? '✅ UPI Paid' : '❌ Refunded'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'channels' && (
          <div className="space-y-4">
            <form
              onSubmit={handleAddChannel}
              className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5"
            >
              <div className="text-xs font-semibold text-white">
                Add Mandatory Force-Join Channel (<code className="font-mono text-sky-400">config:channels</code>)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="@ChannelUsername"
                  value={newChannelUser}
                  onChange={(e) => setNewChannelUser(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500"
                />
                <input
                  type="text"
                  placeholder="Channel Display Title"
                  value={newChannelTitle}
                  onChange={(e) => setNewChannelTitle(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Force Channel</span>
                </button>
              </div>
            </form>

            <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg bg-slate-950">
              {channels.map((ch) => (
                <div
                  key={ch.username}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">{ch.title}</div>
                    <div className="text-xs text-slate-400 font-mono">
                      {ch.username} · {ch.inviteLink}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateKv((draft) => {
                        draft['config:channels'] = draft['config:channels'].filter(
                          (c) => c.username !== ch.username
                        );
                      }, `Removed ${ch.username}`)
                    }
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'redeem' && (
          <div className="space-y-4">
            <form
              onSubmit={handleCreateCode}
              className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5"
            >
              <div className="text-xs font-semibold text-white">
                Create Rupees (₹) Promo Redeem Code (<code className="font-mono text-sky-400">config:redeem_codes</code>)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  placeholder="CODE (e.g. MEZ100)"
                  value={newCodeName}
                  onChange={(e) => setNewCodeName(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                />
                <input
                  type="number"
                  step="5"
                  placeholder="₹ Amount"
                  value={newCodeAmount}
                  onChange={(e) => setNewCodeAmount(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                />
                <input
                  type="number"
                  placeholder="Max Claims"
                  value={newCodeMax}
                  onChange={(e) => setNewCodeMax(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create ₹ Code</span>
                </button>
              </div>
            </form>

            <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg bg-slate-950">
              {redeemCodes.map((c) => (
                <div
                  key={c.code}
                  className="px-3.5 py-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-mono font-semibold text-sky-400">{c.code}</span>
                    <span className="mx-2 text-slate-500">·</span>
                    <span className="font-mono text-emerald-400 tabular-nums">
                      +₹{c.amount.toFixed(2)}
                    </span>
                    <span className="mx-2 text-slate-500">·</span>
                    <span className="text-slate-400 font-mono tabular-nums">
                      Claims: {c.claimedCount}/{c.maxClaims}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateKv((draft) => {
                        delete draft['config:redeem_codes'][c.code];
                      }, `Deleted code ${c.code}`)
                    }
                    className="p-1.5 text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <form
              onSubmit={handleAddAdmin}
              className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
            >
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-white">Authorized Admins:</span>{' '}
                {kv['config:admins'].map((id) => (
                  <span key={id} className="font-mono text-sky-400 mr-2">
                    {id}
                    {id === SUPER_ADMIN_ID ? ' (Super)' : ''}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Telegram User ID"
                  value={newAdminId}
                  onChange={(e) => setNewAdminId(e.target.value)}
                  className="w-36 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-white"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-medium whitespace-nowrap shrink-0"
                >
                  + Add Admin
                </button>
              </div>
            </form>

            <div className="overflow-x-auto border border-slate-800 rounded-lg bg-slate-950">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/50">
                    <th className="py-2.5 px-3 font-medium">User / ID</th>
                    <th className="py-2.5 px-3 font-medium">UPI ID</th>
                    <th className="py-2.5 px-3 font-medium text-right">Balance (₹)</th>
                    <th className="py-2.5 px-3 font-medium text-right">Quick Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-900/40">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-white">{u.firstName}</div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {u.id} · Sold: {u.soldMailsCount} · Bought: {u.purchasedCount}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-sky-300">
                        {u.upiId || 'Not Linked'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-400 tabular-nums">
                        ₹{u.balance.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateKv((draft) => {
                              draft.users[u.id].balance = Number(
                                (draft.users[u.id].balance + 50).toFixed(2)
                              );
                              draft.users[u.id].totalEarned = Number(
                                (draft.users[u.id].totalEarned + 50).toFixed(2)
                              );
                            }, `Credited +₹50.00 to ${u.firstName}`)
                          }
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 font-mono text-[11px] border border-slate-700"
                        >
                          +₹50
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'raw' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-sky-400" />
                Live serialized snapshot of Cloudflare KV namespace <code className="text-sky-300">MEZ_KV</code>
              </span>
            </div>
            <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-[380px]">
              {JSON.stringify(kv, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
