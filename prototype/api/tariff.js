// 해양수산부_화물운임공표정보(data.go.kr 15029607) 외항화물운임공표 조회.
// 명세: https://apis.data.go.kr/1192000/CychgFrghtOut4/Info4 (XML, annGb=v2는 개정 후 자료)
const { rateLimited, send } = require("./_lib/limit");

const ENDPOINT = "https://apis.data.go.kr/1192000/CychgFrghtOut4/Info4";
const FEES = [["OF", "cychgOf"], ["BAF", "cychgBaf"], ["CAF", "cychgCaf"], ["LSS", "cychgLss"], ["EBS", "cychgEbs"], ["OTHC", "cychgOthc"], ["DTHC", "cychgDthc"], ["DOC", "cychgDf"], ["DO", "cychgDo"], ["WHARFAGE", "cychgWaf"], ["SEAL", "cychgSc"], ["ETC", "cychgEtc"]];
const decode = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]) : ""; };

function parseTariffXml(xml) {
  const authError = tag(xml, "returnAuthMsg") || tag(xml, "errMsg");
  if (/OpenAPI_ServiceResponse/.test(xml) && authError) return { ok: false, reason: "service", code: tag(xml, "returnReasonCode"), message: authError };
  const resultCode = tag(xml, "resultCode");
  if (!resultCode) return { ok: false, reason: "format", message: "응답 형식을 읽지 못했습니다." };
  if (!/^0+$/.test(resultCode)) return { ok: false, reason: "service", code: resultCode, message: tag(xml, "resultMsg") };
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, x]) => ({
    annNo: tag(x, "annNo"), annDe: tag(x, "annDe"), fermnDe: tag(x, "fermnDe"), company: tag(x, "entrpsNm"),
    route: tag(x, "annRuteNm"), pol: tag(x, "shipngPrtNm") || tag(x, "dmstcPrtNm"), pod: tag(x, "landngPrtNm") || tag(x, "forcontrPrtNm"),
    container: [tag(x, "contnStdStndrdNm") || tag(x, "contnStdStndrd"), tag(x, "contnCndNm")].filter(Boolean).join(" "),
    unit: tag(x, "tnspotSeNm"), cargo: tag(x, "frghtNm"), remark: tag(x, "cychgRm"),
    fees: FEES.map(([code, f]) => ({ code, amount: tag(x, f), cur: tag(x, f + "CurCd") }))
      .filter((fee) => fee.amount !== "" && Number.isFinite(+fee.amount) && +fee.amount !== 0).map((fee) => ({ ...fee, amount: +fee.amount })),
  }));
  return { ok: true, totalCount: +tag(xml, "totalCount") || items.length, items };
}

const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");

async function fetchTariff({ pol, pod, key, fetchImpl = fetch, now = new Date() }) {
  if (!key) return { ok: false, reason: "no-key", message: "서버에 인증키가 설정되어 있지 않습니다." };
  const params = new URLSearchParams({ pageNo: "1", numOfRows: "50", annGb: "v2", shipngPrtCd: pol, landngPrtCd: pod,
    annDeFr: ymd(new Date(now - 365 * 864e5)), annDeTo: ymd(now) });
  // 포털 인증키는 이미 인코딩된 값과 원문 값이 있어, 인코딩된 키는 그대로 붙인다.
  key = key.trim();
  const encodedKey = /%[0-9A-Fa-f]{2}/.test(key) ? key : encodeURIComponent(key);
  let response;
  try {
    response = await fetchImpl(`${ENDPOINT}?serviceKey=${encodedKey}&${params}`, { signal: AbortSignal.timeout(9000) });
  } catch (e) {
    return { ok: false, reason: "network", message: "공공데이터포털에 연결하지 못했습니다." };
  }
  const text = await response.text();
  if (!response.ok && !/<\w/.test(text)) return { ok: false, reason: "http", code: String(response.status), message: `HTTP ${response.status}` };
  const parsed = parseTariffXml(text);
  if (parsed.ok) parsed.items.sort((a, b) => (b.annDe || "").localeCompare(a.annDe || ""));
  return parsed;
}

async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { ok: false, message: "GET만 지원합니다." });
  if (rateLimited(req, 30)) return send(res, 429, { ok: false, reason: "rate", message: "요청이 많아 잠시 뒤 다시 시도해 주세요." });
  const url = new URL(req.url, "http://local");
  const pol = url.searchParams.get("pol") || "", pod = url.searchParams.get("pod") || "";
  if (!/^[A-Z]{5}$/.test(pol) || !/^[A-Z]{5}$/.test(pod)) return send(res, 400, { ok: false, reason: "input", message: "항구코드는 영문 대문자 5자리여야 합니다." });
  const result = await fetchTariff({ pol, pod, key: process.env.DATA_GO_KR_SERVICE_KEY });
  if (result.ok) result.items = result.items.slice(0, 20);
  send(res, 200, { ...result, pol, pod, source: "해양수산부_화물운임공표정보(data.go.kr 15029607)", fetchedAt: new Date().toISOString() });
}

module.exports = handler;
module.exports.parseTariffXml = parseTariffXml;
module.exports.fetchTariff = fetchTariff;
