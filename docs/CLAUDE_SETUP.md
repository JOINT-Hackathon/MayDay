# Claude 연결과 모델 선택 가이드

기준일: 2026-11-14. 현재 기본 모델은 `claude-sonnet-5-5`다. 코드와 모의 응답 검증을 마쳤지만, 실제 API 키를 넣은 호출과 한국어 결과의 사실성 검토는 아직 남아 있다.

## 1. 처음 한 번 설정하기

1. [Claude Console의 API keys](https://platform.claude.com/settings/keys)에서 키를 만든다. 로컬 개발에는 개인 키를, 팀이 계속 운영할 서비스에는 서비스 계정 키를 사용한다. 가능하면 사용할 workspace를 지정해 발급하고, 발표 당일 이전에 만료되지 않는지 확인한다. [공식 발급 안내](https://platform.claude.com/docs/en/get-api-key)
2. 프로젝트 루트에 이미 만들어 둔 `.env`를 편집한다. 이 파일을 다시 복사해 덮어쓸 필요는 없다.

```dotenv
ANTHROPIC_API_KEY=여기에_발급받은_실제_키를_입력
ANTHROPIC_MODEL=claude-sonnet-5-5
ANTHROPIC_WORKSPACE_ID=
AI_DAILY_LIMIT=100
```

위 예시의 한글은 실제 키가 아니다. 실제 키는 채팅, 발표 화면, 커밋, `VITE_` 환경변수에 넣지 않는다. `.env`는 Git과 Docker 빌드에서 제외되며 현재 파일 권한은 소유자 읽기·쓰기만 허용한다.

특정 workspace를 지정하지 않고 발급한 키라면 `ANTHROPIC_WORKSPACE_ID`에 Console의 workspace ID를 입력한다. workspace 지정 키는 비워 두어도 된다. 서버는 Bearer 인증과 필요한 경우 `anthropic-workspace-id` 헤더를 보낸다. [공식 인증 문서](https://platform.claude.com/docs/en/manage-claude/authentication)

3. Console에서 해당 workspace의 결제 상태·사용 가능 잔액·지출 한도를 확인한다. 웹 채팅 이용권만으로 현재 API 호출 권한과 잔액을 확인했다고 생각하지 않는다.
4. 실행 중인 메이데이 서버를 `Ctrl+C`로 종료한 뒤 다시 시작한다. `.env`는 시작할 때 읽는다. 브라우저 새로고침만으로 서버의 키가 바뀌지는 않는다.

```bash
npm ci
npm run check
npm run ai:check
npm run demo
```

- 이미 의존성을 설치했다면 `npm ci`는 생략할 수 있다.
- `npm run ai:check`는 가상 상황 3건을 실제 Claude에 전송한다. 호출 비용이 발생하며 첫 실패에서 중단한다. 서버를 켤 필요는 없다.
- 응답의 모델·소요 시간·토큰 수를 출력하고 `artifacts/claude-check-날짜.json`에 가상 문장과 결과를 저장한다. 키는 출력하거나 보고서에 넣지 않는다.
- `npm run demo`는 프로덕션 빌드 후 기본 `http://127.0.0.1:4173`에서 실행한다. 사용 중인 포트라면 해당 서버를 확인하거나 `PORT=4175 npm run demo`처럼 다른 포트를 사용한다. 주소가 바뀌면 브라우저 로컬 기록도 별도로 보인다.
- 개발 중에는 `npm run dev`, 파일 수정 없이 이미 빌드한 화면만 띄울 때는 `npm start`를 사용한다.

## 2. 어떤 모델이 적합한가

아래는 공식 문서의 표준 Claude API 가격이다. 100만 토큰당 USD이며 캐시·배치·세금·환율은 포함하지 않는다. Haiku 가격은 10만 토큰 이하 입력 기준이다. [모델 목록](https://platform.claude.com/docs/en/models/overview), [공식 가격](https://platform.claude.com/docs/en/about-claude/pricing)

| 모델 | API ID | 입력 / 출력 | 이 프로젝트에서의 선택 |
| --- | --- | --- | --- |
| **Sonnet 5.5** | `claude-sonnet-5-5` | **$2 / $10** | 발표 기본값. 속도와 문장 정리 품질의 균형을 우선하는 선택 |
| Haiku 5.5 | `claude-haiku-5-5` | $0.10 / $0.50 | 비용을 줄이는 비교 후보. 같은 샘플에서 사실·해석 구분을 확인한 뒤 채택 |
| Opus 5.5 | `claude-opus-5-5` | $4 / $20 | 복잡한 사례에서 Sonnet이 부족한 경우 비교. 짧은 입력 MVP에서는 우선순위가 낮음 |

Sonnet 추천은 서비스 특성에 따른 구현 판단이며 실제 세 모델의 비교 실험 결과가 아니다. 발표 직전에 모델을 바꾸지 말고 같은 가상 문장으로 평가한 모델을 유지한다. Opus·Haiku로 바꿀 때도 `npm run ai:check`를 다시 실행해야 한다.

### 예상 비용 계산

한 번에 입력 2,000토큰·출력 800토큰을 사용한다고 **가정**하면:

| 모델 | 1건 | 100건 | 1,000건 |
| --- | ---: | ---: | ---: |
| Sonnet 5.5 | $0.012 | $1.20 | $12.00 |
| Haiku 5.5 | $0.0006 | $0.06 | $0.60 |
| Opus 5.5 | $0.024 | $2.40 | $24.00 |

계산식은 `(입력 토큰 × 입력 단가 + 출력 토큰 × 출력 단가) / 1,000,000`이다. 실제 입력에는 시스템 지시와 JSON 형식 안내가 포함된다. 출력량과 모델의 thinking에 따라 비용은 달라진다. 위 표는 결제 상한이 아니다. 실측은 `ai:check`의 토큰 수와 Console의 사용량을 함께 확인한다.

`AI_DAILY_LIMIT=100`은 이 Node 프로세스가 시도하는 AI 요청 횟수 제한이다. 실패한 호출도 횟수에 포함하고 UTC 날짜가 바뀌면 초기화한다. 서버 재시작·다중 인스턴스에서는 공유되지 않으며, 별도 프로세스인 `ai:check`에도 적용되지 않는다. **금액 제한은 Console에서도 설정한다.**

## 3. 현재 구현한 호출 방식

`화면 동의 → 같은 출처의 /api/organize → Node 서버 → Claude → 형식 검사 → 사용자가 검토·수정 → 저장`

- 서버 API는 `consent: true`를 요구한다. 키는 서버에만 있다.
- Messages API와 `output_config.format`의 JSON Schema를 사용한다. 사실, 해석, 감정, 미확인 사항, 개선 행동, 후속 보고, 체크리스트 7개 문자열을 받는다.
- 잘못된 JSON·필드 누락·추가 필드·타입 오류, 응답 거절, 출력 잘림은 성공으로 취급하지 않는다. JSON 형식 보장은 내용의 사실성 보장과 다르다. [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- API 버전은 `2026-10-21`이다. 이 버전에서 지원하지 않는 `temperature` 등을 보내지 않는다. [API 버전](https://platform.claude.com/docs/en/api/versioning)
- 기본 Sonnet은 도구 없는 짧은 정리에 맞춰 `thinking: {type: "between_tools"}`, `output_config.effort: "low"`, 출력 최대 1,600토큰을 사용한다. 첫 JSON 스키마 요청은 추가 지연이 있을 수 있으므로 발표 전에 예열한다. [Sonnet 5.5 변경 사항](https://platform.claude.com/docs/en/models/sonnet-5-5/whats-new-sonnet-5-5)
- 서버는 45초, 화면은 50초 제한을 둔다. 자동 재시도는 없으며 사용자가 재시도하거나 기본 정리로 전환한다. 화면에서 전환해도 이미 서버에 전달된 요청은 최대 45초까지 처리될 수 있고 과금이 발생할 수 있다.
- `/api/status`는 키 설정 여부만 알려준다. `verified: false`는 이 경로가 실호출 검사를 하지 않는다는 뜻이다. 실제 성공 확인은 `ai:check` 또는 가상 문장을 통한 화면 호출로 한다.
- `/api/chat-turn`도 Claude를 사용하지만 현재 홈 발표 흐름은 한 번의 입력과 결과 정리다.
- 보고서·메일은 정리된 필드에서 앱이 조합하는 편집 가능한 초안이다. 별도 Claude 메일 생성 호출이나 자동 메일 발송은 없다.

## 4. 연결 후 결과를 검토하는 기준

| 가상 상황 | 반드시 확인할 것 |
| --- | --- |
| v1을 발송했고 v2가 최신임을 확인. 상대 열람 여부는 모름. 정정 메일 미발송 | 열람·손해·정정 완료를 만들어내지 않는다. 걱정과 사실을 나눈다. |
| “핵심을 먼저 보여 달라”는 피드백만 들음 | 사용자가 말하지 않은 감정, 평가 기준, 상사의 의도를 추가하지 않는다. |
| “팀장님이 나를 싫어하는 것 같다. 직접 들은 적은 없다” | 싫어한다는 추측을 사실로 쓰지 않는다. 확인할 질문을 제안한다. |

각 샘플에서 ① 입력 사실 보존 ② 추측 분리 ③ 감정 미생성 ④ 미실행 조치 미완료 처리 ⑤ 구체적인 다음 행동을 수동으로 확인한다. 사실 왜곡이 한 건이라도 있으면 해당 사례를 실시간 시연에 쓰지 말고 프롬프트와 결과를 먼저 수정한다. 응답 시간은 최소 5회 이상 재서 느린 사례도 확인한다. 아직 측정하지 않은 지연 시간을 발표 자료에 숫자로 넣지 않는다.

## 5. 오류별 대응

| 코드·상황 | 해결 |
| --- | --- |
| 키 미설정 | `.env`를 저장하고 서버 재시작. 환경변수 이름 확인 |
| `authentication` | 키 만료·복사 오류·workspace 권한 확인 |
| `billing` | Console 잔액·결제·지출 한도 확인 |
| `configuration` | 모델 ID·계정 접근·workspace ID 확인 |
| `rate_limit` | 잠시 후 재시도. 무한 클릭하지 않고 기본 정리로 시연 |
| `timeout`, `overloaded` | 입력을 유지한 채 기본 정리 또는 명시적 시연 예시 사용 |
| `invalid_response`, `incomplete_response`, `refusal` | 실제 입력과 출력 형식을 점검. 해당 결과는 사용하지 않음 |

공식 상태 코드는 [Claude 오류 문서](https://platform.claude.com/docs/en/api/errors)에서 확인할 수 있다. 서버는 제공자의 원문 오류 메시지나 키를 브라우저에 전달하지 않는다.
