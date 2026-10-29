// 견적 원문(붙여넣은 글, 이미지, PDF)에서 비용 항목만 구조화해 돌려준다.
// 합계와 비교는 계산하지 않는다. 계산은 브라우저의 기존 규칙(app.js)이 맡는다.
const { rateLimited, send } = require("./_lib/limit");

const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
const MAX_TEXT = 20000;
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const FILE_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const CODES = ["OF", "BAF", "CAF", "LSS", "EBS", "THC", "DOC", "BLFEE", "WHARFAGE", "SEAL", "AMS", "ENS", "HANDLING", "SERVICE", "CUSTOMS", "TRUCK", "OTHER"];
const str = { type: ["string", "null"] };

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["meta", "items", "unreadable"],
  properties: {
    meta: {
      type: "object", additionalProperties: false,
      required: ["forwarder", "pol", "pod", "equipment", "quantity", "incoterms", "validity", "freeTime", "fxKrwPerUsd"],
      properties: { forwarder: str, pol: str, pod: str, equipment: str, quantity: { type: ["number", "null"] }, incoterms: str, validity: str, freeTime: str, fxKrwPerUsd: { type: ["number", "null"] } },
    },
    items: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["raw", "category", "amount", "currency", "unit", "includedInOceanFreight", "condition", "unreadable", "needsConfirmation", "reason"],
        properties: {
          raw: { type: "string" }, category: { type: "string", enum: CODES }, amount: { type: ["number", "null"] },
          currency: str, unit: str, includedInOceanFreight: { type: ["boolean", "null"] }, condition: str,
          unreadable: { type: "array", items: { type: "string" } }, needsConfirmation: { type: "boolean" }, reason: str,
        },
      },
    },
    unreadable: { type: "array", items: { type: "string" } },
  },
};

const INSTRUCTIONS = `You read Korean/English ocean freight quotes for small exporters and return ONLY what is written.
Rules:
- One entry per charge line. "raw" is the charge name exactly as written (original language and spelling), without the amount or currency.
- category: map to the closest code. OF=ocean freight, BAF/CAF/LSS/EBS=freight surcharges, THC=terminal handling, DOC=documentation fee, BLFEE=B/L issuance fee, WHARFAGE, SEAL, AMS/ENS=advance filing, HANDLING=forwarder handling, SERVICE=service charge, CUSTOMS=customs clearance, TRUCK=inland trucking. Use OTHER when unsure.
- amount/currency/unit: copy as written. currency as ISO code (USD, KRW, EUR...). Never invent, estimate, convert or sum. If a value is missing or illegible use null, list the field name in "unreadable", set needsConfirmation=true and give a short Korean reason.
- includedInOceanFreight: true only if the quote says the charge is included in O/F (e.g. "incl.", "포함"), false only if it says separate/excluded, otherwise null.
- condition: any written condition (per container, per B/L, subject to, at cost, 실비) or null.
- needsConfirmation=true whenever the line is ambiguous (unclear unit, "at cost", range, "TBA", unclear currency, unclear category).
- meta: copy forwarder, ports, equipment (e.g. 40HC), quantity, incoterms, validity date, free time, exchange rate KRW per USD only if written. Otherwise null and list the field in top-level "unreadable".
- Do not calculate totals. Do not judge whether prices are fair.`;

function validateInput(body) {
  if (!body || typeof body !== "object") return "요청 형식이 올바르지 않습니다.";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length > MAX_TEXT) return `붙여넣은 글은 ${MAX_TEXT.toLocaleString("en-US")}자 이하로 줄여 주세요.`;
  if (body.file) {
    const { name, type, data } = body.file;
    if (!FILE_TYPES.includes(type)) return "PNG, JPG, WEBP 이미지나 PDF 파일만 올릴 수 있습니다.";
    if (typeof data !== "string" || !/^[A-Za-z0-9+/=]+$/.test(data)) return "파일을 읽지 못했습니다.";
    if (Math.floor(data.length * 3 / 4) > MAX_FILE_BYTES) return "파일은 3MB 이하만 올릴 수 있습니다.";
    if (name != null && (typeof name !== "string" || name.length > 200)) return "파일 이름이 너무 깁니다.";
  } else if (!text) return "견적 내용을 붙여넣거나 파일을 올려 주세요.";
  return null;
}

