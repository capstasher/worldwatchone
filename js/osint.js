// ============================================================
// OSINT FEED — TIMESTAMP & SORT FIX
// Replace / merge the relevant sections in your main file.
// ============================================================

// ── Global age cutoff: 48 hours (2 days) ──────────────────────────────────
const MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours in ms

/**
 * parseSourceDate()
 * Robustly extract the ORIGINAL publication timestamp from any source.
 * Returns a Date object, or null if unparseable / too old / in the future.
 *
 * Priority order:
 *  1. Unix epoch integer (seconds)  ← Telegram tg.i-c-a.su
 *  2. ISO 8601 string               ← most RSS feeds, RSSHub
 *  3. RFC 2822 string               ← older RSS feeds
 *  4. Any string Date.parse() accepts
 *  Returns null if the result is >48h old, >1h in the future, or NaN.
 */
function parseSourceDate(raw) {
  if (!raw) return null;

  let ms;

  if (typeof raw === 'number') {
    // Unix timestamp in seconds (Telegram) vs ms — heuristic: <1e12 = seconds
    ms = raw < 1e12 ? raw * 1000 : raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // Try native parser (handles ISO 8601 and RFC 2822)
    ms = Date.parse(trimmed);
    if (isNaN(ms)) return null;
  } else if (raw instanceof Date) {
    ms = raw.getTime();
  } else {
    return null;
  }

  const now = Date.now();

  // Reject if more than 48 hours old
  if (now - ms > MAX_AGE_MS) return null;

  // Reject if more than 1 hour in the future (clock skew / bad data)
  if (ms - now > 60 * 60 * 1000) return null;

  return new Date(ms);
}

// ── OSINT feed item store (replaces direct DOM-append approach) ──────────────
// Each entry: { title, source, pubDate (Date), link, zone, ty, isTelegram, media }
const feedItems = [];
const MAX_FEED_ITEMS = 500;

// Deduplication: track seen titles+sources to avoid double-entries
const seenFeedKeys = new Set();

/**
 * addLiveItem() — REPLACEMENT
 * Always uses the REAL publication date from the source.
 * Falls back to null (item is discarded) if date is missing or too old.
 */
function addLiveItem(title, source, rawDate, link, zone, ty, isTelegram, media = []) {
  if (!title || title.length < 10) return;

  const pubDate = parseSourceDate(rawDate);
  if (!pubDate) return; // too old, future, or unparseable — drop it

  // Deduplicate by (source + first 80 chars of title)
  const dedupeKey = source + '|' + title.slice(0, 80).toLowerCase().replace(/\s+/g, ' ');
  if (seenFeedKeys.has(dedupeKey)) return;
  seenFeedKeys.add(dedupeKey);
  if (seenFeedKeys.size > 3000) {
    const it = seenFeedKeys.values();
    for (let i = 0; i < 500; i++) seenFeedKeys.delete(it.next().value);
  }

  feedItems.push({ title, source, pubDate, link, zone, ty, isTelegram, media });

  // Keep store bounded
  if (feedItems.length > MAX_FEED_ITEMS) {
    // Drop oldest entry instead of shift() to keep sorted order intact
    feedItems.sort((a, b) => b.pubDate - a.pubDate);
    feedItems.length = MAX_FEED_ITEMS;
  }

  // Re-render the OSINT feed pane sorted newest → oldest
  renderFeedPane();
}

/**
 * renderFeedPane()
 * Clears and re-renders #of (the OSINT feed element) sorted newest-first.
 * Called after every addLiveItem(). Throttled to avoid thrashing the DOM.
 */
let renderPending = false;
function renderFeedPane() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    // Lazy lookup — safe regardless of where ofE is declared in the main file
    const pane = document.getElementById('of');
    if (!pane) return;

    // Purge items that have aged out since last render
    const now = Date.now();
    const fresh = feedItems.filter(it => now - it.pubDate.getTime() <= MAX_AGE_MS);
    if (fresh.length !== feedItems.length) {
      feedItems.length = 0;
      feedItems.push(...fresh);
    }

    // Sort newest first
    fresh.sort((a, b) => b.pubDate - a.pubDate);

    // Rebuild DOM
    pane.innerHTML = '';
    fresh.forEach(item => {
      const el = buildFeedEl(item);
      if (el) pane.appendChild(el);
    });
  });
}

