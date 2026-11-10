export interface ForceChannel {
  username: string;
  title: string;
  inviteLink: string;
  addedAt: string;
}

export interface BotConfig {
  sellGmailReward: number;
  standardGmailPrice: number;
  twofaGmailPrice: number;
  agedGmailPrice: number;
  referralBonus: number;
  dailyBonus: number;
  minWithdrawal: number;
  withdrawalsEnabled: boolean;
  upiId: string;
  upiMerchantName: string;
  upiQrFileId: string;
  upiQrImageUrl: string;
  currencySymbol: string;
  updatedAt: string;
}

export interface StockStore {
  standard: string[];
  twofa: string[];
  aged: string[];
}

export interface UserProfile {
  id: number;
  username: string;
  firstName: string;
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  totalSpent: number;
  purchasedCount: number;
  soldMailsCount: number;
  referralsCount: number;
  referredBy: number | null;
  upiId: string;
  notifications: boolean;
  lastDailyBonus: string | null;
  state: string | null;
  stateData: Record<string, any>;
  joinedAt: string;
}

export interface PayoutItem {
  id: string;
  userId: number;
  firstName: string;
  amount: number;
  upiId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedAt?: string;
}

export interface GmailOrderItem {
  id: string;
  userId: number;
  buyerName: string;
  category: 'standard' | 'twofa' | 'aged';
  categoryTitle: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  screenshotRef: string;
  status: 'pending' | 'approved' | 'rejected';
  accounts: string[];
  createdAt: string;
  processedAt?: string;
}

export interface SellSubmissionItem {
  id: string;
  userId: number;
  sellerName: string;
  email: string;
  password: string;
  recoveryInfo: string;
  reward: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedAt?: string;
}

