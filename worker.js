/**
 * ============================================================================
 * 𝐌𝐄𝐙 𝐌𝐀𝐈𝐋𝐒 — Pure Serverless Telegram Bot for Cloudflare Workers (`worker.js`)
 * ============================================================================
 * Worker Type:   100% Pure Serverless Standard Worker (`main = "worker.js"`)
 * Config File:   Clean `wrangler.toml` (NO `[assets]`, NO `[site]`, NO static dirs)
 * Bot Username:  `env.BOT_USERNAME` (`@Mezmailsbot` -> https://t.me/Mezmailsbot?start=ref_<userId>)
 * Support Group: `https://t.me/mezmail`
 * Super Admin:   8838351233
 * KV Storage:    Supports `env.BOT_KV` or `env.MEZ_KV` seamlessly
 *
 * Core Modules:
 * 1. 🟩 🛒 Buy Gmail Marketplace (Stock Inventory + UPI QR & Screenshot Proof)
 * 2. 🟩 📤 Sell Gmail System (User Submissions + Admin Approve & Pay ₹)
 * 3. 🟦 👥 Paginated Users List (`admin_users_list` — 10 users/page with Prev/Next)
 * 4. 🎨 Vibrant Multi-Column Control Panel UI (🟩 Active/Run, 🟦 View/Nav, 🟥 Stop/Danger)
 * ============================================================================
 */

const BOT_NAME = "𝐌𝐄𝐙 𝐌𝐀𝐈𝐋𝐒";
const DEFAULT_BOT_USERNAME = "Mezmailsbot";
const SUPER_ADMIN_ID = 8838351233;
const SUPPORT_GROUP_URL = "https://t.me/mezmail";
const USERS_PER_PAGE = 10;

const DEFAULT_CONFIG = {
  // Sell Gmail Reward Rate (Paid to users when Admin approves their sold Gmail)
  sellGmailReward: 10,        // ₹10 paid to user per approved Gmail submission

  // Buy Gmail Marketplace Prices (Paid by users to purchase stock)
  standardGmailPrice: 15,     // ₹15 per Standard Fresh Gmail
  twofaGmailPrice: 25,        // ₹25 per 2FA Verified Gmail
  agedGmailPrice: 40,         // ₹40 per Old / Aged Gmail

  // Bonuses & Withdrawal Thresholds (in ₹)
  referralBonus: 5,           // ₹5 per referred user
  dailyBonus: 2,              // ₹2 daily check-in reward
  minWithdrawal: 100,         // ₹100 minimum UPI withdrawal threshold
  withdrawalsEnabled: true,   // Instant toggle for UPI withdrawals

  // Admin UPI Receiver Details
  upiId: "mezmails@okaxis",
  upiMerchantName: "MEZ MAILS OFFICIAL",
  upiQrFileId: "",            // Telegram photo file_id uploaded by Admin
  upiQrImageUrl: "",          // Optional HTTPS image URL for UPI QR code
  currencySymbol: "₹",
  updatedAt: new Date().toISOString()
};

const STOCK_CATEGORIES = {
  standard: {
    id: "standard",
    title: "📩 Standard Fresh Gmail",
    priceKey: "standardGmailPrice",
    description: "Freshly registered Gmail account, no recovery phone/email attached."
  },
  twofa: {
    id: "twofa",
    title: "🔐 2FA App-Password Gmail",
    priceKey: "twofaGmailPrice",
    description: "2FA enabled Gmail with backup codes / app password included."
  },
  aged: {
    id: "aged",
    title: "💎 Aged High-Trust Gmail",
    priceKey: "agedGmailPrice",
    description: "Aged Gmail account with high deliverability and warm profile."
  }
};

// ============================================================================
// BOT USERNAME & COMMAND NORMALIZATION HELPERS
// ============================================================================

function resolveBotUsername(env, fallbackUsername = "") {
  const raw =
    (env && env.BOT_USERNAME) ||
    fallbackUsername ||
    DEFAULT_BOT_USERNAME;
  const cleaned = String(raw).replace(/^@/, "").trim();
  return cleaned || DEFAULT_BOT_USERNAME;
}

function normalizeCommandText(text = "") {
  return String(text).replace(/^[🟩🟦🟥]\s*/u, "").trim();
}

// ============================================================================
// VIBRANT COLORFUL REPLY KEYBOARDS (🟩 GREEN / 🟦 BLUE / 🟥 RED CONTROL PANEL)
// ============================================================================

function getUserMainKeyboard(isAdmin = false) {
  const keyboard = [
    [
      { text: "🟩 🛒 Buy Gmail" },
      { text: "🟩 📤 Sell Gmail" }
    ],
    [
      { text: "🟦 📂 My Orders / Submissions" },
      { text: "🟩 💰 Balance / Deposit" }
    ],
    [
      { text: "🟦 👥 Referrals" },
      { text: "🟩 🎁 Rewards" }
    ],
    [
      { text: "🟦 ⚙️ Settings" },
      { text: "🟦 ❓ Help" }
    ]
  ];

  if (isAdmin) {
    keyboard.push([{ text: "🟥 🛡️ Admin Panel" }]);
  }

  return {
    keyboard,
    resize_keyboard: true,
    is_persistent: true
  };
}

function getAdminPanelKeyboard() {
  return {
    keyboard: [
      [
        { text: "🟩 💳 Manage Payouts" },
        { text: "🟦 👥 View Users List" }
      ],
      [
        { text: "🟦 ➕ Add Force Channel" },
        { text: "🟦 📋 View/Remove Channels" }
      ],
      [
        { text: "🟩 🎟️ Create Redeem Code" },
        { text: "🟩 👤 Add Admin" }
      ],
      [
        { text: "🟩 💳 Set Buy/Sell Rates" },
        { text: "🟥 ⭕ Toggle Withdrawals" }
      ],
      [
        { text: "🟩 🛒 Manage Buy Stock" },
        { text: "🟦 📤 Manage Sell Submissions" }
      ],
      [
        { text: "🟦 📊 Bot Stats" },
        { text: "🟦 📢 Broadcast Msg" }
      ],
      [
        { text: "🟦 🖼️ Add/Update UPI QR" },
        { text: "🟥 🗑️ Clear Pending Queues" }
      ],
      [
        { text: "🟥 🔙 Back to User Menu" }
      ]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
}

function getCancelInlineKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🟥 ❌ Cancel Operation", callback_data: "cancel_state" }]
    ]
  };
}

// ============================================================================
// CLOUDFLARE KV (`BOT_KV` / `MEZ_KV`) STORAGE HELPERS
// ============================================================================

async function getJson(kv, key, fallback) {
  try {
    const raw = await kv.get(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function putJson(kv, key, value) {
  await kv.put(key, JSON.stringify(value));
}

async function getConfig(kv) {
  const saved = await getJson(kv, "config:settings", null);
  if (!saved) {
    await putJson(kv, "config:settings", DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  return { ...DEFAULT_CONFIG, ...saved };
}

async function getStockStore(kv) {
  const defaultStock = { standard: [], twofa: [], aged: [] };
  const saved = await getJson(kv, "config:stock", null);
  if (!saved) {
    await putJson(kv, "config:stock", defaultStock);
    return defaultStock;
  }
  return {
    standard: Array.isArray(saved.standard) ? saved.standard : [],
    twofa: Array.isArray(saved.twofa) ? saved.twofa : [],
    aged: Array.isArray(saved.aged) ? saved.aged : []
  };
}

async function getAdmins(kv) {
  const admins = await getJson(kv, "config:admins", [SUPER_ADMIN_ID]);
  if (!admins.map(Number).includes(SUPER_ADMIN_ID)) {
    admins.unshift(SUPER_ADMIN_ID);
  }
  return admins.map(Number);
}

async function isUserAdmin(kv, userId) {
  const uid = Number(userId);
  if (uid === SUPER_ADMIN_ID) return true;
  const admins = await getAdmins(kv);
  return admins.includes(uid);
}

async function getForceChannels(kv) {
  return await getJson(kv, "config:channels", []);
}

async function getOrCreateUser(kv, from, startPayload = "") {
  const userId = Number(from.id);
  const key = `user:${userId}`;
  let user = await getJson(kv, key, null);

  if (!user) {
    let referredBy = null;
    if (startPayload && startPayload.startsWith("ref_")) {
      const refId = Number(startPayload.replace("ref_", "").trim());
      if (refId && refId !== userId) {
        referredBy = refId;
      }
    }

    user = {
      id: userId,
      username: from.username || "",
      firstName: from.first_name || "User",
      balance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      totalSpent: 0,
      purchasedCount: 0,
      soldMailsCount: 0,
      referralsCount: 0,
      referredBy,
      upiId: "",
      notifications: true,
      lastDailyBonus: null,
      state: null,
      stateData: {},
      joinedAt: new Date().toISOString()
    };

    await putJson(kv, key, user);

    const usersIndex = await getJson(kv, "index:users", []);
    if (!usersIndex.includes(userId)) {
      usersIndex.push(userId);
      await putJson(kv, "index:users", usersIndex);
    }

    // Credit referrer in Rupees (₹)
    if (referredBy) {
      const refUser = await getJson(kv, `user:${referredBy}`, null);
      if (refUser) {
        const config = await getConfig(kv);
        const bonus = Number(config.referralBonus) || 5;
        refUser.balance = Number((refUser.balance + bonus).toFixed(2));
        refUser.totalEarned = Number((refUser.totalEarned + bonus).toFixed(2));
        refUser.referralsCount = (refUser.referralsCount || 0) + 1;
        await putJson(kv, `user:${referredBy}`, refUser);
      }
    }
  } else {
    let updated = false;
    if (from.username && user.username !== from.username) {
      user.username = from.username;
      updated = true;
    }
    if (from.first_name && user.firstName !== from.first_name) {
      user.firstName = from.first_name;
      updated = true;
    }
    if (updated) {
      await putJson(kv, key, user);
    }
  }

  return user;
}

async function setUserState(kv, userId, state, stateData = {}) {
  const key = `user:${userId}`;
  const user = await getJson(kv, key, null);
  if (!user) return;
  user.state = state;
  user.stateData = stateData;
  await putJson(kv, key, user);
}

// ============================================================================
// PAGINATED USERS LIST BUILDER (`admin_users_list` — 10 USERS PER PAGE)
// ============================================================================

async function buildPaginatedUsersView(kv, requestedPage = 1) {
  const usersIndex = await getJson(kv, "index:users", []);
  const totalUsers = usersIndex.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / USERS_PER_PAGE));
  const page = Math.min(Math.max(1, Number(requestedPage) || 1), totalPages);

  const startIdx = (page - 1) * USERS_PER_PAGE;
  const pageIds = usersIndex.slice(startIdx, startIdx + USERS_PER_PAGE);
  const lines = [];

  for (let i = 0; i < pageIds.length; i++) {
    const uid = pageIds[i];
    const u = await getJson(kv, `user:${uid}`, null);
    const rank = startIdx + i + 1;
    if (u) {
      const uname = u.username
        ? `(@${escapeHtml(String(u.username).replace(/^@/, ""))})`
        : `<i>(No Username)</i>`;
      const refs = Number(u.referralsCount || 0);
      const badge = refs > 0 ? "✅" : "⚠️";
      lines.push(
        `#${rank}. <b>${escapeHtml(u.firstName)}</b> ${uname}\n` +
          `   🆔 <code>${u.id}</code> | 💎 <b>${formatINR(u.balance)}</b> | 👥 <b>${refs} refs</b> ${badge}`
      );
    }
  }

  const text =
    `🟦 👥 <b>Registered Users List (Page ${page} of ${totalPages})</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 <b>Total Users:</b> <code>${totalUsers}</code> | <b>Showing:</b> <code>${
      totalUsers === 0 ? 0 : startIdx + 1
    }–${Math.min(startIdx + USERS_PER_PAGE, totalUsers)}</code>\n\n` +
    (lines.length > 0 ? lines.join("\n\n") : "<i>No users registered yet.</i>") +
    `\n\n💡 <i>Use the pagination buttons below to browse all pages or adjust any user's ₹ balance:</i>`;

  const navRow = [];
  if (page > 1) {
    navRow.push({
      text: "🟦 ⬅️ Prev Page",
      callback_data: `admin_users_list:${page - 1}`
    });
  }
  navRow.push({
    text: `📄 ${page}/${totalPages}`,
    callback_data: `admin_users_page_info:${page}`
  });
  if (page < totalPages) {
    navRow.push({
      text: "🟦 Next Page ➡️",
      callback_data: `admin_users_list:${page + 1}`
    });
  }

  const inline_keyboard = [
    navRow,
    [{ text: "🟩 💰 Credit / Debit User ₹ Balance", callback_data: "admin_adjust_balance" }]
  ];

  return { text, reply_markup: { inline_keyboard }, page, totalPages, totalUsers };
}

// ============================================================================
// TELEGRAM BOT API HELPERS
// ============================================================================

async function tgApi(botToken, method, payload) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return await response.json();
}

async function sendMessage(botToken, chatId, text, extra = {}) {
  return await tgApi(botToken, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra
  });
}

async function sendPhoto(botToken, chatId, photo, caption, extra = {}) {
  return await tgApi(botToken, "sendPhoto", {
    chat_id: chatId,
    photo,
    caption,
    parse_mode: "HTML",
    ...extra
  });
}

async function editMessageText(botToken, chatId, messageId, text, extra = {}) {
  return await tgApi(botToken, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra
  });
}

async function answerCallbackQuery(botToken, callbackQueryId, text = "", showAlert = false) {
  return await tgApi(botToken, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert
  });
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatINR(amount) {
  return `₹${Number(amount || 0).toFixed(2)}`;
}

// ============================================================================
// FORCE-JOIN CHANNEL VERIFICATION
// ============================================================================

