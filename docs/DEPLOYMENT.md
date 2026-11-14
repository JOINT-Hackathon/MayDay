# 메이데이 배포 가이드

화면과 Node API, Spring 백엔드를 한 Docker 컨테이너에서 실행합니다. 브라우저 기록과 로그인 후 PostgreSQL에 저장한 기록은 별도이며, 클라우드 DB는 로컬 파일 DB로 자동 대체하지 않습니다.

## 배포 전 확인

1. Node.js 22 이상에서 `npm ci && npm run build && node scripts/smoke.mjs`를 실행합니다.
2. 공개 서비스에는 HTTPS와 사용자 지정 도메인을 제공하는 호스팅 플랫폼을 사용합니다.
3. 환경 변수 `HOST=0.0.0.0`과 플랫폼이 지정한 `PORT`를 설정합니다. AI를 사용하지 않으면 `ANTHROPIC_API_KEY`는 비워 둡니다.
4. 실제 AI를 공개할 때만 서버 비밀 변수로 `ANTHROPIC_API_KEY`를 설정합니다. 키를 브라우저 코드, 저장소, 배포 로그에 넣지 않습니다.
5. `GET /api/health`의 200 응답과 `GET /api/status`의 키 설정 상태를 확인합니다.

## Docker 배포

### Render 무료 배포

2026-11-14 배포 완료: https://mayday-pzhh.onrender.com

- 서비스: `srv-dbrv27mi0phs73bl7fdg`, Singapore, Free ($0/month)
- 배포 브랜치: `codex/render-free-deploy`
- 통합 배포 커밋: `a667ab29829f284b4390fca661d61b3ec7958b30`
- 자동 배포: Off. 코드 변경 후 Render에서 수동 배포합니다.
- 통합 배포 전 검증: 테스트 17개·빌드·스모크 통과. H2와 PostgreSQL에서 로그인·사용자 격리·CRUD·재시작 후 보존 검증.
- Claude 키는 Render 환경 변수에만 저장합니다. Spring은 외부 공개 포트 없이 Node 뒤의 `127.0.0.1:8080`에서 실행합니다.
- DB 접근: 인터넷 인바운드 차단, Render 내부 주소로만 연결.
- 무료 PostgreSQL: `mayday-db`, 만료일 **2026-12-14**. 만료 전에 데이터를 내보내고 다른 DB로 이전해야 합니다. 자동 백업이 제공되지 않습니다.
- 로컬 작업 파일을 별도 복사본에서 배포했으므로 작업 폴더의 브랜치는 변경하지 않았습니다.

루트 `render.yaml`에 무료 Docker 웹 서비스 설정을 준비했습니다. Render에서 Web Service를 만들고 배포 브랜치를 선택한 뒤 Docker 런타임, Singapore 리전, **Free ($0/month)** 인스턴스, 헬스 체크 `/api/health`를 지정합니다. Dockerfile이 프런트엔드·Node API·Spring을 함께 빌드·실행합니다. 유료 디스크나 데이터베이스는 추가하지 않습니다.

무료 서비스는 15분 동안 요청이 없으면 중지되며 다음 접속 때 시작 대기 시간이 생깁니다. 서버 파일은 영구 저장소가 아닙니다. 로컬 `.env`는 업로드하지 않으며, Claude 호출 비용은 무료 호스팅과 별개입니다. `/api/health`는 화면과 Spring의 준비 상태를 함께 확인합니다. Java 또는 Node가 종료되면 나머지 프로세스도 종료해 플랫폼이 재시작하도록 합니다.

공식 안내: https://render.com/docs/free

### 로컬 Docker 실행

```bash
docker build -t mayday-mvp .
docker run --rm --env-file .env.cloud -p 4173:4173 mayday-mvp
```

이후 `http://127.0.0.1:4173`에서 수동 입력·저장을 확인합니다. Docker 호스팅에서는 이 저장소의 `Dockerfile`을 빌드 대상으로 지정하고 컨테이너 포트를 4173으로 연결합니다. 플랫폼이 `PORT`를 주입하면 서버와 헬스 체크는 그 값을 사용합니다.

## Node 배포

```bash
npm ci
npm run build
HOST=0.0.0.0 PORT=4173 npm start
```

빌드 명령은 `npm ci && npm run build`, 시작 명령은 `npm start`로 설정할 수 있습니다. 호스팅 플랫폼의 비밀 변수 저장소에 AI 키를 설정합니다. 정적 파일만 올리면 `/api/*`가 없으므로 AI 상태와 요청을 제공할 수 없습니다.

## 배포 직후 점검

### 클라우드 필수 환경 변수

- `MAYDAY_DB_URL`: `jdbc:postgresql://<internal-host>:5432/<database>`
- `MAYDAY_DB_USER`, `MAYDAY_DB_PASSWORD`: DB 연결 자격 증명
- `MAYDAY_DB_SCHEMA=schema-postgresql.sql`
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`: 서버 전용 AI 설정
- `AI_DAILY_LIMIT=100`: 프로세스당 일일 호출 시도 제한, 결제 금액 한도가 아님

Docker 기본 설정은 `COOKIE_SECURE=true`, `REQUIRE_BACKEND=true`입니다. 로컬 HTTP로 컨테이너를 검증할 때만 `COOKIE_SECURE=false`를 지정합니다. `.env.cloud`는 저장소에 올리지 않습니다. 기존 로컬 H2 DB는 이 배포 과정에서 복사하거나 변경하지 않습니다.

검증 명령은 `npm run check`, `npm run backend:build`, `npm run backend:check`입니다. 별도의 빈 PostgreSQL 테스트 DB에는 `TEST_DATABASE_URL`, `TEST_DATABASE_USER`, `TEST_DATABASE_PASSWORD`, `MAYDAY_DB_SCHEMA=schema-postgresql.sql`을 지정해 `npm run backend:check`를 실행합니다. 이 검사는 테스트 계정과 데이터를 만들므로 운영 DB에 실행하지 않습니다.

### 확인 항목

- 새 브라우저 저장 공간에서 두 유형을 각각 시작하고, 사실과 체크리스트만 입력해 저장합니다.
- 새로고침 후 업무 종류별로 체크리스트를 찾고 적용 표시·결과 저장·삭제를 확인합니다.
- 키 없이 AI 사용 불가 안내와 수동 저장을 확인합니다. 키가 있다면 가상 문장으로 실제 응답을 검토합니다.
- 모바일 화면과 키보드 조작, 필수 입력 오류, 빈 기록, 팝업의 Escape 닫기와 초점 복귀를 확인합니다.
- 누락된 정적 파일이 404를 반환하고 `/api/health`가 200을 반환하는지 확인합니다.

## 운영 한계

AI 요청 제한은 현재 프로세스 메모리에 저장됩니다. 재시작하거나 여러 인스턴스를 사용하면 제한이 초기화·분산됩니다. 공개 AI 트래픽이 늘기 전에는 지속성 있는 사용량 제한, 비용 알림, 접근 제어를 추가해야 합니다. 브라우저 기록에는 백업이 없으므로 기기나 저장 공간을 바꾸면 기록을 복구할 수 없습니다. 실제 회사·고객 정보를 입력하지 않도록 화면에서 안내합니다.
