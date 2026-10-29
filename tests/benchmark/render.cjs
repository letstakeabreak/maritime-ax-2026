// 형식이 png, pdf인 합성 견적을 headless Chrome으로 파일로 만든다. 사용: node tests/benchmark/render.cjs
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const quotes = require("./quotes.cjs");

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const out = path.join(__dirname, "files");
fs.mkdirSync(out, { recursive: true });
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
for (const q of quotes.filter((x) => x.format !== "text")) {
  const html = path.join(out, `${q.id}.html`);
  fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff"><pre style="font:15px/1.6 'Apple SD Gothic Neo',sans-serif;padding:32px;white-space:pre-wrap;tab-size:16;color:#111">${esc(q.text)}</pre>`);
  const target = path.join(out, `${q.id}.${q.format}`);
  const args = ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${path.join(out, ".chrome")}`];
  if (q.format === "png") args.push("--window-size=820,620", `--screenshot=${target}`);
  else args.push("--no-pdf-header-footer", `--print-to-pdf=${target}`);
  execFileSync(CHROME, [...args, `file://${html}`], { stdio: "ignore" });
  fs.unlinkSync(html);
  console.log(target, fs.statSync(target).size);
}
fs.rmSync(path.join(out, ".chrome"), { recursive: true, force: true });