async function verifyForceChannels(botToken, kv, userId) {
  const isAdmin = await isUserAdmin(kv, userId);
  if (isAdmin) return { passed: true, missing: [] };

  const channels = await getForceChannels(kv);
  if (!channels || channels.length === 0) {
    return { passed: true, missing: [] };
  }

  const missing = [];
  for (const ch of channels) {
    try {
      const res = await tgApi(botToken, "getChatMember", {
        chat_id: ch.username,
        user_id: userId
      });
      const status = res?.result?.status;
      if (!res.ok || status === "left" || status === "kicked") {
        missing.push(ch);
      }
    } catch {
      missing.push(ch);
    }
  }

  return { passed: missing.length === 0, missing };
}

function buildForceJoinPrompt(missingChannels) {
  const buttons = missingChannels.map((ch) => [
    {
      text: `🟦 📢 Join ${ch.title || ch.username}`,
      url: ch.inviteLink || `https://t.me/${String(ch.username).replace(/^@/, "")}`
    }
  ]);
  buttons.push([{ text: "🟩 ✅ Joined — Verify Membership", callback_data: "verify_membership" }]);

  const text =
    `🔒 <b>Mandatory Channel Verification</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Welcome to <b>${BOT_NAME}</b>! Before buying or selling Gmail accounts, please join our official channel(s):\n\n` +
    missingChannels.map((c, i) => `${i + 1}. <b>${escapeHtml(c.title || c.username)}</b> (${escapeHtml(c.username)})`).join("\n") +
    `\n\n<i>Click "🟩 ✅ Joined — Verify Membership" once subscribed.</i>`;

  return { text, reply_markup: { inline_keyboard: buttons } };
}

