// Formatting helpers shared by every view. No business constants live here.

const BJ = "Asia/Shanghai";
const pad = n => String(n).padStart(2, "0");

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function parts(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat("zh-CN", { timeZone: BJ, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
  return { d, text: `${p.month}-${p.day} ${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
}

// "11-23 13:05" in Beijing time.
export function when(iso) {
  if (!iso) return "—";
  return parts(iso)?.text ?? "—";
}

export function minutesAgo(iso, now = Date.now()) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.max(0, Math.round((now - t) / 60000));
}

export function age(iso, now = Date.now()) {
  const m = minutesAgo(iso, now);
  if (m === null) return "";
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} 小时${m % 60 ? ` ${m % 60} 分` : ""}前`;
  return `${Math.floor(h / 24)} 天前`;
}

// "距官方截止 2 天 23 小时" for the top bar.
export function countdown(iso, now = Date.now()) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const m = Math.round((t - now) / 60000);
  if (m <= 0) return "官方已截止";
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return `距官方截止 ${d ? `${d} 天 ` : ""}${h} 小时${d ? "" : ` ${m % 60} 分`}`;
}

// "11-23 13:05（12 分钟前）"
export function stamp(iso, now = Date.now()) {
  if (!iso) return "—";
  return `${when(iso)}<span class="age">（${age(iso, now)}）</span>`;
}

export function num(v, digits = 2) {
  return v === null || v === undefined ? "—" : Number(v).toFixed(digits);
}

export function signed(v, digits = 2) {
  if (v === null || v === undefined) return "—";
  const text = Number(v).toFixed(digits);
  if (Number(text) === 0) return (0).toFixed(digits);
  return v > 0 ? `+${text}` : text;
}

// One bed cell [value, k, n, state, mean5?] -> HTML. Exactly one number per cell.
export function bedCell(cell) {
  if (!cell) return `<span class="empty" title="这张床还没有评过">未评</span>`;
  const [v, k, n, st, mean5] = cell;
  if (st === "ok" && mean5) return `<span class="score m5" title="校准面板记录的五种子均值，没有逐种子明细">${num(v)}</span>`;
  if (st === "ok") return `<span class="score">${num(v)}</span>`;
  if (st === "partial") return `<span class="empty partial" title="只评了 ${n} 格中的 ${k} 格">不全 ${k}/${n}</span>`;
  if (st === "na") return `<span class="empty" title="评分器判定不适用">不适用</span>`;
  if (st === "failed") return `<span class="empty bad" title="评分失败，见明细">失败</span>`;
  return `<span class="empty" title="这张床还没有评过">未评</span>`;
}

export function person(by) {
  const cls = by === "cym" ? "p-cym" : by === "xzk" ? "p-xzk" : "p-unk";
  return `<span class="who ${cls}">${esc(by || "待确认")}</span>`;
}

const STATUS_CLASS = { 已验收: "s-ok", 在评: "s-run", 不全: "s-part", 失败: "s-bad", 中断: "s-bad", 已登记: "s-new",
  读取错误: "s-bad", 无评分: "s-part", 在跑: "s-run", 排队: "s-run", 已结束: "s-ok", 已取消: "s-part", 未知: "s-part" };

export function status(text, extra = "") {
  return `<span class="status ${STATUS_CLASS[text] || ""}">${esc(text)}${extra ? ` <small>${esc(extra)}</small>` : ""}</span>`;
}

export function verdict(text, source) {
  if (!text) return `<span class="muted">—</span>`;
  const cls = /晋级|领先|合格|最好|优于|候选/.test(text) && !/未晋级/.test(text) ? "v-up"
    : /落后|未过|未晋级/.test(text) ? "v-down" : "v-flat";
  return `<span class="verdict ${cls}" title="${esc(source || "")}">${esc(text)}</span>`;
}
