// Section renderers. Each takes the task payload and returns HTML; the submission table lives in table.js.
import { age, esc, minutesAgo, num, person, signed, stamp, status, when } from "./fmt.js";
import { isSnapshot } from "./api.js";

const STALE_SCAN_MIN = isSnapshot ? 90 : 3;   // the GitHub snapshot is published hourly

export function statusBar(p, index, now = Date.now()) {
  const h = p.health || {};
  const collectedAge = minutesAgo(h.collected_at, now);
  const scanBad = collectedAge !== null && collectedAge > STALE_SCAN_MIN;
  const items = [
    `<span class="${scanBad ? "warn-red" : ""}">${isSnapshot ? "快照采集于" : "采集"} ${stamp(h.collected_at, now)}</span>`,
    `<span>最近验收 ${stamp(h.last_accepted, now)}</span>`,
    `<span>在跑作业 <b>${h.running ?? 0}</b></span>`,
    `<span>在评批次 <b>${h.inflight ?? 0}</b></span>`,
  ];
  const health = [`最近新批次 ${when(h.last_new)}`];
  const unrec = h.unrecognized || 0, errs = h.error_count || 0;
  health.push(`<span class="${unrec ? "warn-amber" : ""}" title="${esc((h.unrecognized_ids || []).join("、"))}">未识别用途 ${unrec}</span>`);
  health.push(`<span class="${errs ? "warn-red" : ""}">读取错误 ${errs}</span>`);
  let errors = "";
  if (errs) {
    errors = `<details class="errors"><summary>${errs} 条读取错误（只影响对应批次）</summary><ul>${(h.errors || [])
      .map(e => `<li><code>${esc(e.where)}</code> ${esc(e.msg)}</li>`).join("")}</ul></details>`;
  }
  const scanError = index?.scan_error ? `<p class="warn-red">最近一次采集失败，页面显示的是上一次成功的结果。</p>`
    : index?.restored ? `<p class="warn-amber">服务刚重启，正在重新采集；下面先显示重启前最后一次采集的结果。</p>` : "";
  const snapshot = isSnapshot ? `<p class="snapshot-note">这是 GitHub 公开快照，每小时更新一次，只含分数和状态；改了什么、逐种子明细、作业和日志只在 5090 实时版（经 SSH 隧道打开 http://127.0.0.1:18765/scorer/）。</p>` : "";
  return `${snapshot}<div class="bar">${items.join("<i>·</i>")}</div>
    <div class="bar health">采集健康：${health.join("<i>·</i>")}<span class="muted">（每轮 ${h.scan_seconds ?? "—"} 秒）</span></div>${errors}${scanError}`;
}

// The champion in one line, like v5's 最新候选 line; the baselines are a table of their own below.
export function headline(p) {
  const c = p.champion;
  if (!c) return `<p class="champion muted">还没有完整评完主床的提交，暂无冠军。</p>`;
  const parent = c.parent ? ` · 父本 <span class="mono">${esc(c.parent)}</span>${c.dp !== null ? `（${signed(c.dp)}）` : ""}` : "";
  return `<p class="champion"><span class="label">当前冠军</span> <b class="mono">${esc(c.name)}</b> <span class="mono muted">${esc(c.id)}</span> ${person(c.by)}
    · 排名分 <b>${num(c.rank, 3)}</b>${parent} · 验收于 ${when(c.last)}${c.note ? `<br><span class="note">${esc(c.note)}</span>` : ""}</p>`;
}

