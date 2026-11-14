# TEAM5 백엔드 연동

확인일: 2026-11-14. 저장소: https://github.com/JOINT-Hackathon/TEAM5_BE
기준 커밋: `cd1189e0c174993a7159d23e4e40d032bb726a68`.

## 실행

Java 21과 Node.js 22 이상이 필요합니다. 백엔드는 프론트와 별도 프로세스입니다.

터미널 1 — 별도 경로에서 백엔드 실행:

```bash
git clone https://github.com/JOINT-Hackathon/TEAM5_BE.git /tmp/mayday-team5-be
cd /tmp/mayday-team5-be
bash gradlew bootRun --args='--server.port=8080 --server.address=127.0.0.1'
```

폴더가 이미 있다면 clone을 생략하고 checkout의 커밋을 확인합니다. 이번 검증 소스는 `/private/tmp/mayday-team5-be`에 있습니다. 원격 백엔드 소스는 수정하지 않았습니다.

터미널 2 — 프론트 프로젝트에서:

```bash
PORT=5180 npm run dev
```

http://127.0.0.1:5180 하단 **서버 기록**을 누릅니다. 분석 결과의 **이 경험을 서버에 저장하기**는 경험 본문·분류와 체크리스트 초안을 가져옵니다. 실제 전송은 서버 기록 화면의 저장 버튼을 누를 때 이루어집니다.

백엔드 주소가 다르면 `.env`의 `TEAM5_BACKEND_URL`을 변경하고 프론트 서버를 재시작합니다. 기본값은 `http://127.0.0.1:8080`이며 `/api` 경로를 붙이지 않습니다. GitHub 저장소 주소는 실행 서버 주소가 아닙니다.

## 구현된 API

브라우저는 같은 출처의 `/api/team5/*`로 요청하고 Node 서버가 Spring `/api/*`로 전달합니다. 개발·배포 서버 모두 같은 프록시를 사용합니다.

| API | 화면 동작 | 실제 검증 |
| --- | --- | --- |
| POST /api/experiences | 경험 본문·유형·분류 저장 | 201 |
| GET /api/experiences/recent | 최근 3건 조회·선택 | 200 |
| POST /api/experiences/{id}/checklist | 확인 항목 생성 | 201 |
| GET /api/experiences/{id}/checklist | 확인 항목 조회 | 200 |
| PATCH /api/checklist/{itemId}/status | 시작 전·진행 중·완료·해당 없음 | 4가지 모두 200 |
| POST /api/experiences/{id}/preventions | 규칙·분류·확인 시점 저장 | 201 |
| GET /api/experiences/{id}/preventions | 기록별 규칙 조회 | 200 |
| GET /api/preventions?category=... | 업무 분류별 규칙 조회 | 200 |
| POST /api/recommendations | 같은 분류의 최신 규칙 최대 3개 | 200 |

분류는 기존 프론트의 `문서·자료`, `회의·소통`, `일정·마감`, `기타`를 저장·검색·추천에 동일하게 사용합니다. 백엔드는 enum 없이 문자열을 받습니다. 다른 클라이언트가 영어 코드로 저장한 규칙은 같은 문자열로 조회해야 하므로 팀 간 분류값 합의가 필요합니다.

## 안 되는 기능과 이유

- 경험 전체 목록·상세 조회·수정·삭제: API 없음. 최근 목록 제목은 20자까지만 제공하므로 원문 복원 불가.
- 오래된 경험: 번호를 알면 체크리스트·규칙 조회 가능. 없는 경험 번호도 빈 배열을 반환하므로 빈 결과만으로 존재 여부 판단 불가.
- 체크리스트 내용 수정·삭제·재정렬, 규칙 수정·삭제: API 없음. 기존 로컬 체크리스트 편집은 서버에 반영되지 않음.
- 감정·원인·보고서·메일 초안·업무 적용 이력 서버 저장: 대응 필드/API 없음. 기존 브라우저 저장 기능 유지.
- AI 분석: TEAM5 저장소에 AI API 없음. 기존 Claude 경로는 독립적이며 키가 없어 실제 호출 미검증.
- 추천: 업무 문장 의미 분석 없음. 같은 분류의 최신 규칙만 조회.
- 로그인·개인별 기록·권한·자동 동기화: 없음. 같은 서버의 사용자가 기록을 함께 조회함.
- 영구 저장: 기본 `jdbc:h2:mem:mayday`, `ddl-auto: create`이므로 재시작 시 초기화. 운영 전 영구 DB와 스키마 관리 필요.
- 일부 잘못된 경험 입력은 백엔드에서 400 대신 500을 반환할 수 있음. 프론트 필수값·길이 검사와 프록시 오류 안내를 추가했지만 백엔드 자체 예외 처리 개선은 별도 작업.

## 테스트

```bash
npm run check
# 프론트 5180 + 격리된 로컬 백엔드 8080 실행 후:
npm run backend:check
```

- 테스트 15개, 프로덕션 빌드, HTTP smoke 통과.
- 실제 Spring 서버의 9개 API와 4가지 체크 상태 변경 통과. 가상 데이터를 생성하며 삭제 API가 없어 테스트 DB 재시작 전까지 남음. 운영 DB에서 실행하지 않음.
- 프록시 테스트: 경로·본문 전달, 외부 Origin 차단, 잘못된 메서드·Content-Type·큰 본문 거절, 백엔드 실패·잘못된 JSON·연결 끊김 처리.
- 브라우저 클릭·모바일 시각 검증은 도구의 `native pipe closed before response` 오류로 미완료. 반응형 CSS 추가가 실제 화면 검증을 대신하지 않음.

## 변경 파일

- `server/team5.mjs`, `server.mjs`: 제한된 API 프록시와 오류 처리
- `src/team5Api.js`, `src/components/ServerWorkspace.jsx`, `src/components/ServerWorkspace.css`, `src/App.jsx`: 호출 모듈·서버 기능 화면·기존 분석 결과 연결
- `.env.example`, `package.json`, `scripts/team5.test.mjs`, `scripts/check-team5.mjs`: 설정·검증
- README, 데이터 안내, 이 문서

외부 의존성 추가, 원격 저장소 수정, 커밋·배포는 하지 않았습니다.
