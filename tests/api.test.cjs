const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const api = path.join(__dirname, "..", "prototype", "api");
const tariff = require(path.join(api, "tariff.js"));
const extract = require(path.join(api, "extract.js"));
const { rateLimited } = require(path.join(api, "_lib", "limit.js"));

const xmlOk = `<?xml version="1.0" encoding="UTF-8"?><response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header><body><items>
<item><annNo>2026100001</annNo><annDe>20261001</annDe><fermnDe>20261015</fermnDe><entrpsNm>가상선사 &amp; 해운</entrpsNm><shipngPrtNm>부산</shipngPrtNm><landngPrtNm>LOS ANGELES</landngPrtNm><contnStdStndrdNm>40피트</contnStdStndrdNm><contnCndNm>DRY</contnCndNm><cychgOfCurCd>USD</cychgOfCurCd><cychgOf>3000</cychgOf><cychgBafCurCd>USD</cychgBafCurCd><cychgBaf>0</cychgBaf><cychgOthcCurCd>KRW</cychgOthcCurCd><cychgOthc>210000</cychgOthc><cychgDf></cychgDf></item>
<item><annNo>2026090001</annNo><annDe>20260901</annDe><entrpsNm>이전선사</entrpsNm><cychgOfCurCd>USD</cychgOfCurCd><cychgOf>2800</cychgOf></item>
</items><numOfRows>50</numOfRows><pageNo>1</pageNo><totalCount>2</totalCount></body></response>`;
const xmlKeyError = `<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>`;
const fakeFetch = (status, body, calls = []) => async (url, init) => { calls.push({ url, init }); return { ok: status < 400, status, text: async () => body, json: async () => JSON.parse(body) }; };

test("tariff XML items, fees and currencies are parsed without zero or empty fees", () => {
  const r = tariff.parseTariffXml(xmlOk);
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].company, "가상선사 & 해운");
  assert.equal(r.items[0].container, "40피트 DRY");
  assert.deepEqual(r.items[0].fees, [{ code: "OF", amount: 3000, cur: "USD" }, { code: "OTHC", amount: 210000, cur: "KRW" }]);
});

