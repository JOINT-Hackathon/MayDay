# TEAM5 백엔드 연동과 영구 저장

2026-11-14 기준. 원본: https://github.com/JOINT-Hackathon/TEAM5_BE 의 `cd1189e0c174993a7159d23e4e40d032bb726a68`.
프로젝트 `backend/`에 원본 소스를 보관하고 API를 확장했습니다. GitHub 원격 백엔드에는 아직 반영하지 않았습니다.

## 실행

Java 21, Node.js 22 이상이 필요합니다.

```bash
npm run backend:build
npm run backend:start
```

다른 터미널에서 프론트를 실행합니다.

```bash
PORT=5180 npm run dev
```

http://127.0.0.1:5180 하단 **서버 기록 → 새 계정 만들기**로 시작합니다. 아이디는 영문·숫자·밑줄 3~40자, 비밀번호는 10~128자입니다. 기존 분석 결과의 **이 경험을 서버에 저장하기**로 원문과 정리 내용·초안을 가져올 수도 있습니다. 전송은 저장 버튼을 누를 때 이루어집니다.

`TEAM5_BACKEND_URL` 기본값은 `http://127.0.0.1:8080`입니다. GitHub 주소나 `/api` 경로를 넣지 않습니다. 백엔드 자체 포트는 `BACKEND_PORT`로 설정합니다.

## 재시작 후 데이터 보존

- 실행 스크립트가 프로젝트의 절대 경로 `data/mayday`를 DB 경로로 지정합니다. 실행 위치가 달라져도 같은 DB를 엽니다.
- 실제 DB 파일은 `data/mayday.mv.db`입니다. 계정·세션·경험·상세 내용·체크리스트·규칙을 저장합니다.
- H2 파일 DB + `ddl-auto: validate` + 삭제 없는 `CREATE TABLE IF NOT EXISTS` 초기 스키마를 사용합니다. 시작할 때 테이블을 지우거나 데이터를 초기화하지 않습니다.
- `data/`, 빌드 결과, `.env`는 Git과 Docker 빌드 컨텍스트에서 제외합니다. 실행 스크립트는 데이터 폴더 권한을 소유자 전용으로 설정합니다.
- 서버를 중지·재시작해도 데이터는 유지됩니다. **data 폴더 삭제, 디스크 장애, 저장 장치가 초기화되는 배포는 별개입니다.** 배포 시 영구 볼륨에 같은 DB 경로를 연결해야 합니다.
- 파일 DB는 단일 백엔드 프로세스용입니다. 여러 서버 인스턴스가 필요하면 외부 DB와 스키마 마이그레이션을 도입합니다.
- 백업은 백엔드를 정상 종료한 상태에서 `data/`를 다른 안전한 저장소로 복사합니다. 실행 중인 DB 파일을 단순 복사하지 않습니다. 자동 백업 서비스는 추가하지 않았습니다.
- 기존 메모리 서버는 전환 직전 최근 목록이 비어 있음을 확인했습니다. 조회 결과는 `data/backups/`에 보관했습니다. 브라우저 localStorage 기록은 수정하거나 삭제하지 않았습니다.

## 구현 기능

| 기능 | 경로 | 화면 |
| --- | --- | --- |
| 회원가입·로그인·로그아웃·세션 확인 | POST auth/register, auth/login, auth/logout; GET auth/me | 로그인/회원가입, 로그아웃 |
| 경험 저장·전체 목록·상세·수정·삭제 | POST/GET experiences; GET/PUT/DELETE experiences/{id} | 전체 목록 20개씩, 원문 편집, 삭제 확인 |
| 최근 기록 | GET experiences/recent | 기존 API 유지 |
| 상세 내용 저장 | experiences의 details | 감정·원인·행동·적용 결과·완료 표시·보고서·메일 초안 |
| 체크리스트 생성·조회·내용 수정·삭제 | POST/GET experiences/{id}/checklist; PUT/DELETE checklist/{id} | 항목 입력·편집·삭제 |
| 체크 상태·순서 | PATCH checklist/{id}/status; PUT experiences/{id}/checklist/order | 4단계 상태, 위/아래 이동 |
| 규칙 생성·조회·수정·삭제 | POST/GET experiences/{id}/preventions; GET preventions?category=...; PUT/DELETE preventions/{id} | 예방 행동·분류·확인 시점 편집 |
| 업무별 추천 | POST recommendations | 로그인한 사용자의 같은 분류 최신 규칙 |
| AI 분석 | 기존 Node POST /api/organize 재사용 | 전송 동의 후 Claude 초안 불러오기 |