// ============================================================================
// CLOUDFLARE WORKER FETCH HANDLER (SUPPORTS `BOT_KV` AND `MEZ_KV`)
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const kv = env.BOT_KV || env.MEZ_KV;
    const botUsername = resolveBotUsername(env);

    // Health check & diagnostics on GET /
    if (request.method === "GET" && url.pathname === "/") {
      return new Response(
        JSON.stringify(
          {
            ok: true,
            bot: BOT_NAME,
            botUsername: `@${botUsername}`,
            referralFormat: `https://t.me/${botUsername}?start=ref_<userId>`,
            supportGroup: SUPPORT_GROUP_URL,
            workerType: "Pure Serverless Standard Worker (worker.js, zero static assets)",
            modules: [
              "Buy Gmail Marketplace",
              "Sell Gmail Submissions",
              "Paginated Users List (10/page)",
              "Vibrant Colorful Control Panel UI (🟩/🟦/🟥)"
            ],
            superAdminId: SUPER_ADMIN_ID,
            kvBound: Boolean(kv),
            botTokenConfigured: Boolean(env.BOT_TOKEN),
            webhookStatus: "Listening on POST /"
          },
          null,
          2
        ),
        { headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    if (env.WEBHOOK_SECRET) {
      const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (secretHeader !== env.WEBHOOK_SECRET) {
        return new Response("Unauthorized Webhook Secret", { status: 401 });
      }
    }

    if (!env.BOT_TOKEN || !kv) {
      return new Response(
        JSON.stringify({
          error: "Missing BOT_TOKEN or KV binding (BOT_KV / MEZ_KV) in Cloudflare Worker settings."
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const update = await request.json();
      ctx.waitUntil(handleUpdate(update, env.BOT_TOKEN, kv, env));
      return new Response("OK", { status: 200 });
    } catch (err) {
      return new Response(`Bad Request: ${err.message}`, { status: 400 });
    }
  }
};

// ============================================================================
// CORE UPDATE ROUTER
// ============================================================================

async function handleUpdate(update, botToken, kv, env) {
  try {
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, botToken, kv, env);
      return;
    }
    if (update.message) {
      await handleMessage(update.message, botToken, kv, env);
      return;
    }
  } catch (err) {
    console.error("Update error:", err);
  }
}

// ============================================================================
// MESSAGE & VIBRANT REPLY KEYBOARD HANDLER
// ============================================================================

async function handleMessage(message, botToken, kv, env) {
  const chatId = message.chat.id;
  const from = message.from;
  if (!from) return;

  const userId = Number(from.id);
  const rawText = (message.text || message.caption || "").trim();
  const text = normalizeCommandText(rawText);

  let startPayload = "";
  if (text.startsWith("/start")) {
    const parts = text.split(" ");
    if (parts.length > 1) startPayload = parts[1];
  }

  const user = await getOrCreateUser(kv, from, startPayload);
  const isAdmin = await isUserAdmin(kv, userId);
  const config = await getConfig(kv);

  // Check Force-Join Channels for non-admins
  const forceCheck = await verifyForceChannels(botToken, kv, userId);
  if (!forceCheck.passed) {
    const prompt = buildForceJoinPrompt(forceCheck.missing);
    await sendMessage(botToken, chatId, prompt.text, { reply_markup: prompt.reply_markup });
    return;
  }

  // Top-level menu commands reset any pending input state
  const menuCommands = [
    "/start", "/admin", "/cancel",
    "🛒 Buy Gmail", "📤 Sell Gmail", "📂 My Orders / Submissions",
    "💰 Balance / Deposit", "👥 Referrals", "🎁 Rewards",
    "⚙️ Settings", "❓ Help", "🛡️ Admin Panel",
    "🛒 Manage Buy Stock", "📤 Manage Sell Submissions",
    "🖼️ Add/Update UPI QR", "💳 Manage Payouts",
    "👥 View Users List", "➕ Add Force Channel",
    "📋 View/Remove Channels", "🎟️ Create Redeem Code",
    "👤 Add Admin", "💳 Set Buy/Sell Rates", "💳 Manage Points",
    "⭕ Toggle Withdrawals", "📊 Bot Stats",
    "📢 Broadcast Msg", "🗑️ Clear Pending Queues", "🔙 Back to User Menu"
  ];

  if (menuCommands.includes(text) && user.state) {
    await setUserState(kv, userId, null, {});
    user.state = null;
  }

  // Process Stateful Input (Sell Submissions, Buy Screenshots, UPI IDs, Stock Lines, etc.)
  if (user.state) {
    await handleStatefulInput(message, user, isAdmin, config, botToken, kv);
    return;
  }

  // --------------------------------------------------------------------------
  // 1. USER MAIN MENU HANDLERS
  // --------------------------------------------------------------------------
  if (text.startsWith("/start") || text === "🔙 Back to User Menu") {
    const stock = await getStockStore(kv);
    const totalStock = stock.standard.length + stock.twofa.length + stock.aged.length;

    const welcome =
      `✨ <b>Welcome to ${BOT_NAME} — Buy & Sell Gmail Hub</b> ✨\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👋 Namaste <b>${escapeHtml(user.firstName)}</b>! Buy verified Gmail stock or sell your Gmail accounts for instant Indian Rupees (₹) via UPI.\n\n` +
      `🟩 🛒 <b>Buy Gmail Stock:</b> <code>${totalStock} Available</code> (From <code>${formatINR(config.standardGmailPrice)}</code>)\n` +
      `🟩 📤 <b>Sell Your Gmail:</b> Earn <code>${formatINR(config.sellGmailReward)} / account</code>\n` +
      `🟦 👥 <b>Referral Bonus:</b> <code>${formatINR(config.referralBonus)} / friend</code>\n` +
      `🏦 <b>Min. UPI Withdrawal:</b> <code>${formatINR(config.minWithdrawal)}</code>\n` +
      `💬 <b>Official Support:</b> <a href="${SUPPORT_GROUP_URL}">${SUPPORT_GROUP_URL}</a>\n\n` +
      `👇 <i>Choose a colorful control button from the menu below:</i>`;

    await sendMessage(botToken, chatId, welcome, {
      reply_markup: getUserMainKeyboard(isAdmin)
    });
    return;
  }

  // 🛒 Buy Gmail (Marketplace)
  if (text === "🛒 Buy Gmail") {
    const stock = await getStockStore(kv);
    const msg =
      `🟩 🛒 <b>${BOT_NAME} — Live Gmail Marketplace</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Select a Gmail category below to purchase via <b>UPI QR / UPI ID</b> or Wallet Balance:\n\n` +
      `1️⃣ <b>${STOCK_CATEGORIES.standard.title}</b>\n` +
      `   • Price: <code>${formatINR(config.standardGmailPrice)} / account</code>\n` +
      `   • Live Stock: <code>${stock.standard.length} available</code>\n\n` +
      `2️⃣ <b>${STOCK_CATEGORIES.twofa.title}</b>\n` +
      `   • Price: <code>${formatINR(config.twofaGmailPrice)} / account</code>\n` +
      `   • Live Stock: <code>${stock.twofa.length} available</code>\n\n` +
      `3️⃣ <b>${STOCK_CATEGORIES.aged.title}</b>\n` +
      `   • Price: <code>${formatINR(config.agedGmailPrice)} / account</code>\n` +
      `   • Live Stock: <code>${stock.aged.length} available</code>\n\n` +
      `💳 <b>Payment Mode:</b> Instant UPI QR & Screenshot Verification`;

    await sendMessage(botToken, chatId, msg, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `🟩 📩 Buy Standard (${formatINR(config.standardGmailPrice)} • Stock: ${stock.standard.length})`,
              callback_data: "buy_cat:standard"
            }
          ],
          [
            {
              text: `🟦 🔐 Buy 2FA Gmail (${formatINR(config.twofaGmailPrice)} • Stock: ${stock.twofa.length})`,
              callback_data: "buy_cat:twofa"
            }
          ],
          [
            {
              text: `🟩 💎 Buy Aged Gmail (${formatINR(config.agedGmailPrice)} • Stock: ${stock.aged.length})`,
              callback_data: "buy_cat:aged"
            }
          ]
        ]
      }
    });
    return;
  }

  // 📤 Sell Gmail (User Submitting Gmail for ₹ Reward)
  if (text === "📤 Sell Gmail") {
    const suggestedUser = `mez.sell.${Math.floor(10000 + Math.random() * 90000)}@gmail.com`;
    const suggestedPass = `Mez#${Math.floor(1000 + Math.random() * 9000)}@`;

    const msg =
      `🟩 📤 <b>Sell Gmail Accounts & Earn Rupees (₹)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Submit your fresh or unlinked Gmail accounts below. Once verified by our Admin team, your wallet is credited automatically!\n\n` +
      `💵 <b>Reward per Approved Gmail:</b> <b><code>${formatINR(config.sellGmailReward)}</code></b>\n` +
      `📧 <b>Suggested Email:</b> <code>${suggestedUser}</code>\n` +
      `🔑 <b>Suggested Password:</b> <code>${suggestedPass}</code>\n\n` +
      `📋 <b>Submission Requirements:</b>\n` +
      `• Provide Email, Password, and Recovery/2FA status.\n` +
      `• Remove any personal phone numbers before submitting.\n\n` +
      `👇 <i>Click the green button below to submit your Gmail account details:</i>`;

    await sendMessage(botToken, chatId, msg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: `🟩 📤 Submit Gmail to Sell (+${formatINR(config.sellGmailReward)})`, callback_data: "start_sell_gmail" }],
          [{ text: "🟦 🔄 Generate New Suggested Credentials", callback_data: "regen_sell_suggestion" }]
        ]
      }
    });
    return;
  }

  // 📂 My Orders / Submissions
  if (text === "📂 My Orders / Submissions") {
    const userOrders = await getJson(kv, `orders:${userId}`, []);
    const userSubmissions = await getJson(kv, `submissions:${userId}`, []);

    if (userOrders.length === 0 && userSubmissions.length === 0) {
      await sendMessage(
        botToken,
        chatId,
        `🟦 📂 <b>My Buy Orders & Sell Submissions</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `You have no Buy Orders or Sell Gmail Submissions yet.\n\n` +
          `• Click <b>🟩 🛒 Buy Gmail</b> to purchase stock accounts.\n` +
          `• Click <b>🟩 📤 Sell Gmail</b> to submit accounts and earn <code>${formatINR(config.sellGmailReward)}</code> each!`
      );
      return;
    }

    const buySection =
      userOrders.length === 0
        ? "<i>No Gmail purchase orders yet.</i>"
        : userOrders
            .slice(-5)
            .reverse()
            .map((ord, idx) => {
              const statusBadge =
                ord.status === "approved"
                  ? "🟩 ✅ Approved & Dispatched"
                  : ord.status === "rejected"
                  ? "🟥 ❌ Rejected"
                  : "⏳ Pending Verification";
              const credsStr =
                ord.accounts && ord.accounts.length > 0
                  ? `\n   🔑 <b>Credentials:</b>\n` + ord.accounts.map((c) => `   <code>${escapeHtml(c)}</code>`).join("\n")
                  : "";
              return (
                `${idx + 1}. <b>Buy #${escapeHtml(ord.id)}</b> (${escapeHtml(ord.categoryTitle)})\n` +
                `   • Qty: <code>${ord.quantity}</code> | Paid: <code>${formatINR(ord.totalAmount)}</code> | ${statusBadge}${credsStr}`
              );
            })
            .join("\n\n");

    const sellSection =
      userSubmissions.length === 0
        ? "<i>No Sell Gmail submissions yet.</i>"
        : userSubmissions
            .slice(-5)
            .reverse()
            .map((sub, idx) => {
              const badge =
                sub.status === "approved"
                  ? `🟩 ✅ Approved (+${formatINR(sub.reward)})`
                  : sub.status === "rejected"
                  ? "🟥 ❌ Rejected"
                  : "⏳ Pending Admin Review";
              return (
                `${idx + 1}. <b>Sell #${escapeHtml(sub.id)}</b> — <code>${escapeHtml(sub.email)}</code>\n` +
                `   • Reward: <code>${formatINR(sub.reward)}</code> | Status: ${badge}`
              );
            })
            .join("\n\n");

    await sendMessage(
      botToken,
      chatId,
      `🟦 📂 <b>My Activity History</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🛒 <b>Recent Buy Orders (${userOrders.length}):</b>\n${buySection}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📤 <b>Recent Sell Submissions (${userSubmissions.length}):</b>\n${sellSection}`
    );
    return;
  }

  // 💰 Balance / Deposit
  if (text === "💰 Balance / Deposit") {
    const wdBadge = config.withdrawalsEnabled ? "🟩 Active (UPI)" : "🟥 Temporarily Paused";
    const msg =
      `🟩 💰 <b>Your Rupees Wallet & UPI Payouts</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>User:</b> ${escapeHtml(user.firstName)} (<code>${user.id}</code>)\n` +
      `💵 <b>Available Balance:</b> <b><code>${formatINR(user.balance)}</code></b>\n` +
      `📈 <b>Total Earned (Sold Gmails & Refs):</b> <code>${formatINR(user.totalEarned)}</code>\n` +
      `📤 <b>Approved Sold Gmails:</b> <code>${user.soldMailsCount || 0} accounts</code>\n` +
      `🛒 <b>Purchased Stock Gmails:</b> <code>${user.purchasedCount || 0} accounts (${formatINR(user.totalSpent || 0)})</code>\n` +
      `🏦 <b>Total Withdrawn (UPI):</b> <code>${formatINR(user.totalWithdrawn)}</code>\n` +
      `📲 <b>Saved UPI ID:</b> <code>${escapeHtml(user.upiId || "Not Linked")}</code>\n` +
      `⭕ <b>UPI Withdrawals:</b> ${wdBadge}\n` +
      `📉 <b>Min. UPI Withdrawal:</b> <code>${formatINR(config.minWithdrawal)}</code>`;

    await sendMessage(botToken, chatId, msg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🟩 💸 Withdraw Balance to UPI", callback_data: "request_upi_withdrawal" }],
          [{ text: "🟦 📲 Set / Update My UPI ID", callback_data: "set_user_upi" }],
          [
            { text: "🟩 🛒 Buy Gmail", callback_data: "buy_cat:standard" },
            { text: "🟩 📤 Sell Gmail", callback_data: "start_sell_gmail" }
          ]
        ]
      }
    });
    return;
  }

  // 👥 Referrals (Strictly uses env.BOT_USERNAME -> @Mezmailsbot or fallback to Mezmailsbot)
  if (text === "👥 Referrals") {
    const botUsername = resolveBotUsername(env, message?.via_bot?.username);
    const refLink = `https://t.me/${botUsername}?start=ref_${user.id}`;
    const msg =
      `🟦 👥 <b>Refer & Earn Indian Rupees (₹)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Invite friends to <b>${BOT_NAME}</b> (<code>@${escapeHtml(botUsername)}</code>) and earn instant Rupees directly in your wallet!\n\n` +
      `🎁 <b>Per Referral Bonus:</b> <code>${formatINR(config.referralBonus)}</code>\n` +
      `👤 <b>Total Referrals:</b> <code>${user.referralsCount || 0} Users</code>\n` +
      `💵 <b>Total Referral Earnings:</b> <code>${formatINR((user.referralsCount || 0) * Number(config.referralBonus))}</code>\n\n` +
      `🔗 <b>Your Personal Invite Link:</b>\n<code>${refLink}</code>`;

    await sendMessage(botToken, chatId, msg, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🟩 📤 Share Referral Link on Telegram",
              url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(`Buy & Sell Gmail accounts for instant ₹ via UPI on ${BOT_NAME}!`)}`
            }
          ]
        ]
      }
    });
    return;
  }

  // 🎁 Rewards
  if (text === "🎁 Rewards") {
    const msg =
      `🟩 🎁 <b>Daily Rewards & Promo Redeem Center</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Claim your daily ₹ check-in bonus or redeem special gift codes shared in our official channel!\n\n` +
      `🎯 <b>Daily Check-In Bonus:</b> <code>${formatINR(config.dailyBonus)}</code>\n` +
      `🎟️ <b>Redeem Gift Codes:</b> Instant ₹ Wallet Credit`;

    await sendMessage(botToken, chatId, msg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: `🟩 📅 Claim Daily Bonus (${formatINR(config.dailyBonus)})`, callback_data: "claim_daily_bonus" }],
          [{ text: "🟦 🎟️ Enter Promo Redeem Code", callback_data: "enter_redeem_code" }]
        ]
      }
    });
    return;
  }

  // ⚙️ Settings
  if (text === "⚙️ Settings") {
    const msg =
      `🟦 ⚙️ <b>Account & UPI Payout Settings</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🆔 <b>Telegram ID:</b> <code>${user.id}</code>\n` +
      `📲 <b>Linked UPI ID:</b> <code>${escapeHtml(user.upiId || "Not Set (Click below to link)")}</code>\n` +
      `🔔 <b>Order & Submission Alerts:</b> ${user.notifications ? "🟩 Enabled" : "🟥 Muted"}\n` +
      `💱 <b>Account Currency:</b> <code>Indian Rupees (₹ / INR)</code>`;

    await sendMessage(botToken, chatId, msg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🟦 📲 Link / Update UPI ID (Paytm, PhonePe, GPay)", callback_data: "set_user_upi" }],
          [
            {
              text: user.notifications ? "🟥 🔕 Mute Bot Notifications" : "🟩 🔔 Enable Bot Notifications",
              callback_data: "toggle_notifications"
            }
          ]
        ]
      }
    });
    return;
  }

  // ❓ Help (Strictly uses https://t.me/mezmail)
  if (text === "❓ Help") {
    const msg =
      `🟦 ❓ <b>Help & Official Support Guide</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>1️⃣ How to Sell Gmail Accounts (🟩 📤 Sell Gmail):</b>\n` +
      `• Click <b>🟩 📤 Sell Gmail</b> and submit the Gmail address, password, and recovery/2FA info.\n` +
      `• Our Admin reviews your submission and clicks <b>🟩 ✅ Approve & Pay User</b>, crediting <code>${formatINR(config.sellGmailReward)}</code> to your wallet!\n\n` +
      `<b>2️⃣ How to Buy Gmail Stock (🟩 🛒 Buy Gmail):</b>\n` +
      `• Choose a category, select quantity, pay via the displayed <b>UPI QR Code / UPI ID</b>, and upload your <b>Payment Screenshot</b>.\n` +
      `• Admin approves and the bot dispatches your credentials automatically!\n\n` +
      `<b>3️⃣ UPI Withdrawals:</b>\n` +
      `• Link your UPI ID in <b>🟦 ⚙️ Settings</b> and withdraw once your balance reaches <code>${formatINR(config.minWithdrawal)}</code>.\n\n` +
      `💬 <b>Official Support Group:</b>\n<a href="${SUPPORT_GROUP_URL}">${SUPPORT_GROUP_URL}</a>`;

    await sendMessage(botToken, chatId, msg, {
      reply_markup: {
        inline_keyboard: [[{ text: "🟦 💬 Join Official Support (t.me/mezmail)", url: SUPPORT_GROUP_URL }]]
      }
    });
    return;
  }

  // --------------------------------------------------------------------------
  // 2. ENHANCED VIBRANT ADMIN CONTROL PANEL
  // --------------------------------------------------------------------------
  if (text === "🛡️ Admin Panel" || text === "/admin") {
    if (!isAdmin) {
      await sendMessage(botToken, chatId, "🟥 ⛔ <b>Access Denied:</b> Only Super Admin and authorized admins can open this panel.");
      return;
    }

    const usersIndex = await getJson(kv, "index:users", []);
    const payouts = await getJson(kv, "index:payouts", []);
    const orders = await getJson(kv, "index:orders", []);
    const submissions = await getJson(kv, "index:submissions", []);
    const stock = await getStockStore(kv);

    const pendingPayouts = payouts.filter((p) => p.status === "pending").length;
    const pendingOrders = orders.filter((o) => o.status === "pending").length;
    const pendingSubs = submissions.filter((s) => s.status === "pending").length;
    const totalStock = stock.standard.length + stock.twofa.length + stock.aged.length;

    const adminDashboard =
      `🛡️ <b>${BOT_NAME} — Vibrant Admin Control Panel</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👋 Welcome, Administrator (<code>${userId}</code>)!\n` +
      `Role: <b>${userId === SUPER_ADMIN_ID ? "👑 Super Admin" : "🛡️ Authorized Admin"}</b>\n\n` +
      `📊 <b>Live Queues & Stock Inventory:</b>\n` +
      `• 🟩 🛒 Buy Stock Available: <code>${totalStock}</code> (Std: ${stock.standard.length} | 2FA: ${stock.twofa.length} | Aged: ${stock.aged.length})\n` +
      `• 🟦 📤 Pending Sell Submissions: <code>${pendingSubs} awaiting review</code>\n` +
      `• 🟦 🧾 Pending Buy Orders: <code>${pendingOrders} awaiting verification</code>\n` +
      `• 🟩 💸 Pending UPI Payouts: <code>${pendingPayouts} requests</code>\n` +
      `• 🟦 👥 Total Registered Users: <code>${usersIndex.length}</code> (Paginated 10/page)\n\n` +
      `💳 <b>Active Rates & UPI Settings (₹):</b>\n` +
      `• 🟩 📤 Sell Gmail Reward: <code>${formatINR(config.sellGmailReward)}</code>\n` +
      `• 🟩 🛒 Buy Prices: Std <code>${formatINR(config.standardGmailPrice)}</code> | 2FA <code>${formatINR(config.twofaGmailPrice)}</code> | Aged <code>${formatINR(config.agedGmailPrice)}</code>\n` +
      `• 🟦 📲 Merchant UPI ID: <code>${escapeHtml(config.upiId)}</code>\n` +
      `• 🟥 ⭕ UPI Withdrawals: <b>${config.withdrawalsEnabled ? "🟩 ENABLED" : "🟥 DISABLED"}</b>\n\n` +
      `👇 <i>Select a color-coded control button below (🟩 Run/Manage | 🟦 View/Nav | 🟥 Toggle/Danger):</i>`;

    await sendMessage(botToken, chatId, adminDashboard, {
      reply_markup: getAdminPanelKeyboard()
    });
    return;
  }

  if (!isAdmin) {
    await sendMessage(botToken, chatId, "💡 Please choose an option from the bottom menu.", {
      reply_markup: getUserMainKeyboard(false)
    });
    return;
  }

  // Row 1 Left: 💳 Manage Payouts
  if (text === "💳 Manage Payouts") {
    const payouts = await getJson(kv, "index:payouts", []);
    const pending = payouts.filter((p) => p.status === "pending");

    if (pending.length === 0) {
      await sendMessage(
        botToken,
        chatId,
        `🟩 💳 <b>Manage UPI Withdrawal Requests</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `✅ <b>0 Pending UPI Withdrawals</b> in queue.\n` +
          `Total Historical Payout Requests: <code>${payouts.length}</code>`
      );
      return;
    }

    for (const item of pending.slice(0, 5)) {
      const pText =
        `💸 <b>Pending UPI Withdrawal #${escapeHtml(item.id)}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>User:</b> ${escapeHtml(item.firstName)} (<code>${item.userId}</code>)\n` +
        `💵 <b>Amount:</b> <code>${formatINR(item.amount)}</code>\n` +
        `📲 <b>User UPI ID:</b> <code>${escapeHtml(item.upiId)}</code>\n` +
        `🕒 <b>Requested:</b> <code>${escapeHtml(item.createdAt)}</code>`;

      await sendMessage(botToken, chatId, pText, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🟩 ✅ Mark UPI Paid", callback_data: `payout_approve:${item.id}` },
              { text: "🟥 ❌ Reject & Refund ₹", callback_data: `payout_reject:${item.id}` }
            ]
          ]
        }
      });
    }
    return;
  }

  // Row 1 Right: 👥 View Users List (Paginated 10 users per page!)
  if (text === "👥 View Users List") {
    const view = await buildPaginatedUsersView(kv, 1);
    await sendMessage(botToken, chatId, view.text, {
      reply_markup: view.reply_markup
    });
    return;
  }

  // Row 2 Left: ➕ Add Force Channel
  if (text === "➕ Add Force Channel") {
    await setUserState(kv, userId, "AWAITING_NEW_FORCE_CHANNEL", {});
    await sendMessage(
      botToken,
      chatId,
      `🟦 ➕ <b>Add Mandatory Force-Join Channel</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Send the channel details in the format:\n` +
        `<code>@ChannelUsername | Channel Title | https://t.me/ChannelUsername</code>\n\n` +
        `<i>Example:</i>\n` +
        `<code>@mezmail | MEZ Official Support | https://t.me/mezmail</code>`,
      { reply_markup: getCancelInlineKeyboard() }
    );
    return;
  }

  // Row 2 Right: 📋 View/Remove Channels
  if (text === "📋 View/Remove Channels") {
    const channels = await getForceChannels(kv);
    if (channels.length === 0) {
      await sendMessage(
        botToken,
        chatId,
        `🟦 📋 <b>Mandatory Force-Join Channels</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `No mandatory channels are currently configured. Click <b>🟦 ➕ Add Force Channel</b> to add one.`
      );
      return;
    }

    const buttons = channels.map((ch) => [
      {
        text: `🟥 🗑️ Remove ${ch.title || ch.username} (${ch.username})`,
        callback_data: `del_channel:${ch.username}`
      }
    ]);

    await sendMessage(
      botToken,
      chatId,
      `🟦 📋 <b>Active Force-Join Channels (${channels.length})</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        channels.map((c, i) => `${i + 1}. <b>${escapeHtml(c.title)}</b> — <code>${escapeHtml(c.username)}</code>`).join("\n") +
        `\n\n👇 <i>Click a red button below to remove a channel:</i>`,
      { reply_markup: { inline_keyboard: buttons } }
    );
    return;
  }

  // Row 3 Left: 🎟️ Create Redeem Code
  if (text === "🎟️ Create Redeem Code") {
    await setUserState(kv, userId, "AWAITING_NEW_REDEEM_CODE", {});
    await sendMessage(
      botToken,
      chatId,
      `🟩 🎟️ <b>Create Rupees (₹) Redeem Code</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Send the new redeem code in the format:\n` +
        `<code>CODE_NAME | AMOUNT_INR | MAX_CLAIMS</code>\n\n` +
        `<i>Example:</i>\n` +
        `<code>MEZBONUS50 | 25 | 50</code> (Gives ₹25 to 50 users)`,
      { reply_markup: getCancelInlineKeyboard() }
    );
    return;
  }

  // Row 3 Right: 👤 Add Admin
  if (text === "👤 Add Admin") {
    const admins = await getAdmins(kv);
    const buttons = admins
      .filter((id) => Number(id) !== SUPER_ADMIN_ID)
      .map((id) => [{ text: `🟥 🗑️ Revoke Admin ${id}`, callback_data: `revoke_admin:${id}` }]);

    buttons.unshift([{ text: "🟩 ➕ Authorize New Admin ID", callback_data: "prompt_add_admin" }]);

    await sendMessage(
      botToken,
      chatId,
      `🟩 👤 <b>Bot Administrator Management</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Authorized Admins (${admins.length}):\n` +
        admins.map((id) => `• <code>${id}</code> ${Number(id) === SUPER_ADMIN_ID ? "👑 <b>(Super Admin)</b>" : "🛡️ (Admin)"}`).join("\n"),
      { reply_markup: { inline_keyboard: buttons } }
    );
    return;
  }

  // Row 4 Left: 💳 Set Buy/Sell Rates (or 💳 Manage Points)
  if (text === "💳 Set Buy/Sell Rates" || text === "💳 Manage Points") {
    const msg =
      `🟩 💳 <b>Manage Buy Prices, Sell Rewards & Thresholds (₹)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📤 <b>Sell Gmail User Reward:</b> <b><code>${formatINR(config.sellGmailReward)}</code></b>\n` +
      `📩 <b>Buy Standard Gmail Price:</b> <code>${formatINR(config.standardGmailPrice)}</code>\n` +
      `🔐 <b>Buy 2FA Gmail Price:</b> <code>${formatINR(config.twofaGmailPrice)}</code>\n` +
      `💎 <b>Buy Aged Gmail Price:</b> <code>${formatINR(config.agedGmailPrice)}</code>\n` +
      `👥 <b>Referral Bonus Rate:</b> <code>${formatINR(config.referralBonus)}</code>\n` +
      `🎁 <b>Daily Check-In Bonus:</b> <code>${formatINR(config.dailyBonus)}</code>\n` +
      `🏦 <b>Min. UPI Withdrawal:</b> <code>${formatINR(config.minWithdrawal)}</code>\n\n` +
      `👇 <i>Click any rate below to update it in Indian Rupees (₹):</i>`;

    await sendMessage(botToken, chatId, msg, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `🟩 📤 Sell Reward (${formatINR(config.sellGmailReward)})`, callback_data: "set_rate:sellGmailReward" }
          ],
          [
            { text: `🟦 🛒 Std Buy (${formatINR(config.standardGmailPrice)})`, callback_data: "set_rate:standardGmailPrice" },
            { text: `🟦 🛒 2FA Buy (${formatINR(config.twofaGmailPrice)})`, callback_data: "set_rate:twofaGmailPrice" }
          ],
          [
            { text: `🟦 🛒 Aged Buy (${formatINR(config.agedGmailPrice)})`, callback_data: "set_rate:agedGmailPrice" },
            { text: `🟩 👥 Referral (${formatINR(config.referralBonus)})`, callback_data: "set_rate:referralBonus" }
          ],
          [
            { text: `🟩 🎁 Daily Bonus (${formatINR(config.dailyBonus)})`, callback_data: "set_rate:dailyBonus" },
            { text: `🟥 🏦 Min Payout (${formatINR(config.minWithdrawal)})`, callback_data: "set_rate:minWithdrawal" }
          ]
        ]
      }
    });
    return;
  }

  // Row 4 Right: ⭕ Toggle Withdrawals
  if (text === "⭕ Toggle Withdrawals") {
    config.withdrawalsEnabled = !config.withdrawalsEnabled;
    config.updatedAt = new Date().toISOString();
    await putJson(kv, "config:settings", config);

    const statusText = config.withdrawalsEnabled ? "🟩 ENABLED (UPI Open)" : "🟥 DISABLED (Paused)";
    await sendMessage(
      botToken,
      chatId,
      `🟥 ⭕ <b>UPI Withdrawal Status Toggled!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `User UPI Withdrawals are now: <b>${statusText}</b>`,
      { reply_markup: getAdminPanelKeyboard() }
    );
    return;
  }

  // Row 5 Left: 🛒 Manage Buy Stock
  if (text === "🛒 Manage Buy Stock") {
    const stock = await getStockStore(kv);
    const orders = await getJson(kv, "index:orders", []);
    const pendingOrdersCount = orders.filter((o) => o.status === "pending").length;

    const msg =
      `🟩 🛒 <b>Manage Buy Stock & Purchase Orders</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Available Credentials in KV Inventory:\n` +
      `• 📩 <b>Standard Gmail:</b> <code>${stock.standard.length} accounts</code> (${formatINR(config.standardGmailPrice)})\n` +
      `• 🔐 <b>2FA Verified Gmail:</b> <code>${stock.twofa.length} accounts</code> (${formatINR(config.twofaGmailPrice)})\n` +
      `• 💎 <b>Aged High-Trust Gmail:</b> <code>${stock.aged.length} accounts</code> (${formatINR(config.agedGmailPrice)})\n\n` +
      `⏳ <b>Pending Buy Orders:</b> <code>${pendingOrdersCount} awaiting approval</code>\n\n` +
      `👇 <i>Choose a category to bulk-add stock or review pending buyer screenshot orders:</i>`;

    await sendMessage(botToken, chatId, msg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: `🟩 ➕ Add Standard Stock (${stock.standard.length})`, callback_data: "admin_add_stock:standard" }],
          [{ text: `🟩 ➕ Add 2FA Gmail Stock (${stock.twofa.length})`, callback_data: "admin_add_stock:twofa" }],
          [{ text: `🟩 ➕ Add Aged Gmail Stock (${stock.aged.length})`, callback_data: "admin_add_stock:aged" }],
          [{ text: `🟦 🧾 Review Pending Buy Orders (${pendingOrdersCount})`, callback_data: "admin_review_orders" }]
        ]
      }
    });
    return;
  }

  // Row 5 Right: 📤 Manage Sell Submissions
  if (text === "📤 Manage Sell Submissions") {
    const submissions = await getJson(kv, "index:submissions", []);
    const pending = submissions.filter((s) => s.status === "pending");

    if (pending.length === 0) {
      await sendMessage(
        botToken,
        chatId,
        `🟦 📤 <b>User Sell Gmail Submissions</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `✅ There are currently <b>0 pending Sell Gmail submissions</b> awaiting review.\n` +
          `Total Historical Submissions: <code>${submissions.length}</code>`
      );
      return;
    }

    for (const sub of pending.slice(0, 5)) {
      const sText =
        `🟦 📤 <b>Pending Sell Submission #${escapeHtml(sub.id)}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Seller:</b> ${escapeHtml(sub.sellerName)} (<code>${sub.userId}</code>)\n` +
        `📧 <b>Gmail:</b> <code>${escapeHtml(sub.email)}</code>\n` +
        `🔑 <b>Password:</b> <code>${escapeHtml(sub.password)}</code>\n` +
        `🛡️ <b>Recovery / 2FA Info:</b> <code>${escapeHtml(sub.recoveryInfo || "None / Clean")}</code>\n` +
        `💵 <b>Payout Reward:</b> <b><code>${formatINR(sub.reward)}</code></b>\n` +
        `🕒 <b>Submitted:</b> <code>${escapeHtml(sub.createdAt)}</code>`;

      await sendMessage(botToken, chatId, sText, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: `🟩 ✅ Approve & Pay ${formatINR(sub.reward)}`, callback_data: `sell_approve:${sub.id}` },
              { text: "🟥 ❌ Reject", callback_data: `sell_reject:${sub.id}` }
            ]
          ]
        }
      });
    }
    return;
  }

  // Row 6 Left: 📊 Bot Stats
  if (text === "📊 Bot Stats") {
    const usersIndex = await getJson(kv, "index:users", []);
    const payouts = await getJson(kv, "index:payouts", []);
    const orders = await getJson(kv, "index:orders", []);
    const submissions = await getJson(kv, "index:submissions", []);
    const stock = await getStockStore(kv);

    let totalBalances = 0;
    for (const uid of usersIndex) {
      const u = await getJson(kv, `user:${uid}`, null);
      if (u) totalBalances += Number(u.balance || 0);
    }

    const approvedOrders = orders.filter((o) => o.status === "approved");
    const pendingOrders = orders.filter((o) => o.status === "pending");
    const totalSalesRevenue = approvedOrders.reduce((acc, o) => acc + Number(o.totalAmount || 0), 0);

    const approvedSubs = submissions.filter((s) => s.status === "approved");
    const pendingSubs = submissions.filter((s) => s.status === "pending");

    const pendingPayouts = payouts.filter((p) => p.status === "pending");
    const paidPayouts = payouts.filter((p) => p.status === "approved");
    const totalPaidVolume = paidPayouts.reduce((acc, p) => acc + Number(p.amount || 0), 0);

    const statsMsg =
      `🟦 📊 <b>${BOT_NAME} — Live Marketplace & KV Telemetry</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👥 <b>Registered Users:</b> <code>${usersIndex.length}</code>\n` +
      `📦 <b>Available Buy Stock:</b> <code>${stock.standard.length + stock.twofa.length + stock.aged.length}</code>\n` +
      `   • Standard: <code>${stock.standard.length}</code> | 2FA: <code>${stock.twofa.length}</code> | Aged: <code>${stock.aged.length}</code>\n` +
      `🛒 <b>Completed Buy Orders:</b> <code>${approvedOrders.length} (${formatINR(totalSalesRevenue)})</code> | Pending: <code>${pendingOrders.length}</code>\n` +
      `📤 <b>Approved Sold Gmails:</b> <code>${approvedSubs.length}</code> | Pending Review: <code>${pendingSubs.length}</code>\n` +
      `💰 <b>Total User Wallet Balances:</b> <code>${formatINR(totalBalances)}</code>\n` +
      `🏦 <b>Completed UPI Payouts:</b> <code>${paidPayouts.length} (${formatINR(totalPaidVolume)})</code> | Pending: <code>${pendingPayouts.length}</code>\n` +
      `📲 <b>Active Merchant UPI:</b> <code>${escapeHtml(config.upiId)}</code>\n` +
      `💬 <b>Support Group:</b> <a href="${SUPPORT_GROUP_URL}">${SUPPORT_GROUP_URL}</a>`;

    await sendMessage(botToken, chatId, statsMsg);
    return;
  }

  // Row 6 Right: 📢 Broadcast Msg
  if (text === "📢 Broadcast Msg") {
    const usersIndex = await getJson(kv, "index:users", []);
    await setUserState(kv, userId, "AWAITING_BROADCAST_MESSAGE", {});
    await sendMessage(
      botToken,
      chatId,
      `🟦 📢 <b>Global Broadcast Dispatcher</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Recipients: <code>${usersIndex.length} Registered Users</code>\n\n` +
        `Send the announcement text (HTML supported) to broadcast to all users:`,
      { reply_markup: getCancelInlineKeyboard() }
    );
    return;
  }

  // Row 7 Left: 🖼️ Add/Update UPI QR
  if (text === "🖼️ Add/Update UPI QR") {
    await setUserState(kv, userId, "AWAITING_UPI_QR_CONFIG", {});
    const msg =
      `🟦 🖼️ <b>Configure Admin UPI QR Code & UPI ID</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Current Merchant UPI ID: <code>${escapeHtml(config.upiId)}</code>\n` +
      `Current Merchant Name: <code>${escapeHtml(config.upiMerchantName)}</code>\n` +
      `QR Image Status: <b>${config.upiQrFileId || config.upiQrImageUrl ? "🟩 ✅ Active" : "Not Uploaded"}</b>\n\n` +
      `<b>How to update:</b>\n` +
      `• <b>Option A (Upload QR Photo):</b> Send your UPI QR code image directly as a photo with caption:\n` +
      `  <code>yourupi@okaxis | Merchant Name</code>\n` +
      `• <b>Option B (Text / URL):</b> Send text in the format:\n` +
      `  <code>yourupi@okaxis | Merchant Name | https://example.com/qr.png</code>`;

    await sendMessage(botToken, chatId, msg, { reply_markup: getCancelInlineKeyboard() });
    return;
  }

  // Row 7 Right: 🗑️ Clear Pending Queues
  if (text === "🗑️ Clear Pending Queues") {
    const orders = await getJson(kv, "index:orders", []);
    const subs = await getJson(kv, "index:submissions", []);
    const pendingOrdCount = orders.filter((o) => o.status === "pending").length;
    const pendingSubCount = subs.filter((s) => s.status === "pending").length;

    await sendMessage(
      botToken,
      chatId,
      `🟥 🗑️ <b>Queue Maintenance & Cleanup</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `• Pending Buy Orders: <code>${pendingOrdCount}</code>\n` +
        `• Pending Sell Submissions: <code>${pendingSubCount}</code>\n\n` +
        `Select an action below to review or clean up queues:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: `🟦 🧾 Review Pending Buy Orders (${pendingOrdCount})`, callback_data: "admin_review_orders" }],
            [{ text: "🟦 👥 Open Paginated Users List", callback_data: "admin_users_list:1" }]
          ]
        }
      }
    );
    return;
  }
}