/**
 * buildFeedEl()
 * Renders a single feed item DOM element.
 * Adjust the HTML structure to match your existing template.
 */
function buildFeedEl(item) {
  const div = document.createElement('div');
  div.className = 'of-item ty-' + (item.ty || 'in') + (item.isTelegram ? ' tg' : '');

  // Relative time label (e.g. "3m ago", "1h ago")
  const ageMs = Date.now() - item.pubDate.getTime();
  const ageLabel = ageMs < 60000
    ? 'just now'
    : ageMs < 3600000
      ? Math.floor(ageMs / 60000) + 'm ago'
      : ageMs < 86400000
        ? Math.floor(ageMs / 3600000) + 'h ago'
        : Math.floor(ageMs / 86400000) + 'd ago';

  // UTC timestamp for tooltip
  const utcStr = item.pubDate.toUTCString();

  div.innerHTML = `
    <span class="of-ty">${item.ty === 'al' ? '🔴' : item.ty === 'wa' ? '🟡' : 'ℹ️'}</span>
    <span class="of-src">[${escHtml(item.source)}]</span>
    <span class="of-age" title="${escHtml(utcStr)}">${ageLabel}</span>
    <span class="of-zone">${escHtml(item.zone)}</span>
    <a class="of-title" href="${escHtml(item.link)}" target="_blank" rel="noopener">${escHtml(item.title)}</a>
  `;

  // Attach media thumbnails if present
  if (item.media && item.media.length > 0) {
    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'of-media';
    item.media.forEach(m => {
      if (!m.thumb && !m.url) return;
      const img = document.createElement('img');
      img.src = m.thumb || m.url;
      img.className = 'of-thumb';
      img.loading = 'lazy';
      img.onerror = () => img.remove();
      mediaWrap.appendChild(img);
    });
    if (mediaWrap.children.length > 0) div.appendChild(mediaWrap);
  }

  return div;
}

// ── Tiny helpers ─────────────────────────────────────────────────────────────
function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── PATCH: fetchNewsQuery — pass real pubDate, not fetch time ────────────────
// Replace your existing fetchNewsQuery with this version.
// The key change: items.slice(0,5) now passes item.pubDate (the RSS <pubDate>)
// instead of implicitly relying on addLiveItem to stamp with Date.now().
async function fetchNewsQuery(qObj) {
  const rssUrl = GN_BASE + qObj.q + GN_PARAMS;
  const proxyUrls = [
    ...FREE_PROXIES.map(p => p(rssUrl)),
    PROXY(rssUrl),
  ];
  for (const url of proxyUrls) {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) continue;
      const xml = await r.text();
      const items = parseRSSXml(xml);
      if (items.length > 0) {
        items.slice(0, 5).forEach(item => {
          // Use item.pubDate (source timestamp) — NOT Date.now()
          addLiveItem(item.title, item.source || 'Google News', item.pubDate, item.link, qObj.zone, qObj.ty, false);
        });
        return;
      }
    } catch (e) { continue; }
  }
}

// ── PATCH: fetchRSSFeed — same fix ────────────────────────────────────────────
async function fetchRSSFeed(feed) {
  const proxyUrls = [
    ...FREE_PROXIES.map(p => p(feed.url)),
    PROXY(feed.url),
  ];
  for (const url of proxyUrls) {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) continue;
      const xml = await r.text();
      const items = parseRSSXml(xml);
      if (items.length > 0) {
        items.slice(0, 6).forEach(item => {
          if (!item.title || item.title.length < 10) return;
          // Use item.pubDate (source timestamp) — NOT Date.now()
          addLiveItem(item.title, feed.label, item.pubDate, item.link, feed.zone, feed.ty, false);
        });
        return;
      }
    } catch (e) { continue; }
  }
}

