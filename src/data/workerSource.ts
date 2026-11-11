import workerJsRaw from '../../worker.js?raw';
import wranglerTomlRaw from '../../wrangler.toml?raw';

export const WORKER_JS_SOURCE: string = workerJsRaw;
export const INDEX_JS_SOURCE: string = workerJsRaw;
export const WRANGLER_TOML_SOURCE: string = wranglerTomlRaw;

export const BOT_METADATA = {
  botName: '𝐌𝐄𝐙 𝐌𝐀𝐈𝐋𝐒',
  plainName: 'MEZ MAILS',
  botUsername: '@Mezmailsbot',
  superAdminId: 8838351233,
  supportGroup: 'https://t.me/mezmail',
  kvBinding: 'BOT_KV',
  currency: '₹ (INR)',
};