// ============================================================================
// STATEFUL INPUT HANDLER (SELL GMAIL, BUY SCREENSHOTS, UPI IDS, STOCK, RATES)
// ============================================================================

async function handleStatefulInput(message, user, isAdmin, config, botToken, kv) {
  const chatId = message.chat.id;
  const userId = user.id;
  const text = (message.text || message.caption || "").trim();
  const state = user.state;

  // 1. User submitting a Gmail account to SELL for ₹ reward
  if (state === "AWAITING_SELL_GMAIL_SUBMISSION") {
    const parts = text.includes("|")
      ? text.split("|").map((s) => s.trim())
      : text.split(":").map((s) => s.trim());

    const email = (parts[0] || "").toLowerCase();
    const password = parts[1] || "";
    const recoveryInfo = parts.slice(2).join(" ") || "No Recovery / Clean 2FA Off";

    if (!email.endsWith("@gmail.com") || password.length < 5) {
      await sendMessage(
        botToken,
        chatId,
        `🟥 ⚠️ <b>Invalid Submission Format!</b>\nPlease send the Gmail address, password, and optional recovery/2FA info in either format:\n\n` +
          `<code>youraccount@gmail.com | Password123 | No Recovery</code>\n` +
          `<i>or</i>\n` +
          `<code>youraccount@gmail.com:Password123:NoRecovery</code>`,
        { reply_markup: getCancelInlineKeyboard() }
      );
      return;
    }

    const subId = `SELL-${Math.floor(100000 + Math.random() * 900000)}`;
    const reward = Number(config.sellGmailReward) || 10;
    const submission = {
      id: subId,
      userId,
      sellerName: user.firstName,
      sellerUsername: user.username || "",
      email,
      password,
      recoveryInfo,
      reward,
      status: "pending",
      createdAt: new Date().toISOString().slice(0, 16).replace("T", " ")
    };

    const allSubs = await getJson(kv, "index:submissions", []);
    allSubs.unshift(submission);
    await putJson(kv, "index:submissions", allSubs);

    const userSubs = await getJson(kv, `submissions:${userId}`, []);
    userSubs.push(submission);
    await putJson(kv, `submissions:${userId}`, userSubs);

    await setUserState(kv, userId, null, {});

    await sendMessage(
      botToken,
      chatId,
      `🟩 ✅ <b>Gmail Submitted for Admin Review!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 <b>Submission ID:</b> <code>#${subId}</code>\n` +
        `📧 <b>Gmail Account:</b> <code>${escapeHtml(email)}</code>\n` +
        `🛡️ <b>Recovery/2FA Status:</b> <code>${escapeHtml(recoveryInfo)}</code>\n` +
        `💵 <b>Reward on Approval:</b> <b><code>+${formatINR(reward)}</code></b>\n\n` +
        `⏳ <i>Our Admin team has received your submission card. Once verified, <b>${formatINR(reward)}</b> will be credited to your wallet automatically!</i>`,
      { reply_markup: getUserMainKeyboard(isAdmin) }
    );

    const admins = await getAdmins(kv);
    const adminCardText =
      `🟦 📤 <b>New Sell Gmail Submission — Admin Review</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🆔 <b>Submission ID:</b> <code>#${subId}</code>\n` +
      `👤 <b>Seller:</b> ${escapeHtml(user.firstName)} (<code>${userId}</code>)\n` +
      `📧 <b>Email:</b> <code>${escapeHtml(email)}</code>\n` +
      `🔑 <b>Password:</b> <code>${escapeHtml(password)}</code>\n` +
      `🛡️ <b>Recovery / 2FA:</b> <code>${escapeHtml(recoveryInfo)}</code>\n` +
      `💵 <b>Payout Amount:</b> <b><code>${formatINR(reward)}</code></b>\n\n` +
      `👇 <i>Verify the account login and click Approve to credit ${formatINR(reward)} to the seller's wallet:</i>`;

    const adminCardMarkup = {
      inline_keyboard: [
        [
          { text: `🟩 ✅ Approve & Pay User (${formatINR(reward)})`, callback_data: `sell_approve:${subId}` },
          { text: "🟥 ❌ Reject", callback_data: `sell_reject:${subId}` }
        ]
      ]
    };

    for (const adminId of admins) {
      await sendMessage(botToken, adminId, adminCardText, { reply_markup: adminCardMarkup });
    }
    return;
  }

  // 2. User entering custom Buy quantity
  if (state === "AWAITING_CUSTOM_BUY_QTY") {
    const qty = parseInt(text, 10);
    const category = user.stateData?.category || "standard";
    const stock = await getStockStore(kv);
    const available = (stock[category] || []).length;

    if (isNaN(qty) || qty <= 0) {
      await sendMessage(botToken, chatId, "⚠️ Please enter a valid positive number of Gmail accounts:", {
        reply_markup: getCancelInlineKeyboard()
      });
      return;
    }

    if (qty > available) {
      await sendMessage(
        botToken,
        chatId,
        `⚠️ Only <code>${available}</code> accounts are currently available in <b>${STOCK_CATEGORIES[category]?.title}</b>. Please enter a quantity up to <code>${available}</code>:`,
        { reply_markup: getCancelInlineKeyboard() }
      );
      return;
    }

    await sendUpiCheckoutInvoice(botToken, kv, chatId, userId, category, qty, config);
    return;
  }

  // 3. User uploading UPI Payment Screenshot
  if (state === "AWAITING_PAYMENT_SCREENSHOT") {
    const hasPhoto = Array.isArray(message.photo) && message.photo.length > 0;
    const hasDoc = Boolean(message.document);
    const hasUtrText = text.length >= 4;

    if (!hasPhoto && !hasDoc && !hasUtrText) {
      await sendMessage(
        botToken,
        chatId,
        "📸 <b>Please upload your UPI Payment Screenshot image</b> (or send the 12-digit UPI UTR / Reference number) to submit your order for Admin approval:",
        { reply_markup: getCancelInlineKeyboard() }
      );
      return;
    }

    const { category, categoryTitle, quantity, unitPrice, totalAmount } = user.stateData;
    const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const photoFileId = hasPhoto ? message.photo[message.photo.length - 1].file_id : "";
    const screenshotRef = hasPhoto
      ? `Telegram Photo (${photoFileId.slice(0, 14)}...)`
      : `UTR/Proof: ${text.slice(0, 50)}`;

    const orderItem = {
      id: orderId,
      userId,
      buyerName: user.firstName,
      buyerUsername: user.username || "",
      category,
      categoryTitle,
      quantity,
      unitPrice,
      totalAmount,
      photoFileId,
      screenshotRef,
      status: "pending",
      accounts: [],
      createdAt: new Date().toISOString().slice(0, 16).replace("T", " ")
    };

    const allOrders = await getJson(kv, "index:orders", []);
    allOrders.unshift(orderItem);
    await putJson(kv, "index:orders", allOrders);

    const userOrders = await getJson(kv, `orders:${userId}`, []);
    userOrders.push(orderItem);
    await putJson(kv, `orders:${userId}`, userOrders);

    await setUserState(kv, userId, null, {});

    await sendMessage(
      botToken,
      chatId,
      `🟩 ✅ <b>Payment Screenshot Received!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🧾 <b>Order ID:</b> <code>#${orderId}</code>\n` +
        `📦 <b>Item:</b> ${escapeHtml(categoryTitle)}\n` +
        `🔢 <b>Quantity:</b> <code>${quantity} Account(s)</code>\n` +
        `💰 <b>Amount Paid:</b> <code>${formatINR(totalAmount)}</code>\n` +
        `📸 <b>Proof:</b> <code>${escapeHtml(screenshotRef)}</code>\n\n` +
        `⏳ <i>An instant approval alert with your payment screenshot has been sent to our Admins. As soon as approved, the bot will automatically dispatch your Gmail credentials here!</i>`,
      { reply_markup: getUserMainKeyboard(isAdmin) }
    );

    const admins = await getAdmins(kv);
    const adminCaption =
      `🚨 <b>New Gmail Purchase — Payment Proof Alert</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🧾 <b>Order ID:</b> <code>#${orderId}</code>\n` +
      `👤 <b>Buyer:</b> ${escapeHtml(user.firstName)} (<code>${userId}</code>)\n` +
      `📦 <b>Category:</b> ${escapeHtml(categoryTitle)}\n` +
      `🔢 <b>Quantity:</b> <code>${quantity} Gmail(s)</code>\n` +
      `💰 <b>Total Paid:</b> <b><code>${formatINR(totalAmount)}</code></b>\n` +
      `🧾 <b>Note / UTR:</b> <code>${escapeHtml(text || "Screenshot Attached")}</code>\n\n` +
      `👇 <i>Click "✅ Approve & Dispatch Stock" to auto-deduct from KV and send credentials to buyer:</i>`;

    const approvalMarkup = {
      inline_keyboard: [
        [
          { text: "🟩 ✅ Approve & Dispatch Stock", callback_data: `order_approve:${orderId}` },
          { text: "🟥 ❌ Reject", callback_data: `order_reject:${orderId}` }
        ]
      ]
    };

    for (const adminId of admins) {
      if (photoFileId) {
        await sendPhoto(botToken, adminId, photoFileId, adminCaption, { reply_markup: approvalMarkup });
      } else {
        await sendMessage(botToken, adminId, adminCaption, { reply_markup: approvalMarkup });
      }
    }
    return;
  }

  // 4. User setting or updating their UPI ID
  if (state === "AWAITING_USER_UPI_ID") {
    if (!text.includes("@") || text.length < 5 || text.includes(" ")) {
      await sendMessage(
        botToken,
        chatId,
        "⚠️ <b>Invalid UPI ID Format!</b>\nPlease enter a valid UPI ID (for example: <code>name@paytm</code>, <code>9876543210@ybl</code>, or <code>user@oksbi</code>):",
        { reply_markup: getCancelInlineKeyboard() }
      );
      return;
    }

    user.upiId = text;
    user.state = null;
    user.stateData = {};
    await putJson(kv, `user:${userId}`, user);

    await sendMessage(
      botToken,
      chatId,
      `🟩 ✅ <b>UPI ID Saved Successfully!</b>\nYour ₹ withdrawals will be sent to: <code>${escapeHtml(text)}</code>`,
      { reply_markup: getUserMainKeyboard(isAdmin) }
    );
    return;
  }

  // 5. User requesting a Rupees (₹) UPI withdrawal
  if (state === "AWAITING_UPI_WITHDRAW_AMOUNT") {
    const amount = parseFloat(text);
    const minW = Number(config.minWithdrawal) || 100;

    if (isNaN(amount) || amount <= 0) {
      await sendMessage(botToken, chatId, "⚠️ Please enter a valid withdrawal amount in Rupees (₹):", {
        reply_markup: getCancelInlineKeyboard()
      });
      return;
    }
    if (amount < minW) {
      await sendMessage(botToken, chatId, `⚠️ Minimum UPI withdrawal amount is <code>${formatINR(minW)}</code>.`, {
        reply_markup: getCancelInlineKeyboard()
      });
      return;
    }
    if (amount > Number(user.balance)) {
      await sendMessage(
        botToken,
        chatId,
        `⚠️ Insufficient balance! Your available balance is <code>${formatINR(user.balance)}</code>.`,
        { reply_markup: getCancelInlineKeyboard() }
      );
      return;
    }

    user.balance = Number((user.balance - amount).toFixed(2));
    user.state = null;
    user.stateData = {};
    await putJson(kv, `user:${userId}`, user);

    const payoutId = `UPI-${Math.floor(100000 + Math.random() * 900000)}`;
    const payoutRecord = {
      id: payoutId,
      userId,
      firstName: user.firstName,
      amount,
      upiId: user.upiId,
      status: "pending",
      createdAt: new Date().toISOString().slice(0, 16).replace("T", " ")
    };

    const payouts = await getJson(kv, "index:payouts", []);
    payouts.unshift(payoutRecord);
    await putJson(kv, "index:payouts", payouts);

    await sendMessage(
      botToken,
      chatId,
      `🟩 ✅ <b>UPI Withdrawal Request Submitted!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 <b>Ticket ID:</b> <code>#${payoutId}</code>\n` +
        `💵 <b>Amount:</b> <code>${formatINR(amount)}</code>\n` +
        `📲 <b>UPI ID:</b> <code>${escapeHtml(user.upiId)}</code>\n` +
        `⏳ <b>Status:</b> Pending Admin Transfer`,
      { reply_markup: getUserMainKeyboard(isAdmin) }
    );

    const admins = await getAdmins(kv);
    for (const adminId of admins) {
      await sendMessage(
        botToken,
        adminId,
        `🔔 <b>New UPI Withdrawal Request #${payoutId}</b>\n` +
          `👤 User: ${escapeHtml(user.firstName)} (<code>${userId}</code>)\n` +
          `💵 Amount: <b><code>${formatINR(amount)}</code></b>\n` +
          `📲 UPI ID: <code>${escapeHtml(user.upiId)}</code>`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🟩 ✅ Mark UPI Paid", callback_data: `payout_approve:${payoutId}` },
                { text: "🟥 ❌ Reject & Refund ₹", callback_data: `payout_reject:${payoutId}` }
              ]
            ]
          }
        }
      );
    }
    return;
  }

  // 6. User claiming a Promo Redeem Code
  if (state === "AWAITING_REDEEM_CLAIM") {
    const codeKey = text.toUpperCase();
    const codes = await getJson(kv, "config:redeem_codes", {});
    const item = codes[codeKey];

    if (!item) {
      await sendMessage(botToken, chatId, "🟥 ❌ <b>Invalid or expired redeem code!</b>", {
        reply_markup: getCancelInlineKeyboard()
      });
      return;
    }
    if (item.claimedBy.includes(userId)) {
      await setUserState(kv, userId, null, {});
      await sendMessage(botToken, chatId, "⚠️ You have already claimed this redeem code!");
      return;
    }
    if (item.claimedBy.length >= item.maxClaims) {
      await setUserState(kv, userId, null, {});
      await sendMessage(botToken, chatId, "⚠️ This redeem code has reached its maximum claim limit!");
      return;
    }

    item.claimedBy.push(userId);
    codes[codeKey] = item;
    await putJson(kv, "config:redeem_codes", codes);

    user.balance = Number((user.balance + Number(item.amount)).toFixed(2));
    user.totalEarned = Number((user.totalEarned + Number(item.amount)).toFixed(2));
    user.state = null;
    user.stateData = {};
    await putJson(kv, `user:${userId}`, user);

    await sendMessage(
      botToken,
      chatId,
      `🎉 <b>Redeem Code Claimed!</b>\nCredited: <code>+${formatINR(item.amount)}</code>\nNew Wallet Balance: <code>${formatINR(user.balance)}</code>`,
      { reply_markup: getUserMainKeyboard(isAdmin) }
    );
    return;
  }

  // --------------------------------------------------------------------------
  // ADMIN STATEFUL INPUTS
  // --------------------------------------------------------------------------
  if (!isAdmin) {
    await setUserState(kv, userId, null, {});
    return;
  }

  // 7. Admin adding Gmail stock lines
  if (state === "AWAITING_STOCK_LINES") {
    const category = user.stateData?.category || "standard";
    const rawLines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.includes("@") && l.includes(":"));

    if (rawLines.length === 0) {
      await sendMessage(
        botToken,
        chatId,
        "⚠️ Please send one or more valid <code>email@gmail.com:password</code> lines:",
        { reply_markup: getCancelInlineKeyboard() }
      );
      return;
    }

    const stock = await getStockStore(kv);
    stock[category] = [...(stock[category] || []), ...rawLines];
    await putJson(kv, "config:stock", stock);
    await setUserState(kv, userId, null, {});

    await sendMessage(
      botToken,
      chatId,
      `🟩 ✅ <b>Added ${rawLines.length} Gmail Account(s) to Stock!</b>\n` +
        `📦 Category: <b>${escapeHtml(STOCK_CATEGORIES[category]?.title || category)}</b>\n` +
        `🔢 Updated Available Stock: <code>${stock[category].length} accounts</code>`,
      { reply_markup: getAdminPanelKeyboard() }
    );
    return;
  }

  // 8. Admin updating UPI QR Code & Merchant UPI ID
  if (state === "AWAITING_UPI_QR_CONFIG") {
    const hasPhoto = Array.isArray(message.photo) && message.photo.length > 0;
    if (hasPhoto) {
      config.upiQrFileId = message.photo[message.photo.length - 1].file_id;
    }

    if (text) {
      const parts = text.split("|").map((s) => s.trim());
      if (parts[0] && parts[0].includes("@")) {
        config.upiId = parts[0];
      }
      if (parts[1]) {
        config.upiMerchantName = parts[1];
      }
      if (parts[2] && parts[2].startsWith("http")) {
        config.upiQrImageUrl = parts[2];
      }
    }

    config.updatedAt = new Date().toISOString();
    await putJson(kv, "config:settings", config);
    await setUserState(kv, userId, null, {});

    await sendMessage(
      botToken,
      chatId,
      `🟩 ✅ <b>Admin UPI QR & Merchant Details Updated!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📲 <b>Merchant UPI ID:</b> <code>${escapeHtml(config.upiId)}</code>\n` +
        `🏢 <b>Merchant Name:</b> <code>${escapeHtml(config.upiMerchantName)}</code>\n` +
        `🖼️ <b>QR Photo Uploaded:</b> <code>${config.upiQrFileId ? "Yes (Telegram File ID Saved)" : config.upiQrImageUrl ? "Yes (Image URL Saved)" : "Text Only"}</code>`,
      { reply_markup: getAdminPanelKeyboard() }
    );
    return;
  }

  // 9. Admin updating a rate/price in ₹
  if (state === "AWAITING_RATE_VALUE") {
    const field = user.stateData?.field;
    const val = parseFloat(text);
    if (!field || isNaN(val) || val < 0) {
      await sendMessage(botToken, chatId, "⚠️ Please enter a valid non-negative number in Rupees (₹):", {
        reply_markup: getCancelInlineKeyboard()
      });
      return;
    }

    config[field] = val;
    config.updatedAt = new Date().toISOString();
    await putJson(kv, "config:settings", config);
    await setUserState(kv, userId, null, {});

    await sendMessage(
      botToken,
      chatId,
      `🟩 ✅ <b>Rate Updated in KV!</b>\n<code>${escapeHtml(field)}</code> is now set to <b><code>${formatINR(val)}</code></b>.`,
      { reply_markup: getAdminPanelKeyboard() }
    );
    return;
  }

  // 10. Admin adding Force Channel
  if (state === "AWAITING_NEW_FORCE_CHANNEL") {
    const parts = text.split("|").map((s) => s.trim());
    const username = parts[0]?.startsWith("@") ? parts[0] : `@${parts[0] || ""}`;
    const title = parts[1] || username;
    const inviteLink = parts[2] || `https://t.me/${username.replace(/^@/, "")}`;

    if (username.length < 3) {
      await sendMessage(botToken, chatId, "⚠️ Invalid channel username. Try again:", {
        reply_markup: getCancelInlineKeyboard()
      });
      return;
    }

    const channels = await getForceChannels(kv);
    channels.push({ username, title, inviteLink });
    await putJson(kv, "config:channels", channels);
    await setUserState(kv, userId, null, {});

    await sendMessage(
      botToken,
      chatId,
      `🟩 ✅ <b>Mandatory Channel Added!</b>\n<b>${escapeHtml(title)}</b> (<code>${escapeHtml(username)}</code>) is now required for all users.`,
      { reply_markup: getAdminPanelKeyboard() }
    );
    return;
  }

  // 11. Admin creating Redeem Code in ₹
  if (state === "AWAITING_NEW_REDEEM_CODE") {
    const parts = text.split("|").map((s) => s.trim());
    const code = (parts[0] || "").toUpperCase();
    const amount = parseFloat(parts[1]);
    const maxClaims = parseInt(parts[2], 10);

    if (!code || isNaN(amount) || amount <= 0 || isNaN(maxClaims) || maxClaims <= 0) {
      await sendMessage(
        botToken,
        chatId,
        "⚠️ Invalid format. Send: <code>CODE | AMOUNT_INR | MAX_CLAIMS</code>",
        { reply_markup: getCancelInlineKeyboard() }
      );
      return;
    }

    const codes = await getJson(kv, "config:redeem_codes", {});
    codes[code] = {
      code,
      amount,
      maxClaims,
      claimedBy: [],
      createdAt: new Date().toISOString()
    };
    await putJson(kv, "config:redeem_codes", codes);
    await setUserState(kv, userId, null, {});

    await sendMessage(
      botToken,
      chatId,
      `🟩 🎟️ <b>Redeem Code Created!</b>\n` +
        `• Code: <code>${escapeHtml(code)}</code>\n` +
        `• Value: <code>${formatINR(amount)}</code>\n` +
        `• Max Claims: <code>${maxClaims} users</code>`,
      { reply_markup: getAdminPanelKeyboard() }
    );
    return;
  }

  // 12. Admin adding new Admin ID
  if (state === "AWAITING_NEW_ADMIN_ID") {
    const newAdminId = Number(text);
    if (!newAdminId || isNaN(newAdminId)) {
      await sendMessage(botToken, chatId, "⚠️ Please send a valid numeric Telegram User ID:", {
        reply_markup: getCancelInlineKeyboard()
      });
      return;
    }

    const admins = await getAdmins(kv);
    if (!admins.includes(newAdminId)) {
      admins.push(newAdminId);
      await putJson(kv, "config:admins", admins);
    }
    await setUserState(kv, userId, null, {});

    await sendMessage(
      botToken,
      chatId,
      `🟩 ✅ <b>Admin Authorized!</b>\nUser ID <code>${newAdminId}</code> now has full access to the Admin Panel.`,
      { reply_markup: getAdminPanelKeyboard() }
    );
    return;
  }

  // 13. Admin adjusting user ₹ balance
  if (state === "AWAITING_BALANCE_ADJUSTMENT") {
    const parts = text.split("|").map((s) => s.trim());
    const targetId = Number(parts[0]);
    const delta = Number(parts[1]);

    if (isNaN(targetId) || isNaN(delta)) {
      await sendMessage(
        botToken,
        chatId,
        "⚠️ Format: <code>USER_ID | AMOUNT_INR</code>\nExample: <code>8838351233 | 100</code> or <code>8838351233 | -50</code>",
        { reply_markup: getCancelInlineKeyboard() }
      );
      return;
    }

    const targetUser = await getJson(kv, `user:${targetId}`, null);
    if (!targetUser) {
      await sendMessage(botToken, chatId, `🟥 ❌ User ID <code>${targetId}</code> not found in KV.`, {
        reply_markup: getCancelInlineKeyboard()
      });
      return;
    }

    targetUser.balance = Math.max(0, Number((targetUser.balance + delta).toFixed(2)));
    if (delta > 0) {
      targetUser.totalEarned = Number((targetUser.totalEarned + delta).toFixed(2));
    }
    await putJson(kv, `user:${targetId}`, targetUser);
    await setUserState(kv, userId, null, {});

    await sendMessage(
      botToken,
      chatId,
      `🟩 ✅ <b>User ₹ Balance Updated!</b>\n` +
        `👤 User: <b>${escapeHtml(targetUser.firstName)}</b> (<code>${targetId}</code>)\n` +
        `💰 New Balance: <code>${formatINR(targetUser.balance)}</code>`,
      { reply_markup: getAdminPanelKeyboard() }
    );
    return;
  }

  // 14. Admin broadcasting message
  if (state === "AWAITING_BROADCAST_MESSAGE") {
    const usersIndex = await getJson(kv, "index:users", []);
    await setUserState(kv, userId, null, {});

    let delivered = 0;
    let failed = 0;
    for (const uid of usersIndex) {
      try {
        const res = await sendMessage(
          botToken,
          uid,
          `📢 <b>Official Update — ${BOT_NAME}</b>\n━━━━━━━━━━━━━━━━━━━━━━\n${text}`
        );
        if (res && res.ok) delivered++;
        else failed++;
      } catch {
        failed++;
      }
    }

    await sendMessage(
      botToken,
      chatId,
      `🟩 📢 <b>Broadcast Finished!</b>\n` +
        `• Total Users: <code>${usersIndex.length}</code>\n` +
        `• Delivered: <code>${delivered}</code>\n` +
        `• Failed: <code>${failed}</code>`,
      { reply_markup: getAdminPanelKeyboard() }
    );
  }
}

