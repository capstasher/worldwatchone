// ====== CONFIG ======
// Set PROXY_BASE to your Cloudflare Pages domain after deployment.
// The Worker runs as a function on the same domain at /api/*.
const PROXY_BASE = 'https://wwo-proxy.capstasher.workers.dev';

// Single proxy function — routes through your Worker
const PROXY = url => `${PROXY_BASE}/api/proxy?url=${encodeURIComponent(url)}`;

// OpenSky goes through its own dedicated route (handles auth server-side)
const OPENSKY_ENDPOINT = `${PROXY_BASE}/api/opensky`;

// Legacy CORS_PROXIES array — kept for any remaining fallback chains
// Now all point to your Worker instead of third-party proxies
const CORS_PROXIES = [
  url => PROXY(url),
];
