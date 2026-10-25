# 승인한 디자인의 서비스 적용

2026-10-25 작업 기록. 예시 데이터의 소프트웨어 동작을 확인한 기록이며, 실제 견적의 정확도나 비용 절감 성과를 검증한 결과는 아니다.

## 적용 기준

[운임렌즈 Figma 비교 페이지](https://www.figma.com/design/VgmYlLv6J35ZiP2Zvbe1DB?node-id=15-2)의 승인된 Desktop `15:200`, Mobile `15:476`과 상세 화면 `16:189`를 기준으로 구현했다. 기존 원본과 Before 프레임은 그대로 보존했다.

첫 화면은 확인할 내용과 견적 요약을 보여 준다. 항목별 근거, 견적 금액, 비교 기준, 지원사업, 보낼 질문은 버튼을 눌러 연다. 모바일은 목록의 부연 설명을 접고, 하단에서 예시 견적을 바꿀 수 있다. 이전에 보이던 예시 AI 분류 신뢰도는 제거했다.

문구는 승인된 윤문을 적용했다. 이름이 비슷한 수수료를 중복 청구라고 단정하지 않고, 항로와 신고 종류가 다를 때는 경유지와 신고 조건을 물어보도록 했다. AI 미연결과 예시 요금 범위는 화면에 명시했다.

## 계산과 입력

O/F와 BAF, CAF, LSS, EBS를 더해 KCCI와 비교하며 현지 부대요금은 제외한다. 전체 합계에는 모든 항목을 원화로 환산해 넣는다. 데이터 출처와 비교 범위는 [앞선 검증 기록](04-verification-evidence.md)에 남겼다.

| 예시 | 확인할 질문 | KCCI 비교 금액 | 합계 |
|---|---:|---:|---:|
| A | 0개 | $7,600 | 11,350,800원 |
| B | 1개 | $4,720 | 6,864,500원 |
| C | 5개 | $3,550 | 5,417,300원 |

C의 유효기간 누락은 질문 수에 포함하지 않고 견적 원문과 질문 미리보기에서 안내한다. 금액을 바꾸면 결과와 기본 질문이 다시 계산된다. 직접 편집한 질문은 덮어쓰지 않으며, 사용자가 '현재 견적으로 다시 쓰기'를 눌러 갱신할 수 있다. 예시를 바꾸면 해당 예시의 원래 금액과 질문으로 돌아간다.

## 확인한 범위

- `node --test tests/prototype.test.cjs`: 기존 14개를 포함한 27개 통과. 실제 스크립트를 최소 DOM 스텁에서 실행해 계산, URL 샘플 키, 금액 보정, 질문 동기화와 사용자 편집 보존, 클립보드 성공과 실패 처리를 확인했다.
- `node --check prototype/app.js`, `node --check prototype/data.js`, `git diff --check` 통과.
- 실제 로컬 브라우저의 1440px 데스크톱과 390px 모바일을 Figma와 비교했다. 320px, 390px, 960px, 1440px에서 가로 넘침이 없었고, 960px의 긴 결과 제목과 안내문이 겹치지 않았다.
- A/B/C 전환, C의 THC를 260,000원에서 205,000원으로 바꿨을 때 질문 5→4개와 합계 5,417,300→5,362,300원 반영, 질문 편집 후 실제 클립보드 복사, 상세 근거와 지원사업 열기를 확인했다.
- Enter로 상세 창을 열고 Escape로 닫았을 때 원래 버튼으로 포커스가 돌아왔다. 모바일 견적 편집 창 내부에도 가로 넘침이 없었다. 브라우저에서 수집된 warning/error 로그는 0건이었다.
- [A](../proposal/img/screen-a.png), [B](../proposal/img/screen-b.png), [C](../proposal/img/screen-c.png)는 최종 로컬 구현의 실제 화면 캡처다. 이전 캡처 때 사용한 임시 애니메이션 제거 없이 원본 앱을 촬영했다.

실기기별 키보드와 모든 브라우저의 호환성, 실제 견적서 추출, 공표운임 API와 LLM 연동은 이 검증에 포함하지 않았다.


## 배포 확인

- 코드 커밋: `fe3bf2bc1ef885f57332c80ff9c704166531c536`, GitHub `main`에 반영했다.
- Vercel 프로젝트: `unim-lens`, Root Directory `prototype`, 팀 `miros-projects-2a08ca58`.
- 배포 ID: `dpl_6LTcb6gn85cTbHYnCZwS7P29LnMz`, 상태 READY.
- 저장소 루트에서 CLI로 배포했다. 인증된 경로로 HTML, CSS, JS 2개와 SVG 3개의 바이트 수 및 SHA-256이 검증한 로컬 파일과 같음을 확인한 뒤, MCP로 프로덕션에 한 번 승격했다. 보호 설정을 바꾸거나 새 bypass 토큰을 만들지 않았다.
- [공개 서비스](https://unim-lens.vercel.app/?q=dupMissing)의 도메인이 새 배포를 가리키며, 비로그인 GET 200과 HTML 일치를 확인했다.
- 공개 브라우저에서 A/B/C의 질문 수와 금액, 390px 모바일의 가로 넘침 여부, C의 THC 수정에 따른 질문 5→4개 및 합계 변경, 질문 복사를 재확인했다. 새로고침하면 예시 원본으로 돌아오는 것도 확인했다.
- 공개 서비스의 실제 화면: [데스크톱](evidence/service-desktop-2026-10-25.png), [모바일](evidence/service-mobile-2026-10-25.png).

AI, 파일 업로드, 실시간 데이터 연동은 이번 디자인 적용으로 추가되지 않았다. 화면에서 이 범위를 분명히 알린다.

## Git 연결 확인과 이전 설명 정정

2026-10-25 후속 확인에서 `unim-lens`의 Git 연결은 `letstakeabreak/maritime-ax-2026`, 운영 브랜치는 `main`, Root Directory는 `prototype`으로 확인했다. 빌드를 건너뛰는 명령과 저장소의 배포 비활성 설정은 없다.

앞선 기록은 `gitProviderOptions.createDeployments: disabled`를 자동 배포 비활성화로 잘못 해석했다. 이 값은 GitHub Deployment와 `deployment_status` 이벤트의 생성 여부이며, Git push에 따른 Vercel 배포를 막는 옵션이 아니다. [Vercel 공식 설명](https://github.com/vercel/terraform-provider-vercel/blob/main/docs/resources/project.md#nestedatt--git_provider_options)에 따라 정정하며, 관련 이벤트 설정은 변경하지 않았다.

두 API 키의 이름, Secret 타입, Production·Preview 대상만 확인했다. 키 값 조회·다운로드와 실제 API 호출은 이 연결 확인에 포함하지 않았다.
