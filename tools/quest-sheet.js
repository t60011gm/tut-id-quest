#!/usr/bin/env node
/* 把 data/quests.js 轉成審閱用的 docs/quest-answers.md（題目、正解與理由）。
 * 用法：node tools/quest-sheet.js
 * 題目只改 data/quests.js，改完重跑這支程式，審閱檔就會同步。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'data/faculty.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'data/quests.js'), 'utf8'), ctx);
const { WORLD, QUESTS } = ctx.window;

const out = [];
const w = (s = '') => out.push(s);
const list = (arr) => arr.forEach((x) => w(`- ${x}`));

w('# 南應大室研所大冒險 · 任務題目與答案');
w();
w('> 本檔由 `data/quests.js` 自動產生，請勿直接修改。修正題目請改 `data/quests.js`，再執行 `node tools/quest-sheet.js`。');
w('> 題目依一般專業常識撰寫，請各位老師審閱自己的題目，有需要修正的地方直接標註即可。');
w();
w(`第一階段收集數量：一般模式 ${QUESTS.settings.count} 個、快速模式 ${QUESTS.settings.quickCount} 個。`);
w();

const games = {
  network(s) {
    s.rounds.forEach((r, i) => {
      w(`**第 ${i + 1} 題：${r.ask}**`);
      w();
      w(`- 網路：節點 ${r.nodes.join('、')}；連線 ${r.edges.map((e) => e.join('–')).join('、')}`);
      w(`- **正解：${r.answer}**`);
      w(`- 理由：${r.why}`);
      w();
    });
  },
  sequence(s) {
    w('**正確順序**');
    w();
    w('| 順序 | 工程 | 理由 |');
    w('|---|---|---|');
    s.steps.forEach((st, i) => w(`| ${i + 1} | ${st.name} | ${st.why} |`));
    w();
  },
  prompt(s) {
    w('**選項**');
    w();
    w(`- 風格：${s.options.style.join('、')}`);
    w(`- 色調：${s.options.palette.join('、')}`);
    w(`- 材質：${s.options.material.join('、')}`);
    w(`- 光線：${s.options.light.join('、')}`);
    w();
    w('| 回合 | 目標空間 | 風格 | 色調 | 材質 | 光線 |');
    w('|---|---|---|---|---|---|');
    s.rounds.forEach((r, i) => w(`| ${i + 1} | ${r.target} | ${r.answer.style} | ${r.answer.palette} | ${r.answer.material} | ${r.answer.light} |`));
    w();
  },
  nodes(s) {
    w('**節點**');
    w();
    s.nodes.forEach((n) => w(`- ${n.name}${n.desc ? `（${n.desc}）` : ''}`));
    w();
    const name = (id) => s.nodes.find((n) => n.id === id).name;
    w('**正確連線**');
    w();
    s.answer.wires.forEach(([from, to]) => { const [id, port] = to.split('.'); w(`- ${name(from)} → ${name(id)}（${port}）`); });
    w(`- 扭轉角度目標：**${s.answer.twist}°**（容許誤差 ±${s.answer.tolerance}°）`);
    w(`- 理由：${s.why}`);
    w();
  },
  airflow(s) {
    w(`**條件**：二氧化碳上限 ${s.limits.co2} ppm、室外約 ${s.limits.outdoor} ppm、時間 ${s.limits.seconds} 秒`);
    w();
    w('| 設備 | 二氧化碳 | 耗電 | 說明 |');
    w('|---|---|---|---|');
    s.devices.forEach((d) => w(`| ${d.name} | ${d.co2} | ${d.energy} | ${d.note} |`));
    w();
    w(`**解法**：${s.answer}`);
    w();
  },
  sorting(s) {
    w('**分類題**');
    w();
    w('| 材料 | 正解 | 理由 |');
    w('|---|---|---|');
    s.items.forEach((it) => w(`| ${it.name} | ${it.answer} | ${it.why} |`));
    w();
    w('**二選一題**');
    w();
    s.choices.forEach((c, i) => { w(`${i + 1}. ${c.ask}（${c.options.join(' ／ ')}）`); w(`   - **正解：${c.answer}**。${c.why}`); });
    w();
  },
  stack(s) {
    w(`**玩法**：技巧型小遊戲，疊到 ${s.goal.layers} 層過關，沒有對錯題。知識內容在下方的知識小卡。`);
    w();
  },
  bracing(s) {
    w('| 關卡 | 構架 | 最少斜撐 | 正解 | 理由 |');
    w('|---|---|---|---|---|');
    s.levels.forEach((l) => w(`| ${l.name} | ${l.frame} | ${l.minBraces} | ${l.answer} | ${l.why} |`));
    w();
  },
  matching(s) {
    w('| 心願 | 社造面向 | 最佳夥伴 | 最佳地點 | 可行的其他地點 |');
    w('|---|---|---|---|---|');
    s.wishes.forEach((x) => w(`| ${x.wish} | ${x.aspect} | ${x.best.partner} | ${x.best.place} | ${x.ok.join('、') || '—'} |`));
    w();
  },
  storeplan(s) {
    w('| 位置 | 最佳設施 | 理由 |');
    w('|---|---|---|');
    s.slots.forEach((x) => w(`| ${x.slot} | ${x.best} | ${x.why} |`));
    w();
  },
  spotbrand(s) {
    w(`**品牌規範**：${s.spec.mark}；${s.spec.color}；${s.spec.type}`);
    w();
    w('| 應用 | 是否正確 | 錯誤之處 |');
    w('|---|---|---|');
    s.applications.forEach((a) => w(`| ${a.name} | ${a.ok ? '正確' : '**錯誤**'} | ${a.error || '—'} |`));
    w();
    w(`**最後一題**：${s.packaging.ask}`);
    w();
    s.packaging.options.forEach((o) => w(`- ${o === s.packaging.answer ? `**${o}（正解）**` : o}`));
    w();
    w(`理由：${s.packaging.why}`);
    w();
  },
  moodboard(s) {
    w('**選項**');
    w();
    w(`- 家具：${s.options.furniture.join('、')}`);
    w(`- 材質：${s.options.material.join('、')}`);
    w(`- 色彩：${s.options.color.join('、')}`);
    w(`- 燈光：${s.options.light.join('、')}`);
    w();
    w('| 回合 | 風格 | 家具 | 材質 | 色彩 | 燈光 | 理由 |');
    w('|---|---|---|---|---|---|---|');
    s.rounds.forEach((r, i) => w(`| ${i + 1} | ${r.style} | ${r.answer.furniture} | ${r.answer.material} | ${r.answer.color} | ${r.answer.light} | ${r.why} |`));
    w();
  }
};

for (const region of WORLD.regions) {
  const ts = WORLD.faculty.filter((f) => f.region === region.id);
  w(`## ${region.name}（採集場：${region.field ? region.field.name : '—'}）`);
  w();
  for (const f of ts) {
    const q = QUESTS.teachers[f.id];
    if (!q) { w(`### ${f.name}（尚未設計任務）`); w(); continue; }
    w(`### ${f.name}：${f.fields.join('、')}`);
    w();
    w(`徽章：**${q.badge}**`);
    w();
    w('#### 第一階段：採集');
    w();
    list([
      `小怪：${q.stage1.monster.name}（${q.stage1.monster.desc}）`,
      `道具：${q.stage1.item.name}（${q.stage1.item.desc}）`,
      `接任務：「${q.stage1.lines.accept}」`,
      `提示：「${q.stage1.lines.hint}」`,
      `完成：「${q.stage1.lines.done}」`
    ]);
    w();
    const s = q.stage2;
    w(`#### 第二階段：${s.title}`);
    w();
    w(`開場：「${s.intro}」`);
    w();
    w(`玩法：${s.rules}`);
    w();
    (games[s.game] || (() => w(`（小遊戲類型 ${s.game}）`)))(s);
    w(`通關：「${s.win}」`);
    w();
    w(`**知識小卡：${s.knowledge.title}**`);
    w();
    list(s.knowledge.points);
    w();
  }
}

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
const file = path.join(root, 'docs/quest-answers.md');
fs.writeFileSync(file, out.join('\n'));
console.log(`wrote ${path.relative(root, file)} (${out.length} 行)`);
