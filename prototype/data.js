// 프로토타입 데이터. KCCI만 실제 발표값이고 나머지는 예시값이다.
// KCCI 4개 항로는 2026-10-19 KOBC 공식 표와 대조. 검증 근거: docs/research/04-verification-evidence.md
window.REF = {
  kcci: {
    asOf: "2026-10-19",
    unit: "USD / 40ft",
    source: "KOBC KCCI 공식 항로별 운임 표(2026-10-19)",
    sourceUrl: "https://kobc.or.kr/ebz/shippinginfo/kcci/gridList.do?mId=0304000000",
    standardsUrl: "https://kobc.or.kr/ebz/common/file/KCCI_Standards.pdf",
    includedCodes: ["OF", "BAF", "CAF", "LSS", "EBS"],
    routes: {
      "북미 서안": 8229,
      "북미 동안": 11590,
      "북유럽": 3475,
      "지중해": 3835,
    },
  },
  // KRW, 40ft 기준 예시 범위. 실제 선사 공표 요금은 아직 연동하지 않았다.
  published: {
    THC: { min: 180000, max: 230000, label: "터미널 작업비" },
    DOC: { min: 40000, max: 55000, label: "서류발급비" },
    WHARFAGE: { min: 8000, max: 11000, label: "부두사용료" },
    SEAL: { min: 8000, max: 12000, label: "봉인비" },
  },
  // 같은 성격의 수수료 묶음 (이름만 다른 중복 청구 의심)
  dupGroups: [
    { name: "서류 관련 수수료", codes: ["DOC", "BLFEE"] },
    { name: "포워더 취급 수수료", codes: ["HANDLING", "SERVICE"] },
  ],
  // 목적지 신고는 항로에 맞는 것만 유효
  filings: { AMS: ["북미 서안", "북미 동안"], ENS: ["북유럽", "지중해"] },
  programs: [
    { name: "수출바우처 물류 분야", who: "중소, 중견 수출기업", note: "국제운송과 보관, 포장 비용에 쓸 수 있는지 공고문에서 확인해 보세요." },
    { name: "지자체 수출물류비 지원", who: "관내 본사 중소 제조기업", note: "사업장이 있는 지역의 지원 공고를 살펴보세요. 수출 실적과 중복 지원 여부 등 신청 조건이 지역마다 달라요." },
    { name: "중소기업 전용 선복 지원", who: "미주, 유럽 FCL 수출 중소기업", note: "미주나 유럽으로 수출한다면 중소기업 전용 선복을 이용할 수 있는지 확인해 보세요. 운영 여부는 시기에 따라 달라요." },
  ],
};

