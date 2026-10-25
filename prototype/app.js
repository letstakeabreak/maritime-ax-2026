// 비교와 확인 항목은 아래 규칙으로 계산한다. AI나 견적서 자동 추출은 연결하지 않았다.
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const won = (n) => Math.round(n).toLocaleString("ko-KR") + "원";
const usd = (n) => "$" + Math.round(n).toLocaleString("en-US");
const fmt = (it) => it.cur === "USD" ? usd(it.amount) : won(it.amount);
const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const KIND = { OF: "운임", BAF: "운임", CAF: "운임", LSS: "운임", EBS: "운임", THC: "부대", DOC: "부대", BLFEE: "부대", WHARFAGE: "부대", SEAL: "부대", AMS: "수수료", ENS: "수수료", HANDLING: "수수료", SERVICE: "수수료", CUSTOMS: "수수료", TRUCK: "육상" };
const chevron = '<img class="chevron" src="assets/chevron.svg" width="18" height="18" alt="">';
let quote = null, result = null, memoDirty = false;

function position(r) {
  if (r < 0.9) return { k: "low", t: "운임지수보다 낮아요" };
  if (r <= 1.1) return { k: "ok", t: "운임지수와 비슷해요" };
  if (r <= 1.25) return { k: "warn", t: "운임지수보다 다소 높아요" };
  return { k: "bad", t: "운임지수보다 높아요" };
}

