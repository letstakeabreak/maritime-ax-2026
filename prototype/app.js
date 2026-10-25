// 진단 규칙은 결정적 코드다. LLM은 실제 서비스에서 견적서 해석과 설명 문장만 맡는다.
const $ = (s) => document.querySelector(s);
const won = (n) => Math.round(n).toLocaleString("ko-KR") + "원";
const usd = (n) => "$" + Math.round(n).toLocaleString("en-US");

let quote = null;

function position(ratio) {
  if (ratio < 0.9) return { key: "low", text: "시장보다 낮음" };
  if (ratio <= 1.1) return { key: "ok", text: "시장권" };
  if (ratio <= 1.25) return { key: "warn", text: "다소 높음" };
  return { key: "high", text: "높음" };
}

function diagnose(q) {
  const findings = [];
  const toKRW = (it) => (it.cur === "USD" ? it.amount * q.fx : it.amount);
  const codes = q.items.map((i) => i.code);

  // 1. 해상운임 vs KCCI 권역 운임
  const of = q.items.find((i) => i.code === "OF");
  const bench = REF.kcci.routes[q.route];
  let ofResult = null;
  if (of && bench) {
    const ratio = of.amount / bench;
    ofResult = { amount: of.amount, bench, ratio, pos: position(ratio) };
    if (ratio > 1.1)
      findings.push({ level: ratio > 1.25 ? "high" : "warn", title: "해상운임이 KCCI 권역 운임보다 높습니다",
        detail: `${q.route} KCCI ${usd(bench)} 대비 ${Math.round((ratio - 1) * 100)}% 높습니다. KCCI에는 포워더 마진이 없으므로 차이 전체가 과다 청구는 아닙니다.`,
        ask: `해상운임 ${usd(of.amount)}의 선사와 적용 기간을 알려 주시고, ${q.route} 시장 수준(KCCI ${usd(bench)})과의 차이를 설명해 주실 수 있을까요?` });
  }

  // 2. 부대비용 vs 선사 공표 요금 범위
  q.items.forEach((it) => {
    const ref = REF.published[it.code];
    if (!ref) return;
    const v = toKRW(it);
    if (v > ref.max)
      findings.push({ level: "warn", title: `${ref.label}가 공표 요금 범위를 넘습니다`,
        detail: `견적 ${won(v)}, 선사 공표 범위 ${won(ref.min)}~${won(ref.max)}.`,
        ask: `${it.raw} ${won(v)}이 선사 공표 요금(${won(ref.max)} 이하)보다 높은 이유를 알려 주세요.` });
  });

  // 3. 이름만 다른 중복 수수료
  REF.dupGroups.forEach((g) => {
    const hit = q.items.filter((i) => g.codes.includes(i.code));
    if (hit.length > 1)
      findings.push({ level: "warn", title: `${g.name}가 중복된 것으로 보입니다`,
        detail: hit.map((h) => `${h.raw} ${h.cur === "USD" ? usd(h.amount) : won(h.amount)}`).join(", ") + " 항목의 성격이 같습니다.",
        ask: `${hit.map((h) => h.raw).join("와 ")}가 각각 어떤 업무에 대한 비용인지 구분해 주세요.` });
  });

  // 4. 항로와 맞지 않는 사전신고
  Object.entries(REF.filings).forEach(([code, routes]) => {
    if (codes.includes(code) && !routes.includes(q.route))
      findings.push({ level: "high", title: `${code}는 이 항로에 해당하지 않습니다`,
        detail: `${code}는 ${routes.join(", ")} 항로의 사전신고입니다. ${q.route} 항로에는 청구되지 않아야 합니다.`,
        ask: `${q.route} 항로 견적에 ${code} 항목이 포함된 이유를 확인 부탁드립니다.` });
  });

  // 5. 견적에 빠진 조건 (나중에 청구될 수 있음)
  if (!q.freeTime)
    findings.push({ level: "warn", title: "프리타임 조건이 없습니다",
      detail: "Demurrage, Detention(반납 지연료)은 견적에 없다가 나중에 청구되는 대표 항목입니다.",
      ask: "목적지 Demurrage, Detention 프리타임과 초과 시 일 단가를 견적에 명시해 주세요." });
  if (!q.validity)
    findings.push({ level: "info", title: "견적 유효기간이 없습니다", detail: "운임은 주 단위로 바뀝니다.",
      ask: "이 견적의 유효기간을 알려 주세요." });

  const total = q.items.reduce((s, i) => s + toKRW(i), 0);
  return { findings, ofResult, total };
}

