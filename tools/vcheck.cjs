// page-mascot demo 验证：渲染 / 盯光标 / 点击眨眼 / 截图
"use strict";
const { spawn } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");
const PORT = 9338;
const OUT = process.argv[2] || "shots";
const browser = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pm-check-"));
const proc = spawn(browser, [
  "--headless=new", "--disable-gpu", "--enable-unsafe-swiftshader",
  "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile,
  "--no-first-run", "--disable-extensions", "--window-size=1280,800",
  "about:blank"
], { stdio: "ignore" });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  let page;
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      page = list.find(t => t.type === "page");
      if (page) break;
    } catch (_) {}
    await sleep(300);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const errs = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      errs.push((d.exception ? (d.exception.description || d.exception.value) : d.text).slice(0, 200));
    }
    else if (m.method === "Log.entryAdded" && m.params.entry.level === "error") errs.push(m.params.entry.text.slice(0, 200));
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:5201/" });
  await sleep(5000);

  // 1) 基础渲染
  const base = await evalJs(`(() => {
    const m = [...document.querySelectorAll('.mascot-left, .mascot-right')];
    const imgs = [...document.querySelectorAll('img')];
    return {
      title: document.title,
      mascotWrappers: m.length,
      imgs: imgs.length,
      imgLoaded: imgs.map(i => ({ src: i.src.split('/').pop(), ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth })),
      h1: document.querySelector('h1').textContent
    };
  })()`);
  console.log("[1] 渲染:", JSON.stringify(base, null, 1));

  // 2) 盯光标：mousemove 到不同位置，读 mascot 内部 transform/背景位移
  const look = await evalJs(`(async () => {
    const el = document.querySelector('.mascot-left img, .mascot-left div > img, .mascot-left [style]');
    const snap = () => {
      const all = [...document.querySelectorAll('.mascot-left *')];
      return all.map(e => ({ tag: e.tagName, cls: e.className || '', bg: (getComputedStyle(e).backgroundPosition || '').slice(0, 30) })).filter(x => x.bg || x.cls.includes('mascot'));
    };
    const s1 = JSON.stringify(snap());
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1100, clientY: 100 }));
    await new Promise(r => setTimeout(r, 300));
    const s2 = JSON.stringify(snap());
    return { changed: s1 !== s2, s1: s1.slice(0, 200), s2: s2.slice(0, 200) };
  })()`);
  console.log("[2] 盯光标(mousemove后变化):", JSON.stringify(look));

  // 3) 点击眨眼：点击 mascot，看反应雪碧图被激活
  const poke = await evalJs(`(async () => {
    const el = document.querySelector('.mascot-left');
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const bgBefore = [...document.querySelectorAll('.mascot-left *')].map(e => getComputedStyle(e).backgroundPosition).join('|');
    el.dispatchEvent(new MouseEvent('mousedown', { clientX: cx, clientY: cy, bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { clientX: cx, clientY: cy, bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { clientX: cx, clientY: cy, bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    const bgAfter = [...document.querySelectorAll('.mascot-left *')].map(e => getComputedStyle(e).backgroundPosition).join('|');
    // 看是否有 transform 或尺寸变化（按压缩扁 = 眨眼反应）
    const t = getComputedStyle(el.querySelector('img, div') || el).transform;
    return { bgChanged: bgBefore !== bgAfter, transform: t, dims: el.querySelector('img') ? [el.querySelector('img').width, el.querySelector('img').height] : null };
  })()`);
  console.log("[3] 点击眨眼:", JSON.stringify(poke));

  // 4) 截图
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const p = path.join(OUT, "page-mascot-demo.png");
  fs.writeFileSync(p, Buffer.from(shot.result.data, "base64"));
  console.log("[4] 截图:", p);

  console.log("[E] console 错误:", errs.length ? errs.slice(0, 5) : "无");
  ws.close(); proc.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
  process.exit(0);
}
main().catch(e => { console.error("ERR", e.message); proc.kill(); process.exit(1); });