// 추출 정확도 측정용 합성 견적과 정답. 모든 회사명과 금액은 가상이며 실제 고객 견적이 아니다.
// item: raw(정답 이름), cat(허용 분류), amount(정답 금액, null=금액 없음, undefined=채점 제외),
// cur(허용 통화), unclear(확인 필요로 표시되어야 함), optional(추출해도 되고 안 해도 되는 줄).
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../prototype/data.js"), "utf8"), ctx);
const S = ctx.window.SAMPLES;
const fmt = (n) => n.toLocaleString("en-US");
const fromSample = (id, key) => {
  const s = S[key];
  return {
    id, source: `prototype/data.js SAMPLES.${key}`, format: "text",
    text: `${s.forwarder} 견적\nPOL ${s.pol} / POD ${s.pod} / ${s.equip} x 1 / ${s.incoterms}\n` +
      s.items.map((it) => `${it.raw}: ${it.cur} ${fmt(it.amount)}`).join("\n") +
      (s.validity ? `\nValidity: ${s.validity}` : "") + (s.freeTime ? `\nFree time: ${s.freeTime}` : ""),
    items: s.items.map((it) => ({ raw: it.raw, cat: [it.code], amount: it.amount, cur: [it.cur] })),
  };
};
const I = (raw, cat, amount, cur, extra = {}) => ({ raw, cat: [].concat(cat), amount, cur: cur == null ? [null] : [].concat(cur), ...extra });
const U = { unclear: true };
const OPT = { optional: true };

