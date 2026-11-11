import React, { useEffect, useRef, useState } from 'react';
import {
  ADMIN_PANEL_KEYBOARD,
  BOT_DISPLAY_NAME,
  InlineButton,
  KVStoreSnapshot,
  REGULAR_USER_ID,
  SUPER_ADMIN_ID,
  SimChatMessage,
  USER_MAIN_KEYBOARD,
} from '../engine/botSimulatorEngine';
import {
  Send,
  RotateCcw,
  Shield,
  User,
  CheckCircle2,
  Lock,
  ImagePlus,
  QrCode,
} from 'lucide-react';

interface TelegramSimulatorProps {
  kv: KVStoreSnapshot;
  activeUserId: number;
  setActiveUserId: (id: number) => void;
  keyboardMode: 'user' | 'admin';
  setKeyboardMode: (mode: 'user' | 'admin') => void;
  userJoinedChannels: boolean;
  setUserJoinedChannels: (joined: boolean) => void;
  messages: SimChatMessage[];
  onSendText: (text: string, isScreenshot?: boolean) => void;
  onClickInline: (btn: InlineButton) => void;
  onResetSimulator: () => void;
  callbackToast: string | null;
}

// Safely render Telegram HTML subset (<b>, <i>, <code>, <a>)
function renderTelegramHtml(rawHtml: string) {
  const lines = rawHtml.split('\n');
  return lines.map((line, lineIdx) => {
    const tokens = line.split(
      /(<b>.*?<\/b>|<i>.*?<\/i>|<code>.*?<\/code>|<a href=".*?">.*?<\/a>)/g
    );
    return (
      <React.Fragment key={lineIdx}>
        {tokens.map((tok, i) => {
          if (tok.startsWith('<b>') && tok.endsWith('</b>')) {
            return (
              <strong key={i} className="font-semibold text-white">
                {tok.slice(3, -4)}
              </strong>
            );
          }
          if (tok.startsWith('<i>') && tok.endsWith('</i>')) {
            return (
              <em key={i} className="italic text-slate-300">
                {tok.slice(3, -4)}
              </em>
            );
          }
          if (tok.startsWith('<code>') && tok.endsWith('</code>')) {
            return (
              <code
                key={i}
                className="font-mono text-xs bg-slate-950/90 text-sky-300 px-1.5 py-0.5 rounded border border-slate-700/70"
              >
                {tok.slice(6, -7)}
              </code>
            );
          }
          const linkMatch = tok.match(/^<a href="(.*?)">(.*?)<\/a>$/);
          if (linkMatch) {
            return (
              <a
                key={i}
                href={linkMatch[1]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 underline hover:text-sky-300"
              >
                {linkMatch[2]}
              </a>
            );
          }
          return <span key={i}>{tok}</span>;
        })}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

// Vibrant Green / Blue / Red Control Panel button styles matching the reference screenshots
function getVibrantControlStyle(label: string): string {
  if (
    label.startsWith('🟩') ||
    label.includes('Manage Payouts') ||
    label.includes('Create Redeem Code') ||
    label.includes('Add Admin') ||
    label.includes('Set Buy/Sell Rates') ||
    label.includes('Manage Buy Stock') ||
    label.includes('Buy Gmail') ||
    label.includes('Sell Gmail') ||
    label.includes('Balance / Deposit') ||
    label.includes('Rewards') ||
    label.includes('Approve') ||
    label.includes('Mark UPI Paid')
  ) {
    return 'bg-[#5bb85d] hover:bg-[#4ea850] border-[#4ca64e] text-white font-semibold shadow-xs';
  }
  if (
    label.startsWith('🟥') ||
    label.includes('Toggle Withdrawals') ||
    label.includes('Back to User Menu') ||
    label.includes('Clear Pending Queues') ||
    label.includes('Admin Panel') ||
    label.includes('Reject') ||
    label.includes('Cancel') ||
    label.includes('Remove') ||
    label.includes('Revoke')
  ) {
    return 'bg-[#e06b6b] hover:bg-[#d15858] border-[#cf5a5a] text-white font-semibold shadow-xs';
  }
  if (
    label.startsWith('🟦') ||
    label.includes('View Users List') ||
    label.includes('Add Force Channel') ||
    label.includes('View/Remove Channels') ||
    label.includes('Bot Stats') ||
    label.includes('Broadcast Msg') ||
    label.includes('Add/Update UPI QR') ||
    label.includes('Manage Sell Submissions') ||
    label.includes('Prev Page') ||
    label.includes('Next Page')
  ) {
    return 'bg-[#4ea4f5] hover:bg-[#3b94e8] border-[#3d93e4] text-white font-semibold shadow-xs';
  }
  return 'bg-[#4ea4f5] hover:bg-[#3b94e8] border-[#3d93e4] text-white font-semibold shadow-xs';
}

export const TelegramSimulator: React.FC<TelegramSimulatorProps> = ({
  kv,
  activeUserId,
  setActiveUserId,
  keyboardMode,
  setKeyboardMode,
  userJoinedChannels,
  setUserJoinedChannels,
  messages,
  onSendText,
  onClickInline,
  onResetSimulator,
  callbackToast,
}) => {
  const [inputText, setInputText] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const isAdmin =
    activeUserId === SUPER_ADMIN_ID || kv['config:admins'].includes(activeUserId);
  const currentUser = kv.users[activeUserId];
  const activeState = currentUser?.state;

  const bottomKeyboardRows =
    keyboardMode === 'admin' && isAdmin
      ? ADMIN_PANEL_KEYBOARD
      : USER_MAIN_KEYBOARD(isAdmin);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendText(inputText, false);
    setInputText('');
  };

  const handleUploadScreenshotClick = () => {
    const sampleUtr = `UTR-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    if (activeState === 'AWAITING_UPI_QR_CONFIG') {
      onSendText(`${kv['config:settings'].upiId} | ${kv['config:settings'].upiMerchantName}`, true);
    } else {
      onSendText(inputText.trim() || sampleUtr, true);
    }
    setInputText('');
  };

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Simulator Top Control Bar */}
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveUserId(SUPER_ADMIN_ID)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeUserId === SUPER_ADMIN_ID
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Super Admin (8838351233)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveUserId(REGULAR_USER_ID);
              if (!kv['config:admins'].includes(REGULAR_USER_ID)) {
                setKeyboardMode('user');
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeUserId === REGULAR_USER_ID
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Regular User (5192048112)</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeUserId !== SUPER_ADMIN_ID && (
            <button
              type="button"
              onClick={() => setUserJoinedChannels(!userJoinedChannels)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                userJoinedChannels
                  ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                  : 'bg-amber-950/60 border-amber-700/60 text-amber-300'
              }`}
              title="Simulate whether this user has joined mandatory Force Channels"
            >
              {userJoinedChannels ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Joined Force Channels</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Not in Force Channels</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onResetSimulator}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors whitespace-nowrap shrink-0"
            title="Reset simulator messages and KV state"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Telegram Bot Sub-Header */}
      <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-sky-600 flex items-center justify-center font-display font-bold text-white text-sm shrink-0">
            MM
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-semibold text-sm text-white">
                {BOT_DISPLAY_NAME}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-sky-400 font-mono">Buy & Sell Hub (₹)</span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>Wallet:</span>
              <span className="font-mono text-emerald-400 tabular-nums">
                ₹{(currentUser?.balance ?? 0).toFixed(2)}
              </span>
              <span>·</span>
              <span>UPI:</span>
              <span className="font-mono text-slate-300">
                {currentUser?.upiId || 'Not Set'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSendText('/start')}
            className="px-2.5 py-1 rounded text-xs font-mono bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            /start
          </button>
          <button
            type="button"
            onClick={() => onSendText('/admin')}
            className="px-2.5 py-1 rounded text-xs font-mono bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            /admin
          </button>
        </div>
      </div>

      {/* Callback Query Toast Notification */}
      {callbackToast && (
        <div className="bg-sky-950/90 border-b border-sky-700/60 px-4 py-1.5 text-center text-xs font-medium text-sky-200">
          {callbackToast}
        </div>
      )}

      {/* Active Multi-Step Input State Banner */}
      {activeState && (
        <div className="bg-amber-950/75 border-b border-amber-800/60 px-4 py-1.5 flex items-center justify-between text-xs text-amber-200">
          <span>
            Bot State: <code className="font-mono font-semibold">{activeState}</code>
            {activeState === 'AWAITING_PAYMENT_SCREENSHOT' &&
              ' — Click "📸 Upload Screenshot" below!'}
          </span>
          <button
            type="button"
            onClick={() => onClickInline({ text: 'Cancel', callback_data: 'cancel_state' })}
            className="underline hover:text-white ml-2 whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Chat Message Feed */}
      <div
        ref={chatContainerRef}
        className="h-[340px] overflow-y-auto p-4 space-y-3 bg-slate-950/60"
      >
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-sky-600 text-white rounded-br-xs'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-xs'
                }`}
              >
                {/* Visual UPI QR Code Card inside Bot Invoice Message */}
                {!isUser && msg.showUpiQrCard && (
                  <div className="mb-3 p-3 rounded-lg bg-white text-slate-900 flex items-center gap-3.5 border border-slate-200">
                    <div className="w-16 h-16 bg-slate-950 rounded-lg flex items-center justify-center shrink-0">
                      <QrCode className="w-12 h-12 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-slate-900 uppercase tracking-tight truncate">
                        {msg.showUpiQrCard.merchantName}
                      </div>
                      <div className="text-xs font-mono font-semibold text-emerald-700 mt-0.5">
                        Pay ₹{msg.showUpiQrCard.amount.toFixed(2)} via UPI
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 truncate mt-0.5">
                        UPI ID: {msg.showUpiQrCard.upiId}
                      </div>
                    </div>
                  </div>
                )}

                {isUser && msg.isScreenshotAttachment && (
                  <div className="mb-1.5 px-2.5 py-1.5 rounded bg-sky-700/80 border border-sky-400/40 flex items-center gap-2 text-[11px] font-mono text-sky-100">
                    <ImagePlus className="w-3.5 h-3.5 shrink-0" />
                    <span>[Telegram Photo Uploaded: payment_screenshot.jpg]</span>
                  </div>
                )}

                <div className="break-words">{renderTelegramHtml(msg.text)}</div>
                <div
                  className={`text-[10px] mt-1 text-right font-mono tabular-nums ${
                    isUser ? 'text-sky-200' : 'text-slate-500'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {/* Inline Keyboard Buttons attached to Bot Message */}
              {!isUser && msg.inlineKeyboard && msg.inlineKeyboard.length > 0 && (
                <div className="mt-1.5 w-full max-w-[90%] space-y-1.5">
                  {msg.inlineKeyboard.map((row, rIdx) => (
                    <div
                      key={rIdx}
                      className={`grid gap-1.5 ${
                        row.length === 3
                          ? 'grid-cols-3'
                          : row.length === 2
                          ? 'grid-cols-2'
                          : 'grid-cols-1'
                      }`}
                    >
                      {row.map((btn, bIdx) => {
                        const inlineStyle = getVibrantControlStyle(btn.text);
                        return btn.url ? (
                          <a
                            key={bIdx}
                            href={btn.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs border transition-all text-center truncate ${inlineStyle}`}
                          >
                            {btn.text.replace(/^[🟩🟦🟥]\s*/u, '')} ↗
                          </a>
                        ) : (
                          <button
                            key={bIdx}
                            type="button"
                            onClick={() => onClickInline(btn)}
                            className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs border transition-all active:scale-[0.99] text-center truncate ${inlineStyle}`}
                          >
                            {btn.text.replace(/^[🟩🟦🟥]\s*/u, '')}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Message Text & Screenshot Upload Bar */}
      <form
        onSubmit={handleFormSubmit}
        className="px-3 py-2 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
      >
        <button
          type="button"
          onClick={handleUploadScreenshotClick}
          className={`px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors whitespace-nowrap shrink-0 ${
            activeState === 'AWAITING_PAYMENT_SCREENSHOT' ||
            activeState === 'AWAITING_UPI_QR_CONFIG'
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
              : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
          }`}
          title="Simulate uploading a UPI Payment Screenshot or QR Photo to the bot"
        >
          <ImagePlus className="w-3.5 h-3.5" />
          <span>📸 Upload Screenshot</span>
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            activeState === 'AWAITING_SELL_GMAIL_SUBMISSION'
              ? 'email@gmail.com | Password123 | No Recovery'
              : activeState
              ? `Enter value for ${activeState}...`
              : 'Type message, UPI ID, or click a reply button below...'
          }
          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
        </button>
      </form>

      {/* Bottom Reply Keyboard (Vibrant Green / Blue / Red Control Panel Layout) */}
      <div className="p-3 bg-slate-950 border-t border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-slate-400">
            {keyboardMode === 'admin' && isAdmin
              ? '🛡️ Vibrant Multi-Column Admin Control Panel (🟩 Active · 🟦 View · 🟥 Toggle)'
              : '📱 Vibrant User Control Menu (🟩 Buy/Sell · 🟦 Account/Refs · 🟥 Admin)'}
          </span>
          {isAdmin && (
            <button
              type="button"
              onClick={() =>
                onSendText(
                  keyboardMode === 'admin' ? '🟥 🔙 Back to User Menu' : '🟥 🛡️ Admin Panel'
                )
              }
              className="text-[11px] text-sky-400 hover:text-sky-300 underline whitespace-nowrap shrink-0"
            >
              Switch to {keyboardMode === 'admin' ? 'User Menu' : 'Admin Keyboard'}
            </button>
          )}
        </div>

        <div className="space-y-2">
          {bottomKeyboardRows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className={`grid gap-2 ${
                row.length === 2 ? 'grid-cols-2' : 'grid-cols-1'
              }`}
            >
              {row.map((btnLabel) => {
                const btnStyle = getVibrantControlStyle(btnLabel);
                const cleanDisplayLabel = btnLabel.replace(/^[🟩🟦🟥]\s*/u, '');

                return (
                  <button
                    key={btnLabel}
                    type="button"
                    onClick={() => onSendText(btnLabel)}
                    className={`px-3.5 py-2.5 rounded-2xl border text-xs transition-all active:scale-[0.99] truncate ${btnStyle}`}
                  >
                    {cleanDisplayLabel}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
