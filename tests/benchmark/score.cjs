// 정답과 응답을 비교하는 채점 함수. run.cjs와 단위 테스트가 함께 쓴다.
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
const sourceNumbers = (q) => {
  const set = new Set((q.text.match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => +n.replace(/,/g, "")));
  (q.numbers || []).forEach((n) => set.add(n));
  return set;
};

function scoreQuote(q, pred) {
  const gt = q.items.map((g, i) => ({ ...g, i }));
  const used = new Set(), pairs = [];
  const take = (g, p) => { used.add(p); pairs.push([g, pred[p]]); g.matched = true; };
  // 1차: 금액이 같은 줄, 2차: 이름이 같은 줄, 3차: 금액 없는 같은 분류
  for (const g of gt) if (g.amount != null) { const p = pred.findIndex((x, k) => !used.has(k) && x.amount === g.amount && (x.currency == null || g.cur.includes(x.currency))); if (p >= 0) take(g, p); }
  for (const g of gt.filter((x) => !x.matched)) { const p = pred.findIndex((x, k) => !used.has(k) && norm(x.raw) && (norm(x.raw).includes(norm(g.raw)) || norm(g.raw).includes(norm(x.raw)))); if (p >= 0) take(g, p); }
  for (const g of gt.filter((x) => !x.matched)) { const p = pred.findIndex((x, k) => !used.has(k) && x.amount == null && g.cat.includes(x.category)); if (p >= 0) take(g, p); }
  const nums = sourceNumbers(q);
  const required = gt.filter((g) => !g.optional);
  const real = pairs.filter(([g]) => !g.optional);
  return {
    id: q.id, format: q.format,
    gt: required.length, pred: pred.length,
    tp: real.length, matchedOptional: pairs.length - real.length,
    falsePositive: pred.length - pairs.length,
    amountChecked: real.filter(([g]) => g.amount !== undefined).length,
    amountOk: real.filter(([g, p]) => g.amount !== undefined && (p.amount ?? null) === g.amount).length,
    curChecked: real.filter(([g]) => g.amount != null).length,
    curOk: real.filter(([g, p]) => g.amount != null && g.cur.includes(p.currency ?? null)).length,
    catOk: real.filter(([g, p]) => g.cat.includes(p.category)).length,
    hallucinated: pred.filter((p) => p.amount != null && !nums.has(p.amount)).map((p) => `${p.raw}=${p.amount}`),
    unclear: real.filter(([g]) => g.unclear).length,
    unclearFlagged: real.filter(([g, p]) => g.unclear && p.needsConfirmation).length,
    clear: real.filter(([g]) => !g.unclear && g.amount != null).length,
    clearFlagged: real.filter(([g, p]) => !g.unclear && g.amount != null && p.needsConfirmation).length,
    missed: required.filter((g) => !g.matched).map((g) => g.raw),
    wrong: real.filter(([g, p]) => (g.amount !== undefined && (p.amount ?? null) !== g.amount) || !g.cat.includes(p.category)).map(([g, p]) => `${g.raw}: ${p.category} ${p.amount} ${p.currency}`),
  };
}

function summarize(rows) {
  const s = (k) => rows.reduce((a, r) => a + r[k], 0);
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
  const lat = rows.map((r) => r.ms).filter(Boolean).sort((a, b) => a - b);
  return {
    quotes: rows.length, gtItems: s("gt"), predItems: s("pred"),
    recall: pct(s("tp"), s("gt")), precision: pct(s("tp") + s("matchedOptional"), s("pred")),
    amountExact: pct(s("amountOk"), s("amountChecked")), currency: pct(s("curOk"), s("curChecked")), category: pct(s("catOk"), s("tp")),
    hallucinatedAmounts: rows.reduce((a, r) => a + r.hallucinated.length, 0),
    unclearFlagged: `${s("unclearFlagged")}/${s("unclear")}`, clearFalselyFlagged: `${s("clearFlagged")}/${s("clear")}`,
    latencyMs: lat.length ? { median: lat[Math.floor(lat.length / 2)], p90: lat[Math.ceil(lat.length * 0.9) - 1], max: lat[lat.length - 1] } : null,
  };
}
module.exports = { scoreQuote, summarize, sourceNumbers };