export function jobs(p, now = Date.now()) {
  const list = p.jobs || [];
  const states = p.job_states || {};
  const summary = Object.entries(states).map(([k, v]) => `${({ running: "在跑", waiting: "排队", succeeded: "已结束", failed: "失败", interrupted: "中断", cancelled: "已取消", unknown: "未知" })[k] || k} ${v}`).join(" · ");
  if (isSnapshot) {
    return `<h2>在跑</h2><p>采集时本任务在跑 ${states.running || 0} 个作业（${esc(summary)}）。作业明细只在 5090 实时版显示。</p>`;
  }
  if (!list.length) return `<h2>在跑</h2><p class="muted">本任务现在没有在跑的作业，近 24 小时也没有结束的作业。</p>`;
  const rows = list.map(j => `<tr><td class="mono">${esc(j.id)}</td><td>${person(j.by)}</td><td>${status(j.label)}${j.rc !== null && j.rc !== undefined && j.rc !== 0 ? ` <small>退出码 ${esc(j.rc)}</small>` : ""}</td>
    <td>${when(j.started)}</td><td>${when(j.active)}<span class="age">（${age(j.active, now)}）</span></td>
    <td class="mono small">${esc((j.batches || []).join("、")) || "—"}</td><td class="mono small">${esc((j.subs || []).join("、")) || "—"}</td></tr>`).join("");
  return `<h2>在跑</h2><p class="muted">全部作业：${esc(summary)}。下表是在跑、排队和近 24 小时结束的作业。</p>
    <div class="scroll"><table class="jobs"><thead><tr><th>作业</th><th>提交者</th><th>状态</th><th>启动于</th><th>最后活动</th><th>批次</th><th>提交编号</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

export function activity(p) {
  const list = p.activity || [];
  if (!list.length) return `<h2>最近动态</h2><p class="muted">今天和昨天的 ${esc(p.task)} 日志还没有条目（nexus/logs/${esc(p.task)}/）。</p>`;
  const items = list.map(a => `<li><span class="when">${esc(a.at)}</span> ${person(a.by)} <span class="mono small">${esc(a.ref || "")}</span>
    <div class="log">${a.lines.map(esc).join("<br>")}</div></li>`).join("");
  return `<h2>最近动态</h2><ul class="activity">${items}</ul>`;
}

export function batches(p) {
  const list = p.batches || [];
  const rows = list.slice(0, 120).map(b => `<tr><td class="mono">${esc(b.id)}</td><td>${esc(b.purpose)}${b.cls !== "提交" ? ` <small class="muted">${esc(b.cls)}</small>` : ""}</td>
    <td>${person(b.by)}</td><td>${status(b.st)}</td><td>${when(b.started)}</td><td>${when(b.accepted)}</td>
    <td>${b.recipes}</td><td class="small">${b.counts?.valid ?? "—"} / ${b.counts?.na ?? "—"} / ${b.counts?.failed ?? "—"}</td>
    <td class="small">${esc(b.error || "")}</td></tr>`).join("");
  return `<details class="fold"><summary>最近批次（${list.length}）</summary><p class="muted">按回执发现，不按名字筛；认不出用途的批次也列在这里。格子数：有分 / 不适用 / 失败。</p>
    <div class="scroll"><table class="batches"><thead><tr><th>批次</th><th>用途</th><th>提交者</th><th>状态</th><th>开始</th><th>验收</th><th>配方数</th><th>格子</th><th>说明</th></tr></thead>
    <tbody>${rows}</tbody></table></div></details>`;
}

export function rules(p) {
  const r = p.rules;
  const beds = p.columns.map(c => `<tr><td class="mono">${esc(c.id)}</td><td>${esc(c.label)}</td><td>${esc(c.source || "—")}</td>
    <td>${esc(c.stage || "—")}</td><td>${({ rank: "进排名", floor: "底线", display: "只展示" })[c.role] || c.role}${c.modes?.length ? `（${esc(c.modes.join("/"))}）` : ""}</td></tr>`).join("");
  const official = r.official ? `<li>官床：${esc(r.official.label || r.official.bed)}，${esc(r.official.modes.join("、"))} 分开显示，不进排名分。</li>` : "";
  return `<details class="fold"><summary>口径</summary>
    <ul class="fine"><li><b>排名分</b>：${esc(r.formula)}</li><li>${esc(r.confirm)}。</li>
    ${r.floor ? `<li>底线：${esc(r.floor)}。</li>` : ""}${official}
    <li>本地排序与官方是否一致：${esc(r.consistency)}</li>
    <li>同一配方在同一张床、同一种子被评过多次时，取最近一次验收的值；明细里能看到每一次。</li></ul>
    <h3>计分床</h3><div class="scroll"><table><thead><tr><th>床</th><th>名称</th><th>来源</th><th>阶段</th><th>作用</th></tr></thead><tbody>${beds}</tbody></table></div>
    <h3>空值</h3><ul class="fine">${r.legend.map(([k, v]) => `<li><b>${esc(k)}</b>：${esc(v)}</li>`).join("")}</ul>
    <h3>术语</h3><ul class="fine">${r.glossary.map(([k, v]) => `<li><b>${esc(k)}</b>：${esc(v)}</li>`).join("")}</ul></details>`;
}
