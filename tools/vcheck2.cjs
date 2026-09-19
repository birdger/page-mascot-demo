// page-mascot demo 验证 v2：模拟 fine pointer + 真实输入事件测 盯光标/点击
"use strict";
const { spawn } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");
const PORT = 9339;
const OUT = process.argv[2] || "shots";
const browser = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pm-check2-"));
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
      errs.push("EXC: " + (d.exception ? (d.exception.description || d.exception.value) : d.text).slice(0, 200));
    }
    else if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
      errs.push(m.params.entry.text.slice(0, 160) + " | " + (m.params.entry.url || "").slice(-60));
    }
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
  // 模拟 fine pointer（鼠标）
  await send("Emulation.setEmulatedMedia", { features: [{ name: "pointer", value: "fine" }, { name: "hover", value: "hover" }] });
  await send("Page.navigate", { url: "http://127.0.0.1:5201/" });
  await sleep(5000);

  const snap = `(() => {
    const btns = [...document.querySelectorAll('.mascot-left button, .mascot-right button')];
    return btns.map(b => [...b.querySelectorAll('span')].map(s => getComputedStyle(s).backgroundPosition).join('|'));
  })()`;

  const s0 = await evalJs(snap);
  // 鼠标移到右上角（狐狸应该朝右上看）
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1150, y: 120 });
  await sleep(400);
  const s1 = await evalJs(snap);
  // 鼠标移到左下角
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 80, y: 700 });
  await sleep(400);
  const s2 = await evalJs(snap);

  // 点击左侧 mascot 中心（戳一下 → 眨眼/按扁）
  const rect = await evalJs(`(() => { const r = document.querySelector('.mascot-left button').getBoundingClientRect(); return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; })()`);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await sleep(350);
  const s3 = await evalJs(snap);

  // 截图
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const p = path.join(OUT, "page-mascot-demo.png");
  fs.writeFileSync(p, Buffer.from(shot.result.data, "base64"));

  console.log("盯光标——初始:", s0);
  console.log("盯光标——右上:", s1, s1 !== s0 ? "✓变化" : "✗无变化");
  console.log("盯光标——左下:", s2, s2 !== s1 ? "✓变化" : "✗无变化");
  console.log("点击眨眼——点击后:", s3, s3 !== s2 ? "✓变化" : "✗无变化");
  console.log("截图:", p);
  console.log("[E] 错误:", errs.length ? errs.slice(0, 6) : "无");
  ws.close(); proc.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (_) {}
  process.exit(0);
}
main().catch(e => { console.error("ERR", e.message); proc.kill(); process.exit(1); });