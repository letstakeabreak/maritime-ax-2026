// 진단 규칙은 결정적 코드다. 실제 서비스에서 LLM은 견적서 해석, 항목 분류, 설명 문장만 맡는다.
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const won = (n) => Math.round(n).toLocaleString("ko-KR") + "원";
const usd = (n) => "$" + Math.round(n).toLocaleString("en-US");
const fmt = (it) => (it.cur === "USD" ? usd(it.amount) : won(it.amount));

const KIND = { OF: "운임", LSS: "운임", THC: "부대", DOC: "부대", BLFEE: "부대", WHARFAGE: "부대", SEAL: "부대",
  AMS: "수수료", ENS: "수수료", HANDLING: "수수료", SERVICE: "수수료", CUSTOMS: "수수료", TRUCK: "육상" };
// 사전 생성한 AI 분류 신뢰도 예시. 약어나 모호한 이름일수록 낮다.
const CONF = { "WFG": 0.81, "Service Charge": 0.74, "O/F": 0.93, "B/L Issuance Fee": 0.88 };

let quote = null, result = null;

function position(r) {
  if (r < 0.9) return { k: "low", t: "시장보다 낮음" };
  if (r <= 1.1) return { k: "ok", t: "시장권" };
  if (r <= 1.25) return { k: "warn", t: "다소 높음" };
  return { k: "bad", t: "높음" };
}

function diagnose(q) {
  const F = [];
  const toKRW = (it) => (it.cur === "USD" ? it.amount * q.fx : it.amount);
  const codes = q.items.map((i) => i.code);

  const of = q.items.find((i) => i.code === "OF");
  const bench = REF.kcci.routes[q.route];
  let ofr = null;
  if (of && bench) {
    const r = of.amount / bench;
    ofr = { amount: of.amount, bench, r, pos: position(r) };
    if (r > 1.1) F.push({ lv: r > 1.25 ? "bad" : "warn", title: "해상운임이 KCCI 권역 운임보다 높습니다",
      detail: `${q.route} KCCI ${usd(bench)} 대비 ${Math.round((r - 1) * 100)}% 높습니다.`,
      basis: [["견적", `${of.raw} ${usd(of.amount)}`], ["기준", `KCCI ${q.route} ${usd(bench)} (${REF.kcci.asOf}, ${REF.kcci.unit})`],
        ["판정", "KCCI 대비 +10% 초과는 다소 높음, +25% 초과는 높음 (설정값)"], ["주의", "KCCI에는 포워더 마진이 없으므로 차이 전체가 과다 청구를 뜻하지는 않습니다."]],
      ask: `해상운임 ${usd(of.amount)}의 선사와 적용 기간을 알려 주시고, ${q.route} 시장 수준(KCCI ${usd(bench)})과의 차이를 설명해 주실 수 있을까요?` });
  }

  q.items.forEach((it) => {
    const ref = REF.published[it.code];
    if (!ref) return;
    const mid = (ref.min + ref.max) / 2, v = toKRW(it);
    if (v > mid * 1.1) F.push({ lv: "warn", title: `${ref.label}가 선사 공표 요금보다 높습니다`,
      detail: `견적 ${won(v)}, 공표 기준 ${won(mid)}의 +${Math.round((v / mid - 1) * 100)}%.`,
      basis: [["견적", `${it.raw} ${won(v)}`], ["기준", `선사 공표 요금 ${won(ref.min)}~${won(ref.max)}, 평균 ${won(mid)} (예시값)`],
        ["판정", "공표 평균 대비 +10% 초과 (운임공표제의 허용 편차를 참고한 설정값)"]],
      ask: `${it.raw} ${won(v)}이 선사 공표 요금(평균 ${won(mid)})보다 높은 이유를 알려 주세요.` });
  });

  REF.dupGroups.forEach((g) => {
    const hit = q.items.filter((i) => g.codes.includes(i.code));
    if (hit.length > 1) F.push({ lv: "warn", title: `${g.name}가 중복된 것으로 보입니다`,
      detail: hit.map((h) => `${h.raw} ${fmt(h)}`).join(", "),
      basis: [...hit.map((h) => ["견적", `${h.raw} ${fmt(h)}`]), ["판정", "같은 성격으로 분류된 항목이 두 개 이상 (규칙)"]],
      ask: `${hit.map((h) => h.raw).join("와 ")}가 각각 어떤 업무에 대한 비용인지 구분해 주세요.` });
  });

  Object.entries(REF.filings).forEach(([code, routes]) => {
    if (codes.includes(code) && !routes.includes(q.route)) F.push({ lv: "bad", title: `${code}는 이 항로에 해당하지 않습니다`,
      detail: `${code}는 ${routes.join(", ")} 항로의 사전신고입니다.`,
      basis: [["견적", `${q.route} 항로에 ${code} 포함`], ["기준", `${code} 적용 항로: ${routes.join(", ")}`], ["판정", "항로와 신고 종류 불일치 (규칙)"]],
      ask: `${q.route} 항로 견적에 ${code} 항목이 포함된 이유를 확인 부탁드립니다.` });
  });

  if (!q.freeTime) F.push({ lv: "warn", title: "프리타임 조건이 없습니다", detail: "Demurrage, Detention은 견적에 없다가 나중에 청구되는 대표 항목입니다.",
    basis: [["견적", "프리타임 기재 없음"], ["판정", "필수 조건 체크리스트 (규칙)"]],
    ask: "목적지 Demurrage, Detention 프리타임과 초과 시 일 단가를 견적에 명시해 주세요." });
  if (!q.validity) F.push({ lv: "info", title: "견적 유효기간이 없습니다", detail: "운임은 주 단위로 바뀝니다.",
    basis: [["견적", "유효기간 기재 없음"], ["판정", "필수 조건 체크리스트 (규칙)"]], ask: "이 견적의 유효기간을 알려 주세요." });

  return { F, ofr, total: q.items.reduce((s, i) => s + toKRW(i), 0) };
}

