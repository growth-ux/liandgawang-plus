#!/usr/bin/env node
// 用 Chrome.app + CDP 截演讲稿某一页。用法: node .frontend-slides/shot.mjs <页码> <输出png> [裁剪宽x高]
import { spawn, execSync } from 'node:child_process';
import { writeFileSync, rmSync, existsSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9417;
const PROFILE = '/tmp/ldex-shot-profile';
const HTML = process.argv[2];
const PAGE = process.argv[3];
const OUT = process.argv[4];
const CLIP = process.argv[5]; // 可选 "x,y,w,h"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// file:// 缓存很顽固，每次换干净 profile
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

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: `file://${HTML}#${PAGE}` });
await sleep(2200);

// 断言拿到的确实是这一页，避免截到缓存旧版本
const check = await send('Runtime.evaluate', {
  expression: `document.querySelector('.slide.active')?.getAttribute('aria-label')||'NONE'`,
  returnByValue: true,
});
console.log('当前页:', check.result?.result?.value);

// 溢出检测：舞台内元素超出可视高度、或彼此重叠时报警
const overflow = await send('Runtime.evaluate', {
  expression: `(() => {
    const out = [];
    document.querySelectorAll('.slide.active *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height === 0 || r.width === 0) return;
      if (r.bottom > 1081) out.push('超出下边界: ' + el.className + ' bottom=' + Math.round(r.bottom));
      if (r.right > 1921) out.push('超出右边界: ' + el.className + ' right=' + Math.round(r.right));
    });
    // flex 压缩导致的裁切不会体现在 scrollHeight 上：逐个比对孩子是否跑出父容器
    document.querySelectorAll('.slide.active .demo-brief,.slide.active .demand-copy,.slide.active .demo-main').forEach((p) => {
      const pr = p.getBoundingClientRect();
      p.querySelectorAll('*').forEach((c) => {
        const cs = getComputedStyle(c);
        if (cs.position === 'absolute' || cs.position === 'fixed') return;
        const cr = c.getBoundingClientRect();
        if (cr.height === 0) return;
        if (cr.bottom > pr.bottom + 1) out.push('跑出父容器(下): ' + (c.className || c.tagName) + ' ' + Math.round(cr.bottom - pr.bottom) + 'px');
        if (cr.top < pr.top - 1) out.push('跑出父容器(上): ' + (c.className || c.tagName));
      });
    });
    // flex 纵列容器：scrollHeight 会因 justify-content:center 失真（内容往两头溢时只算下半截），
    // 所以逐项累加子元素高度 + 间距 + 内边距，和容器高度比。这是精确几何，不依赖 scrollHeight。
    document.querySelectorAll('.slide.active *').forEach((box) => {
      const cs = getComputedStyle(box);
      if (!cs.display.includes('flex') || cs.flexDirection !== 'column') return;
      const kids = [...box.children];
      if (kids.length < 2) return;
      const gap = parseFloat(cs.rowGap) || 0;
      const sum = kids.reduce((a, k) => a + k.getBoundingClientRect().height, 0);
      const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const need = sum + gap * (kids.length - 1) + pad;
      const have = box.getBoundingClientRect().height;
      if (need > have + 1) out.push('纵列内容超出: ' + box.className + ' 需要' + Math.round(need) + ' > 容器' + Math.round(have));
    });
    return out.length ? [...new Set(out)].join('\\n') : 'OK';
  })()`,
  returnByValue: true,
});
console.log('溢出检测:', overflow.result?.result?.value);

// 版块几何：量左栏容器和内容盒的高度关系，定位被裁切的位置
const geom = await send('Runtime.evaluate', {
  expression: `(() => {
    const pick = (s) => {
      const el = document.querySelector(s);
      if (!el) return s + ': 无';
      const r = el.getBoundingClientRect();
      return s + ': top=' + Math.round(r.top) + ' bottom=' + Math.round(r.bottom) + ' h=' + Math.round(r.height) + ' scroll=' + el.scrollHeight;
    };
    return ['.demo-body', '.inv-layout', '.inv-summary', '.demo-main', '.cost-story-layout']
      .map(pick).join('\\n');
  })()`,
  returnByValue: true,
});
console.log('几何:', geom.result?.result?.value);

const params = { format: 'png' };
if (CLIP) {
  const [x, y, w, h] = CLIP.split(',').map(Number);
  params.clip = { x, y, width: w, height: h, scale: 1 };
}
const shot = await send('Page.captureScreenshot', params);
writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
console.log('已保存:', OUT);
ws.close();
try { execSync(`pkill -f ${PROFILE}`, { stdio: 'ignore' }); } catch {}
process.exit(0);
