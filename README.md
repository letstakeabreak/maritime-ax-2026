# maritime-ax-2026

운임렌즈: 중소 수출화주의 해상운임 견적을 읽는 정적 웹 프로토타입.

## 실행과 검증

```sh
python3 -m http.server 8768 --bind 127.0.0.1 --directory prototype
# http://127.0.0.1:8768 접속
```

```sh
node --test tests/prototype.test.cjs
node --check prototype/app.js
node --check prototype/data.js
```

테스트에는 Node.js 18 이상이 필요합니다. 외부 패키지 설치 없이 실제 스크립트와 최소 DOM 스텁으로 계산, 입력, URL, 메모 유지와 복사 동작을 검사하는 회귀 테스트 27개를 실행합니다. `node --test tests/`는 서버 함수의 입력 제한, XML 파싱, 실패 시 대체 동작을 가짜 fetch로 검사하는 12개를 더해 39개를 실행합니다. 브라우저 화면 검증은 별도입니다.

승인된 Figma 디자인에 맞춰 결과를 먼저 보여 줍니다. 항목과 상세 버튼을 누르면 근거, 견적 원문, 비교 기준을 열 수 있습니다. 견적 금액을 바꾸면 결과가 다시 계산되고, 포워더에게 물어볼 문장을 고쳐서 복사할 수 있습니다.

## 범위와 근거

- 예시 견적 3종과 규칙 기반 진단이 동작합니다.
- AI 견적 읽기(`prototype/api/extract.js`)를 구현했습니다. 붙여넣은 견적 글, 이미지(PNG, JPG, WEBP), PDF를 OpenAI Responses API(기본 모델 `gpt-5-mini`, JSON 스키마 구조화 출력)로 보내 비용 이름, 분류, 금액, 통화, 단위, 포함 여부, 조건, 읽지 못한 칸을 받습니다. AI는 금액을 만들거나 합산하지 않으며, 합계와 비교는 기존 규칙(`app.js`)이 계산합니다. 읽지 못한 항목은 0으로 두고 확인 목록에 표시합니다.
- 공표운임 조회(`prototype/api/tariff.js`)를 구현했습니다. 해양수산부_화물운임공표정보(data.go.kr 15029607)의 `https://apis.data.go.kr/1192000/CychgFrghtOut4/Info4`를 `annGb=v2`, 선적항과 양하항 코드, 최근 1년 공표일로 호출하고 XML을 읽어 기준 보기 화면에 참고로 보여 줍니다. 호출에 실패하면 실패 사유를 화면에 적고, 부대요금 비교는 계속 예시값을 씁니다.
- 2026-10-30 Preview 배포(`feat/real-api`)에서 확인한 결과는 다음과 같습니다. AI 견적 읽기는 붙여넣은 견적 글 1건으로 실제 호출에 성공했습니다. 공표운임 API는 등록된 인증키로 호출했으나 공공데이터포털이 `등록되지 않은 서비스키`(코드 30)를 돌려주어 실제 공표운임은 받지 못했습니다. 15029607 활용신청 승인 여부를 확인해야 합니다. 이미지와 PDF 읽기는 Preview에서 실제로 시험하지 않았습니다.
- 두 함수 모두 키를 서버 환경변수에서만 읽으며, 입력 크기(글 20,000자, 파일 3MB)와 인스턴스별 IP 호출 횟수(읽기 1분 5회, 조회 1분 30회)를 제한합니다. 공표운임은 확인 항목 판단에 쓰지 않습니다. OCR 전용 처리와 데이터 자동 적재는 미구현입니다.
- KCCI는 2026-10-19 공식 발표값입니다. 견적, 환율과 요금 범위는 예시입니다.
- 견적은 40ft 1대이며, 별도 할증료는 O/F에 포함되지 않았다고 가정합니다. 실제 견적의 단위·적용 주차·포함 관계 확인은 남아 있습니다.
- [수정 근거와 검증 범위](docs/research/04-verification-evidence.md)
- [아이디어 기획서](docs/proposal/proposal.md)

2026-10-25 승인된 디자인을 [공개 서비스](https://unim-lens.vercel.app/?q=dupMissing)에 반영했습니다. 코드 커밋은 `fe3bf2b`입니다. [화면과 배포 검증 기록](docs/research/05-service-design-release.md)을 함께 남겼습니다.

Vercel 프로젝트 `unim-lens`는 GitHub의 `letstakeabreak/maritime-ax-2026`에 연결되어 있습니다. 운영 브랜치는 `main`, Root Directory는 `prototype`입니다. `main`에 push하면 운영 배포가 시작되고, 다른 브랜치는 Preview로 배포됩니다. 로컬에서만 수정한 내용은 배포되지 않습니다.

`OPENAI_API_KEY`와 `DATA_GO_KR_SERVICE_KEY`는 Vercel의 Production·Preview에 Secret으로 등록되어 있습니다. 두 키는 서버 함수에서만 사용합니다. 실제로 동작을 확인한 범위는 위 항목을 따릅니다.