function diagnose(q) {
  const F = [];
  const toKRW = (it) => it.cur === "USD" ? it.amount * q.fx : it.amount;
  const toUSD = (it) => it.cur === "KRW" ? it.amount / q.fx : it.amount;
  const of = q.items.find((i) => i.code === "OF"), bench = REF.kcci.routes[q.route];
  let ofr = null;
  if (of && !(of.amount > 0)) F.push({ key: "of-zero", lv: "info", title: "해상운임 금액을 확인해 주세요", detail: "금액이 0이거나 비어 있어 운임지수와 비교하지 않았어요.", basis: [["견적에 적힌 금액", `${of.raw} ${fmt(of)}`]], ask: "해상운임 금액을 다시 알려 주세요." });
  if (of && of.amount > 0 && bench) {
    // KOBC 표준기술서 2쪽: 운임성 할증료 포함, 현지 부대요금 제외. 예시는 40ft 1대 기준.
    const freight = q.items.filter((it) => REF.kcci.includedCodes.includes(it.code));
    const amount = freight.reduce((s, it) => s + toUSD(it), 0), r = amount / bench;
    ofr = { amount, bench, r, pos: position(r) };
    if (r > 1.1) F.push({ key: "freight", lv: r > 1.25 ? "bad" : "warn", title: "운임지수보다 높은 이유를 물어보세요",
      detail: `해상운임과 할증료를 합하면 ${usd(amount)}으로, ${q.route} 운임지수보다 ${Math.round((r - 1) * 100)}% 높아요.`,
      basis: [["견적에 적힌 금액", `${freight.map((it) => `${it.raw} ${fmt(it)}`).join(" + ")} = ${usd(amount)} (달러로 환산했어요)`],
        ["비교한 운임지수", `KCCI ${q.route} ${usd(bench)} (${REF.kcci.asOf}, ${REF.kcci.unit})`],
        ["비교에 넣은 비용", "O/F와 별도 운임 할증료(BAF, CAF, LSS, EBS)를 더했어요. THC, DOC, Wharfage, Seal 등 현지 부대요금은 뺐어요."],
        ["확인 항목으로 표시한 이유", "운임지수보다 10% 넘게 높으면 표시해요. 시연을 위해 정한 기준이며, 부당 청구를 판단하는 기준은 아니에요."],
        ["함께 살펴볼 조건", "권역별 참고값과 개별 견적은 계약 조건이 다를 수 있어요. 선사와 적용 기간, 포함된 비용을 함께 확인해 주세요."]],
      ask: `해상운임과 할증료 합계 ${usd(amount)}은 어떤 선사와 기간을 기준으로 하나요? ${q.route} 운임지수(KCCI ${usd(bench)})와 차이가 나는 이유와 포함된 비용을 알려 주세요.` });
  }
  REF.dupGroups.forEach((g) => {
    const hit = q.items.filter((i) => g.codes.includes(i.code));
    if (hit.length < 2) return;
    const docs = g.codes.includes("DOC");
    F.push({ key: "dup-" + g.codes[0], lv: "warn", title: docs ? "서류 비용 두 건은 어떻게 다른가요?" : "취급 수수료는 각각 어떤 비용인가요?",
      detail: docs ? (hit[0].cur === hit[1].cur && hit[0].amount === hit[1].amount ? `DOC와 B/L 발급비가 각각 ${fmt(hit[0])}이에요.` : `DOC ${fmt(hit[0])}과 B/L 발급비 ${fmt(hit[1])}이 적혀 있어요.`) : `Handling은 ${fmt(hit[0])}, Service는 ${fmt(hit[1])}이에요.`,
      basis: [...hit.map((h) => ["견적에 적힌 비용", `${h.raw} ${fmt(h)}`]), ["확인할 내용", "어떤 업무에 드는 비용인지 물어보세요. 이름이 비슷해도 서로 다른 업무일 수 있어요."]],
      ask: docs ? "DOC와 B/L 발급비는 각각 어떤 업무에 드는 비용인가요?" : "Handling과 Service는 어떻게 다른 비용인가요?" });
  });
  Object.entries(REF.filings).forEach(([code, routes]) => {
    const it = q.items.find((i) => i.code === code);
    if (it && !routes.includes(q.route)) F.push({ key: "filing-" + code, lv: "bad", title: `${code === "AMS" && ["북유럽", "지중해"].includes(q.route) ? "유럽행" : q.pod + "행"} 견적에 ${code}가 들어 있어요`,
      detail: `${CODE_LABEL[code]} 비용 ${fmt(it)}가 포함된 이유를 물어보세요.`,
      basis: [["견적에 적힌 비용", `${q.pod}행 견적에 ${code} ${fmt(it)}가 들어 있어요.`], ["신고가 필요한 항로", `${code}는 ${routes.join(", ")} 항로의 사전신고 비용이에요.`], ["함께 확인할 조건", "이 비용이 필요한 이유를 물어보세요. 경유지와 신고 조건에 따라 달라질 수 있어요."]],
      ask: `${q.pod}행 견적에 ${code}가 포함된 이유는 무엇인가요?` });
  });
  q.items.forEach((it) => {
    const ref = REF.published[it.code];
    if (!ref) return;
    const mid = (ref.min + ref.max) / 2, v = toKRW(it);
    if (v > mid * 1.1) F.push({ key: "fee-" + it.code, lv: "warn", title: `${ref.label}가 예시값보다 높아요`,
      detail: `${it.code} ${won(v)}은 예시 범위의 중간값보다 ${Math.round((v / mid - 1) * 100)}% 높아요.`,
      basis: [["견적에 적힌 금액", `${it.raw} ${won(v)}`], ["비교한 예시값", `${won(ref.min)}~${won(ref.max)}의 중간값인 ${won(mid)}과 비교했어요. 실제 선사가 발표한 요금과는 아직 비교하지 않았어요.`],
        ["확인 항목으로 표시한 이유", "예시 범위의 중간값보다 10% 넘게 높으면 표시해요. 시연을 위해 정한 값이며 법적 허용 기준은 아니에요."]],
      ask: `${it.raw} ${won(v)}은 어떤 기준으로 계산했나요?` });
  });
  if (!q.freeTime) F.push({ key: "free-time", lv: "warn", title: "프리타임이 적혀 있지 않아요", detail: "무료로 보관하고 컨테이너를 반납할 수 있는 기간을 물어보세요.",
    basis: [["견적에 적힌 조건", "프리타임이 적혀 있지 않아요."], ["확인할 기간", "도착한 항구에서 무료로 보관할 수 있는 기간(Demurrage)과 추가 요금 없이 컨테이너를 반납할 수 있는 기한(Detention)을 물어보세요. 기간이 지난 뒤 내야 할 요금도 함께 확인해 보세요."]],
    ask: "목적지에서 무료로 보관하고 컨테이너를 반납할 수 있는 기간은 얼마인가요? 기간이 지난 뒤의 요금도 알려 주세요." });
  if (!q.validity) F.push({ key: "validity", lv: "info", title: "견적 유효기간이 적혀 있지 않아요", detail: "받은 견적을 언제까지 적용받을 수 있는지 물어보세요.", basis: [["견적에 적힌 조건", "유효기간이 적혀 있지 않아요."]], ask: "이 견적을 언제까지 적용받을 수 있나요?" });
  return { F, ofr, total: q.items.reduce((s, i) => s + toKRW(i), 0) };
}

