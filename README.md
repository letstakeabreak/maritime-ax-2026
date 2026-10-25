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

테스트에는 Node.js 18 이상이 필요합니다. 외부 패키지 설치 없이 실제 스크립트와 최소 DOM 스텁으로 계산, 입력, URL, 메모 유지와 복사 동작을 검사하는 회귀 테스트 27개를 실행합니다. 브라우저 화면 검증은 별도입니다.

승인된 Figma 디자인에 맞춰 결과를 먼저 보여 줍니다. 항목과 상세 버튼을 누르면 근거, 견적 원문, 비교 기준을 열 수 있습니다. 견적 금액을 바꾸면 결과가 다시 계산되고, 포워더에게 물어볼 문장을 고쳐서 복사할 수 있습니다.

## 범위와 근거

- 예시 견적 3종과 규칙 기반 진단이 동작합니다. 파일 업로드, OCR, LLM, 데이터 자동 적재는 미구현입니다.
- KCCI는 2026-10-19 공식 발표값입니다. 견적, 환율과 요금 범위는 예시입니다.
- 견적은 40ft 1대이며, 별도 할증료는 O/F에 포함되지 않았다고 가정합니다. 실제 견적의 단위·적용 주차·포함 관계 확인은 남아 있습니다.
- [수정 근거와 검증 범위](docs/research/04-verification-evidence.md)
- [아이디어 기획서](docs/proposal/proposal.md)

2026-10-25 승인된 디자인을 [공개 서비스](https://unim-lens.vercel.app/?q=dupMissing)에 반영했습니다. 코드 커밋은 `fe3bf2b`입니다. [화면과 배포 검증 기록](docs/research/05-service-design-release.md)을 함께 남겼습니다.

Vercel 프로젝트의 Root Directory는 `prototype`이며 Git 자동 배포는 비활성 상태입니다. 이후 로컬 변경이나 Git push만으로 공개 사이트가 갱신되지는 않습니다.