표의 Spring 경로 앞에는 `/api/`가 붙습니다. 브라우저는 Node의 `/api/team5/` 프록시로 호출합니다. AI 코드는 기존 `server/claude.mjs`, `server/reflection.mjs`를 사용하며 Java에 중복 구현하지 않았습니다.

## 계정과 접근 제어

- 비밀번호는 무작위 salt와 PBKDF2-HMAC-SHA256 600,000회 해시로 저장합니다. 비밀번호 원문을 저장하거나 로그에 출력하지 않습니다.
- 256비트 무작위 세션 토큰의 SHA-256 해시만 DB에 저장합니다. 브라우저 쿠키는 HttpOnly, SameSite=Strict이며 7일 후 만료됩니다. 로그아웃하면 서버 세션을 삭제합니다.
- 경험·체크리스트·규칙·추천 모든 조회/변경에 로그인 사용자의 소유권을 확인합니다. 다른 계정 소유의 ID는 404를 반환합니다.
- 계정마다 서버 기록이 분리됩니다. 기존 ‘내 기록’과 헤더 체크리스트는 계속 브라우저 저장 기능이며 자동 동기화하지 않습니다.
- 로그인/가입은 백엔드 접속 주소별 5분당 30회로 제한합니다. 단일 Node 프록시 뒤에서는 사용자가 이 한도를 공유하므로 대규모 운영 전 신뢰할 프록시와 사용자별 제한 정책을 조정해야 합니다.
- HTTPS 배포에서는 `COOKIE_SECURE=true`가 필요합니다. 로컬 HTTP 확인은 기본 false입니다. backend는 기본 loopback에만 바인딩합니다.

## 검증

```bash
npm run check
npm run backend:build
npm run backend:check
```

`backend:check`는 기본적으로 별도의 임시 파일 DB와 임의 포트로 서버를 띄워 검증합니다. `TEST_DATABASE_URL`을 지정하는 경우 반드시 별도의 테스트 DB만 사용해야 합니다. 검증 과정에서 테스트 계정과 기록을 생성·삭제합니다.

확인 항목:

- 프론트/Node 테스트 15개, 빌드, HTTP smoke 통과.
- Java 컴파일, Spring 컨텍스트 테스트, 실행 JAR 생성 통과.
- 실제 HTTP 회원가입·로그인·잘못된 비밀번호·중복 아이디·로그아웃, 미인증 차단.
- 두 계정 간 경험·체크리스트·규칙 읽기/변경/삭제/정렬/추천 접근 격리.
- 빈 입력·길이·유형·체크 상태 검증, 22개 경험의 페이지 나눔.
- 경험·항목·규칙 편집/삭제, 순서 변경, 경험 삭제 시 자식 데이터 함께 삭제.
- **실제 Java와 Node 프로세스를 종료한 뒤 같은 파일 DB로 재시작:** 계정, 로그인 세션, 원문, 상세 JSON, 보고서·메일 초안, 체크리스트 순서/내용/완료 상태, 규칙 보존.

## 남은 범위

비밀번호 찾기·이메일 인증·자동 백업·다중 서버 배포는 구현하지 않았습니다. 추천은 분류 기반이며 의미 검색 모델은 아닙니다. AI는 환경의 Claude 키·결제·모델 접근 상태에 의존합니다. 운영 데이터의 동시 편집은 마지막 저장이 반영되는 방식입니다.

### 이번 변경의 추가 확인

- Chrome에서 가상 계정 가입, 계정별 빈 목록, 경험 저장·재조회, 체크리스트 생성·완료 상태 저장, 로그아웃을 확인했습니다. 첫 진입 시 seed가 null인 경우의 초기화 오류를 수정했습니다.
- 화면 캡처: `artifacts/server-records-verified.jpg`. 가상 QA 계정의 테스트 기록만 표시합니다.
- 현재 로컬 `/api/organize`에 가상 문장 1건을 전송해 HTTP 200, Anthropic `claude-sonnet-5-5` 응답과 7개 정리 필드를 확인했습니다. 결과: `artifacts/team5-ai-live.json`. 응답 성공이 사실성이나 실제 업무 성과를 보장하지는 않습니다.
- 모바일 시각 검증과 원격 TEAM5_BE 저장소 반영은 이번 작업에서 수행하지 않았습니다.
