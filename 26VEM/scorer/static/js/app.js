// Router, URL state and polling. Each task page has its own URL; filters and the opened row live in it too.
import { fetchIndex, fetchTask, isSnapshot } from "./api.js";
import { countdown, esc, when } from "./fmt.js";
import { ReferenceTable, SMALL, SubmissionTable, columnsFor, linkScroll } from "./table.js";
import { activity, batches, headline, jobs, rules, statusBar } from "./views.js";

const TASKS = ["T1", "T2A", "T2B", "T3"];
const DEFAULTS = { by: "all", kind: "提交", st: "all", sort: "new", q: "", aux: "", open: "" };
const POLL_MS = isSnapshot ? 5 * 60 * 1000 : 15 * 1000;
const main = document.getElementById("main");
let index = null;
let payload = null;
let table = null;
let reference = null;
let current = "";
let pollError = "";

// Old links (#/scorer, #/scorer/t2, #/scorer/samples) land on the matching new page.
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean).filter(x => x !== "scorer");
  const name = (parts[0] || "t1").toUpperCase();
  const task = name === "T2" ? "T2A" : TASKS.includes(name) ? name : "T1";
  const ui = { ...DEFAULTS };
  for (const [k, v] of new URLSearchParams(query)) if (k in ui) ui[k] = v;
  return { task, ui };
}

function writeHash(task, ui, replace) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(ui)) if (v && v !== DEFAULTS[k]) q.set(k, v);
  const hash = `#/${task.toLowerCase()}${q.toString() ? `?${q}` : ""}`;
  if (location.hash === hash) return;
  if (replace) history.replaceState(null, "", hash);
  else history.pushState(null, "", hash);
}

function nav(task) {
  const tabs = TASKS.map(t => {
    const info = index?.tasks?.[t];
    const dot = info && (info.errors || info.unrecognized) ? `<i class="dot warn" title="有读取错误或未识别批次"></i>`
      : info?.running ? `<i class="dot run" title="有在跑的作业"></i>` : "";
    return `<a href="#/${t.toLowerCase()}" class="${t === task ? "active" : ""}"${t === task ? ' aria-current="page"' : ""}>${esc(info?.title || t)}${dot}</a>`;
  }).join("");
  document.getElementById("tabs").innerHTML = tabs;
}

function shell(task) {
  main.innerHTML = `<section id="status" class="status-bar"></section>
    <section id="headline" class="champion-bar"></section>
    <nav class="jump" aria-label="跳到">跳到${JUMPS.map(([id, label]) => `<button type="button" data-jump="${id}">${label}</button>`).join("")}</nav>
    <section id="reference" class="card"><h2>基线对照</h2><div id="ref"></div></section>
    <section id="samples" class="card"><h2>样本记录</h2><div id="subs"></div></section>
    <section id="running" class="card"></section>
    <section id="activity" class="card"></section>
    <section id="extra" class="card"></section>`;
  main.querySelector(".jump").addEventListener("click", e => {
    const id = e.target.closest("[data-jump]")?.dataset.jump;
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  reference = new ReferenceTable(document.getElementById("ref"));
  table = new SubmissionTable(document.getElementById("subs"), (change, typing) => {
    const { ui } = parseHash();
    const next = { ...ui, ...change };
    writeHash(task, next, typing);
    paint();
  });
  linkScroll(reference.wrap, table.wrap);
  current = task;
}

const JUMPS = [["reference", "基线对照"], ["samples", "样本记录"], ["running", "在跑"], ["activity", "最近动态"], ["extra", "批次与口径"]];

function topRight(now = Date.now()) {
  const where = document.getElementById("where");
  if (where) where.textContent = `${isSnapshot ? "GitHub 快照" : "5090 实时版"}${payload?.rules?.deadline ? ` · ${countdown(payload.rules.deadline, now)}` : ""}`;
}

function paint() {
  const { task, ui } = parseHash();
  nav(task);
  document.title = `${index?.tasks?.[task]?.title || task} · 评分器 · 26VEM${isSnapshot ? "（快照）" : ""}`;
  if (!payload || payload.task !== task) return;
  if (payload.failed) {
    main.innerHTML = `<section class="card"><h2>${esc(task)} 本轮汇总失败</h2><p>其余任务不受影响。原因：</p><ul>${(payload.health?.errors || [])
      .map(e => `<li><code>${esc(e.where)}</code> ${esc(e.msg)}</li>`).join("")}</ul></section>`;
    current = "";
    return;
  }
  if (current !== task || !document.getElementById("subs")) shell(task);
  const now = Date.now();
  document.getElementById("status").innerHTML = notice() + statusBar(payload, index, now);
  document.getElementById("headline").innerHTML = headline(payload);
  topRight(now);
  // One column list for both tables, so 基线对照 and 样本记录 line up column by column.
  const cols = columnsFor(payload, ui);
  reference.render(payload, cols);
  table.render(payload, ui, cols);
  document.getElementById("running").innerHTML = jobs(payload, now);
  document.getElementById("activity").innerHTML = activity(payload);
  const extra = document.getElementById("extra");
  const open = [...extra.querySelectorAll("details")].map(d => d.open);
  extra.innerHTML = batches(payload) + rules(payload);
  extra.querySelectorAll("details").forEach((d, i) => { d.open = open[i] || false; });
}

async function loadTask(task) {
  try {
    const result = await fetchTask(task);
    if (!result.unchanged || !payload || payload.task !== task) payload = result.data;
    if (parseHash().task === task) paint();
  } catch (err) {
    if (!payload || payload.task !== task) {
      main.innerHTML = `<section class="card"><p class="warn-red">未取得 ${esc(task)} 数据：${esc(err.message)}${index?.collected_at ? `。上次成功采集 ${when(index.collected_at)}` : ""}</p></section>`;
      current = "";
    }
  }
}

function notice() {
  return pollError ? `<p class="warn-red">刷新失败：${esc(pollError)}。下面是上次取得的数据。</p>` : "";
}

async function poll() {
  try {
    const next = await fetchIndex();
    pollError = "";
    const { task } = parseHash();
    const changed = !index || index.tasks?.[task]?.version !== next.tasks?.[task]?.version;
    index = next;
    if (changed || !payload || payload.task !== task) await loadTask(task);
    else paint();
  } catch (err) {
    pollError = err.message;
    if (payload) paint();
    else main.innerHTML = `<section class="card"><p class="warn-red">未取得看板数据：${esc(err.message)}</p></section>`;
  }
}

window.addEventListener("hashchange", () => {
  const { task } = parseHash();
  if (!payload || payload.task !== task) {
    main.innerHTML = `<p class="muted">正在读取 ${esc(task)}…</p>`;
    current = "";
    loadTask(task);
  } else {
    paint();
  }
});
window.addEventListener("popstate", () => paint());

// Sticky table headers sit just below the top bar, whose height changes when it wraps on narrow screens.
function measureTop() {
  const top = document.querySelector(".top");
  if (top) document.documentElement.style.setProperty("--top-h", `${top.offsetHeight}px`);
}
let resizeQueued = false;
window.addEventListener("resize", () => {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => { resizeQueued = false; measureTop(); table?.fit(); });
});
SMALL.addEventListener("change", () => paint());   // phones keep five columns in both tables
measureTop();

poll();
setInterval(poll, POLL_MS);
setInterval(() => {
  const el = document.getElementById("status");
  if (payload && el && !payload.failed) el.innerHTML = notice() + statusBar(payload, index);
  topRight();
}, 30 * 1000);