test("an unregistered data.go.kr key is reported as a service failure", async () => {
  const r = await tariff.fetchTariff({ pol: "KRPUS", pod: "USLAX", key: "k", fetchImpl: fakeFetch(200, xmlKeyError) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "service");
  assert.equal(r.code, "30");
  assert.match(r.message, /NOT_REGISTERED/);
});

test("tariff request uses the v2 endpoint, route codes and sorts newest first", async () => {
  const calls = [];
  const r = await tariff.fetchTariff({ pol: "KRPUS", pod: "USLAX", key: "a+b/c==", fetchImpl: fakeFetch(200, xmlOk, calls), now: new Date("2026-10-30T00:00:00Z") });
  assert.equal(r.ok, true);
  assert.equal(r.items[0].annNo, "2026100001");
  const url = calls[0].url;
  assert.match(url, /^https:\/\/apis\.data\.go\.kr\/1192000\/CychgFrghtOut4\/Info4\?serviceKey=a%2Bb%2Fc%3D%3D&/);
  assert.match(url, /annGb=v2/);
  assert.match(url, /shipngPrtCd=KRPUS&landngPrtCd=USLAX/);
  assert.match(url, /annDeTo=20261030/);
});

test("tariff network failure and missing key fall back without throwing", async () => {
  const down = await tariff.fetchTariff({ pol: "KRPUS", pod: "USLAX", key: "k", fetchImpl: async () => { throw new Error("down"); } });
  assert.deepEqual([down.ok, down.reason], [false, "network"]);
  const none = await tariff.fetchTariff({ pol: "KRPUS", pod: "USLAX", key: "" });
  assert.deepEqual([none.ok, none.reason], [false, "no-key"]);
});

test("extract input limits reject empty, oversized and unsupported input", () => {
  assert.match(extract.validateInput({ text: "" }), /붙여넣거나/);
  assert.match(extract.validateInput({ text: "x".repeat(20001) }), /20,000자/);
  assert.match(extract.validateInput({ file: { type: "text/html", data: "AAAA" } }), /PDF/);
  assert.match(extract.validateInput({ file: { type: "image/png", data: "A".repeat(4.2 * 1024 * 1024) } }), /3MB/);
  assert.equal(extract.validateInput({ text: "Ocean Freight USD 3000" }), null);
});

test("extract request asks for strict JSON schema and attaches PDF or image", () => {
  const pdf = extract.buildRequest({ text: "", file: { name: "q.pdf", type: "application/pdf", data: "QUJD" } });
  assert.equal(pdf.text.format.type, "json_schema");
  assert.equal(pdf.text.format.strict, true);
  assert.equal(pdf.input[0].content[0].type, "input_file");
  assert.match(pdf.input[0].content[0].file_data, /^data:application\/pdf;base64,QUJD$/);
  const img = extract.buildRequest({ text: "memo", file: { type: "image/png", data: "QUJD" } });
  assert.deepEqual(img.input[0].content.map((c) => c.type), ["input_text", "input_image"]);
});

const aiResult = {
  meta: { forwarder: "테스트포워딩", pol: "Busan", pod: "Los Angeles", equipment: "40HC", quantity: 1, incoterms: "FOB", validity: "2026-11-15", freeTime: null, fxKrwPerUsd: null },
  items: [
    { raw: "O/F", category: "OF", amount: 3200, currency: "USD", unit: "per 40HC", includedInOceanFreight: null, condition: null, unreadable: [], needsConfirmation: false, reason: null },
    { raw: "THC", category: "THC", amount: 210000, currency: "KRW", unit: null, includedInOceanFreight: null, condition: null, unreadable: [], needsConfirmation: false, reason: null },
    { raw: "Doc fee", category: "DOC", amount: null, currency: "KRW", unit: null, includedInOceanFreight: null, condition: "at cost", unreadable: ["amount"], needsConfirmation: true, reason: "실비 청구" },
    { raw: "CIC", category: "OTHER", amount: 50, currency: "EUR", unit: null, includedInOceanFreight: null, condition: null, unreadable: [], needsConfirmation: false, reason: null },
  ],
  unreadable: ["freeTime"],
};

test("OpenAI response text is parsed and missing amounts stay null and flagged", async () => {
  const body = JSON.stringify({ status: "completed", model: "m", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(aiResult) }] }] });
  const calls = [];
  const r = await extract.extract({ text: "quote" }, { key: "sk-test", fetchImpl: fakeFetch(200, body, calls) });
  assert.equal(r.status, 200);
  assert.equal(r.body.items[2].amount, null);
  assert.equal(r.body.items[2].needsConfirmation, true);
  assert.equal(calls[0].init.headers.Authorization, "Bearer sk-test");
  assert.equal("sk-test" in r.body || JSON.stringify(r.body).includes("sk-test"), false);
});

test("OpenAI errors, refusals and truncated output return honest failures", async () => {
  const err = await extract.extract({ text: "q" }, { key: "k", fetchImpl: fakeFetch(401, JSON.stringify({ error: { code: "invalid_api_key" } })) });
  assert.deepEqual([err.status, err.body.ok, err.body.code], [502, false, "invalid_api_key"]);
  assert.equal(extract.parseOpenAIResponse({ output: [{ content: [{ type: "refusal", refusal: "no" }] }] }).ok, false);
  assert.equal(extract.parseOpenAIResponse({ status: "incomplete", output: [] }).ok, false);
  const none = await extract.extract({ text: "q" }, { key: "" });
  assert.deepEqual([none.status, none.body.reason], [503, "no-key"]);
});

test("rate limit blocks requests beyond the per-minute limit", () => {
  const req = { headers: { "x-forwarded-for": "203.0.113.9" } };
  const results = Array.from({ length: 6 }, () => rateLimited(req, 5, 60000, 1000));
  assert.deepEqual(results, [false, false, false, false, false, true]);
  assert.equal(rateLimited(req, 5, 60000, 70000), false);
});

