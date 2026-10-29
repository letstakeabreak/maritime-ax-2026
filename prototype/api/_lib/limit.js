// 인스턴스 메모리 기준의 간단한 IP별 호출 제한. 분산 환경 전체의 정확한 제한은 아니다.
const hits = new Map();
function rateLimited(req, max, windowMs = 60_000, now = Date.now()) {
  const ip = String((req.headers && (req.headers["x-forwarded-for"] || req.headers["x-real-ip"])) || "local").split(",")[0].trim();
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
module.exports = { rateLimited, send, _hits: hits };