export interface RedeemCodeItem {
  code: string;
  amount: number;
  maxClaims: number;
  claimedCount: number;
  claimedBy: number[];
  createdBy: number;
  createdAt: string;
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface SimChatMessage {
  id: number;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  inlineKeyboard?: InlineButton[][];
  showUpiQrCard?: {
    upiId: string;
    merchantName: string;
    amount: number;
  };
  isScreenshotAttachment?: boolean;
}

export interface KVStoreSnapshot {
  'config:settings': BotConfig;
  'config:stock': StockStore;
  'config:admins': number[];
  'config:channels': ForceChannel[];
  'config:redeem_codes': Record<string, RedeemCodeItem>;
  'index:users': number[];
  'index:payouts': PayoutItem[];
  'index:orders': GmailOrderItem[];
  'index:submissions': SellSubmissionItem[];
  users: Record<number, UserProfile>;
}

export const SUPER_ADMIN_ID = 8838351233;
export const REGULAR_USER_ID = 5192048112;
export const SUPPORT_GROUP_URL = 'https://t.me/MMAGROUP0';
export const BOT_DISPLAY_NAME = '𝐌𝐄𝐙 𝐌𝐀𝐈𝐋𝐒';

export const STOCK_CATEGORIES_META = {
  standard: {
    id: 'standard' as const,
    title: '📩 Standard Fresh Gmail',
    priceKey: 'standardGmailPrice' as const,
    description: 'Freshly registered Gmail account, no recovery phone/email attached.',
  },
  twofa: {
    id: 'twofa' as const,
    title: '🔐 2FA App-Password Gmail',
    priceKey: 'twofaGmailPrice' as const,
    description: '2FA enabled Gmail with backup codes / app password included.',
  },
  aged: {
    id: 'aged' as const,
    title: '💎 Aged High-Trust Gmail',
    priceKey: 'agedGmailPrice' as const,
    description: 'Aged Gmail account with high deliverability and warm profile.',
  },
};

export const USER_MAIN_KEYBOARD = (isAdmin: boolean): string[][] => {
  const rows = [
    ['🛒 Buy Gmail', '📤 Sell Gmail'],
    ['📂 My Orders / Submissions', '💰 Balance / Deposit'],
    ['👥 Referrals', '🎁 Rewards'],
    ['⚙️ Settings', '❓ Help'],
  ];
  if (isAdmin) {
    rows.push(['🛡️ Admin Panel']);
  }
  return rows;
};

export const ADMIN_PANEL_KEYBOARD: string[][] = [
  ['🛒 Manage Buy Stock', '📤 Manage Sell Submissions'],
  ['🖼️ Add/Update UPI QR', '💳 Manage Payouts'],
  ['👥 View Users List', '➕ Add Force Channel'],
  ['📋 View/Remove Channels', '🎟️ Create Redeem Code'],
  ['👤 Add Admin', '💳 Set Buy/Sell Rates'],
  ['⭕ Toggle Withdrawals', '📊 Bot Stats'],
  ['📢 Broadcast Msg', '🔙 Back to User Menu'],
];

export function createInitialKVSnapshot(): KVStoreSnapshot {
  const now = new Date().toISOString();
  return {
    'config:settings': {
      sellGmailReward: 10,
      standardGmailPrice: 15,
      twofaGmailPrice: 25,
      agedGmailPrice: 40,
      referralBonus: 5,
      dailyBonus: 2,
      minWithdrawal: 100,
      withdrawalsEnabled: true,
      upiId: 'mezmails@okaxis',
      upiMerchantName: 'MEZ MAILS OFFICIAL',
      upiQrFileId: 'QR_FILE_ACTIVE',
      upiQrImageUrl: '',
      currencySymbol: '₹',
      updatedAt: now,
    },
    'config:stock': {
      standard: [
        'mez.std.1041@gmail.com:MezPass@901',
        'mez.std.1042@gmail.com:MezPass@902',
        'mez.std.1043@gmail.com:MezPass@903',
        'mez.std.1044@gmail.com:MezPass@904',
        'mez.std.1045@gmail.com:MezPass@905',
        'mez.std.1046@gmail.com:MezPass@906',
      ],
      twofa: [
        'mez.2fa.8801@gmail.com:Mez2FA@112:app-xxxx-yyyy',
        'mez.2fa.8802@gmail.com:Mez2FA@113:app-aaaa-bbbb',
        'mez.2fa.8803@gmail.com:Mez2FA@114:app-cccc-dddd',
      ],
      aged: [
        'mez.aged.2019@gmail.com:AgedSecure#771',
        'mez.aged.2020@gmail.com:AgedSecure#772',
      ],
    },
    'config:admins': [SUPER_ADMIN_ID],
    'config:channels': [
      {
        username: '@MMAGROUP0',
        title: 'MEZ Official Support Group',
        inviteLink: 'https://t.me/MMAGROUP0',
        addedAt: now,
      },
    ],
    'config:redeem_codes': {
      BHARAT50: {
        code: 'BHARAT50',
        amount: 50,
        maxClaims: 25,
        claimedCount: 2,
        claimedBy: [771293811],
        createdBy: SUPER_ADMIN_ID,
        createdAt: now,
      },
      MEZ25: {
        code: 'MEZ25',
        amount: 25,
        maxClaims: 50,
        claimedCount: 4,
        claimedBy: [771293811],
        createdBy: SUPER_ADMIN_ID,
        createdAt: now,
      },
    },
    'index:users': [SUPER_ADMIN_ID, REGULAR_USER_ID, 771293811],
    'index:payouts': [
      {
        id: 'UPI-739201',
        userId: REGULAR_USER_ID,
        firstName: 'Aarav Sharma',
        amount: 150,
        upiId: 'aarav.sharma@paytm',
        status: 'pending',
        createdAt: '2026-11-09 22:15',
      },
      {
        id: 'UPI-518044',
        userId: 771293811,
        firstName: 'Riya Verma',
        amount: 220,
        upiId: 'riyaverma@oksbi',
        status: 'approved',
        createdAt: '2026-11-08 17:40',
        processedAt: '2026-11-08 17:52',
      },
    ],
    'index:orders': [
      {
        id: 'ORD-904112',
        userId: REGULAR_USER_ID,
        buyerName: 'Aarav Sharma',
        category: 'standard',
        categoryTitle: '📩 Standard Fresh Gmail',
        quantity: 2,
        unitPrice: 15,
        totalAmount: 30,
        screenshotRef: 'UPI Screenshot (UTR: 631490821145)',
        status: 'pending',
        accounts: [],
        createdAt: '2026-11-09 23:45',
      },
      {
        id: 'ORD-812009',
        userId: 771293811,
        buyerName: 'Riya Verma',
        category: 'twofa',
        categoryTitle: '🔐 2FA App-Password Gmail',
        quantity: 1,
        unitPrice: 25,
        totalAmount: 25,
        screenshotRef: 'UPI Screenshot (UTR: 631400192831)',
        status: 'approved',
        accounts: ['mez.2fa.7790@gmail.com:Mez2FA@889:app-verified'],
        createdAt: '2026-11-09 18:10',
        processedAt: '2026-11-09 18:14',
      },
    ],
    'index:submissions': [
      {
        id: 'SELL-482910',
        userId: REGULAR_USER_ID,
        sellerName: 'Aarav Sharma',
        email: 'aarav.fresh.901@gmail.com',
        password: 'FreshPass#2026',
        recoveryInfo: 'No Recovery / 2FA Off',
        reward: 10,
        status: 'pending',
        createdAt: '2026-11-10 00:05',
      },
      {
        id: 'SELL-310944',
        userId: 771293811,
        sellerName: 'Riya Verma',
        email: 'riya.task.712@gmail.com',
        password: 'RiyaTask#881',
        recoveryInfo: 'Clean Account, No Phone',
        reward: 10,
        status: 'approved',
        createdAt: '2026-11-09 21:20',
        processedAt: '2026-11-09 21:28',
      },
    ],
    users: {
      [SUPER_ADMIN_ID]: {
        id: SUPER_ADMIN_ID,
        username: 'mez_superadmin',
        firstName: 'Super Admin',
        balance: 540,
        totalEarned: 1240,
        totalWithdrawn: 700,
        totalSpent: 120,
        purchasedCount: 8,
        soldMailsCount: 15,
        referralsCount: 24,
        referredBy: null,
        upiId: 'mezmails@okaxis',
        notifications: true,
        lastDailyBonus: null,
        state: null,
        stateData: {},
        joinedAt: '2026-10-01T10:00:00.000Z',
      },
      [REGULAR_USER_ID]: {
        id: REGULAR_USER_ID,
        username: 'aarav_user',
        firstName: 'Aarav Sharma',
        balance: 135,
        totalEarned: 285,
        totalWithdrawn: 150,
        totalSpent: 75,
        purchasedCount: 5,
        soldMailsCount: 12,
        referralsCount: 9,
        referredBy: SUPER_ADMIN_ID,
        upiId: 'aarav.sharma@paytm',
        notifications: true,
        lastDailyBonus: null,
        state: null,
        stateData: {},
        joinedAt: '2026-10-14T16:22:00.000Z',
      },
      771293811: {
        id: 771293811,
        username: 'riya_verma',
        firstName: 'Riya Verma',
        balance: 80,
        totalEarned: 300,
        totalWithdrawn: 220,
        totalSpent: 50,
        purchasedCount: 2,
        soldMailsCount: 18,
        referralsCount: 6,
        referredBy: SUPER_ADMIN_ID,
        upiId: 'riyaverma@oksbi',
        notifications: true,
        lastDailyBonus: null,
        state: null,
        stateData: {},
        joinedAt: '2026-10-20T09:10:00.000Z',
      },
    },
  };
}