function loadApp() {
  const els = new Map();
  const el = () => ({ innerHTML: "", textContent: "", value: "", dataset: {}, hidden: false, addEventListener() {}, closest() { return { classList: { toggle() {} } }; } });
  const context = vm.createContext({
    document: { querySelector(s) { if (!els.has(s)) els.set(s, el()); return els.get(s); }, querySelectorAll() { return []; } },
    location: { search: "" }, navigator: {}, structuredClone, URLSearchParams, setTimeout,
  });
  context.window = context;
  for (const f of ["data.js", "app.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "prototype", f), "utf8"), context);
  return { context, els };
}

test("AI result feeds the existing calculation without inventing missing values", () => {
  const { context, els } = loadApp();
  context.extracted = aiResult;
  vm.runInContext("show(fromExtraction(extracted))", context);
  const { quote, result } = vm.runInContext("({ quote, result })", context);
  assert.equal(quote.route, "북미 서안");
  assert.equal(quote.items[2].amount, 0);
  assert.equal(quote.items[3].amount, 0);
  assert.equal(quote.items[3].confirm, true);
  assert.equal(result.total, 3200 * 1380 + 210000);
  assert.equal(result.ofr.bench, 8267);
  assert.ok(quote.review.some((r) => /환율이 적혀 있지 않아/.test(r)));
  assert.ok(quote.review.some((r) => /Doc fee/.test(r)));
  assert.ok(quote.review.some((r) => /freeTime/.test(r)));
  assert.equal(els.get("#ai-note").hidden, false);
  assert.match(els.get("#demo-note").textContent, /AI가 읽은 견적/);
});

test("unknown destination skips KCCI comparison and says so", () => {
  const { context, els } = loadApp();
  context.extracted = { ...aiResult, meta: { ...aiResult.meta, pod: "Lagos" } };
  vm.runInContext("show(fromExtraction(extracted))", context);
  assert.equal(vm.runInContext("result.ofr", context), null);
  assert.match(els.get("#gauge").innerHTML, /항로를/);
  assert.match(els.get("#tariff").innerHTML, /항구코드를 찾지 못해/);
});

test("tariff panel states failure honestly and keeps example values", () => {
  const { context } = loadApp();
  const q = { pol: "부산", pod: "로스앤젤레스" };
  context.q = q;
  context.t = { ok: false, code: "30", message: "SERVICE_KEY_IS_NOT_REGISTERED_ERROR" };
  const failed = vm.runInContext("tariffHTML(t, q)", context);
  assert.match(failed, /불러오지 못했어요/);
  assert.match(failed, /코드 30/);
  assert.match(failed, /예시값/);
  context.t = { ok: true, pol: "KRPUS", pod: "USLAX", totalCount: 1, items: [{ company: "<b>x</b>", annDe: "20261001", container: "40", fees: [{ code: "OF", amount: 3000, cur: "USD" }] }] };
  const shown = vm.runInContext("tariffHTML(t, q)", context);
  assert.match(shown, /OF 3,000 USD/);
  assert.doesNotMatch(shown, /<b>x<\/b>/);
  assert.equal(vm.runInContext("portOf('Los Angeles, CA').code", context), "USLAX");
  assert.equal(vm.runInContext("portOf('부산 신항').code", context), "KRPUS");
});

test("tariff widens an empty 90-day window and merges the first and last pages so the newest rows come first", async () => {
  const row = (no, de) => `<item><annNo>${no}</annNo><annDe>${de}</annDe><cychgOfCurCd>USD</cychgOfCurCd><cychgOf>1000</cychgOf></item>`;
  const xml = (items, total) => `<response><header><resultCode>00</resultCode></header><body><items>${items}</items><totalCount>${total}</totalCount></body></response>`;
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const u = new URL(url);
    const days = (Date.parse("2026-10-30") - Date.parse(u.searchParams.get("annDeFr").replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"))) / 864e5;
    if (days === 90) return { ok: true, status: 200, text: async () => xml("", 0) };
    // 오래된 순으로 오는 응답: 첫 쪽은 오래된 행, 마지막 쪽에 최신 행
    const items = u.searchParams.get("pageNo") === "1" ? row("old", "20260501") : row("new", "20260920");
    return { ok: true, status: 200, text: async () => xml(items, 120) };
  };
  const r = await tariff.fetchTariff({ pol: "KRPUS", pod: "USLAX", key: "k", fetchImpl, now: new Date("2026-10-30T00:00:00Z") });
  assert.equal(r.ok, true);
  assert.equal(r.windowDays, 180);
  assert.deepEqual(r.items.map((i) => i.annNo), ["new", "old"]);
  assert.equal(calls.length, 3);
  assert.match(calls[2], /pageNo=3/);
});
