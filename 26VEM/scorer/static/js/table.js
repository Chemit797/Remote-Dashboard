// Two tables with one set of columns: 基线对照 (a few reference rows) sits above 样本记录 (every submission).
// Both use the fixed widths below, so their columns line up exactly, and they scroll sideways together.
// The sample table keeps its filters in the URL, redraws only rows whose data changed, and opens a detail row
// with every evaluation of one submission on demand.
import { bedCell, esc, num, person, signed, status, verdict, when } from "./fmt.js";
import { fetchDetail } from "./api.js";

const PAGE = 60;
const NOTE_MIN = 180;   // px left for 改了什么 before the tables scroll sideways
export const SMALL = window.matchMedia("(max-width: 760px)");

// Column widths: px on wider screens, % on phones (only these five columns are kept there).
const W = { id: 116, name: 110, by: 52, parent: 86, last: 94, official: 82, rank: 92, bed: 86, offm: 78, floor: 44,
  dp: 72, verdict: 76, st: 90 };
const SMALL_W = { id: 25, name: 20, official: 17, rank: 21, st: 17 };

export function columnsFor(p, ui, small = SMALL.matches) {
  const cols = [
    { key: "id", label: "编号", cls: "mono c-id", w: W.id },
    { key: "name", label: "配方名", cls: "mono", w: W.name },
    { key: "by", label: "提交者", w: W.by },
    { key: "note", label: "改了什么", cls: "note" },
    { key: "parent", label: "父本", cls: "mono", w: W.parent },
    { key: "last", label: "最近验收", w: W.last },
    { key: "official", label: "官网分", sub: "上一阶段验证榜", cls: "num key", w: W.official },
    { key: "rank", label: "排名分", sub: "本地评分器", cls: "rank key", w: W.rank },
  ];
  for (const c of p.columns) {
    if (c.role === "rank" || c.default !== false || ui.aux) cols.push({ key: `bed:${c.id}`, bed: c, cls: "bed", w: W.bed });
  }
  if (p.rules.official) {
    for (const m of p.rules.official.modes) cols.push({ key: `off:${m}`, label: `官床 ${m}`, cls: "bed", mode: m, w: W.offm });
  }
  if (p.rules.floor) cols.push({ key: "floor", label: "底线", w: W.floor });
  cols.push({ key: "dp", label: "Δ父本", cls: "num", w: W.dp }, { key: "verdict", label: "判定", w: W.verdict },
    { key: "st", label: "状态", w: W.st });
  if (!small) return cols;
  return cols.filter(c => c.key in SMALL_W).map(c => ({ ...c, w: null, pct: SMALL_W[c.key] }));
}

function colgroup(cols) {
  return `<colgroup>${cols.map(c => `<col${c.w ? ` style="width:${c.w}px"` : c.pct ? ` style="width:${c.pct}%"` : ""}>`).join("")}</colgroup>`;
}

function minWidth(cols) {
  return cols.some(c => c.pct) ? "" : `${cols.reduce((sum, c) => sum + (c.w || NOTE_MIN), 0)}px`;
}

function head(col) {
  if (!col.bed) return `<th class="${col.cls || ""}">${esc(col.label)}${col.sub ? `<small>${esc(col.sub)}</small>` : ""}</th>`;
  // Label, then one short line: the bed's role and stage. The bed ID and source are in the tooltip.
  const b = col.bed;
  const role = b.role === "rank" ? "排名" : b.role === "floor" ? "底线" : "展示";
  const sub = [role, b.stage].filter(Boolean).join(" · ");
  const flat = b.flat ? ` <em class="flat" title="这一列所有配方的分数逐位相同，不能用来比较">无区分</em>` : "";
  const tip = [b.id, b.source].filter(Boolean).join("\n");
  return `<th class="${col.cls} role-${esc(b.role)}" title="${esc(tip)}">${esc(b.label)}${flat}<small>${esc(sub)}</small></th>`;
}

const DASH = `<span class="muted">—</span>`;

