# 메이데이 배포 가이드

이 구성은 화면과 같은 출처의 Node API를 한 프로세스에서 제공합니다. 기록은 각 사용자의 브라우저에만 저장됩니다. 계정, 기기 간 동기화, 서버 백업은 없습니다.

## 배포 전 확인

1. Node.js 22 이상에서 `npm ci && npm run build && node scripts/smoke.mjs`를 실행합니다.
2. 공개 서비스에는 HTTPS와 사용자 지정 도메인을 제공하는 호스팅 플랫폼을 사용합니다.
3. 환경 변수 `HOST=0.0.0.0`과 플랫폼이 지정한 `PORT`를 설정합니다. AI를 사용하지 않으면 `ANTHROPIC_API_KEY`는 비워 둡니다.
4. 실제 AI를 공개할 때만 서버 비밀 변수로 `ANTHROPIC_API_KEY`를 설정합니다. 키를 브라우저 코드, 저장소, 배포 로그에 넣지 않습니다.
5. `GET /api/health`의 200 응답과 `GET /api/status`의 키 설정 상태를 확인합니다.

## Docker 배포

### Render 무료 배포

루트 `render.yaml`에 무료 Docker 웹 서비스 설정을 준비했습니다. Render에서 Web Service를 만들고 배포 브랜치를 선택한 뒤 Docker 런타임, Singapore 리전, **Free ($0/month)** 인스턴스, 헬스 체크 `/api/health`를 지정합니다. 기존 Dockerfile이 프런트엔드와 Node API를 함께 빌드·실행합니다. 유료 디스크나 데이터베이스는 추가하지 않습니다.

무료 서비스는 15분 동안 요청이 없으면 중지되며 다음 접속 때 시작 대기 시간이 생깁니다. 서버 파일은 영구 저장소가 아닙니다. 로컬 `.env`는 업로드하지 않으며, Claude 호출 비용은 무료 호스팅과 별개입니다. TEAM5 Spring 서버는 이 Node 이미지에 포함되지 않습니다.

공식 안내: https://render.com/docs/free

### 로컬 Docker 실행

```bash
docker build -t mayday-mvp .
docker run --rm -p 4173:4173 mayday-mvp
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

### Google Cloud Run

프로젝트에 활성 결제 계정이 연결되어 있어야 합니다. `.gcloudignore`는 Docker 빌드에 필요한 파일만 업로드하며 로컬 `.env`는 제외합니다.

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project=project-b032d384-ee0f-492e-b5c
gcloud run deploy mayday --source=. --project=project-b032d384-ee0f-492e-b5c --region=asia-northeast3 --allow-unauthenticated --port=4173 --memory=512Mi --cpu=1 --min-instances=0 --max-instances=1 --set-env-vars=HOST=0.0.0.0,NODE_ENV=production --quiet
```

출력된 서비스 URL의 `/api/health`와 `/api/status`를 확인합니다. 최소 인스턴스 0은 유휴 비용을 줄이지만 무료를 보장하지 않으며 빌드·이미지 저장·요청 사용량에 따라 비용이 발생할 수 있습니다.

Claude 키는 Secret Manager에 보관하고 Cloud Run의 비밀 참조로 연결합니다. 로컬 키는 자동으로 업로드되지 않습니다. TEAM5 서버는 별도로 배포한 후 `TEAM5_BACKEND_URL`을 해당 서버의 origin으로 설정해야 합니다. Cloud Run의 `127.0.0.1:8080`은 개발자 컴퓨터의 Spring 서버에 연결되지 않습니다.

### 확인 항목

- 새 브라우저 저장 공간에서 두 유형을 각각 시작하고, 사실과 체크리스트만 입력해 저장합니다.
- 새로고침 후 업무 종류별로 체크리스트를 찾고 적용 표시·결과 저장·삭제를 확인합니다.
- 키 없이 AI 사용 불가 안내와 수동 저장을 확인합니다. 키가 있다면 가상 문장으로 실제 응답을 검토합니다.
- 모바일 화면과 키보드 조작, 필수 입력 오류, 빈 기록, 팝업의 Escape 닫기와 초점 복귀를 확인합니다.
- 누락된 정적 파일이 404를 반환하고 `/api/health`가 200을 반환하는지 확인합니다.

## 운영 한계

AI 요청 제한은 현재 프로세스 메모리에 저장됩니다. 재시작하거나 여러 인스턴스를 사용하면 제한이 초기화·분산됩니다. 공개 AI 트래픽이 늘기 전에는 지속성 있는 사용량 제한, 비용 알림, 접근 제어를 추가해야 합니다. 브라우저 기록에는 백업이 없으므로 기기나 저장 공간을 바꾸면 기록을 복구할 수 없습니다. 실제 회사·고객 정보를 입력하지 않도록 화면에서 안내합니다.