module.exports = [
  fromSample("Q01", "normal"),
  fromSample("Q02", "highOF"),
  fromSample("Q03", "dupMissing"),
  { id: "Q04", format: "png", text: `안녕하세요, 한빛로지스(가상) 김대리입니다.
요청하신 부산 → 뉴욕 40HC 1대 견적 드립니다.

- 해상운임(O/F): USD 9,850 / CNTR (BAF 포함)
- AMS: USD 35 / BL
- THC: KRW 215,000 / CNTR
- 서류발급비: KRW 50,000 / BL
- 부두사용료: KRW 9,630 / CNTR
- 씰비: KRW 10,000
- 통관수수료: KRW 33,000

유효기간: 2026-11-15, Free time 목적지 10일
감사합니다.`, items: [I("해상운임(O/F)", "OF", 9850, "USD"), I("BAF", "BAF", null, null, OPT), I("AMS", "AMS", 35, "USD"), I("THC", "THC", 215000, "KRW"), I("서류발급비", "DOC", 50000, "KRW"), I("부두사용료", "WHARFAGE", 9630, "KRW"), I("씰비", "SEAL", 10000, "KRW"), I("통관수수료", "CUSTOMS", 33000, "KRW")] },
  { id: "Q05", format: "pdf", text: `QUOTATION   Ref: SQ-2611-044   (Seoul Ocean Line Agency, fictitious)
POL: BUSAN / POD: ROTTERDAM   EQ: 40'HC x 2   Term: FOB
Charge | Rate | Cur | Unit
O/F | 3,320 | USD | /40HC
BAF | 410 | USD | /40HC
LSS | 95 | USD | /40HC
ENS | 35 | USD | /BL
THC | 215,000 | KRW | /40HC
DOC | 50,000 | KRW | /BL
WFG | 9,630 | KRW | /40HC
SEAL | 10,000 | KRW | /40HC
Valid till 2026-11-14`, items: [I("O/F", "OF", 3320, "USD"), I("BAF", "BAF", 410, "USD"), I("LSS", "LSS", 95, "USD"), I("ENS", "ENS", 35, "USD"), I("THC", "THC", 215000, "KRW"), I("DOC", "DOC", 50000, "KRW"), I("WFG", "WHARFAGE", 9630, "KRW"), I("SEAL", "SEAL", 10000, "KRW")] },
  { id: "Q06", format: "text", text: `BUSAN-HAMBURG 1x40'GP
O/F USD 3,150/40'  BAF incl.  CAF incl.
THC KRW 215,000  DOC KRW 45,000
CFS chg at cost
H/C KRW 30,000
** subject to GRI 11/15 **`, items: [I("O/F", "OF", 3150, "USD"), I("BAF", "BAF", null, null, OPT), I("CAF", "CAF", null, null, OPT), I("THC", "THC", 215000, "KRW"), I("DOC", "DOC", 45000, "KRW"), I("CFS chg", ["OTHER", "HANDLING", "SERVICE"], null, [null, "KRW", "USD"], U), I("H/C", "HANDLING", 30000, "KRW"), I("GRI", ["OTHER", "OF"], null, [null], { optional: true })] },
  { id: "Q07", format: "text", text: `인천 → 상해 20GP 2대 견적입니다.
O/F: USD 280/20'
THC: 130,000원/20'
DOC: 40,000원/BL
CIS(중국 신고비): USD 30/BL
WHARFAGE: 4,815원/20'
내륙운송(시화→인천항): 220,000원/대
통관: 실비 청구`, items: [I("O/F", "OF", 280, "USD"), I("THC", "THC", 130000, "KRW"), I("DOC", "DOC", 40000, "KRW"), I("CIS(중국 신고비)", ["OTHER", "AMS", "ENS"], 30, "USD"), I("WHARFAGE", "WHARFAGE", 4815, "KRW"), I("내륙운송", "TRUCK", 220000, "KRW"), I("통관", "CUSTOMS", null, [null, "KRW"], U)] },
  { id: "Q08", format: "png", text: `Dear Mr. Park,
Please find our best rate for PUSAN-TOKYO 1x40GP.

Ocean freight: USD 450
BAF: USD 120
CAF: 5% of O/F
THC: KRW 180,000
DOC FEE: KRW 50,000
D/O at destination: JPY 6,000 (collect)

Validity: end of Nov.
Best regards, Daon Shipping (fictitious)`, items: [I("Ocean freight", "OF", 450, "USD"), I("BAF", "BAF", 120, "USD"), I("CAF", "CAF", null, [null, "USD"], U), I("THC", "THC", 180000, "KRW"), I("DOC FEE", "DOC", 50000, "KRW"), I("D/O", ["OTHER", "DOC"], 6000, "JPY")] },
  { id: "Q09", format: "text", text: `[견적] 부산 → 싱가포르 40HC
- O/F USD 380 /40HC
- LSS USD 40 /40HC
- THC KRW 180,000~220,000 (터미널에 따라 상이)
- DOC KRW 50,000 /BL
- Seal KRW 8,000
- Handling KRW 25,000 /BL`, items: [I("O/F", "OF", 380, "USD"), I("LSS", "LSS", 40, "USD"), I("THC", "THC", undefined, [null, "KRW"], U), I("DOC", "DOC", 50000, "KRW"), I("Seal", "SEAL", 8000, "KRW"), I("Handling", "HANDLING", 25000, "KRW")] },
  { id: "Q10", format: "text", numbers: [210000, 50000], text: `LA 40HC 견적 보내드려요.
운임 7,900불, THC 21만원, 서류비 5만원, AMS 35불
핸들링은 별도 협의`, items: [I("운임", "OF", 7900, "USD"), I("THC", "THC", 210000, "KRW"), I("서류비", "DOC", 50000, "KRW"), I("AMS", "AMS", 35, "USD"), I("핸들링", "HANDLING", null, [null, "KRW"], U)] },
  { id: "Q11", format: "pdf", text: `RATE OFFER  BUSAN -> SAVANNAH  1 x 40HC
ALL-IN RATE: USD 11,200 /40HC (O/F + BAF + EBS incl.)
AMS: USD 35 /BL
ISF filing: USD 25 /BL
THC: KRW 215,000 /40HC
DOC: KRW 50,000 /BL
Chassis usage at destination: TBA`, items: [I("ALL-IN RATE", "OF", 11200, "USD"), I("BAF", "BAF", null, null, OPT), I("EBS", "EBS", null, null, OPT), I("AMS", "AMS", 35, "USD"), I("ISF filing", ["AMS", "OTHER"], 25, "USD"), I("THC", "THC", 215000, "KRW"), I("DOC", "DOC", 50000, "KRW"), I("Chassis usage", ["OTHER", "TRUCK"], null, [null, "USD"], U)] },
  { id: "Q12", format: "png", text: `광양 → 롱비치 40HC 견적표
항목\t금액\t통화\t단위
해상운임\t7,450\tUSD\t40HC
저유황할증료\t60\tUSD\t40HC
긴급유류할증료\t150\tUSD\t40HC
터미널작업비\t215,000\tKRW\t40HC
B/L 발급비\t50,000\tKRW\tBL
부두사용료\t9,630\tKRW\t40HC
미국신고(AMS)\t35\tUSD\tBL`, items: [I("해상운임", "OF", 7450, "USD"), I("저유황할증료", "LSS", 60, "USD"), I("긴급유류할증료", "EBS", 150, "USD"), I("터미널작업비", "THC", 215000, "KRW"), I("B/L 발급비", ["BLFEE", "DOC"], 50000, "KRW"), I("부두사용료", "WHARFAGE", 9630, "KRW"), I("미국신고(AMS)", "AMS", 35, "USD")] },
  { id: "Q13", format: "text", text: `Busan to Genoa, 1x40HC, CIF
O/F EUR 3,400 / 40HC
BAF EUR 280 / 40HC
ENS EUR 25 / BL
THC KRW 215,000
DOC KRW 50,000
Seal KRW 10,000`, items: [I("O/F", "OF", 3400, "EUR"), I("BAF", "BAF", 280, "EUR"), I("ENS", "ENS", 25, "EUR"), I("THC", "THC", 215000, "KRW"), I("DOC", "DOC", 50000, "KRW"), I("Seal", "SEAL", 10000, "KRW")] },
  { id: "Q14", format: "text", text: `Busan-Antwerp 40HC
O/F USD 3,600
THC KRW 215,000
Documentation fee KRW 50,000
B/L fee KRW 40,000
Telex release fee KRW 30,000
Handling charge KRW 50,000
Service charge KRW 30,000`, items: [I("O/F", "OF", 3600, "USD"), I("THC", "THC", 215000, "KRW"), I("Documentation fee", "DOC", 50000, "KRW"), I("B/L fee", ["BLFEE", "DOC"], 40000, "KRW"), I("Telex release fee", ["BLFEE", "DOC", "OTHER"], 30000, "KRW"), I("Handling charge", "HANDLING", 50000, "KRW"), I("Service charge", "SERVICE", 30000, "KRW")] },
  { id: "Q15", format: "text", text: `부산-로테르담 40HC 운임 회신
O/F 3,900 /40HC
THC 215,000
DOC 50,000`, items: [I("O/F", "OF", 3900, [null, "USD"], U), I("THC", "THC", 215000, [null, "KRW"], U), I("DOC", "DOC", 50000, [null, "KRW"], U)] },
  { id: "Q16", format: "png", text: `From: 바다로지스틱스(가상) 이과장
Sent: 2026-10-28 16:42
Subject: RE: 부산-바르셀로나 견적 요청 (PO 20261028-7)

이사님 안녕하세요. 요청주신 건 아래와 같이 회신드립니다.
40HC x 1, CIF, 11/20 ETD 기준

Ocean Freight USD 3,950/40HC (BAF incl.)
LSS USD 75/40HC
ENS USD 30/BL
THC KRW 215,000/40HC
DOC KRW 50,000/BL
부산신항 셔틀 운송 KRW 150,000

문의사항 있으시면 연락주세요.
Tel 051-123-4567 / Mobile 010-9876-5432`, items: [I("Ocean Freight", "OF", 3950, "USD"), I("BAF", "BAF", null, null, OPT), I("LSS", "LSS", 75, "USD"), I("ENS", "ENS", 30, "USD"), I("THC", "THC", 215000, "KRW"), I("DOC", "DOC", 50000, "KRW"), I("부산신항 셔틀 운송", "TRUCK", 150000, "KRW")] },
  { id: "Q17", format: "png", text: `PUS-RTM 40'HC
0/F USD 2,950.-/40'HC ; T.H.C KRW215,000 ; D0C KRW 50,000 ; WHF KRW9,630 ; SEAL KRW 10,000`, items: [I("0/F", "OF", 2950, "USD"), I("T.H.C", "THC", 215000, "KRW"), I("D0C", "DOC", 50000, "KRW"), I("WHF", "WHARFAGE", 9630, "KRW"), I("SEAL", "SEAL", 10000, "KRW")] },
  { id: "Q18", format: "text", text: `Busan - Valencia 40HC
O/F USD 3,700 /40HC subject to space availability
PSS USD 300 /40HC (effective 11/15 if applied)
THC KRW 215,000
DOC KRW 50,000
ENS USD 30`, items: [I("O/F", "OF", 3700, "USD"), I("PSS", ["OTHER", "BAF", "OF"], 300, "USD", U), I("THC", "THC", 215000, "KRW"), I("DOC", "DOC", 50000, "KRW"), I("ENS", "ENS", 30, "USD")] },
  { id: "Q19", format: "text", text: `LCL Busan -> Oakland, 3.5 CBM
O/F USD 25 /CBM
CFS KRW 18,000 /CBM
THC KRW 9,000 /CBM
DOC KRW 50,000 /BL
AMS USD 35 /BL
Bonded warehouse: at cost`, items: [I("O/F", "OF", 25, "USD"), I("CFS", ["OTHER", "HANDLING"], 18000, "KRW"), I("THC", "THC", 9000, "KRW"), I("DOC", "DOC", 50000, "KRW"), I("AMS", "AMS", 35, "USD"), I("Bonded warehouse", ["OTHER", "HANDLING"], null, [null, "KRW", "USD"], U)] },
  { id: "Q20", format: "pdf", text: `부산 → 시애틀 40HC 1대 견적서 (누리포워딩, 가상)
해상운임  USD 7,700 / 40HC
THC  215,000원 (VAT 별도)
서류발급비  50,000원
AMS  USD 35
통관수수료  30,000원
운송비(화성→부산)  330,000원 (VAT 포함)`, items: [I("해상운임", "OF", 7700, "USD"), I("THC", "THC", 215000, "KRW"), I("서류발급비", "DOC", 50000, "KRW"), I("AMS", "AMS", 35, "USD"), I("통관수수료", "CUSTOMS", 30000, "KRW"), I("운송비", "TRUCK", 330000, "KRW")] },
  { id: "Q21", format: "text", text: `평택 → 청도 20GP x 3
O/F: USD 0 /20GP
THC: KRW 130,000 /20GP
DOC: KRW 40,000 /BL
CIS: USD 25 /BL
수입지 비용: COLLECT`, items: [I("O/F", "OF", 0, "USD"), I("THC", "THC", 130000, "KRW"), I("DOC", "DOC", 40000, "KRW"), I("CIS", ["OTHER", "AMS", "ENS"], 25, "USD"), I("수입지 비용", "OTHER", null, null, OPT)] },
  { id: "Q22", format: "text", text: `부산 → 함부르크 40HC
O/F USD 3,300 (BAF 별도)
BAF USD 380
EBS USD 50 /40HC
THC KRW 215,000
DOC KRW 50,000
CFS 해당없음`, items: [I("O/F", "OF", 3300, "USD"), I("BAF", "BAF", 380, "USD"), I("EBS", "EBS", 50, "USD"), I("THC", "THC", 215000, "KRW"), I("DOC", "DOC", 50000, "KRW"), I("CFS", "OTHER", null, null, OPT)] },
  { id: "Q23", format: "text", text: `Busan - Ho Chi Minh (Cat Lai)
Ocean freight: USD 150/20GP & USD 280/40HC
BAF: USD 60/20GP, USD 120/40HC
THC: KRW 130,000/20GP, KRW 180,000/40HC
DOC: KRW 50,000/BL`, items: [I("Ocean freight 20GP", "OF", 150, "USD"), I("Ocean freight 40HC", "OF", 280, "USD"), I("BAF 20GP", "BAF", 60, "USD"), I("BAF 40HC", "BAF", 120, "USD"), I("THC 20GP", "THC", 130000, "KRW"), I("THC 40HC", "THC", 180000, "KRW"), I("DOC", "DOC", 50000, "KRW")] },
];