function buildRequest(body) {
  const content = [];
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text) content.push({ type: "input_text", text: `견적 원문:\n${text}` });
  if (body.file) {
    const url = `data:${body.file.type};base64,${body.file.data}`;
    content.push(body.file.type === "application/pdf"
      ? { type: "input_file", filename: body.file.name || "quote.pdf", file_data: url }
      : { type: "input_image", image_url: url, detail: "high" });
    if (!text) content.push({ type: "input_text", text: "첨부한 견적 문서의 비용 항목을 읽어 주세요." });
  }
  return {
    model: MODEL, instructions: INSTRUCTIONS, input: [{ role: "user", content }],
    text: { format: { type: "json_schema", name: "freight_quote", strict: true, schema: SCHEMA } },
    max_output_tokens: 8000, store: false,
  };
}

// Responses API의 원시 응답에서 출력 글을 꺼내 형식을 다시 확인한다.
function parseOpenAIResponse(json) {
  if (json && json.status === "incomplete") return { ok: false, message: "문서가 길어 끝까지 읽지 못했습니다. 일부만 붙여넣어 주세요." };
  const parts = ((json && json.output) || []).flatMap((o) => o.content || []);
  const refusal = parts.find((c) => c.type === "refusal");
  if (refusal) return { ok: false, message: "AI가 이 문서를 처리하지 않았습니다." };
  const out = parts.find((c) => c.type === "output_text");
  if (!out) return { ok: false, message: "AI 응답에서 결과를 찾지 못했습니다." };
  let data;
  try { data = JSON.parse(out.text); } catch { return { ok: false, message: "AI 응답을 읽지 못했습니다." }; }
  if (!data || !Array.isArray(data.items) || !data.meta) return { ok: false, message: "AI 응답 형식이 맞지 않습니다." };
  data.items = data.items.filter((it) => it && typeof it.raw === "string").map((it) => ({
    ...it,
    category: CODES.includes(it.category) ? it.category : "OTHER",
    amount: typeof it.amount === "number" && Number.isFinite(it.amount) && it.amount >= 0 ? it.amount : null,
    currency: typeof it.currency === "string" ? it.currency.toUpperCase().slice(0, 3) : null,
    unreadable: Array.isArray(it.unreadable) ? it.unreadable : [],
    needsConfirmation: Boolean(it.needsConfirmation) || it.amount == null || !it.currency,
  }));
  data.unreadable = Array.isArray(data.unreadable) ? data.unreadable : [];
  return { ok: true, data };
}

async function extract(body, { key, fetchImpl = fetch } = {}) {
  if (!key) return { status: 503, body: { ok: false, reason: "no-key", message: "서버에 AI 키가 설정되어 있지 않습니다." } };
  let response;
  try {
    response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(buildRequest(body)), signal: AbortSignal.timeout(55000),
    });
  } catch {
    return { status: 502, body: { ok: false, reason: "network", message: "AI 서비스에 연결하지 못했습니다." } };
  }
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const code = json && json.error && (json.error.code || json.error.type);
    return { status: 502, body: { ok: false, reason: "upstream", code: code || String(response.status), message: `AI 서비스가 요청을 처리하지 못했습니다(${code || response.status}).` } };
  }
  const parsed = parseOpenAIResponse(json);
  if (!parsed.ok) return { status: 502, body: { ok: false, reason: "parse", message: parsed.message } };
  return { status: 200, body: { ok: true, model: json.model || MODEL, ...parsed.data } };
}

async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, message: "POST만 지원합니다." });
  if (+(req.headers["content-length"] || 0) > 4.4 * 1024 * 1024) return send(res, 413, { ok: false, message: "요청이 너무 큽니다." });
  if (rateLimited(req, 5)) return send(res, 429, { ok: false, reason: "rate", message: "1분에 5번까지 읽을 수 있습니다. 잠시 뒤 다시 시도해 주세요." });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const error = validateInput(body);
  if (error) return send(res, 400, { ok: false, reason: "input", message: error });
  const result = await extract(body, { key: process.env.OPENAI_API_KEY });
  send(res, result.status, result.body);
}

module.exports = handler;
module.exports.config = { maxDuration: 60 };
Object.assign(module.exports, { validateInput, buildRequest, parseOpenAIResponse, extract, SCHEMA });