// ── PATCH: injectTgMessages — use msg.date (Unix seconds from Telegram API) ──
// Drop-in replacement. The critical fix: msg.date is passed raw to addLiveItem,
// which now calls parseSourceDate() to get the real Unix-epoch ms timestamp.
function injectTgMessages(messages, ch, _cutoff /* ignored — parseSourceDate handles it */) {
  let added = 0;
  messages.forEach(msg => {
    const text = stripHtml(msg.message || msg.text || '');
    if (!text || text.length < 15) return;

    // msg.date is Unix seconds from Telegram — pass it raw, parseSourceDate handles it
    const rawDate = msg.date || null;

    const postId = msg.id || '';
    const dedupeKey = ch.channel + '_' + postId + '_' + text.slice(0, 50);
    if (seenPostIds.has(dedupeKey)) return;
    seenPostIds.add(dedupeKey);
    if (seenPostIds.size > 2000) {
      const it = seenPostIds.values();
      for (let i = 0; i < 500; i++) seenPostIds.delete(it.next().value);
    }

    const link = postId ? `https://t.me/${ch.channel}/${postId}` : `https://t.me/${ch.channel}`;
    const media = extractTgMedia(msg);

    // Store in liveTelegramPosts with a proper Date (or skip if too old)
    const pubDate = parseSourceDate(rawDate);
    if (!pubDate) return; // too old or invalid

    const postObj = { text, source: ch.label, pubDate: pubDate.toISOString(), link, zone: ch.zone, ty: ch.ty, channel: ch.channel, media };
    liveTelegramPosts.push(postObj);
    if (liveTelegramPosts.length > MAX_TG_POSTS) liveTelegramPosts.shift();

    addLiveItem(text, ch.label, rawDate, link, ch.zone, ch.ty, true, media);
    added++;
  });
  return added > 0;
}

// ── PATCH: fetchTelegramChannel — pass msg.date raw everywhere ───────────────
// In your existing fetchTelegramChannel, all three addLiveItem() call-sites
// currently pass pubDate.toISOString() (already converted to a Date from the
// tg.i-c-a.su integer). That's fine — parseSourceDate() handles ISO strings.
// BUT the cutoff check is done manually before addLiveItem(), which means
// stale posts bypass parseSourceDate's MAX_AGE_MS guard.
// Fix: remove manual cutoff checks and let parseSourceDate() be the single
// source of truth. Replace every block like:
//
//   const pubDate = msg.date ? new Date(msg.date*1000) : new Date();
//   if (pubDate.getTime() < cutoff) return;
//   addLiveItem(text, ch.label, pubDate.toISOString(), ...);
//
// with:
//   addLiveItem(text, ch.label, msg.date || null, ...);
//
// parseSourceDate() will handle seconds→ms conversion AND the 48h cutoff.
//
// For RSSHub items (string pubDate), same pattern:
//   addLiveItem(text, ch.label, item.pubDate, ...);   // string is fine
//
// For HTML-scraped items (msg.date is ISO string from <time datetime="...">):
//   addLiveItem(msg.text, ch.label, msg.date, ...);   // ISO string is fine

// ── Periodic stale-item purge ─────────────────────────────────────────────────
// Every 5 minutes, evict feedItems and liveTelegramPosts older than 48h,
// then re-render. This handles items that were valid when ingested but have
// since aged out — and it's what prevents the "3-year-old items" reappearing
// after a page refresh because they were cached in liveTelegramPosts.
setInterval(() => {
  const now = Date.now();
  const before = feedItems.length;

  // Purge feedItems
  for (let i = feedItems.length - 1; i >= 0; i--) {
    if (now - feedItems[i].pubDate.getTime() > MAX_AGE_MS) feedItems.splice(i, 1);
  }

  // Purge liveTelegramPosts
  for (let i = liveTelegramPosts.length - 1; i >= 0; i--) {
    const ms = new Date(liveTelegramPosts[i].pubDate).getTime();
    if (now - ms > MAX_AGE_MS) liveTelegramPosts.splice(i, 1);
  }

  if (feedItems.length < before) {
    console.log(`[WWO] Purged ${before - feedItems.length} stale feed items`);
    renderFeedPane(); // refresh DOM after purge
  }
}, 5 * 60 * 1000);