function renderItems() {
  $("#meta").innerHTML = [["포워더", quote.forwarder], ["구간", `${quote.pol} → ${quote.pod}`], ["장비와 조건", `${quote.equip} 1대, ${quote.incoterms}`], ["유효기간", quote.validity || "적혀 있지 않아요"], ["프리타임", quote.freeTime || "적혀 있지 않아요"], ["적용 환율", `1달러에 ${won(quote.fx)}`]]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHTML(v)}</dd></div>`).join("");
  $("#items").innerHTML = quote.items.map((it, i) => `<li class="row"><span class="kind">${KIND[it.code] || "수수료"}</span><span class="row-text"><label class="row-title" for="amount-${i}">${escapeHTML(it.raw)}</label><span class="row-sub">${CODE_LABEL[it.code] || it.code}</span></span><img class="item-status" data-code="${it.code}" src="assets/notice-dot.svg" width="8" height="8" alt="확인할 항목" hidden><span class="amt"><input id="amount-${i}" type="number" inputmode="decimal" min="0" max="1000000000" step="any" value="${it.amount}" data-i="${i}" aria-label="${escapeHTML(it.raw)} 금액"><span>${it.cur}</span></span></li>`).join("");
  $$("#items input").forEach((el) => el.addEventListener("input", (e) => {
    const v = Math.min(Math.max(+e.target.value || 0, 0), 1e9);
    if (+e.target.value !== v) e.target.value = String(v);
    quote.items[+e.target.dataset.i].amount = v;
    e.target.closest(".row").classList.toggle("zero", v === 0);
    renderResult();
  }));
}

function memoText() {
  const asks = result.F.map((f) => f.ask);
  return asks.length ? `${quote.forwarder} 담당자님,\n받은 견적에서 다음 내용을 확인 부탁드립니다.\n\n${asks.map((a, i) => `${i + 1}. ${a}`).join("\n\n")}` : "이번 예시에서는 정해 둔 규칙에 해당하는 확인 항목이 없어요. 계약 전에 포함된 비용과 적용 기간을 확인해 주세요.";
}

function renderResult() {
  result = diagnose(quote);
  const { F, ofr, total } = result;
  $$(".item-status").forEach((dot) => {
    const code = dot.dataset.code;
    const filing = F.some((f) => f.key === "filing-" + code);
    const duplicate = REF.dupGroups.some((g) => g.codes.includes(code) && F.some((f) => f.key === "dup-" + g.codes[0]));
    dot.hidden = !filing && !duplicate && !F.some((f) => f.key === "fee-" + code || (code === "OF" && ["freight", "of-zero"].includes(f.key)));
    dot.src = filing ? "assets/alert-dot.svg" : "assets/notice-dot.svg";
  });
  const warnings = F.filter((f) => f.lv !== "info"), count = warnings.length;
  $("#summary-title").innerHTML = F.some((f) => f.key === "of-zero") ? '해상운임 금액을<br class="mobile-only"> 먼저 확인해 주세요' : count ? `물어볼 내용이 <br class="mobile-only">${count}가지 있어요` : '정해 둔 규칙에서는<br class="mobile-only"> 확인할 항목이 없어요';
  $("#total").textContent = $("#quote-dialog-total").textContent = won(total);
  $("#forwarder").textContent = `${quote.forwarder}에서 받은 견적이에요`;
  $("#quote-caption").textContent = `${quote.items.length}개 비용을 합쳤어요. 환율은 1달러에 ${won(quote.fx)}을 적용했어요.`;
  $("#quote-mobile-caption").textContent = `총 ${won(total)}이에요. ${quote.validity ? `${quote.validity}까지 유효해요.` : "유효기간은 적혀 있지 않아요."}`;
  const delta = ofr ? Math.round((ofr.r - 1) * 100) : 0;
  const relation = delta > 0 ? "높아요" : delta < 0 ? "낮아요" : "같아요";
  $("#gauge").innerHTML = ofr ? `<strong class="market-delta">${delta > 0 ? "+" : ""}${delta}%</strong><div class="market-copy"><p class="market-label">${quote.route} 운임지수${delta === 0 ? "와" : "보다"} ${relation}</p><p class="market-values">견적 ${usd(ofr.amount)} / KCCI ${usd(ofr.bench)}</p></div>` : '<p class="market-unavailable">해상운임 금액을 입력하면<br>운임지수와 비교할 수 있어요.</p>';
  $("#market-date").textContent = `${REF.kcci.asOf.replaceAll("-", ".")} 발표, 40피트 1대 기준(USD)`;
  // 유효기간은 견적 원문과 질문에서 알리고, 확인 항목 수에는 넣지 않는다.
  const visible = F.filter((f) => f.key !== "validity");
  $("#findings").innerHTML = visible.length ? visible.map((f) => `<li><button type="button" class="action-row finding-row" data-finding="${f.key}"><span class="row-copy"><strong>${escapeHTML(f.title)}</strong><span class="row-detail">${escapeHTML(f.detail)}</span></span>${chevron}</button></li>`).join("") : '<li class="empty-state"><strong>이번 예시에서는 따로 표시할 내용이 없어요</strong><p>계약 전에 포함된 비용과 적용 기간을 확인해 주세요.</p></li>';
  $$("[data-finding]").forEach((b) => b.addEventListener("click", () => {
    const finding = result.F.find((f) => f.key === b.dataset.finding);
    $("#finding-title").textContent = finding.title;
    $("#finding-body").innerHTML = `<p>${escapeHTML(finding.detail)}</p><dl class="basis">${finding.basis.map(([k, v]) => `<div><dt>${escapeHTML(k)}</dt><dd>${escapeHTML(v)}</dd></div>`).join("")}</dl>`;
    openDialog("finding-dialog");
  }));
  if (!memoDirty) $("#memo").value = memoText();
  $("#memo-stale").hidden = !memoDirty;
  $("#memo-note").textContent = quote.validity ? "금액을 바꾼 뒤에는 질문도 다시 확인해 주세요." : "견적을 언제까지 적용받을 수 있는지도 마지막 질문에 넣었어요.";
  $("#copy-status").textContent = "";
  $("#basis-content").innerHTML = `<p>${ofr ? `${REF.kcci.asOf} 발표된 ${quote.route} 해상운임지수(KCCI)는 40피트 컨테이너 1대당 ${usd(ofr.bench)}예요. 이 예시 견적의 비교 금액 ${usd(ofr.amount)}은 지수${delta === 0 ? "와 같아요" : `보다 약 ${Math.abs(delta)}% ${relation}`}.` : "해상운임 금액이 없어 운임지수와 비교하지 않았어요."}</p><p>KCCI와 비교할 때는 해상운임과 별도 운임 할증료(BAF, CAF, LSS, EBS)를 더하고, 현지 부대요금은 빼요. 예시는 40피트 컨테이너 1대 기준이며, 별도로 적힌 할증료는 해상운임에 포함되지 않은 것으로 가정했어요.</p><p>부대요금 범위와 경고 기준은 시연을 위해 정한 예시예요. 운임지수나 예시 요금의 중간값보다 10% 넘게 높으면 확인할 항목으로 표시해요. 실제 선사 요금은 아직 반영하지 않았어요.</p>`;
}

function openDialog(id) {
  const dialog = $("#" + id);
  dialog.showModal();
  dialog.querySelector("h2").focus();
}

function toward(place) {
  const syllable = place.charCodeAt(place.length - 1) - 0xac00;
  const needsEu = syllable >= 0 && syllable <= 11171 && syllable % 28 !== 0 && syllable % 28 !== 8;
  return place + (needsEu ? "으로" : "로");
}

function load(key) {
  quote = structuredClone(SAMPLES[key]);
  memoDirty = false;
  $$(".chip").forEach((b) => b.setAttribute("aria-pressed", b.dataset.key === key));
  $("#sample-select").value = key;
  $("#route-title").textContent = `${quote.pol}에서 ${toward(quote.pod)}`;
  $("#route-description").textContent = `${quote.pol}에서 ${toward(quote.pod)} 보내요. ${quote.equip} 1대, ${quote.incoterms} 조건이에요.`;
  $("#route-description-mobile").textContent = `${quote.equip} 1대를 ${quote.incoterms} 조건으로 보내는 예시예요.`;
  renderItems();
  renderResult();
}

$$(".chip").forEach((b) => b.addEventListener("click", () => load(b.dataset.key)));
$("#sample-select").addEventListener("change", (e) => { load(e.target.value); window.scrollTo({ top: 0, behavior: "smooth" }); });
$$("[data-open]").forEach((b) => b.addEventListener("click", () => openDialog(b.dataset.open)));
$$("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
$$("dialog").forEach((dialog) => dialog.addEventListener("click", (e) => {
  const rect = dialog.getBoundingClientRect();
  if (e.target === dialog && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) dialog.close();
}));
$("#memo").addEventListener("input", () => { memoDirty = true; $("#copy-status").textContent = ""; });
$("#reset-memo").addEventListener("click", () => { memoDirty = false; $("#memo").value = memoText(); $("#memo-stale").hidden = true; $("#copy-status").textContent = "현재 견적에 맞춰 다시 썼어요."; });
$("#copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#memo").value);
    $("#copy-status").textContent = "질문을 복사했어요. 보내기 전에 한 번 더 확인해 주세요.";
  } catch {
    $("#memo").focus();
    $("#memo").select();
    $("#copy-status").textContent = "자동으로 복사하지 못했어요. 선택된 글을 직접 복사해 주세요.";
  }
});
$("#programs").innerHTML = REF.programs.map((p) => `<li><h3>${p.name}</h3><p>${p.note}</p></li>`).join("");
const q0 = new URLSearchParams(location.search).get("q");
load(Object.hasOwn(SAMPLES, q0) ? q0 : "normal");