// ============================================================================
// UPI CHECKOUT INVOICE GENERATOR
// ============================================================================

async function sendUpiCheckoutInvoice(botToken, kv, chatId, userId, category, quantity, config) {
  const catInfo = STOCK_CATEGORIES[category] || STOCK_CATEGORIES.standard;
  const unitPrice = Number(config[catInfo.priceKey] || 15);
  const totalAmount = Number((unitPrice * quantity).toFixed(2));

  await setUserState(kv, userId, "AWAITING_PAYMENT_SCREENSHOT", {
    category,
    categoryTitle: catInfo.title,
    quantity,
    unitPrice,
    totalAmount
  });

  const caption =
    `🧾 <b>UPI Payment Invoice — ${BOT_NAME}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 <b>Selected Category:</b> ${escapeHtml(catInfo.title)}\n` +
    `🔢 <b>Quantity:</b> <code>${quantity} Gmail Account(s)</code>\n` +
    `🏷️ <b>Rate per Gmail:</b> <code>${formatINR(unitPrice)}</code>\n` +
    `💰 <b>Total Payable Amount:</b> <b><code>${formatINR(totalAmount)}</code></b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏦 <b>Pay via Any UPI App (GPay / PhonePe / Paytm):</b>\n` +
    `📲 <b>Merchant UPI ID:</b> <code>${escapeHtml(config.upiId)}</code>\n` +
    `🏢 <b>Payee Name:</b> <code>${escapeHtml(config.upiMerchantName)}</code>\n\n` +
    `📸 <b>Next Step:</b> Complete the payment of <b>${formatINR(totalAmount)}</b> and <b>send the Payment Screenshot image right here</b> in this chat!`;

  const markup = {
    inline_keyboard: [
      [{ text: "🟩 💰 Pay Instantly from Wallet Balance", callback_data: `pay_wallet:${category}:${quantity}` }],
      [{ text: "🟥 ❌ Cancel Order", callback_data: "cancel_state" }]
    ]
  };

  if (config.upiQrFileId) {
    await sendPhoto(botToken, chatId, config.upiQrFileId, caption, { reply_markup: markup });
  } else if (config.upiQrImageUrl) {
    await sendPhoto(botToken, chatId, config.upiQrImageUrl, caption, { reply_markup: markup });
  } else {
    await sendMessage(botToken, chatId, caption, { reply_markup: markup });
  }
}