// 예시 가정: 40ft 1대, 별도 항목으로 적힌 할증료는 O/F에 미포함. A/C는 별도 할증료 없음.
// 실제 견적의 포함 관계·적용 주차·수량을 자동으로 확인하는 기능은 아직 없다.
window.SAMPLES = {
  normal: {
    title: "예시 A: 시장권 견적",
    forwarder: "가나포워딩(가상)",
    route: "북미 서안", pol: "부산", pod: "로스앤젤레스", equip: "40HC", incoterms: "CIF", validity: "2026-10-31", freeTime: "목적지 7일",
    fx: 1380,
    items: [
      { raw: "Ocean Freight", code: "OF", amount: 7600, cur: "USD" },
      { raw: "THC", code: "THC", amount: 210000, cur: "KRW" },
      { raw: "Document Fee", code: "DOC", amount: 45000, cur: "KRW" },
      { raw: "Wharfage", code: "WHARFAGE", amount: 9500, cur: "KRW" },
      { raw: "Seal Charge", code: "SEAL", amount: 10000, cur: "KRW" },
      { raw: "AMS Filing", code: "AMS", amount: 35, cur: "USD" },
      { raw: "Handling Charge", code: "HANDLING", amount: 30000, cur: "KRW" },
      { raw: "통관수수료", code: "CUSTOMS", amount: 30000, cur: "KRW" },
      { raw: "내륙운송 (평택→부산신항)", code: "TRUCK", amount: 480000, cur: "KRW" },
    ],
  },
  highOF: {
    title: "예시 B: 해상운임 고가",
    forwarder: "다라로지스(가상)",
    route: "북유럽", pol: "부산", pod: "로테르담", equip: "40HC", incoterms: "CIF", validity: "2026-10-31", freeTime: "목적지 5일",
    fx: 1380,
    items: [
      { raw: "O/F", code: "OF", amount: 4600, cur: "USD" },
      { raw: "LSS", code: "LSS", amount: 120, cur: "USD" },
      { raw: "THC", code: "THC", amount: 215000, cur: "KRW" },
      { raw: "DOC FEE", code: "DOC", amount: 50000, cur: "KRW" },
      { raw: "WFG", code: "WHARFAGE", amount: 9500, cur: "KRW" },
      { raw: "ENS", code: "ENS", amount: 30, cur: "USD" },
      { raw: "Handling", code: "HANDLING", amount: 35000, cur: "KRW" },
    ],
  },
  dupMissing: {
    title: "예시 C: 중복 및 누락 의심",
    forwarder: "마바해운항공(가상)",
    route: "북유럽", pol: "부산", pod: "함부르크", equip: "40GP", incoterms: "CIF", validity: "", freeTime: "",
    fx: 1380,
    items: [
      { raw: "Ocean Freight", code: "OF", amount: 3550, cur: "USD" },
      { raw: "THC", code: "THC", amount: 260000, cur: "KRW" },
      { raw: "Documentation Fee", code: "DOC", amount: 50000, cur: "KRW" },
      { raw: "B/L Issuance Fee", code: "BLFEE", amount: 50000, cur: "KRW" },
      { raw: "AMS", code: "AMS", amount: 35, cur: "USD" },
      { raw: "Handling Charge", code: "HANDLING", amount: 60000, cur: "KRW" },
      { raw: "Service Charge", code: "SERVICE", amount: 40000, cur: "KRW" },
      { raw: "Seal", code: "SEAL", amount: 10000, cur: "KRW" },
    ],
  },
};

window.CODE_LABEL = {
  OF: "해상운임", BAF: "유류할증료", CAF: "통화할증료", LSS: "저유황유할증료", EBS: "긴급유류할증료", THC: "터미널 작업비", DOC: "서류발급비", BLFEE: "B/L 발급비",
  WHARFAGE: "부두사용료", SEAL: "봉인비", AMS: "미국 사전신고", ENS: "EU 사전신고",
  HANDLING: "포워더 취급수수료", SERVICE: "서비스 수수료", CUSTOMS: "통관수수료", TRUCK: "내륙운송", OTHER: "기타 비용",
};

// 공표운임 조회(data.go.kr 15029607)용 UN/LOCODE와 KCCI 항로. 이름은 AI가 읽은 항구명과 대조한다.
window.PORTS = [
  { code: "KRPUS", names: ["부산", "busan", "pusan"] },
  { code: "KRINC", names: ["인천", "incheon"] },
  { code: "KRKAN", names: ["광양", "gwangyang", "kwangyang"] },
  { code: "KRPTK", names: ["평택", "pyeongtaek"] },
  { code: "USLAX", names: ["로스앤젤레스", "los angeles", "la"], route: "북미 서안" },
  { code: "USLGB", names: ["롱비치", "long beach"], route: "북미 서안" },
  { code: "USOAK", names: ["오클랜드", "oakland"], route: "북미 서안" },
  { code: "USSEA", names: ["시애틀", "seattle"], route: "북미 서안" },
  { code: "USNYC", names: ["뉴욕", "new york"], route: "북미 동안" },
  { code: "USSAV", names: ["서배너", "사바나", "savannah"], route: "북미 동안" },
  { code: "NLRTM", names: ["로테르담", "rotterdam"], route: "북유럽" },
  { code: "DEHAM", names: ["함부르크", "hamburg"], route: "북유럽" },
  { code: "BEANR", names: ["앤트워프", "antwerp"], route: "북유럽" },
  { code: "ITGOA", names: ["제노바", "genoa"], route: "지중해" },
  { code: "ESBCN", names: ["바르셀로나", "barcelona"], route: "지중해" },
  { code: "ESVLC", names: ["발렌시아", "valencia"], route: "지중해" },
];
