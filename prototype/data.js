// 모든 수치는 프로토타입용 예시 데이터다.
// KCCI 북미 서안, 북미 동안, 북유럽은 2026-09-07 기준 보도값(news.tf.co.kr), 나머지 항로와 요금 기준은 예시값.
window.REF = {
  kcci: {
    asOf: "2026-09-07",
    unit: "USD / 40ft",
    routes: {
      "북미 서안": 7424,
      "북미 동안": 10989,
      "북유럽": 4289,
      "지중해": 4650,
      "중동": 2900,
      "동남아": 620,
    },
  },
  // 요금 기준 범위 (KRW, 40ft 기준 예시). 공표: 운임공표제 요금 8종에 포함, 참고: 공표 대상 여부 확인 전
  published: {
    THC: { min: 180000, max: 230000, label: "터미널 작업비", src: "참고" },
    DOC: { min: 40000, max: 55000, label: "서류발급비", src: "공표" },
    WHARFAGE: { min: 8000, max: 11000, label: "부두사용료", src: "공표" },
    SEAL: { min: 8000, max: 12000, label: "봉인비", src: "참고" },
  },
  // 같은 성격의 수수료 묶음 (이름만 다른 중복 청구 의심)
  dupGroups: [
    { name: "서류 관련 수수료", codes: ["DOC", "BLFEE"] },
    { name: "포워더 취급 수수료", codes: ["HANDLING", "SERVICE"] },
  ],
  // 목적지 신고는 항로에 맞는 것만 유효
  filings: { AMS: ["북미 서안", "북미 동안"], ENS: ["북유럽", "지중해"] },
  programs: [
    { name: "수출바우처 물류 분야", who: "중소, 중견 수출기업", note: "국제운송비 등 물류비를 바우처로 지원" },
    { name: "지자체 수출물류비 지원", who: "관내 본사 중소 제조기업", note: "지역별 요건(직수출 실적, 수출자 구분, 중복 지원 제한) 확인 필요" },
    { name: "중소기업 전용 선복 지원", who: "미주, 유럽 FCL 수출 중소기업", note: "국적선사 선복을 중소화주에 배정. 운영 여부는 시기별로 확인" },
  ],
};

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
      { raw: "O/F", code: "OF", amount: 5600, cur: "USD" },
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
      { raw: "Ocean Freight", code: "OF", amount: 4400, cur: "USD" },
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
  OF: "해상운임", LSS: "저유황유할증료", THC: "터미널 작업비", DOC: "서류발급비", BLFEE: "B/L 발급비",
  WHARFAGE: "부두사용료", SEAL: "봉인비", AMS: "미국 사전신고", ENS: "EU 사전신고",
  HANDLING: "포워더 취급수수료", SERVICE: "서비스 수수료", CUSTOMS: "통관수수료", TRUCK: "내륙운송",
};
