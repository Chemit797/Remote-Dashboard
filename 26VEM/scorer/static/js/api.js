// Data source. The live board reads the loopback API; a snapshot build reads files with the same shapes.

const SNAPSHOT = document.querySelector('meta[name="board-source"]')?.content === "snapshot";
// Relative, so the page works at /scorer/ on 5090 and at any sub-path of a static copy. A snapshot page may name
// its feed (the hourly overwritten branch on GitHub) in <meta name="board-feed">.
const FEED = document.querySelector('meta[name="board-feed"]')?.content;
const base = SNAPSHOT ? (FEED || "data/") : "api/";
const etags = new Map();
const cache = new Map();

async function getJSON(url, { conditional = false } = {}) {
  const headers = {};
  if (conditional && etags.has(url)) headers["If-None-Match"] = etags.get(url);
  const res = await fetch(url, { headers, cache: "no-cache" });
  if (res.status === 304) return { unchanged: true, data: cache.get(url) };
  if (!res.ok) {
    let message = `${res.status}`;
    try { message = (await res.json()).error || message; } catch { /* plain error page */ }
    throw new Error(message);
  }
  const data = await res.json();
  const tag = res.headers.get("ETag");
  if (tag) etags.set(url, tag);
  cache.set(url, data);
  return { unchanged: false, data };
}

export const isSnapshot = SNAPSHOT;

export function fetchIndex() {
  return getJSON(SNAPSHOT ? `${base}index.json` : `${base}index`).then(r => r.data);
}

export function fetchTask(task) {
  return getJSON(SNAPSHOT ? `${base}${task}.json` : `${base}task/${task}`, { conditional: true });
}

export function fetchDetail(task, id) {
  if (SNAPSHOT) return Promise.reject(new Error("快照不含逐种子明细，请打开 5090 实时版"));
  return getJSON(`${base}task/${task}/sub/${encodeURIComponent(id)}`).then(r => r.data);
}
