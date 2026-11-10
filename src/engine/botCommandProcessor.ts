import {
  BOT_DISPLAY_NAME,
  InlineButton,
  KVStoreSnapshot,
  STOCK_CATEGORIES_META,
  SUPER_ADMIN_ID,
  SUPPORT_GROUP_URL,
} from './botSimulatorEngine';

export interface BotTurnResult {
  kv: KVStoreSnapshot;
  replies: Array<{
    text: string;
    inlineKeyboard?: InlineButton[][];
    showUpiQrCard?: {
      upiId: string;
      merchantName: string;
      amount: number;
    };
  }>;
  keyboardMode: 'user' | 'admin';
  callbackNotice?: string;
}

const CANCEL_INLINE: InlineButton[][] = [
  [{ text: '❌ Cancel Operation', callback_data: 'cancel_state' }],
];

function formatINR(val: number): string {
  return `₹${Number(val || 0).toFixed(2)}`;
}

export function processBotTextCommand(
  rawInput: string,
  activeUserId: number,
  currentKeyboardMode: 'user' | 'admin',
  userJoinedForceChannels: boolean,
  prevKv: KVStoreSnapshot,
  isSimulatedScreenshot = false
): BotTurnResult {
  const kv: KVStoreSnapshot = structuredClone(prevKv);
  const text = rawInput.trim();
  const config = kv['config:settings'];
  const stock = kv['config:stock'];
  const admins = kv['config:admins'];
  const isAdmin = activeUserId === SUPER_ADMIN_ID || admins.includes(activeUserId);

  let user = kv.users[activeUserId];
  if (!user) {
    user = {
      id: activeUserId,
      username: `user_${activeUserId}`,
      firstName: 'Telegram User',
      balance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      totalSpent: 0,
      purchasedCount: 0,
      soldMailsCount: 0,
      referralsCount: 0,
      referredBy: null,
      upiId: '',
      notifications: true,
      lastDailyBonus: null,
      state: null,
      stateData: {},
      joinedAt: new Date().toISOString(),
    };
    kv.users[activeUserId] = user;
    if (!kv['index:users'].includes(activeUserId)) {
      kv['index:users'].push(activeUserId);
    }
  }

  const replies: BotTurnResult['replies'] = [];
  let keyboardMode = currentKeyboardMode;

  // Mandatory Force-Join Channel check for regular users
  const channels = kv['config:channels'];
  if (!isAdmin && channels.length > 0 && !userJoinedForceChannels) {
    const buttons: InlineButton[][] = channels.map((ch) => [
      {
        text: `📢 Join ${ch.title || ch.username}`,
        url: ch.inviteLink || `https://t.me/${ch.username.replace(/^@/, '')}`,
      },
    ]);
    buttons.push([
      { text: '✅ Joined — Verify Membership', callback_data: 'verify_membership' },
    ]);

    replies.push({
      text:
        `🔒 <b>Mandatory Channel Verification</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Welcome to <b>${BOT_DISPLAY_NAME}</b>! Before buying or selling Gmail accounts, please join our official channel(s):\n\n` +
        channels.map((c, i) => `${i + 1}. <b>${c.title}</b> (${c.username})`).join('\n') +
        `\n\n<i>Click "✅ Joined — Verify Membership" once subscribed.</i>`,
      inlineKeyboard: buttons,
    });
    return { kv, replies, keyboardMode: 'user' };
  }

  const topCommands = [
    '/start',
    '/admin',
    '/cancel',
    '🛒 Buy Gmail',
    '📤 Sell Gmail',
    '📂 My Orders / Submissions',
    '💰 Balance / Deposit',
    '👥 Referrals',
    '🎁 Rewards',
    '⚙️ Settings',
    '❓ Help',
    '🛡️ Admin Panel',
    '🛒 Manage Buy Stock',
    '📤 Manage Sell Submissions',
    '🖼️ Add/Update UPI QR',
    '💳 Manage Payouts',
    '👥 View Users List',
    '➕ Add Force Channel',
    '📋 View/Remove Channels',
    '🎟️ Create Redeem Code',
    '👤 Add Admin',
    '💳 Set Buy/Sell Rates',
    '⭕ Toggle Withdrawals',
    '📊 Bot Stats',
    '📢 Broadcast Msg',
    '🔙 Back to User Menu',
  ];

  if (topCommands.includes(text) && user.state) {
    user.state = null;
    user.stateData = {};
  }

  // Handle Multi-Step Stateful Input
  if (user.state) {
    const state = user.state;

    // 1. User submitting a Gmail account to SELL for ₹ reward
    if (state === 'AWAITING_SELL_GMAIL_SUBMISSION') {
      const parts = text.includes('|')
        ? text.split('|').map((s) => s.trim())
        : text.split(':').map((s) => s.trim());

      const email = (parts[0] || '').toLowerCase();
      const password = parts[1] || '';
      const recoveryInfo = parts.slice(2).join(' ') || 'No Recovery / 2FA Off';

      if (!email.endsWith('@gmail.com') || password.length < 5) {
        replies.push({
          text:
            `⚠️ <b>Invalid Submission Format!</b>\n` +
            `Please send the Gmail address, password, and recovery/2FA info:\n\n` +
            `<code>mez.sell99@gmail.com | Pass#1234 | No Recovery</code>\n` +
            `<i>or</i>\n` +
            `<code>mez.sell99@gmail.com:Pass#1234:NoRecovery</code>`,
          inlineKeyboard: CANCEL_INLINE,
        });
        return { kv, replies, keyboardMode };
      }

      const subId = `SELL-${Math.floor(100000 + Math.random() * 900000)}`;
      const reward = Number(config.sellGmailReward) || 10;
      const newSub = {
        id: subId,
        userId: activeUserId,
        sellerName: user.firstName,
        email,
        password,
        recoveryInfo,
        reward,
        status: 'pending' as const,
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      };

      kv['index:submissions'].unshift(newSub);
      user.state = null;
      user.stateData = {};

      replies.push({
        text:
          `✅ <b>Gmail Submitted for Admin Review!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🆔 <b>Submission ID:</b> <code>#${subId}</code>\n` +
          `📧 <b>Gmail Account:</b> <code>${email}</code>\n` +
          `🛡️ <b>Recovery/2FA Status:</b> <code>${recoveryInfo}</code>\n` +
          `💵 <b>Reward on Approval:</b> <b><code>+${formatINR(reward)}</code></b>\n\n` +
          `⏳ <i>An instant review card has been sent to our Admins!</i>`,
      });

      // Also display the Instant Admin Approval Card in simulator so it can be approved right away
      replies.push({
        text:
          `📤 <b>[Admin Alert] New Sell Gmail Submission — Review</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🆔 <b>Submission ID:</b> <code>#${subId}</code>\n` +
          `👤 <b>Seller:</b> ${user.firstName} (<code>${activeUserId}</code>)\n` +
          `📧 <b>Email:</b> <code>${email}</code>\n` +
          `🔑 <b>Password:</b> <code>${password}</code>\n` +
          `🛡️ <b>Recovery / 2FA:</b> <code>${recoveryInfo}</code>\n` +
          `💵 <b>Payout Amount:</b> <b><code>${formatINR(reward)}</code></b>\n\n` +
          `👇 <i>Admin Action: Click Approve to credit ${formatINR(reward)} to the seller's wallet:</i>`,
        inlineKeyboard: [
          [
            {
              text: `✅ Approve & Pay User (${formatINR(reward)})`,
              callback_data: `sell_approve:${subId}`,
            },
            { text: '❌ Reject', callback_data: `sell_reject:${subId}` },
          ],
        ],
      });

      return {
        kv,
        replies,
        keyboardMode,
        callbackNotice: `Sell Submission #${subId} sent to Admin`,
      };
    }

    // 2. User uploading UPI Payment Screenshot for BUY order
    if (state === 'AWAITING_PAYMENT_SCREENSHOT') {
      const pendingOrder = user.stateData || {};
      if (!isSimulatedScreenshot && text.length < 4) {
        replies.push({
          text:
            `⚠️ <b>Payment Screenshot Required!</b>\n` +
            `Click the <b>"📸 Upload Screenshot"</b> button in the simulator bar or enter your 12-digit UPI UTR reference number:`,
          inlineKeyboard: CANCEL_INLINE,
        });
        return { kv, replies, keyboardMode };
      }

      const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
      const category = (pendingOrder.category || 'standard') as 'standard' | 'twofa' | 'aged';
      const newOrder = {
        id: orderId,
        userId: activeUserId,
        buyerName: user.firstName,
        category,
        categoryTitle: pendingOrder.categoryTitle || '📩 Standard Fresh Gmail',
        quantity: Number(pendingOrder.quantity || 1),
        unitPrice: Number(pendingOrder.unitPrice || config.standardGmailPrice),
        totalAmount: Number(pendingOrder.totalAmount || config.standardGmailPrice),
        screenshotRef: isSimulatedScreenshot
          ? `UPI Screenshot Photo (${text || 'UTR: 631588920144'})`
          : `UPI Payment Proof (${text})`,
        status: 'pending' as const,
        accounts: [],
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      };

      kv['index:orders'].unshift(newOrder);
      user.state = null;
      user.stateData = {};

      replies.push({
        text:
          `✅ <b>Payment Proof Submitted Successfully!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🆔 <b>Order ID:</b> <code>#${orderId}</code>\n` +
          `📦 <b>Item:</b> ${newOrder.categoryTitle}\n` +
          `🔢 <b>Quantity:</b> <code>${newOrder.quantity} Gmail(s)</code>\n` +
          `💰 <b>Total Paid:</b> <code>${formatINR(newOrder.totalAmount)}</code>\n` +
          `🧾 <b>Proof:</b> <code>${newOrder.screenshotRef}</code>\n\n` +
          `⏳ <i>An instant approval alert card with your screenshot has been sent to the Admin!</i>`,
      });

      replies.push({
        text:
          `🚨 <b>[Admin Alert] New Gmail Purchase — Payment Verification</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🆔 <b>Order ID:</b> <code>#${orderId}</code>\n` +
          `👤 <b>Buyer:</b> ${user.firstName} (<code>${activeUserId}</code>)\n` +
          `📦 <b>Category:</b> ${newOrder.categoryTitle}\n` +
          `🔢 <b>Quantity:</b> <code>${newOrder.quantity} Account(s)</code>\n` +
          `💰 <b>Amount Paid:</b> <code>${formatINR(newOrder.totalAmount)}</code>\n` +
          `🧾 <b>Screenshot / UTR:</b> <code>${newOrder.screenshotRef}</code>\n\n` +
          `👇 <i>Admin Action: Click Approve to automatically deduct stock from MEZ_KV and dispatch Gmail credentials:</i>`,
        inlineKeyboard: [
          [
            { text: '✅ Approve & Dispatch Stock', callback_data: `order_approve:${orderId}` },
            { text: '❌ Reject', callback_data: `order_reject:${orderId}` },
          ],
        ],
      });

      return {
        kv,
        replies,
        keyboardMode,
        callbackNotice: `Buy Order #${orderId} submitted for Admin verification`,
      };
    }

    // 3. User entering custom quantity to buy
    if (state === 'AWAITING_CUSTOM_BUY_QTY') {
      const category = (user.stateData?.category || 'standard') as 'standard' | 'twofa' | 'aged';
      const qty = parseInt(text, 10);
      const available = (stock[category] || []).length;

      if (isNaN(qty) || qty < 1) {
        replies.push({
          text: `⚠️ Please enter a valid quantity (1 or more).`,
          inlineKeyboard: CANCEL_INLINE,
        });
        return { kv, replies, keyboardMode };
      }
      if (qty > available) {
        replies.push({
          text: `⚠️ Only <code>${available}</code> account(s) currently available in stock for this category.`,
          inlineKeyboard: CANCEL_INLINE,
        });
        return { kv, replies, keyboardMode };
      }

      const catInfo = STOCK_CATEGORIES_META[category];
      const unitPrice = Number(config[catInfo.priceKey]);
      const totalAmount = Number((unitPrice * qty).toFixed(2));

      user.state = 'AWAITING_PAYMENT_SCREENSHOT';
      user.stateData = {
        category,
        categoryTitle: catInfo.title,
        quantity: qty,
        unitPrice,
        totalAmount,
      };

      replies.push({
        text:
          `🧾 <b>UPI Payment Invoice — ${BOT_DISPLAY_NAME}</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📦 <b>Selected Category:</b> ${catInfo.title}\n` +
          `🔢 <b>Quantity:</b> <code>${qty} Gmail Account(s)</code>\n` +
          `🏷️ <b>Rate per Gmail:</b> <code>${formatINR(unitPrice)}</code>\n` +
          `💰 <b>Total Payable Amount:</b> <b><code>${formatINR(totalAmount)}</code></b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🏦 <b>Pay via Any UPI App (GPay / PhonePe / Paytm):</b>\n` +
          `📲 <b>Merchant UPI ID:</b> <code>${config.upiId}</code>\n` +
          `🏢 <b>Payee Name:</b> <code>${config.upiMerchantName}</code>\n\n` +
          `📸 <b>Next Step:</b> Complete the payment of <b>${formatINR(totalAmount)}</b> and click <b>"📸 Upload Screenshot"</b> below (or send UTR)!`,
        showUpiQrCard: {
          upiId: config.upiId,
          merchantName: config.upiMerchantName,
          amount: totalAmount,
        },
        inlineKeyboard: [
          [
            {
              text: '💰 Pay Instantly from Wallet Balance',
              callback_data: `pay_wallet:${category}:${qty}`,
            },
          ],
          [{ text: '❌ Cancel Order', callback_data: 'cancel_state' }],
        ],
      });
      return { kv, replies, keyboardMode };
    }

    // 4. User setting their UPI ID
    if (state === 'AWAITING_USER_UPI_ID') {
      if (!text.includes('@') || text.length < 5 || text.includes(' ')) {
        replies.push({
          text:
            `⚠️ <b>Invalid UPI ID Format!</b>\n` +
            `Please enter a valid UPI ID containing <code>@</code> (e.g., <code>aarav@paytm</code>, <code>user@oksbi</code>, or <code>9876543210@ybl</code>):`,
          inlineKeyboard: CANCEL_INLINE,
        });
        return { kv, replies, keyboardMode };
      }
      user.upiId = text.toLowerCase();
      user.state = null;
      user.stateData = {};

      replies.push({
        text:
          `✅ <b>UPI ID Linked Successfully!</b>\n` +
          `All your ₹ withdrawals will now be sent to:\n<code>${user.upiId}</code>`,
      });
      return { kv, replies, keyboardMode };
    }

    // 5. User entering UPI withdrawal amount in ₹
    if (state === 'AWAITING_UPI_WITHDRAW_AMOUNT') {
      const amount = Number(text);
      if (isNaN(amount) || amount <= 0) {
        replies.push({
          text: `⚠️ Please enter a valid numeric withdrawal amount in Rupees (₹).`,
          inlineKeyboard: CANCEL_INLINE,
        });
        return { kv, replies, keyboardMode };
      }
      if (amount < config.minWithdrawal) {
        replies.push({
          text: `⚠️ Minimum UPI withdrawal threshold is <code>${formatINR(config.minWithdrawal)}</code>.`,
          inlineKeyboard: CANCEL_INLINE,
        });
        return { kv, replies, keyboardMode };
      }
      if (amount > user.balance) {
        replies.push({
          text: `⚠️ Insufficient balance! Your available balance is <code>${formatINR(user.balance)}</code>.`,
          inlineKeyboard: CANCEL_INLINE,
        });
        return { kv, replies, keyboardMode };
      }

      user.balance = Number((user.balance - amount).toFixed(2));
      user.state = null;

      const payoutId = `UPI-${Math.floor(100000 + Math.random() * 900000)}`;
      kv['index:payouts'].unshift({
        id: payoutId,
        userId: activeUserId,
        firstName: user.firstName,
        amount,
        upiId: user.upiId,
        status: 'pending',
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      });

      replies.push({
        text:
          `✅ <b>UPI Withdrawal Request Submitted!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🆔 <b>Ticket ID:</b> <code>#${payoutId}</code>\n` +
          `💵 <b>Amount:</b> <code>${formatINR(amount)}</code>\n` +
          `📲 <b>Receiving UPI ID:</b> <code>${user.upiId}</code>\n\n` +
          `<i>Admins can review and mark this paid inside 🛡️ Admin Panel → 💳 Manage Payouts.</i>`,
      });
      return { kv, replies, keyboardMode };
    }

    // 6. User claiming a Rupees Redeem Code
    if (state === 'AWAITING_REDEEM_CLAIM') {
      const codeKey = text.toUpperCase().trim();
      const item = kv['config:redeem_codes'][codeKey];
      if (!item) {
        replies.push({
          text: `❌ <b>Invalid Redeem Code!</b> Try <code>BHARAT50</code> or <code>MEZ25</code>, or create a new code in the Admin Panel.`,
          inlineKeyboard: CANCEL_INLINE,
        });
        return { kv, replies, keyboardMode };
      }
      if (item.claimedBy.includes(activeUserId)) {
        user.state = null;
        replies.push({
          text: `⚠️ You have already claimed code <code>${codeKey}</code>!`,
        });
        return { kv, replies, keyboardMode };
      }
      if (item.claimedCount >= item.maxClaims) {
        user.state = null;
        replies.push({
          text: `⌛ Code <code>${codeKey}</code> has reached its maximum claim limit!`,
        });
        return { kv, replies, keyboardMode };
      }

      item.claimedCount += 1;
      item.claimedBy.push(activeUserId);
      user.balance = Number((user.balance + item.amount).toFixed(2));
      user.totalEarned = Number((user.totalEarned + item.amount).toFixed(2));
      user.state = null;

      replies.push({
        text:
          `🎉 <b>Promo Code Redeemed!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🎟️ <b>Code:</b> <code>${codeKey}</code>\n` +
          `💵 <b>Bonus Credited:</b> <code>+${formatINR(item.amount)}</code>\n` +
          `💰 <b>New Wallet Balance:</b> <code>${formatINR(user.balance)}</code>`,
      });
      return { kv, replies, keyboardMode };
    }

    // 7. Admin adding Gmail Stock lines
    if (isAdmin && state === 'AWAITING_STOCK_LINES') {
      const category = (user.stateData?.category || 'standard') as 'standard' | 'twofa' | 'aged';
      const rawLines = text
        .split(/\r?\n|,/)
        .map((l) => l.trim())
        .filter((l) => l.includes('@') && l.includes(':'));

      if (rawLines.length === 0) {
        replies.push({
          text:
            `⚠️ <b>Invalid Stock Format!</b>\nSend one or more Gmail credentials in <code>email:password</code> format:\n` +
            `<code>fresh.mail99@gmail.com:MezPass#123</code>`,
          inlineKeyboard: CANCEL_INLINE,
        });
        return { kv, replies, keyboardMode: 'admin' };
      }

      stock[category].push(...rawLines);
      user.state = null;
      user.stateData = {};
      const catInfo = STOCK_CATEGORIES_META[category];

      replies.push({
        text:
          `✅ <b>Gmail Stock Added to MEZ_KV!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📦 <b>Category:</b> ${catInfo.title}\n` +
          `➕ <b>Added Now:</b> <code>${rawLines.length} account(s)</code>\n` +
          `📊 <b>Updated Category Stock:</b> <code>${stock[category].length} account(s)</code>`,
      });
      return { kv, replies, keyboardMode: 'admin' };
    }

    // 8. Admin updating UPI QR Code & UPI ID
    if (isAdmin && state === 'AWAITING_UPI_QR_CONFIG') {
      const parts = text.split('|').map((s) => s.trim());
      if (parts[0] && parts[0].includes('@')) {
        config.upiId = parts[0];
      }
      if (parts[1]) {
        config.upiMerchantName = parts[1];
      }
      if (isSimulatedScreenshot) {
        config.upiQrFileId = `QR_FILE_${Date.now()}`;
      }
      config.updatedAt = new Date().toISOString();
      user.state = null;

      replies.push({
        text:
          `✅ <b>Admin UPI QR & Payment Details Saved in MEZ_KV!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📲 <b>Merchant UPI ID:</b> <code>${config.upiId}</code>\n` +
          `🏢 <b>Merchant Name:</b> <code>${config.upiMerchantName}</code>\n` +
          `🖼️ <b>QR Code Image:</b> <b>✅ Active & Displayed on Checkout</b>`,
      });
      return { kv, replies, keyboardMode: 'admin' };
    }

    // 9. Admin updating Rupees (₹) rates
    if (isAdmin && state === 'AWAITING_RATE_VALUE') {
      const field = user.stateData?.field as keyof typeof config;
      const val = Number(text);
      if (isNaN(val) || val < 0) {
        replies.push({
          text: `⚠️ Please enter a valid non-negative amount in Rupees (₹) (e.g. <code>20</code>).`,
          inlineKeyboard: CANCEL_INLINE,
        });
        return { kv, replies, keyboardMode: 'admin' };
      }
      (config as any)[field] = val;
      config.updatedAt = new Date().toISOString();
      user.state = null;
      user.stateData = {};

      replies.push({
        text:
          `✅ <b>Rate Updated in MEZ_KV!</b>\n` +
          `Parameter <code>${String(field)}</code> is now set to <b>${formatINR(val)}</b>.`,
      });
      return { kv, replies, keyboardMode: 'admin' };
    }

    // 10. Admin adding Force Channel
    if (isAdmin && state === 'AWAITING_NEW_FORCE_CHANNEL') {
      const parts = text.split('|').map((s) => s.trim());
      const rawUsername = parts[0] || '';
      if (!rawUsername.startsWith('@')) {
        replies.push({
          text:
            `⚠️ Channel username must start with <code>@</code>.\n` +
            `Example: <code>@MEZ_OFFERS | MEZ Deals | https://t.me/MEZ_OFFERS</code>`,
          inlineKeyboard: CANCEL_INLINE,
        });
        return { kv, replies, keyboardMode: 'admin' };
      }
      const title = parts[1] || rawUsername;
      const inviteLink = parts[2] || `https://t.me/${rawUsername.replace(/^@/, '')}`;
      kv['config:channels'] = kv['config:channels'].filter(
        (c) => c.username.toLowerCase() !== rawUsername.toLowerCase()
      );
      kv['config:channels'].push({
        username: rawUsername,
        title,
        inviteLink,
        addedAt: new Date().toISOString(),
      });
      user.state = null;

      replies.push({
        text:
          `✅ <b>Force-Join Channel Added!</b>\n` +
          `• <b>Title:</b> ${title}\n` +
          `• <b>Username:</b> <code>${rawUsername}</code>`,
      });
      return { kv, replies, keyboardMode: 'admin' };
    }

    // 11. Admin creating Rupees Redeem Code
    if (isAdmin && state === 'AWAITING_NEW_REDEEM_CODE') {
      const parts = text.split('|').map((s) => s.trim());
      const codeName = (parts[0] || '').toUpperCase();
      const amount = Number(parts[1]);
      const maxClaims = Number(parts[2] || 10);

      if (!codeName || isNaN(amount) || amount <= 0 || isNaN(maxClaims) || maxClaims < 1) {
        replies.push({
          text:
            `⚠️ Format: <code>CODE_NAME | AMOUNT_INR | MAX_CLAIMS</code>\n` +
            `Example: <code>DHAMAKA100 | 100 | 20</code>`,
          inlineKeyboard: CANCEL_INLINE,
        });
        return { kv, replies, keyboardMode: 'admin' };
      }

      kv['config:redeem_codes'][codeName] = {
        code: codeName,
        amount,
        maxClaims,
        claimedCount: 0,
        claimedBy: [],
        createdBy: activeUserId,
        createdAt: new Date().toISOString(),
      };
      user.state = null;

      replies.push({
        text:
          `🎟️ <b>Rupees Redeem Code Created!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `• <b>Code:</b> <code>${codeName}</code>\n` +
          `• <b>Reward:</b> <code>${formatINR(amount)}</code>\n` +
          `• <b>Max Claims:</b> <code>${maxClaims} users</code>`,
      });
      return { kv, replies, keyboardMode: 'admin' };
    }

    // 12. Admin adding new Admin ID
    if (isAdmin && state === 'AWAITING_NEW_ADMIN_ID') {
      const newAdminId = Number(text);
      if (isNaN(newAdminId) || newAdminId < 10000) {
        replies.push({
          text: `⚠️ Please enter a valid numeric Telegram User ID (e.g. <code>5192048112</code>).`,
          inlineKeyboard: CANCEL_INLINE,
        });
        return { kv, replies, keyboardMode: 'admin' };
      }
      if (!kv['config:admins'].includes(newAdminId)) {
        kv['config:admins'].push(newAdminId);
      }
      user.state = null;
      replies.push({
        text: `✅ <b>Admin Authorized!</b>\nUser ID <code>${newAdminId}</code> now has full access to the 🛡️ Admin Panel.`,
      });
      return { kv, replies, keyboardMode: 'admin' };
    }

    // 13. Admin adjusting user ₹ balance
    if (isAdmin && state === 'AWAITING_BALANCE_ADJUSTMENT') {
      const parts = text.split('|').map((s) => s.trim());
      const targetId = Number(parts[0]);
      const delta = Number(parts[1]);

      if (isNaN(targetId) || isNaN(delta)) {
        replies.push({
          text: `⚠️ Format: <code>USER_ID | AMOUNT_INR</code>\nExample: <code>${activeUserId} | 200</code>`,
          inlineKeyboard: CANCEL_INLINE,
        });
        return { kv, replies, keyboardMode: 'admin' };
      }

      const targetUser = kv.users[targetId];
      if (!targetUser) {
        replies.push({
          text: `❌ User ID <code>${targetId}</code> not found in MEZ_KV.`,
          inlineKeyboard: CANCEL_INLINE,
        });
        return { kv, replies, keyboardMode: 'admin' };
      }

      targetUser.balance = Math.max(0, Number((targetUser.balance + delta).toFixed(2)));
      if (delta > 0) {
        targetUser.totalEarned = Number((targetUser.totalEarned + delta).toFixed(2));
      }
      user.state = null;

      replies.push({
        text:
          `✅ <b>User ₹ Balance Adjusted!</b>\n` +
          `👤 <b>User:</b> ${targetUser.firstName} (<code>${targetId}</code>)\n` +
          `💰 <b>Updated Balance:</b> <code>${formatINR(targetUser.balance)}</code>`,
      });
      return { kv, replies, keyboardMode: 'admin' };
    }

    // 14. Admin broadcasting message
    if (isAdmin && state === 'AWAITING_BROADCAST_MESSAGE') {
      const totalUsers = kv['index:users'].length;
      user.state = null;

      replies.push({
        text:
          `📢 <b>Official Update — ${BOT_DISPLAY_NAME}</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${text}`,
      });
      replies.push({
        text:
          `✅ <b>Broadcast Completed!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👥 <b>Total Targeted:</b> <code>${totalUsers}</code>\n` +
          `✅ <b>Delivered:</b> <code>${totalUsers}</code>\n` +
          `❌ <b>Failed / Blocked:</b> <code>0</code>`,
      });
      return { kv, replies, keyboardMode: 'admin' };
    }
  }

  // --------------------------------------------------------------------------
  // USER MAIN MENU COMMANDS
  // --------------------------------------------------------------------------
  if (text.startsWith('/start') || text === '🔙 Back to User Menu') {
    keyboardMode = 'user';
    const totalStock =
      stock.standard.length + stock.twofa.length + stock.aged.length;

    replies.push({
      text:
        `✨ <b>Welcome to ${BOT_DISPLAY_NAME} — Buy & Sell Gmail Hub</b> ✨\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👋 Namaste <b>${user.firstName}</b>! Buy verified Gmail stock or sell your Gmail accounts for instant Indian Rupees (₹) via UPI.\n\n` +
        `🛒 <b>Buy Gmail Stock:</b> <code>${totalStock} Available</code> (From <code>${formatINR(config.standardGmailPrice)}</code>)\n` +
        `📤 <b>Sell Your Gmail:</b> Earn <code>${formatINR(config.sellGmailReward)} / account</code>\n` +
        `👥 <b>Referral Bonus:</b> <code>${formatINR(config.referralBonus)} / friend</code>\n` +
        `🏦 <b>Min. UPI Withdrawal:</b> <code>${formatINR(config.minWithdrawal)}</code>\n` +
        `💬 <b>Support Group:</b> <a href="${SUPPORT_GROUP_URL}">${SUPPORT_GROUP_URL}</a>\n\n` +
        `👇 <i>Choose an option from the menu below:</i>`,
    });
    return { kv, replies, keyboardMode };
  }

  // 🛒 Buy Gmail
  if (text === '🛒 Buy Gmail') {
    replies.push({
      text:
        `🛒 <b>${BOT_DISPLAY_NAME} — Live Gmail Marketplace</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Select a Gmail category below to purchase via <b>UPI QR / UPI ID</b> or Wallet Balance:\n\n` +
        `1️⃣ <b>${STOCK_CATEGORIES_META.standard.title}</b>\n` +
        `   • Price: <code>${formatINR(config.standardGmailPrice)} / account</code>\n` +
        `   • Live Stock: <code>${stock.standard.length} available</code>\n\n` +
        `2️⃣ <b>${STOCK_CATEGORIES_META.twofa.title}</b>\n` +
        `   • Price: <code>${formatINR(config.twofaGmailPrice)} / account</code>\n` +
        `   • Live Stock: <code>${stock.twofa.length} available</code>\n\n` +
        `3️⃣ <b>${STOCK_CATEGORIES_META.aged.title}</b>\n` +
        `   • Price: <code>${formatINR(config.agedGmailPrice)} / account</code>\n` +
        `   • Live Stock: <code>${stock.aged.length} available</code>\n\n` +
        `💳 <b>Payment Mode:</b> Instant UPI QR & Screenshot Verification`,
      inlineKeyboard: [
        [
          {
            text: `📩 Buy Standard (${formatINR(config.standardGmailPrice)} • Stock: ${stock.standard.length})`,
            callback_data: 'buy_cat:standard',
          },
        ],
        [
          {
            text: `🔐 Buy 2FA Gmail (${formatINR(config.twofaGmailPrice)} • Stock: ${stock.twofa.length})`,
            callback_data: 'buy_cat:twofa',
          },
        ],
        [
          {
            text: `💎 Buy Aged Gmail (${formatINR(config.agedGmailPrice)} • Stock: ${stock.aged.length})`,
            callback_data: 'buy_cat:aged',
          },
        ],
      ],
    });
    return { kv, replies, keyboardMode };
  }

  // 📤 Sell Gmail
  if (text === '📤 Sell Gmail') {
    const suggestedUser = `mez.sell.${Math.floor(10000 + Math.random() * 90000)}@gmail.com`;
    const suggestedPass = `Mez#${Math.floor(1000 + Math.random() * 9000)}@`;

    replies.push({
      text:
        `📤 <b>Sell Gmail Accounts & Earn Rupees (₹)</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Submit your fresh or unlinked Gmail accounts below. Once verified by our Admin team, your wallet is credited automatically!\n\n` +
        `💵 <b>Reward per Approved Gmail:</b> <b><code>${formatINR(config.sellGmailReward)}</code></b>\n` +
        `📧 <b>Suggested Email:</b> <code>${suggestedUser}</code>\n` +
        `🔑 <b>Suggested Password:</b> <code>${suggestedPass}</code>\n\n` +
        `📋 <b>Submission Requirements:</b>\n` +
        `• Provide Email, Password, and Recovery/2FA status.\n` +
        `• Remove any personal phone numbers before submitting.\n\n` +
        `👇 <i>Click the button below to submit your Gmail account details:</i>`,
      inlineKeyboard: [
        [
          {
            text: `📤 Submit Gmail to Sell (+${formatINR(config.sellGmailReward)})`,
            callback_data: 'start_sell_gmail',
          },
        ],
        [
          {
            text: '🔄 Generate New Suggested Credentials',
            callback_data: 'regen_sell_suggestion',
          },
        ],
      ],
    });
    return { kv, replies, keyboardMode };
  }

  // 📂 My Orders / Submissions
  if (text === '📂 My Orders / Submissions') {
    const myOrders = kv['index:orders'].filter((o) => o.userId === activeUserId);
    const mySubs = kv['index:submissions'].filter((s) => s.userId === activeUserId);

    if (myOrders.length === 0 && mySubs.length === 0) {
      replies.push({
        text:
          `📂 <b>My Buy Orders & Sell Submissions</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `You have no Buy Orders or Sell Gmail Submissions yet.\n\n` +
          `• Click <b>🛒 Buy Gmail</b> to purchase stock accounts.\n` +
          `• Click <b>📤 Sell Gmail</b> to submit accounts and earn <code>${formatINR(config.sellGmailReward)}</code> each!`,
      });
    } else {
      const buySection =
        myOrders.length === 0
          ? '<i>No Gmail purchase orders yet.</i>'
          : myOrders
              .slice(0, 5)
              .map((ord, idx) => {
                const badge =
                  ord.status === 'approved'
                    ? '✅ Approved & Dispatched'
                    : ord.status === 'rejected'
                    ? '❌ Rejected'
                    : '⏳ Pending Verification';
                const creds =
                  ord.accounts && ord.accounts.length > 0
                    ? `\n   🔑 <b>Credentials:</b>\n` +
                      ord.accounts.map((c) => `   <code>${c}</code>`).join('\n')
                    : '';
                return (
                  `${idx + 1}. <b>Buy #${ord.id}</b> (${ord.categoryTitle})\n` +
                  `   • Qty: <code>${ord.quantity}</code> | Paid: <code>${formatINR(ord.totalAmount)}</code> | ${badge}${creds}`
                );
              })
              .join('\n\n');

      const sellSection =
        mySubs.length === 0
          ? '<i>No Sell Gmail submissions yet.</i>'
          : mySubs
              .slice(0, 5)
              .map((sub, idx) => {
                const badge =
                  sub.status === 'approved'
                    ? `✅ Approved (+${formatINR(sub.reward)})`
                    : sub.status === 'rejected'
                    ? '❌ Rejected'
                    : '⏳ Pending Admin Review';
                return (
                  `${idx + 1}. <b>Sell #${sub.id}</b> — <code>${sub.email}</code>\n` +
                  `   • Reward: <code>${formatINR(sub.reward)}</code> | Status: ${badge}`
                );
              })
              .join('\n\n');

      replies.push({
        text:
          `📂 <b>My Activity History</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🛒 <b>Recent Buy Orders (${myOrders.length}):</b>\n${buySection}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📤 <b>Recent Sell Submissions (${mySubs.length}):</b>\n${sellSection}`,
      });
    }
    return { kv, replies, keyboardMode };
  }

  // 💰 Balance / Deposit
  if (text === '💰 Balance / Deposit') {
    const wdBadge = config.withdrawalsEnabled ? '🟢 Active (UPI)' : '🔴 Temporarily Paused';
    replies.push({
      text:
        `💰 <b>Your Rupees Wallet & UPI Payouts</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>User:</b> ${user.firstName} (<code>${user.id}</code>)\n` +
        `💵 <b>Available Balance:</b> <b><code>${formatINR(user.balance)}</code></b>\n` +
        `📈 <b>Total Earned (Sold Gmails & Refs):</b> <code>${formatINR(user.totalEarned)}</code>\n` +
        `📤 <b>Approved Sold Gmails:</b> <code>${user.soldMailsCount || 0} accounts</code>\n` +
        `🛒 <b>Purchased Stock Gmails:</b> <code>${user.purchasedCount} accounts (${formatINR(user.totalSpent)})</code>\n` +
        `🏦 <b>Total Withdrawn (UPI):</b> <code>${formatINR(user.totalWithdrawn)}</code>\n` +
        `📲 <b>Saved UPI ID:</b> <code>${user.upiId || 'Not Linked'}</code>\n` +
        `⭕ <b>UPI Withdrawals:</b> ${wdBadge}\n` +
        `📉 <b>Min. UPI Withdrawal:</b> <code>${formatINR(config.minWithdrawal)}</code>`,
      inlineKeyboard: [
        [{ text: '💸 Withdraw Balance to UPI', callback_data: 'request_upi_withdrawal' }],
        [{ text: '📲 Set / Update My UPI ID', callback_data: 'set_user_upi' }],
        [
          { text: '🛒 Buy Gmail', callback_data: 'buy_cat:standard' },
          { text: '📤 Sell Gmail', callback_data: 'start_sell_gmail' },
        ],
      ],
    });
    return { kv, replies, keyboardMode };
  }

  // 👥 Referrals
  if (text === '👥 Referrals') {
    const refLink = `https://t.me/MEZ_MAILS_BOT?start=ref_${user.id}`;
    replies.push({
      text:
        `👥 <b>Refer & Earn Indian Rupees (₹)</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Invite friends to <b>${BOT_DISPLAY_NAME}</b> and earn instant Rupees directly in your wallet!\n\n` +
        `🎁 <b>Per Referral Bonus:</b> <code>${formatINR(config.referralBonus)}</code>\n` +
        `👤 <b>Total Referrals:</b> <code>${user.referralsCount} Users</code>\n` +
        `💵 <b>Total Referral Earnings:</b> <code>${formatINR(user.referralsCount * config.referralBonus)}</code>\n\n` +
        `🔗 <b>Your Personal Invite Link:</b>\n<code>${refLink}</code>`,
    });
    return { kv, replies, keyboardMode };
  }

  // 🎁 Rewards
  if (text === '🎁 Rewards') {
    replies.push({
      text:
        `🎁 <b>Daily Rewards & Promo Redeem Center</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Claim your daily ₹ check-in bonus or redeem special gift codes shared in our official channel!\n\n` +
        `🎯 <b>Daily Check-In Bonus:</b> <code>${formatINR(config.dailyBonus)}</code>\n` +
        `🎟️ <b>Active Sample Codes:</b> <code>BHARAT50</code> (₹50) · <code>MEZ25</code> (₹25)`,
      inlineKeyboard: [
        [
          {
            text: `📅 Claim Daily Bonus (${formatINR(config.dailyBonus)})`,
            callback_data: 'claim_daily_bonus',
          },
        ],
        [{ text: '🎟️ Enter Promo Redeem Code', callback_data: 'enter_redeem_code' }],
      ],
    });
    return { kv, replies, keyboardMode };
  }

  // ⚙️ Settings
  if (text === '⚙️ Settings') {
    replies.push({
      text:
        `⚙️ <b>Account & UPI Payout Settings</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 <b>Telegram ID:</b> <code>${user.id}</code>\n` +
        `📲 <b>Linked UPI ID:</b> <code>${user.upiId || 'Not Set (Click below to link)'}</code>\n` +
        `🔔 <b>Order & Submission Alerts:</b> ${user.notifications ? '🟢 Enabled' : '🔴 Muted'}\n` +
        `💱 <b>Account Currency:</b> <code>Indian Rupees (₹ / INR)</code>`,
      inlineKeyboard: [
        [
          {
            text: '📲 Link / Update UPI ID (Paytm, PhonePe, GPay)',
            callback_data: 'set_user_upi',
          },
        ],
        [
          {
            text: user.notifications ? '🔕 Mute Bot Notifications' : '🔔 Enable Bot Notifications',
            callback_data: 'toggle_notifications',
          },
        ],
      ],
    });
    return { kv, replies, keyboardMode };
  }

  // ❓ Help
  if (text === '❓ Help') {
    replies.push({
      text:
        `❓ <b>Help & Official Support Guide</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<b>1️⃣ How to Sell Gmail Accounts (📤 Sell Gmail):</b>\n` +
        `• Click <b>📤 Sell Gmail</b> and submit the Gmail address, password, and recovery/2FA info.\n` +
        `• Admin reviews your submission and clicks <b>✅ Approve & Pay User</b>, crediting <code>${formatINR(config.sellGmailReward)}</code> to your wallet!\n\n` +
        `<b>2️⃣ How to Buy Gmail Stock (🛒 Buy Gmail):</b>\n` +
        `• Choose a category, select quantity, pay via the displayed <b>UPI QR Code / UPI ID</b>, and upload your <b>Payment Screenshot</b>.\n` +
        `• Admin approves and the bot dispatches your credentials automatically!\n\n` +
        `💬 <b>Official Support Group:</b>\n<a href="${SUPPORT_GROUP_URL}">${SUPPORT_GROUP_URL}</a>`,
      inlineKeyboard: [[{ text: '💬 Join Official Support Group', url: SUPPORT_GROUP_URL }]],
    });
    return { kv, replies, keyboardMode };
  }

  // --------------------------------------------------------------------------
  // ENHANCED 7-ROW ADMIN PANEL
  // --------------------------------------------------------------------------
  if (text === '🛡️ Admin Panel' || text === '/admin') {
    if (!isAdmin) {
      replies.push({
        text: `⛔ <b>Access Denied:</b> Only Super Admin (<code>${SUPER_ADMIN_ID}</code>) and authorized admins can open the Admin Panel.`,
      });
      return { kv, replies, keyboardMode: 'user' };
    }

    keyboardMode = 'admin';
    const pendingPayouts = kv['index:payouts'].filter((p) => p.status === 'pending').length;
    const pendingOrders = kv['index:orders'].filter((o) => o.status === 'pending').length;
    const pendingSubs = kv['index:submissions'].filter((s) => s.status === 'pending').length;
    const totalStock =
      stock.standard.length + stock.twofa.length + stock.aged.length;

    replies.push({
      text:
        `🛡️ <b>${BOT_DISPLAY_NAME} — Executive Admin Control</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👋 Welcome, Administrator (<code>${activeUserId}</code>)!\n` +
        `Role: <b>${activeUserId === SUPER_ADMIN_ID ? '👑 Super Admin' : '🛡️ Authorized Admin'}</b>\n\n` +
        `📊 <b>Live Queues & Stock Inventory:</b>\n` +
        `• 🛒 Buy Stock Available: <code>${totalStock}</code> (Std: ${stock.standard.length} | 2FA: ${stock.twofa.length} | Aged: ${stock.aged.length})\n` +
        `• 📤 Pending Sell Submissions: <code>${pendingSubs} awaiting review</code>\n` +
        `• 🧾 Pending Buy Orders: <code>${pendingOrders} awaiting verification</code>\n` +
        `• 💸 Pending UPI Payouts: <code>${pendingPayouts} requests</code>\n` +
        `• 👥 Total Users: <code>${kv['index:users'].length}</code>\n\n` +
        `💳 <b>Active Rates & UPI Settings (₹):</b>\n` +
        `• 📤 Sell Gmail Reward: <code>${formatINR(config.sellGmailReward)}</code>\n` +
        `• 🛒 Buy Prices: Std <code>${formatINR(config.standardGmailPrice)}</code> | 2FA <code>${formatINR(config.twofaGmailPrice)}</code> | Aged <code>${formatINR(config.agedGmailPrice)}</code>\n` +
        `• 📲 Merchant UPI ID: <code>${config.upiId}</code>\n` +
        `• ⭕ UPI Withdrawals: <b>${config.withdrawalsEnabled ? '🟢 ENABLED' : '🔴 DISABLED'}</b>\n\n` +
        `👇 <i>Select a management module from the 7-row Admin Keyboard below:</i>`,
    });
    return { kv, replies, keyboardMode };
  }

  if (isAdmin) {
    // Row 1 Left: 🛒 Manage Buy Stock
    if (text === '🛒 Manage Buy Stock') {
      const pendingOrdersCount = kv['index:orders'].filter((o) => o.status === 'pending').length;
      replies.push({
        text:
          `🛒 <b>Manage Buy Stock & Purchase Orders</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Available Credentials in <code>MEZ_KV</code>:\n` +
          `• 📩 <b>Standard Gmail:</b> <code>${stock.standard.length} accounts</code> (${formatINR(config.standardGmailPrice)})\n` +
          `• 🔐 <b>2FA Verified Gmail:</b> <code>${stock.twofa.length} accounts</code> (${formatINR(config.twofaGmailPrice)})\n` +
          `• 💎 <b>Aged High-Trust Gmail:</b> <code>${stock.aged.length} accounts</code> (${formatINR(config.agedGmailPrice)})\n\n` +
          `⏳ <b>Pending Buy Orders:</b> <code>${pendingOrdersCount} awaiting approval</code>\n\n` +
          `👇 <i>Choose a category to bulk-add stock or review pending buyer screenshot orders:</i>`,
        inlineKeyboard: [
          [
            {
              text: `➕ Add Standard Stock (${stock.standard.length})`,
              callback_data: 'admin_add_stock:standard',
            },
          ],
          [
            {
              text: `➕ Add 2FA Gmail Stock (${stock.twofa.length})`,
              callback_data: 'admin_add_stock:twofa',
            },
          ],
          [
            {
              text: `➕ Add Aged Gmail Stock (${stock.aged.length})`,
              callback_data: 'admin_add_stock:aged',
            },
          ],
          [
            {
              text: `🧾 Review Pending Buy Orders (${pendingOrdersCount})`,
              callback_data: 'admin_review_orders',
            },
          ],
        ],
      });
      return { kv, replies, keyboardMode: 'admin' };
    }

    // Row 1 Right: 📤 Manage Sell Submissions
    if (text === '📤 Manage Sell Submissions') {
      const pending = kv['index:submissions'].filter((s) => s.status === 'pending');
      if (pending.length === 0) {
        replies.push({
          text:
            `📤 <b>User Sell Gmail Submissions</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ There are currently <b>0 pending Sell Gmail submissions</b> awaiting review.\n` +
            `Total Historical Submissions: <code>${kv['index:submissions'].length}</code>`,
        });
      } else {
        for (const sub of pending) {
          replies.push({
            text:
              `📤 <b>Pending Sell Submission #${sub.id}</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `👤 <b>Seller:</b> ${sub.sellerName} (<code>${sub.userId}</code>)\n` +
              `📧 <b>Gmail:</b> <code>${sub.email}</code>\n` +
              `🔑 <b>Password:</b> <code>${sub.password}</code>\n` +
              `🛡️ <b>Recovery / 2FA Info:</b> <code>${sub.recoveryInfo}</code>\n` +
              `💵 <b>Payout Reward:</b> <b><code>${formatINR(sub.reward)}</code></b>\n` +
              `🕒 <b>Submitted:</b> <code>${sub.createdAt}</code>`,
            inlineKeyboard: [
              [
                {
                  text: `✅ Approve & Pay User (${formatINR(sub.reward)})`,
                  callback_data: `sell_approve:${sub.id}`,
                },
                { text: '❌ Reject', callback_data: `sell_reject:${sub.id}` },
              ],
            ],
          });
        }
      }
      return { kv, replies, keyboardMode: 'admin' };
    }

    // Row 2 Left: 🖼️ Add/Update UPI QR
    if (text === '🖼️ Add/Update UPI QR') {
      user.state = 'AWAITING_UPI_QR_CONFIG';
      replies.push({
        text:
          `🖼️ <b>Configure Admin UPI QR Code & UPI ID</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Current Merchant UPI ID: <code>${config.upiId}</code>\n` +
          `Current Merchant Name: <code>${config.upiMerchantName}</code>\n` +
          `QR Image Status: <b>${config.upiQrFileId ? '✅ Active' : 'Not Uploaded'}</b>\n\n` +
          `Send your updated UPI ID and Merchant Name in the format:\n` +
          `<code>newmerchant@okaxis | MEZ MAILS INDIA</code>\n` +
          `<i>(Or click "📸 Upload Screenshot" in the simulator bar to upload a new QR photo!)</i>`,
        inlineKeyboard: CANCEL_INLINE,
      });
      return { kv, replies, keyboardMode: 'admin' };
    }

    // Row 2 Right: 💳 Manage Payouts
    if (text === '💳 Manage Payouts') {
      const pendingPayouts = kv['index:payouts'].filter((p) => p.status === 'pending');

      if (pendingPayouts.length === 0) {
        replies.push({
          text:
            `💳 <b>Manage UPI Withdrawal Requests</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ <b>0 Pending UPI Withdrawals</b> in queue.\n` +
            `Total Historical Payout Requests: <code>${kv['index:payouts'].length}</code>`,
        });
      } else {
        for (const item of pendingPayouts) {
          replies.push({
            text:
              `💸 <b>Pending UPI Withdrawal #${item.id}</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `👤 <b>User:</b> ${item.firstName} (<code>${item.userId}</code>)\n` +
              `💵 <b>Amount:</b> <code>${formatINR(item.amount)}</code>\n` +
              `📲 <b>User UPI ID:</b> <code>${item.upiId}</code>\n` +
              `🕒 <b>Requested:</b> <code>${item.createdAt}</code>`,
            inlineKeyboard: [
              [
                { text: '✅ Mark UPI Paid', callback_data: `payout_approve:${item.id}` },
                { text: '❌ Reject & Refund ₹', callback_data: `payout_reject:${item.id}` },
              ],
            ],
          });
        }
      }
      return { kv, replies, keyboardMode: 'admin' };
    }

    // Row 3 Left: 👥 View Users List
    if (text === '👥 View Users List') {
      const lines = kv['index:users'].map((uid) => {
        const u = kv.users[uid];
        if (!u) return '';
        return `• <b>${u.firstName}</b> (<code>${u.id}</code>) — <code>${formatINR(u.balance)}</code> | UPI: <code>${u.upiId || 'None'}</code>`;
      });
      replies.push({
        text:
          `👥 <b>Registered Users Directory (${kv['index:users'].length} Total)</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${lines.filter(Boolean).join('\n')}\n\n` +
          `💡 <i>Click below to credit or debit any user's ₹ balance in MEZ_KV:</i>`,
        inlineKeyboard: [
          [{ text: '💰 Credit / Debit User ₹ Balance', callback_data: 'admin_adjust_balance' }],
        ],
      });
      return { kv, replies, keyboardMode: 'admin' };
    }

    // Row 3 Right: ➕ Add Force Channel
    if (text === '➕ Add Force Channel') {
      user.state = 'AWAITING_NEW_FORCE_CHANNEL';
      replies.push({
        text:
          `➕ <b>Add Mandatory Force-Join Channel</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Send the channel details in the following format:\n` +
          `<code>@ChannelUsername | Channel Title | https://t.me/ChannelUsername</code>`,
        inlineKeyboard: CANCEL_INLINE,
      });
      return { kv, replies, keyboardMode: 'admin' };
    }

    // Row 4 Left: 📋 View/Remove Channels
    if (text === '📋 View/Remove Channels') {
      const chs = kv['config:channels'];
      if (chs.length === 0) {
        replies.push({
          text:
            `📋 <b>Mandatory Force-Join Channels</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `No mandatory channels are currently configured.`,
        });
      } else {
        const buttons: InlineButton[][] = chs.map((c) => [
          {
            text: `🗑️ Remove ${c.title} (${c.username})`,
            callback_data: `del_channel:${c.username}`,
          },
        ]);
        replies.push({
          text:
            `📋 <b>Active Force-Join Channels (${chs.length})</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            chs.map((c, i) => `${i + 1}. <b>${c.title}</b> — <code>${c.username}</code>`).join('\n') +
            `\n\n👇 <i>Click a channel below to remove it:</i>`,
          inlineKeyboard: buttons,
        });
      }
      return { kv, replies, keyboardMode: 'admin' };
    }

    // Row 4 Right: 🎟️ Create Redeem Code
    if (text === '🎟️ Create Redeem Code') {
      user.state = 'AWAITING_NEW_REDEEM_CODE';
      replies.push({
        text:
          `🎟️ <b>Create Rupees (₹) Redeem Code</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Send the new redeem code in the format:\n` +
          `<code>CODE_NAME | AMOUNT_INR | MAX_CLAIMS</code>\n\n` +
          `<i>Example:</i>\n` +
          `<code>DIWALI50 | 50 | 25</code>`,
        inlineKeyboard: CANCEL_INLINE,
      });
      return { kv, replies, keyboardMode: 'admin' };
    }

    // Row 5 Left: 👤 Add Admin
    if (text === '👤 Add Admin') {
      const adminButtons: InlineButton[][] = [
        [{ text: '➕ Authorize New Admin ID', callback_data: 'prompt_add_admin' }],
      ];
      for (const id of kv['config:admins']) {
        if (id !== SUPER_ADMIN_ID) {
          adminButtons.push([{ text: `🗑️ Revoke Admin ${id}`, callback_data: `revoke_admin:${id}` }]);
        }
      }

      replies.push({
        text:
          `👤 <b>Bot Administrator Management</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Authorized Admins (${kv['config:admins'].length}):\n` +
          kv['config:admins']
            .map((id) => `• <code>${id}</code> ${id === SUPER_ADMIN_ID ? '👑 <b>(Super Admin)</b>' : '🛡️ (Admin)'}`)
            .join('\n'),
        inlineKeyboard: adminButtons,
      });
      return { kv, replies, keyboardMode: 'admin' };
    }

    // Row 5 Right: 💳 Set Buy/Sell Rates
    if (text === '💳 Set Buy/Sell Rates') {
      replies.push({
        text:
          `💳 <b>Manage Buy Prices, Sell Rewards & Thresholds (₹)</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📤 <b>Sell Gmail User Reward:</b> <b><code>${formatINR(config.sellGmailReward)}</code></b>\n` +
          `📩 <b>Buy Standard Gmail Price:</b> <code>${formatINR(config.standardGmailPrice)}</code>\n` +
          `🔐 <b>Buy 2FA Gmail Price:</b> <code>${formatINR(config.twofaGmailPrice)}</code>\n` +
          `💎 <b>Buy Aged Gmail Price:</b> <code>${formatINR(config.agedGmailPrice)}</code>\n` +
          `👥 <b>Referral Bonus Rate:</b> <code>${formatINR(config.referralBonus)}</code>\n` +
          `🎁 <b>Daily Check-In Bonus:</b> <code>${formatINR(config.dailyBonus)}</code>\n` +
          `🏦 <b>Min. UPI Withdrawal:</b> <code>${formatINR(config.minWithdrawal)}</code>\n\n` +
          `👇 <i>Select a parameter below to update it in Indian Rupees (₹):</i>`,
        inlineKeyboard: [
          [
            {
              text: `📤 Sell Reward (${formatINR(config.sellGmailReward)})`,
              callback_data: 'set_rate:sellGmailReward',
            },
          ],
          [
            {
              text: `🛒 Std Buy (${formatINR(config.standardGmailPrice)})`,
              callback_data: 'set_rate:standardGmailPrice',
            },
            {
              text: `🛒 2FA Buy (${formatINR(config.twofaGmailPrice)})`,
              callback_data: 'set_rate:twofaGmailPrice',
            },
          ],
          [
            {
              text: `🛒 Aged Buy (${formatINR(config.agedGmailPrice)})`,
              callback_data: 'set_rate:agedGmailPrice',
            },
            {
              text: `👥 Referral (${formatINR(config.referralBonus)})`,
              callback_data: 'set_rate:referralBonus',
            },
          ],
          [
            {
              text: `🎁 Daily Bonus (${formatINR(config.dailyBonus)})`,
              callback_data: 'set_rate:dailyBonus',
            },
            {
              text: `🏦 Min Payout (${formatINR(config.minWithdrawal)})`,
              callback_data: 'set_rate:minWithdrawal',
            },
          ],
        ],
      });
      return { kv, replies, keyboardMode: 'admin' };
    }

    // Row 6 Left: ⭕ Toggle Withdrawals
    if (text === '⭕ Toggle Withdrawals') {
      config.withdrawalsEnabled = !config.withdrawalsEnabled;
      config.updatedAt = new Date().toISOString();
      const stateLabel = config.withdrawalsEnabled
        ? '🟢 ENABLED (UPI Open)'
        : '🔴 DISABLED (Paused)';

      replies.push({
        text:
          `⭕ <b>UPI Withdrawal Status Toggled!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `User UPI Withdrawals are now: <b>${stateLabel}</b>`,
      });
      return { kv, replies, keyboardMode: 'admin' };
    }

    // Row 6 Right: 📊 Bot Stats
    if (text === '📊 Bot Stats') {
      let totalUserBalances = 0;
      for (const uid of kv['index:users']) {
        const u = kv.users[uid];
        if (u) totalUserBalances += u.balance;
      }
      const approvedOrders = kv['index:orders'].filter((o) => o.status === 'approved');
      const pendingOrders = kv['index:orders'].filter((o) => o.status === 'pending');
      const totalSales = approvedOrders.reduce((acc, o) => acc + o.totalAmount, 0);

      const approvedSubs = kv['index:submissions'].filter((s) => s.status === 'approved');
      const pendingSubs = kv['index:submissions'].filter((s) => s.status === 'pending');

      const pendingPayouts = kv['index:payouts'].filter((p) => p.status === 'pending');
      const paidPayouts = kv['index:payouts'].filter((p) => p.status === 'approved');
      const paidVol = paidPayouts.reduce((acc, p) => acc + p.amount, 0);

      replies.push({
        text:
          `📊 <b>${BOT_DISPLAY_NAME} — Live Marketplace & KV Telemetry</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👥 <b>Registered Users:</b> <code>${kv['index:users'].length}</code>\n` +
          `📦 <b>Available Buy Stock:</b> <code>${stock.standard.length + stock.twofa.length + stock.aged.length}</code>\n` +
          `   • Standard: <code>${stock.standard.length}</code> | 2FA: <code>${stock.twofa.length}</code> | Aged: <code>${stock.aged.length}</code>\n` +
          `🛒 <b>Completed Buy Orders:</b> <code>${approvedOrders.length} (${formatINR(totalSales)})</code> | Pending: <code>${pendingOrders.length}</code>\n` +
          `📤 <b>Approved Sold Gmails:</b> <code>${approvedSubs.length}</code> | Pending Review: <code>${pendingSubs.length}</code>\n` +
          `💰 <b>Total User Wallet Balances:</b> <code>${formatINR(totalUserBalances)}</code>\n` +
          `🏦 <b>Completed UPI Payouts:</b> <code>${paidPayouts.length} (${formatINR(paidVol)})</code> | Pending: <code>${pendingPayouts.length}</code>\n` +
          `📲 <b>Active Merchant UPI:</b> <code>${config.upiId}</code>`,
      });
      return { kv, replies, keyboardMode: 'admin' };
    }

    // Row 7 Left: 📢 Broadcast Msg
    if (text === '📢 Broadcast Msg') {
      user.state = 'AWAITING_BROADCAST_MESSAGE';
      replies.push({
        text:
          `📢 <b>Global Broadcast Dispatcher</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Target Audience: <code>${kv['index:users'].length} Registered Users</code>\n\n` +
          `Send the announcement text (HTML supported) that you wish to broadcast to all users:`,
        inlineKeyboard: CANCEL_INLINE,
      });
      return { kv, replies, keyboardMode: 'admin' };
    }
  }

  replies.push({
    text: `💡 Please select an option from the reply keyboard menu below or type <code>/start</code>.`,
  });
  return { kv, replies, keyboardMode };
}

export function processBotCallbackQuery(
  callbackData: string,
  activeUserId: number,
  currentKeyboardMode: 'user' | 'admin',
  userJoinedForceChannels: boolean,
  prevKv: KVStoreSnapshot
): BotTurnResult {
  const kv: KVStoreSnapshot = structuredClone(prevKv);
  const config = kv['config:settings'];
  const stock = kv['config:stock'];
  const admins = kv['config:admins'];
  const isAdmin = activeUserId === SUPER_ADMIN_ID || admins.includes(activeUserId);
  const user = kv.users[activeUserId];
  const replies: BotTurnResult['replies'] = [];

  if (callbackData === 'cancel_state') {
    if (user) {
      user.state = null;
      user.stateData = {};
    }
    replies.push({ text: `❌ <b>Operation cancelled.</b>` });
    return {
      kv,
      replies,
      keyboardMode: currentKeyboardMode,
      callbackNotice: 'Operation cancelled',
    };
  }

  if (callbackData === 'verify_membership') {
    if (!isAdmin && kv['config:channels'].length > 0 && !userJoinedForceChannels) {
      return {
        kv,
        replies: [],
        keyboardMode: currentKeyboardMode,
        callbackNotice: `❌ Please join all ${kv['config:channels'].length} mandatory channel(s) first!`,
      };
    }
    replies.push({
      text: `✅ <b>Verification Successful!</b> Welcome to <b>${BOT_DISPLAY_NAME}</b>.`,
    });
    return {
      kv,
      replies,
      keyboardMode: 'user',
      callbackNotice: '✅ Membership verified!',
    };
  }

  // --------------------------------------------------------------------------
  // SELL GMAIL CALLBACKS
  // --------------------------------------------------------------------------
  if (callbackData === 'regen_sell_suggestion') {
    const suggestedUser = `mez.sell.${Math.floor(10000 + Math.random() * 90000)}@gmail.com`;
    const suggestedPass = `Mez#${Math.floor(1000 + Math.random() * 9000)}@`;
    replies.push({
      text:
        `📤 <b>Sell Gmail Accounts & Earn Rupees (₹)</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💵 <b>Reward per Approved Gmail:</b> <b><code>${formatINR(config.sellGmailReward)}</code></b>\n` +
        `📧 <b>Suggested Email:</b> <code>${suggestedUser}</code>\n` +
        `🔑 <b>Suggested Password:</b> <code>${suggestedPass}</code>\n\n` +
        `👇 <i>Click below to submit your Gmail account for Admin approval:</i>`,
      inlineKeyboard: [
        [
          {
            text: `📤 Submit Gmail to Sell (+${formatINR(config.sellGmailReward)})`,
            callback_data: 'start_sell_gmail',
          },
        ],
        [
          {
            text: '🔄 Generate New Suggested Credentials',
            callback_data: 'regen_sell_suggestion',
          },
        ],
      ],
    });
    return {
      kv,
      replies,
      keyboardMode: currentKeyboardMode,
      callbackNotice: 'Generated new suggested credentials',
    };
  }

  if (callbackData === 'start_sell_gmail') {
    user.state = 'AWAITING_SELL_GMAIL_SUBMISSION';
    replies.push({
      text:
        `📤 <b>Submit Gmail Account to Sell</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Reward on Admin Approval: <b><code>+${formatINR(config.sellGmailReward)}</code></b>\n\n` +
        `Please send your Gmail details in the following format:\n` +
        `<code>email@gmail.com | Password123 | Recovery/2FA Status</code>\n\n` +
        `<i>Example:</i>\n` +
        `<code>mez.task99@gmail.com | Mez#9182 | No Recovery, 2FA Off</code>`,
      inlineKeyboard: CANCEL_INLINE,
    });
    return { kv, replies, keyboardMode: currentKeyboardMode };
  }

  // --------------------------------------------------------------------------
  // BUY GMAIL CALLBACKS
  // --------------------------------------------------------------------------
  if (callbackData.startsWith('buy_cat:')) {
    const category = callbackData.replace('buy_cat:', '') as 'standard' | 'twofa' | 'aged';
    const catInfo = STOCK_CATEGORIES_META[category] || STOCK_CATEGORIES_META.standard;
    const available = (stock[category] || []).length;
    const unitPrice = Number(config[catInfo.priceKey]);

    if (available === 0) {
      return {
        kv,
        replies: [
          {
            text: `⚠️ <b>${catInfo.title}</b> is currently Out of Stock! An Admin can add stock via <b>🛒 Manage Buy Stock</b>.`,
          },
        ],
        keyboardMode: currentKeyboardMode,
        callbackNotice: '⚠️ Out of Stock!',
      };
    }

    const qtyOptions = [1, 2, 5, 10].filter((q) => q <= available);
    const buttons: InlineButton[][] = [];
    for (let i = 0; i < qtyOptions.length; i += 2) {
      buttons.push(
        qtyOptions.slice(i, i + 2).map((q) => ({
          text: `Buy ${q} (${formatINR(q * unitPrice)})`,
          callback_data: `buy_qty:${category}:${q}`,
        }))
      );
    }
    buttons.push([{ text: '🔢 Enter Custom Quantity', callback_data: `buy_custom:${category}` }]);

    replies.push({
      text:
        `🛒 <b>${catInfo.title}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📝 <i>${catInfo.description}</i>\n\n` +
        `🏷️ <b>Price:</b> <code>${formatINR(unitPrice)} / account</code>\n` +
        `📦 <b>Available in KV Stock:</b> <code>${available} accounts</code>\n\n` +
        `👇 <i>Select how many Gmail accounts you want to buy:</i>`,
      inlineKeyboard: buttons,
    });
    return { kv, replies, keyboardMode: currentKeyboardMode };
  }

  if (callbackData.startsWith('buy_qty:')) {
    const [, categoryRaw, qtyStr] = callbackData.split(':');
    const category = categoryRaw as 'standard' | 'twofa' | 'aged';
    const quantity = parseInt(qtyStr, 10);
    const available = (stock[category] || []).length;

    if (quantity > available) {
      return {
        kv,
        replies: [],
        keyboardMode: currentKeyboardMode,
        callbackNotice: `⚠️ Only ${available} left in stock!`,
      };
    }

    const catInfo = STOCK_CATEGORIES_META[category];
    const unitPrice = Number(config[catInfo.priceKey]);
    const totalAmount = Number((unitPrice * quantity).toFixed(2));

    user.state = 'AWAITING_PAYMENT_SCREENSHOT';
    user.stateData = {
      category,
      categoryTitle: catInfo.title,
      quantity,
      unitPrice,
      totalAmount,
    };

    replies.push({
      text:
        `🧾 <b>UPI Payment Invoice — ${BOT_DISPLAY_NAME}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📦 <b>Selected Category:</b> ${catInfo.title}\n` +
        `🔢 <b>Quantity:</b> <code>${quantity} Gmail Account(s)</code>\n` +
        `🏷️ <b>Rate per Gmail:</b> <code>${formatINR(unitPrice)}</code>\n` +
        `💰 <b>Total Payable Amount:</b> <b><code>${formatINR(totalAmount)}</code></b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏦 <b>Pay via Any UPI App (GPay / PhonePe / Paytm):</b>\n` +
        `📲 <b>Merchant UPI ID:</b> <code>${config.upiId}</code>\n` +
        `🏢 <b>Payee Name:</b> <code>${config.upiMerchantName}</code>\n\n` +
        `📸 <b>Next Step:</b> Pay <b>${formatINR(totalAmount)}</b> and click <b>"📸 Upload Screenshot"</b> below (or type UTR) to submit your payment proof!`,
      showUpiQrCard: {
        upiId: config.upiId,
        merchantName: config.upiMerchantName,
        amount: totalAmount,
      },
      inlineKeyboard: [
        [
          {
            text: `💰 Pay Instantly from Wallet (${formatINR(user.balance)})`,
            callback_data: `pay_wallet:${category}:${quantity}`,
          },
        ],
        [{ text: '❌ Cancel Order', callback_data: 'cancel_state' }],
      ],
    });
    return {
      kv,
      replies,
      keyboardMode: currentKeyboardMode,
      callbackNotice: `UPI Invoice generated for ${formatINR(totalAmount)}`,
    };
  }

  if (callbackData.startsWith('buy_custom:')) {
    const category = callbackData.replace('buy_custom:', '') as 'standard' | 'twofa' | 'aged';
    const available = (stock[category] || []).length;
    user.state = 'AWAITING_CUSTOM_BUY_QTY';
    user.stateData = { category };
    replies.push({
      text:
        `🔢 <b>Enter Quantity to Purchase</b>\n` +
        `Available Stock: <code>${available} accounts</code>\n\n` +
        `Send the number of Gmail accounts you want to buy:`,
      inlineKeyboard: CANCEL_INLINE,
    });
    return { kv, replies, keyboardMode: currentKeyboardMode };
  }

  if (callbackData.startsWith('pay_wallet:')) {
    const [, catRaw, qtyStr] = callbackData.split(':');
    const category = catRaw as 'standard' | 'twofa' | 'aged';
    const quantity = parseInt(qtyStr, 10);
    const catInfo = STOCK_CATEGORIES_META[category];
    const unitPrice = Number(config[catInfo.priceKey]);
    const totalAmount = Number((unitPrice * quantity).toFixed(2));

    if ((stock[category] || []).length < quantity) {
      return {
        kv,
        replies: [],
        keyboardMode: currentKeyboardMode,
        callbackNotice: '⚠️ Not enough stock remaining!',
      };
    }
    if (user.balance < totalAmount) {
      return {
        kv,
        replies: [],
        keyboardMode: currentKeyboardMode,
        callbackNotice: `⚠️ Insufficient Wallet Balance! Need ${formatINR(totalAmount)} (Have ${formatINR(user.balance)}). Upload UPI Screenshot instead.`,
      };
    }

    const dispatched = stock[category].splice(0, quantity);
    user.balance = Number((user.balance - totalAmount).toFixed(2));
    user.totalSpent = Number((user.totalSpent + totalAmount).toFixed(2));
    user.purchasedCount += quantity;
    user.state = null;
    user.stateData = {};

    const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    kv['index:orders'].unshift({
      id: orderId,
      userId: activeUserId,
      buyerName: user.firstName,
      category,
      categoryTitle: catInfo.title,
      quantity,
      unitPrice,
      totalAmount,
      screenshotRef: 'Paid via ₹ Wallet Balance',
      status: 'approved',
      accounts: dispatched,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    });

    replies.push({
      text:
        `🎉 <b>Order #${orderId} Dispatched Instantly!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📦 <b>Category:</b> ${catInfo.title}\n` +
        `💰 <b>Paid from Wallet:</b> <code>${formatINR(totalAmount)}</code>\n\n` +
        `🔑 <b>Your Purchased Gmail Credentials:</b>\n` +
        dispatched.map((c, i) => `${i + 1}. <code>${c}</code>`).join('\n'),
    });
    return {
      kv,
      replies,
      keyboardMode: currentKeyboardMode,
      callbackNotice: `✅ Dispatched ${quantity} Gmail(s)!`,
    };
  }

  if (callbackData === 'set_user_upi') {
    user.state = 'AWAITING_USER_UPI_ID';
    replies.push({
      text:
        `📲 <b>Link Your UPI ID for ₹ Withdrawals</b>\n` +
        `Current UPI ID: <code>${user.upiId || 'Not Set'}</code>\n\n` +
        `Please type and send your UPI ID below (e.g. <code>yourname@paytm</code>, <code>user@oksbi</code>):`,
      inlineKeyboard: CANCEL_INLINE,
    });
    return { kv, replies, keyboardMode: currentKeyboardMode };
  }

  if (callbackData === 'request_upi_withdrawal') {
    if (!config.withdrawalsEnabled) {
      return {
        kv,
        replies: [
          {
            text: `🔴 <b>UPI Withdrawals Paused:</b> Administrators have temporarily paused withdrawals.`,
          },
        ],
        keyboardMode: currentKeyboardMode,
        callbackNotice: '🔴 Withdrawals are currently paused by Admin',
      };
    }
    if (!user.upiId) {
      return {
        kv,
        replies: [
          {
            text: `⚠️ Please link your <b>UPI ID</b> first before requesting a withdrawal.`,
          },
        ],
        keyboardMode: currentKeyboardMode,
        callbackNotice: 'Link your UPI ID first!',
      };
    }
    if (user.balance < config.minWithdrawal) {
      return {
        kv,
        replies: [
          {
            text: `⚠️ <b>Minimum Withdrawal Not Met:</b> You need at least <code>${formatINR(config.minWithdrawal)}</code> (Available: <code>${formatINR(user.balance)}</code>).`,
          },
        ],
        keyboardMode: currentKeyboardMode,
        callbackNotice: `Minimum UPI withdrawal is ${formatINR(config.minWithdrawal)}`,
      };
    }

    user.state = 'AWAITING_UPI_WITHDRAW_AMOUNT';
    replies.push({
      text:
        `💸 <b>Withdraw Rupees (₹) to UPI</b>\n` +
        `Available Balance: <code>${formatINR(user.balance)}</code>\n` +
        `Receiving UPI ID: <code>${user.upiId}</code>\n\n` +
        `Enter the ₹ amount you wish to withdraw:`,
      inlineKeyboard: CANCEL_INLINE,
    });
    return { kv, replies, keyboardMode: currentKeyboardMode };
  }

  if (callbackData === 'toggle_notifications') {
    user.notifications = !user.notifications;
    replies.push({
      text: `🔔 Order & submission notifications are now <b>${user.notifications ? '🟢 Enabled' : '🔴 Muted'}</b>.`,
    });
    return {
      kv,
      replies,
      keyboardMode: currentKeyboardMode,
      callbackNotice: 'Notification preference updated',
    };
  }

  if (callbackData === 'claim_daily_bonus') {
    const today = new Date().toISOString().slice(0, 10);
    if (user.lastDailyBonus === today) {
      return {
        kv,
        replies: [],
        keyboardMode: currentKeyboardMode,
        callbackNotice: "⏳ You already claimed today's ₹ bonus!",
      };
    }
    const bonus = config.dailyBonus || 2;
    user.lastDailyBonus = today;
    user.balance = Number((user.balance + bonus).toFixed(2));
    user.totalEarned = Number((user.totalEarned + bonus).toFixed(2));

    replies.push({
      text:
        `🎁 <b>Daily Check-In Bonus Claimed!</b>\n` +
        `<code>+${formatINR(bonus)}</code> has been added to your wallet. New balance: <code>${formatINR(user.balance)}</code>.`,
    });
    return {
      kv,
      replies,
      keyboardMode: currentKeyboardMode,
      callbackNotice: `+${formatINR(bonus)} Daily Bonus Credited!`,
    };
  }

  if (callbackData === 'enter_redeem_code') {
    user.state = 'AWAITING_REDEEM_CLAIM';
    replies.push({
      text:
        `🎟️ <b>Redeem Rupees Promo Code</b>\n` +
        `Send your promotional code below (e.g. <code>BHARAT50</code> or <code>MEZ25</code>):`,
      inlineKeyboard: CANCEL_INLINE,
    });
    return { kv, replies, keyboardMode: currentKeyboardMode };
  }

  // --------------------------------------------------------------------------
  // ADMIN CALLBACK ACTIONS
  // --------------------------------------------------------------------------
  if (!isAdmin) {
    return {
      kv,
      replies: [],
      keyboardMode: currentKeyboardMode,
      callbackNotice: '⛔ Admin permission required',
    };
  }

  // Admin: Approve or Reject User's Sell Gmail Submission (Credits ₹ to Seller Wallet)
  if (callbackData.startsWith('sell_approve:') || callbackData.startsWith('sell_reject:')) {
    const isApprove = callbackData.startsWith('sell_approve:');
    const subId = callbackData.split(':')[1];
    const idx = kv['index:submissions'].findIndex((s) => s.id === subId);

    if (idx === -1 || kv['index:submissions'][idx].status !== 'pending') {
      return {
        kv,
        replies: [],
        keyboardMode: currentKeyboardMode,
        callbackNotice: 'Submission already processed!',
      };
    }

    const sub = kv['index:submissions'][idx];
    sub.status = isApprove ? 'approved' : 'rejected';
    sub.processedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

    if (isApprove) {
      const seller = kv.users[sub.userId];
      const reward = Number(sub.reward || config.sellGmailReward || 10);
      if (seller) {
        seller.balance = Number((seller.balance + reward).toFixed(2));
        seller.totalEarned = Number((seller.totalEarned + reward).toFixed(2));
        seller.soldMailsCount = (seller.soldMailsCount || 0) + 1;
      }

      replies.push({
        text:
          `✅ <b>Sell Submission #${sub.id} Approved & Paid!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📧 <b>Verified Gmail:</b> <code>${sub.email}</code>\n` +
          `👤 <b>Seller:</b> ${sub.sellerName} (<code>${sub.userId}</code>)\n` +
          `💵 <b>Credited to Seller Wallet:</b> <b><code>+${formatINR(reward)}</code></b>`,
      });

      return {
        kv,
        replies,
        keyboardMode: currentKeyboardMode,
        callbackNotice: `✅ Approved #${sub.id} & Credited +${formatINR(reward)}!`,
      };
    } else {
      replies.push({
        text: `❌ <b>Sell Submission #${sub.id} Rejected.</b> Seller <code>${sub.userId}</code> has been notified.`,
      });
      return {
        kv,
        replies,
        keyboardMode: currentKeyboardMode,
        callbackNotice: `❌ Rejected Sell Submission #${sub.id}`,
      };
    }
  }

  // Admin: Add Gmail Stock
  if (callbackData.startsWith('admin_add_stock:')) {
    const category = callbackData.replace('admin_add_stock:', '') as 'standard' | 'twofa' | 'aged';
    const catInfo = STOCK_CATEGORIES_META[category] || STOCK_CATEGORIES_META.standard;
    user.state = 'AWAITING_STOCK_LINES';
    user.stateData = { category };

    replies.push({
      text:
        `➕ <b>Add Stock to: ${catInfo.title}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Send the Gmail credentials to add into <code>MEZ_KV</code> inventory (one <code>email:password</code> per line):\n\n` +
        `<code>freshuser101@gmail.com:Pass@9911</code>`,
      inlineKeyboard: CANCEL_INLINE,
    });
    return { kv, replies, keyboardMode: 'admin' };
  }

  // Admin: Review pending buy orders
  if (callbackData === 'admin_review_orders') {
    const pending = kv['index:orders'].filter((o) => o.status === 'pending');
    if (pending.length === 0) {
      replies.push({
        text: `✅ There are currently <b>0 pending Gmail purchase orders</b> awaiting verification.`,
      });
      return { kv, replies, keyboardMode: 'admin' };
    }

    for (const ord of pending) {
      replies.push({
        text:
          `🛒 <b>Pending Gmail Purchase #${ord.id}</b>\n` +
          `👤 Buyer: ${ord.buyerName} (<code>${ord.userId}</code>)\n` +
          `📦 Category: ${ord.categoryTitle} × <code>${ord.quantity}</code>\n` +
          `💰 Paid: <code>${formatINR(ord.totalAmount)}</code>\n` +
          `🧾 Proof: <code>${ord.screenshotRef}</code>`,
        inlineKeyboard: [
          [
            { text: '✅ Approve & Dispatch Stock', callback_data: `order_approve:${ord.id}` },
            { text: '❌ Reject', callback_data: `order_reject:${ord.id}` },
          ],
        ],
      });
    }
    return { kv, replies, keyboardMode: 'admin' };
  }

  // Admin: Approve or Reject Gmail Purchase Order (Auto-Deduct Stock & Dispatch Credentials)
  if (callbackData.startsWith('order_approve:') || callbackData.startsWith('order_reject:')) {
    const isApprove = callbackData.startsWith('order_approve:');
    const orderId = callbackData.split(':')[1];
    const idx = kv['index:orders'].findIndex((o) => o.id === orderId);

    if (idx === -1 || kv['index:orders'][idx].status !== 'pending') {
      return {
        kv,
        replies: [],
        keyboardMode: currentKeyboardMode,
        callbackNotice: 'Order already processed!',
      };
    }

    const order = kv['index:orders'][idx];

    if (isApprove) {
      const catList = stock[order.category] || [];
      if (catList.length < order.quantity) {
        return {
          kv,
          replies: [
            {
              text: `⚠️ <b>Insufficient Stock!</b> Order #${order.id} needs <code>${order.quantity}</code> in <b>${order.categoryTitle}</b>, but only <code>${catList.length}</code> available. Add stock first!`,
            },
          ],
          keyboardMode: currentKeyboardMode,
          callbackNotice: `⚠️ Insufficient stock (${catList.length}/${order.quantity})!`,
        };
      }

      const dispatched = catList.splice(0, order.quantity);
      order.status = 'approved';
      order.accounts = dispatched;
      order.processedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

      const buyer = kv.users[order.userId];
      if (buyer) {
        buyer.totalSpent = Number((buyer.totalSpent + order.totalAmount).toFixed(2));
        buyer.purchasedCount += order.quantity;
      }

      replies.push({
        text:
          `✅ <b>Order #${order.id} Approved & Dispatched!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📦 <b>Category:</b> ${order.categoryTitle}\n` +
          `📉 <b>Stock Deducted:</b> <code>-${order.quantity} from MEZ_KV</code>\n` +
          `👤 <b>Dispatched to Buyer:</b> ${order.buyerName} (<code>${order.userId}</code>)\n\n` +
          `🔑 <b>Dispatched Gmail Credentials:</b>\n` +
          dispatched.map((c, i) => `${i + 1}. <code>${c}</code>`).join('\n'),
      });

      return {
        kv,
        replies,
        keyboardMode: currentKeyboardMode,
        callbackNotice: `✅ Approved #${order.id} & Dispatched ${order.quantity} Gmail(s)!`,
      };
    } else {
      order.status = 'rejected';
      order.processedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
      replies.push({
        text: `❌ <b>Order #${order.id} Rejected.</b> Buyer <code>${order.userId}</code> has been notified.`,
      });
      return {
        kv,
        replies,
        keyboardMode: currentKeyboardMode,
        callbackNotice: `❌ Rejected Order #${order.id}`,
      };
    }
  }

  // Admin: Approve or Reject UPI Payout
  if (callbackData.startsWith('payout_approve:') || callbackData.startsWith('payout_reject:')) {
    const isApprove = callbackData.startsWith('payout_approve:');
    const payoutId = callbackData.split(':')[1];
    const idx = kv['index:payouts'].findIndex((p) => p.id === payoutId);

    if (idx === -1 || kv['index:payouts'][idx].status !== 'pending') {
      return {
        kv,
        replies: [],
        keyboardMode: 'admin',
        callbackNotice: 'Payout ticket already processed!',
      };
    }

    const item = kv['index:payouts'][idx];
    item.status = isApprove ? 'approved' : 'rejected';
    item.processedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

    const targetUser = kv.users[item.userId];
    if (targetUser) {
      if (isApprove) {
        targetUser.totalWithdrawn = Number((targetUser.totalWithdrawn + item.amount).toFixed(2));
      } else {
        targetUser.balance = Number((targetUser.balance + item.amount).toFixed(2));
      }
    }

    replies.push({
      text:
        `${isApprove ? '✅ <b>UPI PAYOUT SENT</b>' : '❌ <b>REJECTED & REFUNDED TO WALLET</b>'}\n` +
        `Ticket: <code>#${item.id}</code> | User: <code>${item.userId}</code> | Amount: <code>${formatINR(item.amount)}</code> | UPI: <code>${item.upiId}</code>`,
    });
    return {
      kv,
      replies,
      keyboardMode: 'admin',
      callbackNotice: isApprove ? `Marked Paid #${item.id}` : `Rejected & Refunded #${item.id}`,
    };
  }

  // Admin: Set Rate
  if (callbackData.startsWith('set_rate:')) {
    const field = callbackData.replace('set_rate:', '');
    user.state = 'AWAITING_RATE_VALUE';
    user.stateData = { field };
    replies.push({
      text:
        `✏️ <b>Update Rate Parameter:</b> <code>${field}</code>\n` +
        `Enter the new numeric value in Indian Rupees (₹) to save into <code>MEZ_KV</code>:`,
      inlineKeyboard: CANCEL_INLINE,
    });
    return { kv, replies, keyboardMode: 'admin' };
  }

  if (callbackData.startsWith('del_channel:')) {
    const targetUsername = callbackData.replace('del_channel:', '');
    kv['config:channels'] = kv['config:channels'].filter((c) => c.username !== targetUsername);
    replies.push({
      text: `🗑️ Removed <code>${targetUsername}</code> from mandatory force-join channels.`,
    });
    return {
      kv,
      replies,
      keyboardMode: 'admin',
      callbackNotice: `Removed ${targetUsername}`,
    };
  }

  if (callbackData === 'prompt_add_admin') {
    user.state = 'AWAITING_NEW_ADMIN_ID';
    replies.push({
      text:
        `👤 <b>Authorize New Admin</b>\n` +
        `Send the numeric Telegram User ID of the new admin (e.g. <code>5192048112</code>):`,
      inlineKeyboard: CANCEL_INLINE,
    });
    return { kv, replies, keyboardMode: 'admin' };
  }

  if (callbackData.startsWith('revoke_admin:')) {
    const targetId = Number(callbackData.replace('revoke_admin:', ''));
    if (targetId === SUPER_ADMIN_ID) {
      return {
        kv,
        replies: [],
        keyboardMode: 'admin',
        callbackNotice: 'Cannot revoke Super Admin (8838351233)!',
      };
    }
    kv['config:admins'] = kv['config:admins'].filter((id) => id !== targetId);
    replies.push({
      text: `🗑️ Revoked administrator privileges for User ID <code>${targetId}</code>.`,
    });
    return {
      kv,
      replies,
      keyboardMode: 'admin',
      callbackNotice: `Revoked ${targetId}`,
    };
  }

  if (callbackData === 'admin_adjust_balance') {
    user.state = 'AWAITING_BALANCE_ADJUSTMENT';
    replies.push({
      text:
        `💰 <b>Credit / Debit User ₹ Balance</b>\n` +
        `Send the User ID and ₹ adjustment separated by <code>|</code>:\n\n` +
        `<code>5192048112 | 150</code> (Credit ₹150)\n` +
        `<code>5192048112 | -50</code> (Debit ₹50)`,
      inlineKeyboard: CANCEL_INLINE,
    });
    return { kv, replies, keyboardMode: 'admin' };
  }

  return { kv, replies, keyboardMode: currentKeyboardMode };
}