// ============================================================================
// INLINE CALLBACK QUERY HANDLER
// ============================================================================

async function handleCallbackQuery(query, botToken, kv, env) {
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const userId = Number(query.from.id);
  const data = query.data || "";

  const user = await getOrCreateUser(kv, query.from);
  const isAdmin = await isUserAdmin(kv, userId);
  const config = await getConfig(kv);

  if (data === "cancel_state") {
    await setUserState(kv, userId, null, {});
    await answerCallbackQuery(botToken, query.id, "Operation cancelled");
    await sendMessage(botToken, chatId, "🟥 ❌ <b>Operation cancelled.</b>");
    return;
  }

  if (data === "verify_membership") {
    const check = await verifyForceChannels(botToken, kv, userId);
    if (!check.passed) {
      await answerCallbackQuery(
        botToken,
        query.id,
        `❌ Please join all ${check.missing.length} mandatory channel(s) first!`,
        true
      );
      return;
    }
    await answerCallbackQuery(botToken, query.id, "✅ Verified!");
    await sendMessage(botToken, chatId, `🟩 ✅ <b>Membership Verified!</b> Welcome to <b>${BOT_NAME}</b>.`, {
      reply_markup: getUserMainKeyboard(isAdmin)
    });
    return;
  }

  // --------------------------------------------------------------------------
  // SELL GMAIL CALLBACKS
  // --------------------------------------------------------------------------
  if (data === "regen_sell_suggestion") {
    const suggestedUser = `mez.sell.${Math.floor(10000 + Math.random() * 90000)}@gmail.com`;
    const suggestedPass = `Mez#${Math.floor(1000 + Math.random() * 9000)}@`;
    const msg =
      `🟩 📤 <b>Sell Gmail Accounts & Earn Rupees (₹)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💵 <b>Reward per Approved Gmail:</b> <b><code>${formatINR(config.sellGmailReward)}</code></b>\n` +
      `📧 <b>Suggested Email:</b> <code>${suggestedUser}</code>\n` +
      `🔑 <b>Suggested Password:</b> <code>${suggestedPass}</code>\n\n` +
      `👇 <i>Click below to submit your Gmail account for Admin approval:</i>`;

    await answerCallbackQuery(botToken, query.id, "Generated new credentials!");
    await editMessageText(botToken, chatId, messageId, msg, {
      reply_markup: {
        inline_keyboard: [
          [{ text: `🟩 📤 Submit Gmail to Sell (+${formatINR(config.sellGmailReward)})`, callback_data: "start_sell_gmail" }],
          [{ text: "🟦 🔄 Generate New Suggested Credentials", callback_data: "regen_sell_suggestion" }]
        ]
      }
    });
    return;
  }

  if (data === "start_sell_gmail") {
    await setUserState(kv, userId, "AWAITING_SELL_GMAIL_SUBMISSION", {});
    await answerCallbackQuery(botToken, query.id);
    await sendMessage(
      botToken,
      chatId,
      `🟩 📤 <b>Submit Gmail Account to Sell</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Reward on Admin Approval: <b><code>${formatINR(config.sellGmailReward)}</code></b>\n\n` +
        `Please send your Gmail details in the following format:\n` +
        `<code>email@gmail.com | Password123 | Recovery/2FA Status</code>\n\n` +
        `<i>Example:</i>\n` +
        `<code>mez.task99@gmail.com | Mez#9182 | No Recovery, 2FA Off</code>`,
      { reply_markup: getCancelInlineKeyboard() }
    );
    return;
  }

  // --------------------------------------------------------------------------
  // BUY GMAIL CALLBACKS
  // --------------------------------------------------------------------------
  if (data.startsWith("buy_cat:")) {
    const category = data.replace("buy_cat:", "");
    const catInfo = STOCK_CATEGORIES[category] || STOCK_CATEGORIES.standard;
    const stock = await getStockStore(kv);
    const available = (stock[category] || []).length;
    const unitPrice = Number(config[catInfo.priceKey] || 15);

    if (available === 0) {
      await answerCallbackQuery(
        botToken,
        query.id,
        `⚠️ ${catInfo.title} is currently Out of Stock! Please check back soon or contact support.`,
        true
      );
      return;
    }

    await answerCallbackQuery(botToken, query.id);
    const qtyButtons = [1, 2, 5, 10]
      .filter((q) => q <= available)
      .map((q) => ({
        text: `🟩 Buy ${q} (${formatINR(q * unitPrice)})`,
        callback_data: `buy_qty:${category}:${q}`
      }));

    const rows = [];
    for (let i = 0; i < qtyButtons.length; i += 2) {
      rows.push(qtyButtons.slice(i, i + 2));
    }
    rows.push([{ text: "🟦 🔢 Enter Custom Quantity", callback_data: `buy_custom:${category}` }]);

    await sendMessage(
      botToken,
      chatId,
      `🟩 🛒 <b>${escapeHtml(catInfo.title)}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📝 <i>${escapeHtml(catInfo.description)}</i>\n\n` +
        `🏷️ <b>Price:</b> <code>${formatINR(unitPrice)} / account</code>\n` +
        `📦 <b>Available in Stock:</b> <code>${available} accounts</code>\n\n` +
        `👇 <i>Select how many Gmail accounts you want to buy:</i>`,
      { reply_markup: { inline_keyboard: rows } }
    );
    return;
  }

  if (data.startsWith("buy_qty:")) {
    const parts = data.split(":");
    const category = parts[1];
    const quantity = parseInt(parts[2], 10);
    const stock = await getStockStore(kv);
    const available = (stock[category] || []).length;

    if (quantity > available) {
      await answerCallbackQuery(botToken, query.id, `Only ${available} left in stock!`, true);
      return;
    }

    await answerCallbackQuery(botToken, query.id, "Generating UPI QR Invoice...");
    await sendUpiCheckoutInvoice(botToken, kv, chatId, userId, category, quantity, config);
    return;
  }

  if (data.startsWith("buy_custom:")) {
    const category = data.replace("buy_custom:", "");
    const stock = await getStockStore(kv);
    const available = (stock[category] || []).length;

    await setUserState(kv, userId, "AWAITING_CUSTOM_BUY_QTY", { category });
    await answerCallbackQuery(botToken, query.id);
    await sendMessage(
      botToken,
      chatId,
      `🟦 🔢 <b>Enter Quantity to Purchase</b>\nAvailable Stock: <code>${available} accounts</code>\n\nSend the number of Gmail accounts you want to buy:`,
      { reply_markup: getCancelInlineKeyboard() }
    );
    return;
  }

  if (data.startsWith("pay_wallet:")) {
    const [, category, qtyStr] = data.split(":");
    const quantity = parseInt(qtyStr, 10);
    const catInfo = STOCK_CATEGORIES[category] || STOCK_CATEGORIES.standard;
    const unitPrice = Number(config[catInfo.priceKey] || 15);
    const totalAmount = Number((unitPrice * quantity).toFixed(2));

    const stock = await getStockStore(kv);
    if ((stock[category] || []).length < quantity) {
      await answerCallbackQuery(botToken, query.id, "⚠️ Not enough stock remaining!", true);
      return;
    }
    if (Number(user.balance) < totalAmount) {
      await answerCallbackQuery(
        botToken,
        query.id,
        `⚠️ Insufficient Wallet Balance! You need ${formatINR(totalAmount)} (Available: ${formatINR(user.balance)}). Please pay via UPI QR & upload screenshot.`,
        true
      );
      return;
    }

    const dispatched = stock[category].splice(0, quantity);
    await putJson(kv, "config:stock", stock);

    user.balance = Number((user.balance - totalAmount).toFixed(2));
    user.totalSpent = Number(((user.totalSpent || 0) + totalAmount).toFixed(2));
    user.purchasedCount = (user.purchasedCount || 0) + quantity;
    user.state = null;
    user.stateData = {};
    await putJson(kv, `user:${userId}`, user);

    const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const completedOrder = {
      id: orderId,
      userId,
      buyerName: user.firstName,
      category,
      categoryTitle: catInfo.title,
      quantity,
      unitPrice,
      totalAmount,
      screenshotRef: "Paid via Wallet Balance",
      status: "approved",
      accounts: dispatched,
      createdAt: new Date().toISOString().slice(0, 16).replace("T", " ")
    };

    const allOrders = await getJson(kv, "index:orders", []);
    allOrders.unshift(completedOrder);
    await putJson(kv, "index:orders", allOrders);

    const userOrders = await getJson(kv, `orders:${userId}`, []);
    userOrders.push(completedOrder);
    await putJson(kv, `orders:${userId}`, userOrders);

    await answerCallbackQuery(botToken, query.id, "✅ Order Dispatched!");
    await sendMessage(
      botToken,
      chatId,
      `🎉 <b>Order #${orderId} Dispatched Instantly!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📦 <b>Category:</b> ${escapeHtml(catInfo.title)}\n` +
        `Paid from Wallet: <code>${formatINR(totalAmount)}</code>\n\n` +
        `🔑 <b>Your Purchased Gmail Credentials:</b>\n` +
        dispatched.map((c, i) => `${i + 1}. <code>${escapeHtml(c)}</code>`).join("\n")
    );
    return;
  }

  // --------------------------------------------------------------------------
  // WALLET & SETTINGS CALLBACKS
  // --------------------------------------------------------------------------
  if (data === "set_user_upi") {
    await setUserState(kv, userId, "AWAITING_USER_UPI_ID", {});
    await answerCallbackQuery(botToken, query.id);
    await sendMessage(
      botToken,
      chatId,
      `🟦 📲 <b>Link Your UPI ID for ₹ Withdrawals</b>\n` +
        `Current UPI ID: <code>${escapeHtml(user.upiId || "Not Set")}</code>\n\n` +
        `Please send your valid UPI ID (e.g. <code>yourname@paytm</code>, <code>mobile@ybl</code>, <code>name@oksbi</code>):`,
      { reply_markup: getCancelInlineKeyboard() }
    );
    return;
  }

  if (data === "request_upi_withdrawal") {
    if (!config.withdrawalsEnabled) {
      await answerCallbackQuery(
        botToken,
        query.id,
        "🔴 UPI Withdrawals are temporarily paused by Admin. Please try again later.",
        true
      );
      return;
    }
    if (!user.upiId) {
      await answerCallbackQuery(
        botToken,
        query.id,
        "⚠️ Please link your UPI ID first using '📲 Set / Update My UPI ID'!",
        true
      );
      return;
    }
    if (Number(user.balance) < Number(config.minWithdrawal)) {
      await answerCallbackQuery(
        botToken,
        query.id,
        `⚠️ Minimum UPI withdrawal is ${formatINR(config.minWithdrawal)}. Your balance is ${formatINR(user.balance)}.`,
        true
      );
      return;
    }

    await setUserState(kv, userId, "AWAITING_UPI_WITHDRAW_AMOUNT", {});
    await answerCallbackQuery(botToken, query.id);
    await sendMessage(
      botToken,
      chatId,
      `🟩 💸 <b>Withdraw Rupees (₹) to UPI</b>\n` +
        `Available Balance: <code>${formatINR(user.balance)}</code>\n` +
        `Receiving UPI ID: <code>${escapeHtml(user.upiId)}</code>\n\n` +
        `Enter the ₹ amount you want to withdraw:`,
      { reply_markup: getCancelInlineKeyboard() }
    );
    return;
  }

  if (data === "toggle_notifications") {
    user.notifications = !user.notifications;
    await putJson(kv, `user:${userId}`, user);
    await answerCallbackQuery(botToken, query.id, "Notification settings updated!");
    await sendMessage(
      botToken,
      chatId,
      `🔔 Order & submission notifications are now <b>${user.notifications ? "🟩 Enabled" : "🟥 Muted"}</b>.`
    );
    return;
  }

  if (data === "claim_daily_bonus") {
    const today = new Date().toISOString().slice(0, 10);
    if (user.lastDailyBonus === today) {
      await answerCallbackQuery(botToken, query.id, "⏳ You already claimed today's ₹ bonus! Come back tomorrow.", true);
      return;
    }

    const bonus = Number(config.dailyBonus) || 2;
    user.lastDailyBonus = today;
    user.balance = Number((user.balance + bonus).toFixed(2));
    user.totalEarned = Number((user.totalEarned + bonus).toFixed(2));
    await putJson(kv, `user:${userId}`, user);

    await answerCallbackQuery(botToken, query.id, `🎉 +${formatINR(bonus)} Daily Bonus Credited!`, true);
    await sendMessage(
      botToken,
      chatId,
      `🟩 🎁 <b>Daily Bonus Claimed!</b>\nCredited <code>+${formatINR(bonus)}</code>. New Wallet Balance: <code>${formatINR(user.balance)}</code>.`
    );
    return;
  }

  if (data === "enter_redeem_code") {
    await setUserState(kv, userId, "AWAITING_REDEEM_CLAIM", {});
    await answerCallbackQuery(botToken, query.id);
    await sendMessage(
      botToken,
      chatId,
      `🟦 🎟️ <b>Redeem Rupees Promo Code</b>\nSend your promotional code below to claim instant ₹ balance:`,
      { reply_markup: getCancelInlineKeyboard() }
    );
    return;
  }

  // --------------------------------------------------------------------------
  // ADMIN CALLBACK ACTIONS
  // --------------------------------------------------------------------------
  if (!isAdmin) {
    await answerCallbackQuery(botToken, query.id, "⛔ Admin access required.", true);
    return;
  }

  // Admin: Paginated Users List (`admin_users_list` or `admin_users_list:<page>`)
  if (data === "admin_users_list" || data.startsWith("admin_users_list:")) {
    const rawPage = data.includes(":") ? parseInt(data.split(":")[1], 10) : 1;
    const view = await buildPaginatedUsersView(kv, rawPage);
    await answerCallbackQuery(botToken, query.id, `Page ${view.page} of ${view.totalPages}`);
    await editMessageText(botToken, chatId, messageId, view.text, {
      reply_markup: view.reply_markup
    });
    return;
  }

  if (data.startsWith("admin_users_page_info:")) {
    const p = data.split(":")[1] || "1";
    await answerCallbackQuery(botToken, query.id, `Viewing Page ${p} (${USERS_PER_PAGE} users per page)`);
    return;
  }

  // Admin: Approve or Reject User's Sell Gmail Submission (Credits ₹ to Seller Wallet)
  if (data.startsWith("sell_approve:") || data.startsWith("sell_reject:")) {
    const isApprove = data.startsWith("sell_approve:");
    const subId = data.split(":")[1];
    const allSubs = await getJson(kv, "index:submissions", []);
    const idx = allSubs.findIndex((s) => s.id === subId);

    if (idx === -1 || allSubs[idx].status !== "pending") {
      await answerCallbackQuery(botToken, query.id, "Submission already processed!", true);
      return;
    }

    const sub = allSubs[idx];
    sub.status = isApprove ? "approved" : "rejected";
    sub.processedAt = new Date().toISOString();
    allSubs[idx] = sub;
    await putJson(kv, "index:submissions", allSubs);

    const userSubs = await getJson(kv, `submissions:${sub.userId}`, []);
    const uSubIdx = userSubs.findIndex((s) => s.id === subId);
    if (uSubIdx !== -1) {
      userSubs[uSubIdx] = sub;
    } else {
      userSubs.push(sub);
    }
    await putJson(kv, `submissions:${sub.userId}`, userSubs);

    if (isApprove) {
      const seller = await getJson(kv, `user:${sub.userId}`, null);
      const reward = Number(sub.reward || config.sellGmailReward || 10);
      if (seller) {
        seller.balance = Number(((seller.balance || 0) + reward).toFixed(2));
        seller.totalEarned = Number(((seller.totalEarned || 0) + reward).toFixed(2));
        seller.soldMailsCount = (seller.soldMailsCount || 0) + 1;
        await putJson(kv, `user:${sub.userId}`, seller);
      }

      await answerCallbackQuery(botToken, query.id, `✅ Approved & Paid ${formatINR(reward)}!`);
      await editMessageText(
        botToken,
        chatId,
        messageId,
        `🟩 ✅ <b>SELL SUBMISSION APPROVED & PAID</b>\n` +
          `Submission: <code>#${escapeHtml(sub.id)}</code> | Seller: <code>${sub.userId}</code>\n` +
          `Gmail: <code>${escapeHtml(sub.email)}</code> | Credited: <b><code>+${formatINR(reward)}</code></b>`
      );

      await sendMessage(
        botToken,
        sub.userId,
        `🎉 <b>Sell Gmail Approved — Wallet Credited!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🆔 <b>Submission ID:</b> <code>#${escapeHtml(sub.id)}</code>\n` +
          `📧 <b>Gmail Account:</b> <code>${escapeHtml(sub.email)}</code>\n` +
          `💵 <b>Reward Credited:</b> <b><code>+${formatINR(reward)}</code></b>\n` +
          `💰 <b>Updated Balance:</b> <code>${formatINR(seller ? seller.balance : reward)}</code>`
      );
    } else {
      await answerCallbackQuery(botToken, query.id, "❌ Submission Rejected");
      await editMessageText(
        botToken,
        chatId,
        messageId,
        `🟥 ❌ <b>SELL SUBMISSION REJECTED</b>\n` +
          `Submission: <code>#${escapeHtml(sub.id)}</code> | Seller: <code>${sub.userId}</code> | Email: <code>${escapeHtml(sub.email)}</code>`
      );

      await sendMessage(
        botToken,
        sub.userId,
        `⚠️ <b>Sell Gmail Submission #${escapeHtml(sub.id)} Rejected</b>\n` +
          `Your submitted account (<code>${escapeHtml(sub.email)}</code>) could not be verified (invalid credentials or 2FA/recovery still attached).`
      );
    }
    return;
  }

  // Admin: Add Gmail Stock to a category
  if (data.startsWith("admin_add_stock:")) {
    const category = data.replace("admin_add_stock:", "");
    const catInfo = STOCK_CATEGORIES[category] || STOCK_CATEGORIES.standard;
    await setUserState(kv, userId, "AWAITING_STOCK_LINES", { category });
    await answerCallbackQuery(botToken, query.id);
    await sendMessage(
      botToken,
      chatId,
      `🟩 ➕ <b>Add Stock to: ${escapeHtml(catInfo.title)}</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Send the Gmail credentials to add into KV inventory (one <code>email:password</code> per line):\n\n` +
        `<code>freshuser101@gmail.com:Pass@9911</code>\n` +
        `<code>freshuser102@gmail.com:Pass@9912</code>`,
      { reply_markup: getCancelInlineKeyboard() }
    );
    return;
  }

  // Admin: Review pending Gmail purchase orders
  if (data === "admin_review_orders") {
    const orders = await getJson(kv, "index:orders", []);
    const pending = orders.filter((o) => o.status === "pending");
    await answerCallbackQuery(botToken, query.id);

    if (pending.length === 0) {
      await sendMessage(botToken, chatId, "🟩 ✅ There are currently <b>0 pending Gmail purchase orders</b>.");
      return;
    }

    for (const ord of pending.slice(0, 5)) {
      await sendMessage(
        botToken,
        chatId,
        `🟦 🛒 <b>Pending Buy Order #${escapeHtml(ord.id)}</b>\n` +
          `👤 Buyer: ${escapeHtml(ord.buyerName)} (<code>${ord.userId}</code>)\n` +
          `📦 Category: ${escapeHtml(ord.categoryTitle)} × <code>${ord.quantity}</code>\n` +
          `💰 Amount: <code>${formatINR(ord.totalAmount)}</code>\n` +
          `🧾 Proof: <code>${escapeHtml(ord.screenshotRef)}</code>`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🟩 ✅ Approve & Dispatch Stock", callback_data: `order_approve:${ord.id}` },
                { text: "🟥 ❌ Reject", callback_data: `order_reject:${ord.id}` }
              ]
            ]
          }
        }
      );
    }
    return;
  }

  // Admin: Approve or Reject Gmail Purchase Order (Auto-Deduct Stock & Dispatch Credentials)
  if (data.startsWith("order_approve:") || data.startsWith("order_reject:")) {
    const isApprove = data.startsWith("order_approve:");
    const orderId = data.split(":")[1];
    const allOrders = await getJson(kv, "index:orders", []);
    const idx = allOrders.findIndex((o) => o.id === orderId);

    if (idx === -1 || allOrders[idx].status !== "pending") {
      await answerCallbackQuery(botToken, query.id, "Order already processed!", true);
      return;
    }

    const order = allOrders[idx];

    if (isApprove) {
      const stock = await getStockStore(kv);
      const catList = stock[order.category] || [];
      if (catList.length < order.quantity) {
        await answerCallbackQuery(
          botToken,
          query.id,
          `⚠️ Insufficient stock in ${order.category}! Need ${order.quantity}, have ${catList.length}. Add stock first!`,
          true
        );
        return;
      }

      const dispatchedAccounts = catList.splice(0, order.quantity);
      stock[order.category] = catList;
      await putJson(kv, "config:stock", stock);

      order.status = "approved";
      order.accounts = dispatchedAccounts;
      order.processedAt = new Date().toISOString();
      allOrders[idx] = order;
      await putJson(kv, "index:orders", allOrders);

      const userOrders = await getJson(kv, `orders:${order.userId}`, []);
      const uOrdIdx = userOrders.findIndex((o) => o.id === orderId);
      if (uOrdIdx !== -1) {
        userOrders[uOrdIdx] = order;
      } else {
        userOrders.push(order);
      }
      await putJson(kv, `orders:${order.userId}`, userOrders);

      const buyer = await getJson(kv, `user:${order.userId}`, null);
      if (buyer) {
        buyer.totalSpent = Number(((buyer.totalSpent || 0) + Number(order.totalAmount)).toFixed(2));
        buyer.purchasedCount = (buyer.purchasedCount || 0) + Number(order.quantity);
        await putJson(kv, `user:${order.userId}`, buyer);
      }

      await answerCallbackQuery(botToken, query.id, "✅ Approved & Gmail Credentials Dispatched!");
      await sendMessage(
        botToken,
        chatId,
        `🟩 ✅ <b>Order #${escapeHtml(order.id)} Approved & Dispatched!</b>\n` +
          `Deducted <code>${order.quantity}</code> account(s) from KV stock and sent to Buyer <code>${order.userId}</code>.`
      );

      await sendMessage(
        botToken,
        order.userId,
        `🎉 <b>Payment Approved — Your Gmail Order #${escapeHtml(order.id)} is Ready!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📦 <b>Category:</b> ${escapeHtml(order.categoryTitle)}\n` +
          `🔢 <b>Quantity:</b> <code>${order.quantity} Account(s)</code>\n` +
          `💰 <b>Paid via UPI:</b> <code>${formatINR(order.totalAmount)}</code>\n\n` +
          `🔑 <b>Dispatched Gmail Credentials (Email:Password):</b>\n` +
          dispatchedAccounts.map((cred, i) => `${i + 1}. <code>${escapeHtml(cred)}</code>`).join("\n") +
          `\n\n<i>Thank you for buying from ${BOT_NAME}!</i>`
      );
    } else {
      order.status = "rejected";
      order.processedAt = new Date().toISOString();
      allOrders[idx] = order;
      await putJson(kv, "index:orders", allOrders);

      const userOrders = await getJson(kv, `orders:${order.userId}`, []);
      const uOrdIdx = userOrders.findIndex((o) => o.id === orderId);
      if (uOrdIdx !== -1) {
        userOrders[uOrdIdx] = order;
        await putJson(kv, `orders:${order.userId}`, userOrders);
      }

      await answerCallbackQuery(botToken, query.id, "❌ Order Rejected");
      await sendMessage(
        botToken,
        chatId,
        `🟥 ❌ <b>Order #${escapeHtml(order.id)} Rejected.</b> Buyer <code>${order.userId}</code> has been notified.`
      );

      await sendMessage(
        botToken,
        order.userId,
        `⚠️ <b>Order #${escapeHtml(order.id)} Rejected</b>\nYour UPI payment screenshot for <code>${formatINR(order.totalAmount)}</code> could not be verified. Please contact <a href="${SUPPORT_GROUP_URL}">Official Support (${SUPPORT_GROUP_URL})</a> with your transaction receipt.`
      );
    }
    return;
  }

  // Admin: Approve or Reject UPI Withdrawal Request
  if (data.startsWith("payout_approve:") || data.startsWith("payout_reject:")) {
    const isApprove = data.startsWith("payout_approve:");
    const payoutId = data.split(":")[1];
    const payouts = await getJson(kv, "index:payouts", []);
    const idx = payouts.findIndex((p) => p.id === payoutId);

    if (idx === -1 || payouts[idx].status !== "pending") {
      await answerCallbackQuery(botToken, query.id, "Payout already processed!", true);
      return;
    }

    const item = payouts[idx];
    item.status = isApprove ? "approved" : "rejected";
    item.processedAt = new Date().toISOString();
    payouts[idx] = item;
    await putJson(kv, "index:payouts", payouts);

    const targetUser = await getJson(kv, `user:${item.userId}`, null);
    if (targetUser) {
      if (isApprove) {
        targetUser.totalWithdrawn = Number(((targetUser.totalWithdrawn || 0) + Number(item.amount)).toFixed(2));
      } else {
        targetUser.balance = Number(((targetUser.balance || 0) + Number(item.amount)).toFixed(2));
      }
      await putJson(kv, `user:${item.userId}`, targetUser);
    }

    await answerCallbackQuery(botToken, query.id, isApprove ? "Marked UPI Paid!" : "Rejected & Refunded ₹!");
    await editMessageText(
      botToken,
      chatId,
      messageId,
      `${isApprove ? "🟩 ✅ <b>UPI PAYOUT SENT</b>" : "🟥 ❌ <b>REJECTED & REFUNDED</b>"}\n` +
        `Ticket: <code>#${escapeHtml(item.id)}</code> | User: <code>${item.userId}</code> | Amount: <code>${formatINR(item.amount)}</code> | UPI: <code>${escapeHtml(item.upiId)}</code>`
    );

    await sendMessage(
      botToken,
      item.userId,
      isApprove
        ? `🎉 <b>UPI Withdrawal Paid!</b>\nYour payout of <code>${formatINR(item.amount)}</code> (<code>#${escapeHtml(item.id)}</code>) has been transferred to your UPI ID <code>${escapeHtml(item.upiId)}</code>.`
        : `⚠️ <b>UPI Withdrawal Refunded</b>\nYour payout request <code>#${escapeHtml(item.id)}</code> (${formatINR(item.amount)}) was rejected and refunded to your wallet.`
    );
    return;
  }

  // Admin: Set Rate
  if (data.startsWith("set_rate:")) {
    const field = data.replace("set_rate:", "");
    await setUserState(kv, userId, "AWAITING_RATE_VALUE", { field });
    await answerCallbackQuery(botToken, query.id);
    await sendMessage(
      botToken,
      chatId,
      `🟩 ✏️ <b>Update Rate Parameter:</b> <code>${escapeHtml(field)}</code>\nSend the new value in Indian Rupees (₹):`,
      { reply_markup: getCancelInlineKeyboard() }
    );
    return;
  }

  // Admin: Delete Force Channel
  if (data.startsWith("del_channel:")) {
    const targetUsername = data.replace("del_channel:", "");
    const channels = await getForceChannels(kv);
    const updated = channels.filter((c) => c.username !== targetUsername);
    await putJson(kv, "config:channels", updated);

    await answerCallbackQuery(botToken, query.id, `Removed ${targetUsername}`);
    await editMessageText(
      botToken,
      chatId,
      messageId,
      `🟩 ✅ Channel <code>${escapeHtml(targetUsername)}</code> removed from mandatory force-join list.`
    );
    return;
  }

  // Admin: Add Admin Prompt
  if (data === "prompt_add_admin") {
    await setUserState(kv, userId, "AWAITING_NEW_ADMIN_ID", {});
    await answerCallbackQuery(botToken, query.id);
    await sendMessage(
      botToken,
      chatId,
      `🟩 👤 <b>Authorize New Admin</b>\nSend the numeric Telegram User ID of the new administrator:`,
      { reply_markup: getCancelInlineKeyboard() }
    );
    return;
  }

  // Admin: Revoke Admin
  if (data.startsWith("revoke_admin:")) {
    const targetAdminId = Number(data.replace("revoke_admin:", ""));
    if (targetAdminId === SUPER_ADMIN_ID) {
      await answerCallbackQuery(botToken, query.id, "Cannot revoke Super Admin!", true);
      return;
    }
    const admins = await getAdmins(kv);
    const updated = admins.filter((id) => Number(id) !== targetAdminId);
    await putJson(kv, "config:admins", updated);

    await answerCallbackQuery(botToken, query.id, `Revoked Admin ${targetAdminId}`);
    await editMessageText(botToken, chatId, messageId, `🟥 🗑️ Admin <code>${targetAdminId}</code> has been revoked.`);
    return;
  }

  // Admin: Credit/Debit Balance
  if (data === "admin_adjust_balance") {
    await setUserState(kv, userId, "AWAITING_BALANCE_ADJUSTMENT", {});
    await answerCallbackQuery(botToken, query.id);
    await sendMessage(
      botToken,
      chatId,
      `🟩 💰 <b>Credit / Debit User ₹ Balance</b>\n` +
        `Send the User ID and ₹ adjustment separated by <code>|</code>:\n\n` +
        `<code>8838351233 | 150</code> (Credits ₹150)\n` +
        `<code>8838351233 | -50</code> (Debits ₹50)`,
      { reply_markup: getCancelInlineKeyboard() }
    );
  }
}