function renderItems() {
  $("#meta").innerHTML = [["포워더", quote.forwarder], ["구간", `${quote.pol} → ${quote.pod}`], ["KCCI 항로", quote.route],
    ["장비", quote.equip], ["인코텀즈", quote.incoterms], ["유효기간", quote.validity || "없음"], ["프리타임", quote.freeTime || "없음"]]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
  $("#items").innerHTML = quote.items.map((it, i) => {
    const c = CONF[it.raw] ?? 0.97, k = KIND[it.code] || "수수료";
    return `<li class="row" style="animation-delay:${i * 30}ms">
      <span class="kind" data-k="${k}">${k}</span>
      <span class="row-text"><span class="row-title">${it.raw}</span>
        <span class="row-sub ${c < 0.85 ? "low" : ""}">${CODE_LABEL[it.code] || it.code}, 분류 신뢰도 ${Math.round(c * 100)}%${c < 0.85 ? ", 확인 필요" : ""}</span></span>
      <span class="amt"><input type="number" value="${it.amount}" data-i="${i}" aria-label="${it.raw} 금액">${it.cur}</span></li>`;
  }).join("");
  $$("#items input").forEach((el) => el.addEventListener("input", (e) => { quote.items[+e.target.dataset.i].amount = +e.target.value || 0; renderResult(); }));
}

function renderResult() {
  result = diagnose(quote);
  const { F, ofr, total } = result;
  $("#total").textContent = `${won(total)} (환율 ${quote.fx}원 적용)`;
  $("#count").textContent = F.filter((f) => f.lv !== "info").length;
  $("#gauge").innerHTML = ofr ? `<div class="card-title" style="font-size:15px;margin:0">해상운임 시장 대비 위치 <span class="pill ${ofr.pos.k}">${ofr.pos.t}</span></div>
    <div class="bar"><span class="marker" style="left:${Math.max(0, Math.min(100, ((ofr.r - 0.6) / 0.9) * 100))}%"></span></div>
    <div class="bar-legend"><span>낮음</span><span>KCCI ${quote.route} ${usd(ofr.bench)}</span><span>높음</span></div>
    <p class="note">견적 ${usd(ofr.amount)}, KCCI 대비 ${ofr.r >= 1 ? "+" : ""}${Math.round((ofr.r - 1) * 100)}%. 기준일 ${REF.kcci.asOf}, ${REF.kcci.unit}. KCCI에는 포워더 마진과 부대비용이 없으므로 차이가 곧 부당 청구를 뜻하지는 않습니다.</p>`
    : `<p class="note">비교할 KCCI 항로가 없습니다.</p>`;
  $("#findings").innerHTML = F.length ? F.map((f, i) => `<li data-i="${i}" tabindex="0" aria-expanded="false"><span class="dot ${f.lv}"></span><span><b>${f.title}</b><p>${f.detail}</p></span></li>`).join("")
    : `<li><span class="dot ok"></span><span><b>규칙으로 확인한 범위에서 문제가 없습니다</b></span></li>`;
  $$("#findings li[data-i]").forEach((li) => { li.onclick = li.onkeydown = (e) => { if (e.type === "click" || e.key === "Enter") toggle(li); }; });
  const asks = F.map((f) => f.ask);
  $("#memo").value = asks.length ? `${quote.forwarder} 담당자님께,\n\n보내 주신 ${quote.pol}→${quote.pod} ${quote.equip} 견적 관련하여 몇 가지 확인 부탁드립니다.\n\n` +
    asks.map((a, i) => `${i + 1}. ${a}`).join("\n") + "\n\n감사합니다." : "확인 요청할 항목이 없습니다.";
  $("#programs").innerHTML = REF.programs.map((p) => `<li><b>${p.name}</b><span>${p.who}</span><p>${p.note}</p></li>`).join("");
}

function toggle(li) {
  const open = li.getAttribute("aria-expanded") === "true";
  li.querySelector(".basis")?.remove();
  li.setAttribute("aria-expanded", !open);
  li.setAttribute("aria-selected", !open);
  if (!open) li.insertAdjacentHTML("beforeend", `<div class="basis">${result.F[+li.dataset.i].basis.map(([k, v]) => `<div class="quote"><b>${k}</b>${v}</div>`).join("")}</div>`);
}

function load(key) {
  quote = structuredClone(SAMPLES[key]);
  $$(".chip").forEach((b) => b.setAttribute("aria-pressed", b.dataset.key === key));
  renderItems();
  renderResult();
}

$$(".chip").forEach((b) => b.addEventListener("click", () => load(b.dataset.key)));
$("#copy").addEventListener("click", () => { navigator.clipboard?.writeText($("#memo").value); $("#copy").textContent = "복사됨"; setTimeout(() => ($("#copy").textContent = "복사"), 1200); });
load(new URLSearchParams(location.search).get("q") || "normal");
