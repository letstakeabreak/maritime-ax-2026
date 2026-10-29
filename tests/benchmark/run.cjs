// 운영 /api/extract에 합성 견적을 보내 정확도를 잰다. 호출 제한(1분 5회) 때문에 13초 간격으로 보낸다.
// 사용: node tests/benchmark/run.cjs [기준 URL]  결과: tests/benchmark/results.json
const fs = require("node:fs");
const path = require("node:path");
const quotes = require("./quotes.cjs");
const { scoreQuote, summarize } = require("./score.cjs");

const BASE = process.argv[2] || "https://unim-lens.vercel.app";
const MIME = { png: "image/png", pdf: "application/pdf" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // IDS=Q17,Q18 처럼 주면 해당 견적만 다시 보내고 기존 results.json의 같은 행을 바꾼다.
  const only = process.env.IDS ? process.env.IDS.split(",") : null;
  const prev = only ? JSON.parse(fs.readFileSync(path.join(__dirname, "results.json"), "utf8")).rows : [];
  const rows = [];
  for (const [n, q] of quotes.filter((x) => !only || only.includes(x.id)).entries()) {
    if (n) await sleep(13000);
    const body = q.format === "text" ? { text: q.text }
      : { file: { name: `${q.id}.${q.format}`, type: MIME[q.format], data: fs.readFileSync(path.join(__dirname, "files", `${q.id}.${q.format}`)).toString("base64") } };
    const t = Date.now();
    const res = await fetch(`${BASE}/api/extract`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const ms = Date.now() - t;
    const json = await res.json().catch(() => ({}));
    if (!json.ok) { console.log(q.id, "FAIL", res.status, json.message); rows.push({ id: q.id, format: q.format, error: json.message || res.status, ms }); continue; }
    const row = { ...scoreQuote(q, json.items), ms, model: json.model, response: json.items };
    rows.push(row);
    console.log(q.id, q.format, `tp ${row.tp}/${row.gt}`, `fp ${row.falsePositive}`, `${ms}ms`, row.hallucinated.length ? `HALLU ${row.hallucinated}` : "", row.missed.length ? `missed ${row.missed}` : "", row.wrong.length ? `wrong ${row.wrong.join("; ")}` : "");
  }
  if (only) { for (const r of rows) prev[prev.findIndex((x) => x.id === r.id)] = r; rows.splice(0, rows.length, ...prev); }
  const ok = rows.filter((r) => !r.error);
  const result = { runAt: new Date().toISOString(), endpoint: `${BASE}/api/extract`, model: ok[0] && ok[0].model, failures: rows.length - ok.length,
    all: summarize(ok), text: summarize(ok.filter((r) => r.format === "text")), png: summarize(ok.filter((r) => r.format === "png")), pdf: summarize(ok.filter((r) => r.format === "pdf")), rows };
  fs.writeFileSync(path.join(__dirname, "results.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ all: result.all, text: result.text, png: result.png, pdf: result.pdf, failures: result.failures }, null, 1));
})();