function renderItems() {
  $("#items").innerHTML = quote.items.map((it, idx) => `
    <tr>
      <td>${it.raw}</td>
      <td><span class="tag">${CODE_LABEL[it.code] || it.code}</span></td>
      <td class="num"><input type="number" value="${it.amount}" data-idx="${idx}" aria-label="${it.raw} 금액"> ${it.cur}</td>
    </tr>`).join("");
  document.querySelectorAll("#items input").forEach((el) =>
    el.addEventListener("input", (e) => { quote.items[+e.target.dataset.idx].amount = +e.target.value || 0; renderDiagnosis(); }));
}

function renderDiagnosis() {
  const { findings, ofResult, total } = diagnose(quote);
  const g = $("#gauge");
  if (ofResult) {
    const pct = Math.max(0, Math.min(100, ((ofResult.ratio - 0.6) / 0.9) * 100));
    g.innerHTML = `
      <div class="gauge-head"><b>해상운임 시장 대비 위치</b><span class="pill ${ofResult.pos.key}">${ofResult.pos.text}</span></div>
      <div class="bar"><span class="band"></span><span class="marker" style="left:${pct}%"></span></div>
      <div class="bar-legend"><span>낮음</span><span>KCCI ${quote.route} ${usd(ofResult.bench)}</span><span>높음</span></div>
      <p class="muted">견적 ${usd(ofResult.amount)}, KCCI 대비 ${ofResult.ratio >= 1 ? "+" : ""}${Math.round((ofResult.ratio - 1) * 100)}% (기준일 ${REF.kcci.asOf}, ${REF.kcci.unit})</p>`;
  } else g.innerHTML = `<p class="muted">비교할 KCCI 항로가 없습니다.</p>`;

  $("#total").textContent = won(total) + ` (환율 ${quote.fx}원 적용)`;
  $("#findings").innerHTML = findings.length
    ? findings.map((f) => `<li class="f ${f.level}"><b>${f.title}</b><p>${f.detail}</p></li>`).join("")
    : `<li class="f ok"><b>특이사항이 없습니다</b><p>규칙으로 확인한 범위에서는 문제가 보이지 않습니다.</p></li>`;
  const asks = findings.map((f) => f.ask).filter(Boolean);
  $("#memo").value = asks.length
    ? `${quote.forwarder} 담당자님께,\n\n보내 주신 ${quote.pol}→${quote.pod} ${quote.equip} 견적 관련하여 몇 가지 확인 부탁드립니다.\n\n` +
      asks.map((a, i) => `${i + 1}. ${a}`).join("\n") + `\n\n감사합니다.`
    : "확인 요청할 항목이 없습니다.";
  $("#programs").innerHTML = REF.programs.map((p) => `<li><b>${p.name}</b><span>${p.who}</span><p>${p.note}</p></li>`).join("");
  $("#count").textContent = findings.filter((f) => f.level !== "info").length;
}

function load(key) {
  quote = structuredClone(SAMPLES[key]);
  document.querySelectorAll(".sample").forEach((b) => b.setAttribute("aria-pressed", b.dataset.key === key));
  $("#meta").innerHTML = [
    ["포워더", quote.forwarder], ["구간", `${quote.pol} → ${quote.pod}`], ["KCCI 항로", quote.route],
    ["장비", quote.equip], ["인코텀즈", quote.incoterms], ["유효기간", quote.validity || "없음"], ["프리타임", quote.freeTime || "없음"],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  renderItems();
  renderDiagnosis();
}

document.querySelectorAll(".sample").forEach((b) => b.addEventListener("click", () => load(b.dataset.key)));
$("#copy").addEventListener("click", () => { navigator.clipboard?.writeText($("#memo").value); $("#copy").textContent = "복사됨"; setTimeout(() => ($("#copy").textContent = "복사"), 1200); });
load(new URLSearchParams(location.search).get("q") || "normal");
