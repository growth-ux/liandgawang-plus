#!/usr/bin/env node
// 打开采购工作台，dump 采购列表 / 造一笔到厂核算的单并截图。
// 用法: node workbench.mjs dump
//       node workbench.mjs cost <out.png> [clip]
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, rmSync, existsSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9418;
const PROFILE = '/tmp/ldex-wb-profile';
const BASE = 'http://localhost:5174';

const mode = process.argv[2];
const STAGE = Number(process.argv[5] ?? 6);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync(`pkill -f ${PROFILE}`, { stdio: 'ignore' }); } catch {}
await sleep(400);
if (existsSync(PROFILE)) rmSync(PROFILE, { recursive: true, force: true });

spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--window-size=1920,1080', 'about:blank',
], { stdio: 'ignore', detached: true }).unref();

let wsUrl = null;
for (let i = 0; i < 40; i++) {
  await sleep(400);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page?.webSocketDebuggerUrl) { wsUrl = page.webSocketDebuggerUrl; break; }
  } catch {}
}
if (!wsUrl) { console.error('CDP 连接失败'); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) =>
  new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) console.error('页面报错:', JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails));
  return r.result?.result?.value;
};

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 2, mobile: false });

if (mode === 'dump') {
  await send('Page.navigate', { url: `${BASE}/agent/da` });
  await sleep(3000);
  const list = JSON.parse((await evaluate(`localStorage.getItem('zhanggui-purchases-v1')`)) || '[]');
  console.log('采购条数:', list.length);
  for (const p of list) console.log(` id=${p.id} stage=${p.stage} transport=${p.transportId}`);
  ws.close();
  try { execSync(`pkill -f ${PROFILE}`, { stdio: 'ignore' }); } catch {}
  process.exit(0);
}

// ---- cost 模式：造一笔铁公联运的单，直达 stage 6 ----
await send('Page.navigate', { url: `${BASE}/agent/da` });
await sleep(3000);
console.log('location.host =', await evaluate('location.host'));

const seeded = await evaluate(`(async () => {
  const m = await import('/src/features/zhanggui/purchaseModel.ts');
  const purchase = {
    ...m.newPurchase({ variety: "玉米", quantity: 200, destination: "山东省潍坊市", days: 10, budget: 2680 }),
    sourceId: "qingdao",
    transportId: "combined",
    stage: ${STAGE},
    qualified: true,
    reviewed: true,
    ordered: true,
    received: true,
    deliveryStep: 2,
    learned: false,
  };
  const list = (() => { try { return JSON.parse(localStorage.getItem(m.PURCHASE_STORAGE_KEY) || "[]"); } catch { return []; } })();
  list.unshift(purchase);
  localStorage.setItem(m.PURCHASE_STORAGE_KEY, JSON.stringify(list));
  const check = m.readPurchases();
  return { id: purchase.id, kept: check.length, transport: check[0]?.transportId, stage: check[0]?.stage };
})()`);
console.log('已写入:', JSON.stringify(seeded));
if (!seeded || seeded.kept === 0) { console.error('数据没过 readPurchases 校验，被过滤了'); process.exit(1); }

// 同文档跳转 React 不会重读 localStorage，必须换文档再回来
await send('Page.navigate', { url: 'about:blank' });
await sleep(600);
await send('Page.navigate', { url: `${BASE}/agent/da?purchase=${seeded.id}&stage=${STAGE}` });
await sleep(3500);

// 阶段面板在抽屉里，可能要先把抽屉打开才有非零尺寸
const size = await evaluate(`(() => { const el = document.querySelector('.pw-settlement-primary'); return el ? el.getBoundingClientRect().width : -1; })()`);
console.log('结算面板宽度:', size);
if (size === 0 || size === -1) {
  const opened = await evaluate(`(() => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find((x) => /继续办理|查看明细|核验|办理/.test(x.textContent || ''));
    if (b) { b.click(); return b.textContent.trim(); }
    return '没找到按钮: ' + btns.map(x => (x.textContent||'').trim()).filter(Boolean).slice(0, 12).join(' | ');
  })()`);
  console.log('尝试打开抽屉:', opened);
  await sleep(1500);
}

const probe = await evaluate(`(() => {
  const q = (s) => document.querySelector(s)?.textContent?.trim().replace(/\\s+/g,' ') || 'N/A';
  return [
    '主数字   : ' + q('.pw-settlement-primary strong'),
    '到厂总成本: ' + q('.pw-settlement-kpis article:nth-child(1) strong'),
    '合格入库 : ' + q('.pw-settlement-kpis article:nth-child(2) strong'),
    '预算差异 : ' + q('.pw-settlement-kpis article:nth-child(3) strong'),
    '结算合计 : ' + q('.pw-settlement-cost-total'),
    '结算调整 : ' + q('.pw-settlement-adjustments dl'),
    '损耗归责 : ' + q('.pw-settlement-loss-result'),
  ].join('\\n');
})()`);
console.log(probe);

const params = { format: 'png' };
if (process.argv[4]) {
  const [x, y, w, h] = process.argv[4].split(',').map(Number);
  params.clip = { x, y, width: w, height: h, scale: 1 };
}
const shot = await send('Page.captureScreenshot', params);
writeFileSync(process.argv[3], Buffer.from(shot.result.data, 'base64'));
console.log('已保存:', process.argv[3]);
ws.close();
try { execSync(`pkill -f ${PROFILE}`, { stdio: 'ignore' }); } catch {}
process.exit(0);