function sampleCell(col, r) {
  switch (col.key) {
    case "id": return `${esc(r.id)}${r.today ? ' <span class="badge">今天</span>' : ""}`;
    case "name": return `<span title="${esc(r.name)}">${esc(r.name)}</span>${r.same ? ' <span class="badge warn" title="排名分与父本逐位相同，改动可能没有生效">同父本</span>' : ""}`;
    case "by": return `<span title="${esc(r.how)}">${person(r.by)}</span>`;
    case "note": return r.note ? `<span title="${esc(`${r.note}（${r.nsrc || ""}）`)}">${esc(r.note)}</span>` : DASH;
    case "parent": return r.parent ? `${esc(r.parent)}${r.pid ? `<small>${esc(r.pid)}</small>` : ""}` : DASH;
    case "last": return when(r.last);
    case "official": return DASH;
    case "rank": return r.rank === null ? DASH : `<b>${num(r.rank, 3)}</b>`;
    case "floor": return r.floor === true ? `<span class="v-up" title="底线已过">✓</span>` : r.floor === false ? `<span class="v-down" title="低于底线">×</span>` : `<span class="muted" title="底线床未评齐">—</span>`;
    case "dp": return `<span class="${r.dp > 0 ? "up" : r.dp < 0 ? "down" : ""}">${signed(r.dp, 3)}</span>`;
    case "verdict": return verdict(r.verdict, r.vsrc);
    case "st": return status(r.st, r.st === "已验收" ? "" : r.prog);
    default:
      if (col.bed) return bedCell(r.beds?.[col.bed.id]);
      if (col.mode) return bedCell(r.off?.[col.mode]);
      return "";
  }
}

// A 基线对照 row: a standard baseline from the board, or an official upload from the previous phase whose local
// columns come from its board counterpart when it has one.
function referenceCell(col, item, r) {
  const official = item.kind === "official";
  switch (col.key) {
    case "id": {
      const main = official ? esc(item.ref || (item.sha || "").slice(0, 8)) : esc(r?.id || "—");
      return `${main} <span class="badge ref-${esc(item.kind)}">${esc(item.label)}</span>`;
    }
    case "name": return official ? `<span title="${esc(item.file || "")}">${esc(item.title || "")}</span>` : r ? esc(r.name) : DASH;
    case "by": return official ? DASH : r ? person(r.by) : DASH;
    case "note": {
      if (!official) return r ? sampleCell(col, r) : `<span class="muted">看板上还没有这条基线</span>`;
      const tip = [item.note, item.file, item.sha ? `SHA ${item.sha}` : ""].filter(Boolean).join("\n");
      return `<span title="${esc(tip)}">${esc(item.note || "")}</span>`;
    }
    case "official": return item.official === null || item.official === undefined ? DASH
      : `<b>${num(item.official)}</b><small>${esc(item.at || "")} 上传</small>`;
    case "rank": {
      if (!r) return `<span class="muted">本地未评</span>`;
      if (r.rank === null) return DASH;
      const gap = item.gap === null || item.gap === undefined ? ""
        : `<small class="${item.gap < 0 ? "down" : item.gap > 0 ? "up" : ""}">距冠军 ${signed(item.gap)}</small>`;
      return `<b>${num(r.rank, 3)}</b>${gap}`;
    }
    default: return r ? sampleCell(col, r) : DASH;
  }
}

