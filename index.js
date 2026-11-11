/**
 * ============================================================================
 * 𝐌𝐄𝐙 𝐌𝐀𝐈𝐋𝐒 — Serverless Entrypoint (`index.js` -> `worker.js`)
 * ============================================================================
 * Re-exports the pure serverless Cloudflare Standard Worker (`worker.js`)
 * so deployments configured with either `main = "worker.js"` or `main = "index.js"`
 * work seamlessly with zero static asset errors.
 * ============================================================================
 */

import worker from "./worker.js";
export default worker;