export function filterRows(p, ui) {
  const q = (ui.q || "").trim().toLowerCase();
  let rows = p.rows.filter(r => {
    if (ui.kind === "提交" && r.kind !== "提交") return false;
    if (ui.kind === "工程" && r.kind === "归档") return false;
    if (ui.kind === "归档" && r.kind === "工程") return false;
    if (ui.by && ui.by !== "all" && r.by !== ui.by && !["待确认", "共同"].includes(r.by)) return false;
    if (ui.st && ui.st !== "all" && r.st !== ui.st) return false;
    if (q && !`${r.id} ${r.name} ${r.parent || ""} ${r.note || ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
  if (ui.sort === "rank") rows = rows.slice().sort((a, b) => (b.rank ?? -1e9) - (a.rank ?? -1e9));
  else if (ui.sort === "id") rows = rows.slice().sort((a, b) => a.id.localeCompare(b.id, "zh"));
  return rows;
}

export function countsLine(p) {
  const c = p.counts;
  const today = Object.values(c.today || {}).reduce((a, b) => a + b, 0);
  const others = [c.engineering ? `工程 ${c.engineering} 个` : "", c.archive ? `归档 ${c.archive} 个` : ""].filter(Boolean).join("、");
  return `共 <b>${c.total}</b> 个（cym ${c.cym} 个，xzk ${c.xzk} 个${c.pending ? `，待确认 ${c.pending} 个` : ""}；今天新登记 ${today} 个）`
    + `${others ? `<span class="muted">，另有${others}，默认不显示</span>` : ""}`;
}

export function filtersHTML(ui, hidden = 0) {
  const opt = (value, label, current) => `<option value="${esc(value)}"${value === current ? " selected" : ""}>${esc(label)}</option>`;
  return `<label>提交者 <select data-f="by">${opt("all", "全部", ui.by)}${opt("cym", "只看 cym", ui.by)}${opt("xzk", "只看 xzk", ui.by)}</select></label>
    <label>范围 <select data-f="kind">${opt("提交", "提交", ui.kind)}${opt("工程", "提交 + 工程", ui.kind)}${opt("归档", "提交 + 归档", ui.kind)}${opt("全部", "全部", ui.kind)}</select></label>
    <label>状态 <select data-f="st">${["all", "已验收", "在评", "不全", "失败", "中断", "已登记"].map(s => opt(s, s === "all" ? "全部" : s, ui.st)).join("")}</select></label>
    <label>排序 <select data-f="sort">${opt("new", "最新在上", ui.sort)}${opt("rank", "排名分", ui.sort)}${opt("id", "编号", ui.sort)}</select></label>
    <label class="grow">搜索 <input data-f="q" type="search" placeholder="编号、配方名、父本或说明" value="${esc(ui.q || "")}"></label>
    ${hidden ? `<label class="check"><input data-f="aux" type="checkbox"${ui.aux ? " checked" : ""}> 再显示 ${hidden} 张计分床</label>` : ""}`;
}

// Sideways scrolling of the two tables moves together. The box the user last touched (wheel, pointer, touch or
// keys) leads; scroll events of the other box are only the echo of following it and are ignored, so the two
// boxes never pull each other back.
export function linkScroll(a, b) {
  let lead = null;
  for (const box of [a, b]) {
    for (const type of ["wheel", "pointerdown", "touchstart", "keydown"]) {
      box.addEventListener(type, () => { lead = box; }, { passive: true });
    }
  }
  const follow = (from, to) => from.addEventListener("scroll", () => {
    if (lead && lead !== from) return;
    if (Math.abs(to.scrollLeft - from.scrollLeft) >= 1) to.scrollLeft = from.scrollLeft;
  }, { passive: true });
  follow(a, b);
  follow(b, a);
}

export class ReferenceTable {
  constructor(root) {
    root.innerHTML = `<p class="lead">几条标准基线，加上一阶段验证榜官网分最高的两份原件。列与下面的样本记录逐列对齐。
      官网分考的是另一批答案，只能比先后，不能和本地分直接比大小。</p>
      <div class="scroll ref-wrap"><table class="subs ref"></table></div><ul class="fine ref-notes"></ul>`;
    this.wrap = root.querySelector(".ref-wrap");
    this.table = root.querySelector("table");
    this.notes = root.querySelector(".ref-notes");
    this.sig = "";
  }

  render(p, cols) {
    const byId = new Map(p.rows.map(r => [r.id, r]));
    const items = (p.reference || []).map(item => ({ item, r: item.id ? byId.get(item.id) : null }));
    const sig = JSON.stringify([cols.map(c => [c.key, c.w, c.pct, c.bed?.flat]), items, p.reference_notes]);
    if (sig === this.sig) return;
    this.sig = sig;
    this.table.style.minWidth = minWidth(cols);
    const body = items.map(({ item, r }) => `<tr class="ref-${esc(item.kind)}">${cols.map(c =>
      `<td class="${c.cls || ""}">${referenceCell(c, item, r)}</td>`).join("")}</tr>`).join("");
    this.table.innerHTML = `${colgroup(cols)}<thead><tr>${cols.map(head).join("")}</tr></thead><tbody>${body}</tbody>`;
    this.notes.innerHTML = (p.reference_notes || []).map(n => `<li>${esc(n)}</li>`).join("");
  }
}

export class SubmissionTable {
  constructor(root, onChange) {
    this.root = root;
    this.onChange = onChange;
    this.rows = new Map();      // id -> { tr, sig }
    this.details = new Map();   // id -> tr
    this.headSig = "";
    this.limit = PAGE;
    root.innerHTML = `<p class="counts"></p><form class="filters" onsubmit="return false"></form>
      <div class="scroll subs-wrap"><table class="subs"><colgroup></colgroup><thead></thead><tbody></tbody></table></div>
      <p class="more"><button type="button" hidden>显示更多</button></p>`;
    this.counts = root.querySelector(".counts");
    this.form = root.querySelector(".filters");
    this.wrap = root.querySelector(".subs-wrap");
    this.table = root.querySelector("table");
    this.cols = root.querySelector("colgroup");
    this.thead = root.querySelector("thead");
    this.tbody = root.querySelector("tbody");
    this.moreButton = root.querySelector(".more button");
    this.moreButton.addEventListener("click", () => { this.limit += PAGE; this.render(this.p, this.ui); });
    this.form.addEventListener("input", e => this.filterChanged(e));
    this.form.addEventListener("change", e => this.filterChanged(e));
    this.tbody.addEventListener("click", e => {
      const tr = e.target.closest("tr[data-id]");
      if (tr && !e.target.closest("a")) this.onChange({ open: this.ui.open === tr.dataset.id ? "" : tr.dataset.id });
    });
  }

  filterChanged(e) {
    const key = e.target.dataset.f;
    if (!key) return;
    const value = e.target.type === "checkbox" ? (e.target.checked ? "1" : "") : e.target.value;
    if (key === "q" && e.type === "change") return;
    this.limit = PAGE;
    this.onChange({ [key]: value }, key === "q");
  }

  render(p, ui, cols = columnsFor(p, ui)) {
    this.p = p;
    this.ui = ui;
    this.tbody.querySelectorAll("tr.placeholder").forEach(tr => tr.remove());
    this.counts.innerHTML = countsLine(p);
    const focused = document.activeElement && this.form.contains(document.activeElement) ? document.activeElement.dataset.f : null;
    const hidden = p.columns.filter(c => c.role !== "rank" && c.default === false).length;
    const formSig = JSON.stringify([ui.by, ui.kind, ui.st, ui.sort, ui.aux, hidden]);
    if (this.formSig !== formSig || !this.form.innerHTML) {
      this.form.innerHTML = filtersHTML(ui, hidden);
      this.formSig = formSig;
      if (focused) this.form.querySelector(`[data-f="${focused}"]`)?.focus();
    }
    const headSig = JSON.stringify(cols.map(c => [c.key, c.w, c.pct, c.bed?.flat]));
    if (headSig !== this.headSig) {
      this.cols.outerHTML = colgroup(cols);
      this.cols = this.table.querySelector("colgroup");
      this.thead.innerHTML = `<tr>${cols.map(head).join("")}</tr>`;
      this.table.style.minWidth = minWidth(cols);
      this.headSig = headSig;
      this.rows.clear();
      this.details.clear();
      this.tbody.textContent = "";
    }
    const all = filterRows(p, ui);
    const shown = all.slice(0, this.limit);
    if (ui.open && !shown.some(r => r.id === ui.open)) {
      const opened = all.find(r => r.id === ui.open);
      if (opened) shown.push(opened);
    }
    const keep = new Set();
    const order = [];
    for (const r of shown) {
      const sig = JSON.stringify(r);
      let entry = this.rows.get(r.id);
      if (!entry || entry.sig !== sig) {
        const tr = document.createElement("tr");
        tr.dataset.id = r.id;
        tr.className = `${r.kind !== "提交" ? "kind-other" : ""}`;
        tr.innerHTML = cols.map(c => `<td class="${c.cls || ""}">${sampleCell(c, r)}</td>`).join("");
        if (entry) entry.tr.replaceWith(tr);
        entry = { tr, sig };
        this.rows.set(r.id, entry);
      }
      entry.tr.classList.toggle("open", ui.open === r.id);
      keep.add(r.id);
      order.push(entry.tr);
      if (ui.open === r.id) order.push(this.detailRow(r, cols.length));
    }
    for (const [id, entry] of this.rows) if (!keep.has(id)) { entry.tr.remove(); this.rows.delete(id); }
    for (const [id, tr] of this.details) if (id !== ui.open) { tr.remove(); this.details.delete(id); }
    // Re-append in order: moves existing nodes without rebuilding them.
    let cursor = this.tbody.firstChild;
    for (const node of order) {
      if (node === cursor) { cursor = cursor.nextSibling; continue; }
      this.tbody.insertBefore(node, cursor);
    }
    if (!shown.length) {
      this.tbody.insertAdjacentHTML("beforeend", `<tr class="placeholder"><td colspan="${cols.length}" class="muted">没有符合筛选的提交。</td></tr>`);
    }
    this.moreButton.hidden = all.length <= this.limit;
    this.moreButton.textContent = `显示更多（还有 ${all.length - Math.min(all.length, this.limit)} 个）`;
    this.fit();
  }

  // Column headers stick below the page's top bar only when the table fits the page width; a wider table
  // scrolls sideways inside its own box, where sticking to the page is not possible.
  fit() {
    this.wrap.classList.toggle("fits", this.table.offsetWidth <= this.wrap.clientWidth + 1);
  }

  detailRow(r, span) {
    let tr = this.details.get(r.id);
    if (tr) return tr;
    tr = document.createElement("tr");
    tr.className = "detail";
    tr.innerHTML = `<td colspan="${span}"><p class="muted">正在读取 ${esc(r.id)} 的逐种子明细…</p></td>`;
    this.details.set(r.id, tr);
    fetchDetail(this.p.task, r.id)
      .then(d => { tr.firstChild.innerHTML = detailHTML(r, d, this.p); })
      .catch(err => { tr.firstChild.innerHTML = `<p class="warn-red">读不到明细：${esc(err.message)}</p>`; });
    return tr;
  }
}

function detailHTML(r, d, p) {
  const seeds = p.rules.seeds.length ? p.rules.seeds : [null];
  const latest = new Map();
  const counts = new Map();
  for (const c of d.cells) {
    const key = `${c.bed}|${c.mode ?? ""}|${c.seed ?? ""}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    const prev = latest.get(key);
    if (!prev || (c.at || "") >= (prev.at || "")) latest.set(key, c);
  }
  const bedModes = [...new Set(d.cells.map(c => `${c.bed}|${c.mode ?? ""}`))];
  const label = id => p.columns.find(c => c.id === id)?.label || "";
  const tipOf = c => [c.batch, c.cal ? `校准 ${c.cal}` : "", c.reason || "", Object.entries(c.skills || {}).map(([k, v]) => `${k} ${num(v)}`).join(" ")].filter(Boolean).join(" · ");
  const rows = bedModes.map(bm => {
    const [bed, mode] = bm.split("|");
    const perSeed = seeds.map(s => latest.get(`${bed}|${mode}|${s ?? ""}`));
    const mean = latest.get(`${bed}|${mode}|`);
    let cells;
    if (seeds[0] !== null && perSeed.every(c => !c) && mean) {
      // The T3 calibration panel keeps one five-seed mean per cell, not the per-seed scores.
      const text = mean.st === "valid" ? `五种子均值 ${num(mean.v, 3)}` : mean.st === "na" ? "不适用" : "失败";
      cells = `<td colspan="${seeds.length}" class="${mean.st === "valid" ? "" : "muted"}" title="${esc(tipOf(mean))}">${text}<small>校准面板只记录均值</small></td>`;
    } else {
      cells = seeds.map((s, i) => {
        const key = `${bed}|${mode}|${s ?? ""}`;
        const c = perSeed[i];
        if (!c) return `<td class="muted">未评</td>`;
        const times = counts.get(key) > 1 ? `<small title="评过 ${counts.get(key)} 次，显示最近一次">×${counts.get(key)}</small>` : "";
        const text = c.st === "valid" ? num(c.v, 3) : c.st === "na" ? "不适用" : "失败";
        return `<td class="${c.st === "valid" ? "" : "muted"}" title="${esc(tipOf(c))}">${text}${times}</td>`;
      }).join("");
    }
    const summary = d.beds[bed];
    return `<tr><th class="mono">${esc(bed)}<small>${esc(label(bed))}</small></th><td>${esc(mode || "—")}</td>${cells}
      <td>${summary ? bedCell([summary.v, summary.k, summary.n, summary.st, summary.m5]) : ""}</td></tr>`;
  }).join("");
  const seedHead = seeds.map(s => `<th>${s === null ? "值" : `种子 ${s}`}</th>`).join("");
  const batches = d.batches.map(b => `<li><span class="mono">${esc(b.id)}</span> ${esc(b.purpose)} · ${status(b.st)} · ${person(b.by)}
    · 验收 ${when(b.accepted)}${b.error ? ` · <span class="warn-red">${esc(b.error)}</span>` : ""}</li>`).join("");
  const ledger = d.ledger || {};
  return `<div class="detail-body">
    <p><b class="mono">${esc(r.id)}</b> · 配方名 <span class="mono">${esc(r.name)}</span> · 首次出现 ${when(ledger.first_seen)}（${esc(ledger.source || "")}）
      · 提交者 ${person(r.by)}（${esc(r.how)}）</p>
    ${r.note ? `<p>改了什么：${esc(r.note)} <small class="muted">来源：${esc(r.nsrc || "")}</small></p>` : ""}
    ${r.verdict ? `<p>判定：${esc(r.verdict)} <small class="muted">来源：${esc(r.vsrc || "")}</small></p>` : ""}
    <div class="scroll"><table class="seeds"><thead><tr><th>床</th><th>参照</th>${seedHead}<th>本床均分</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted">悬停格子可看批次、校准方式和分项；×n 表示同一格被评过 n 次，取最近一次验收。</p>
    <details><summary>批次（${d.batches.length}）</summary><ul class="fine">${batches}</ul></details></div>`;
}
