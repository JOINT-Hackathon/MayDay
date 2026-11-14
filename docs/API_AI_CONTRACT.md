# 메이데이 API·AI 계약

> 기준 코드: `server.mjs` (2026-11-14). 아래의 **현재** 계약은 코드에서 확인한 내용이다. Claude organize의 실제 가상 샘플 3건과 브라우저 호출은 검증했다. chat-turn의 실제 외부 호출은 미검증이다.

## 공통

- 같은 출처의 Node 서버가 프런트엔드와 `/api/*`를 제공한다.
- JSON 응답에는 `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`가 설정된다.
- AI 키는 서버 환경 변수 `ANTHROPIC_API_KEY`에서 읽는다. `.env`는 Git에서 제외된다.
- `GET /api/status`의 `available`은 **키가 설정돼 있는지**만 뜻한다. 모델 접근 권한이나 외부 API 상태 확인 결과는 아니다.
- `Content-Type`은 세미콜론 앞의 미디어 타입을 소문자로 비교해 `application/json`일 때만 받는다. `application/json; charset=utf-8`은 허용하고 `text/application/json`은 거절한다.

## `GET /api/status` — 현재

성공: `200 {"available":true,"provider":"anthropic","model":"claude-sonnet-5-5","verified":false}`. `available`은 키가 없으면 false이며, 이 경로는 실호출을 하지 않으므로 `verified`는 항상 false다. 클라이언트는 `false` 또는 네트워크 실패 시 수동 입력을 계속 제공한다.

## `GET /api/health` — 현재

성공: `200 {"ok":true}`. 배포 프로세스의 기본 헬스 체크이며 AI 모델 접근 여부나 브라우저 저장 성공을 검증하지 않는다.

## `POST /api/organize` — 현재

요청:

```json
{"text":"공유한 표의 합계가 원본과 달랐어요.","mode":"mistake","consent":true}
```

- `consent`: 반드시 `true`. 미동의 요청은 Claude로 전송하지 않고 400 응답.
- `mode`: `mistake` 또는 `feedback`.
- `text`: 공백이 아닌 문자열, 최대 3000자. 현재 홈 입력은 최대 500자, 직접 정리 폼 입력은 최대 1200자.
- `Content-Type`: `application/json`. 요청 본문은 12000바이트를 넘을 수 없다.
- `Origin` 헤더가 있으면 요청의 `Host`와 일치하는지 확인한다. 이 검사는 사용자 인증을 대신하지 않는다.

성공 응답:

```json
{
  "suggestions": {
    "observed": "공유한 표의 합계가 원본과 달랐습니다.",
    "interpretation": "",
    "feeling": "",
    "unknown": "자료를 누가 사용했는지 확인해야 합니다.",
    "improvement": "원본 수치와 공유한 표의 합계를 대조합니다.",
    "followUp": "합계 차이를 확인했고 자료 사용 여부를 확인하겠습니다.",
    "checklist": "자료 공유 전 합계와 원본 수치를 대조하기"
  }
}
```

위 응답 문장은 **형식 설명용 예시**다. 모델이 실제로 이런 문장을 반환했다는 뜻이 아니다. 성공 응답에는 `meta` 객체도 포함된다: `provider`, `model`, `durationMs`, `promptVersion`, `usage.inputTokens`, `usage.outputTokens`. 서버는 7개 필드가 모두 문자열인지 확인하고 각 값을 최대 500자로 자른다. 화면은 기존 작성값이 없는 칸에만 제안값을 채운다. 필드 의미는 [AI MVP 명세](../AI-MVP-구현명세.md#4-입출력-계약)에 둔다.

| 상태 | 현재 조건 | 클라이언트 처리 |
| --- | --- | --- |
| `400` | JSON 오류, 빈 입력·길이 초과·잘못된 유형 | 입력을 유지하고 수정 안내 |
| `403` | `Origin` 불일치 | 전송 중단 안내 |
| `405` | POST 외 메서드 | 구현 오류로 기록 |
| `413` | 본문 12000바이트 초과 | 입력 길이 안내 |
| `415` | JSON이 아닌 요청 | 구현 오류로 기록 |
| `429` | IP별 분당 요청 또는 전체 일일 요청 한도 | 잠시 후 재시도 또는 직접 입력 |
| `503` | 키 미설정·인증·결제·모델 설정·일시 과부하 | AI 비활성, 직접 입력 |
| `422` | Claude 응답 거절 | 직접 정리로 전환 |
| `504` | Claude 시간 초과 | 재시도 또는 기본 정리 |
| `502` | 외부 API 오류·응답 잘림·응답 검증 실패 | 입력 유지, 직접 입력 또는 재시도 |
| `500` | 처리되지 않은 서버 오류 | 입력 유지, 실패 안내 |

현재 IP별 제한은 프로세스 메모리 기준 **1분에 12회**, 전체 일일 제한 기본값은 **100회**이며 `AI_DAILY_LIMIT`로 바꿀 수 있다. Claude 호출은 45초, 홈과 직접 입력 화면은 50초 시간 제한을 사용한다. 일일 카운트는 호출 시도 전에 증가하고, UTC 날짜 기준으로 초기화된다. 이 제한은 재시작·다중 인스턴스에서 공유되지 않는다.

## AI 출력의 검증 원칙

서버의 프롬프트는 입력에 없는 사실·원인·의도·감정을 만들지 않도록 지시한다. **프롬프트는 정확성을 보장하지 않는다.** 실제 키로 실수형·지적형 샘플을 호출해 사실과 추측 분리를 확인해야 한다. 사용자가 확인하기 전 자동 저장·발송하지 않는다.

## `POST /api/chat-turn` — 현재 코드에 남은 선택 경로

이 엔드포인트는 대화형 가이드의 다음 질문과 9개 필드 요약을 생성한다. **짧은 폼을 기본으로 하는 MVP + AI v0의 필수 경로는 아니다.** 서버에 구현돼 있지만 실제 키로 성공 호출한 결과는 확인되지 않았다.

요청에는 `consent: true`, `mode`, 선택적 `preferredTrack`(`feelings` 또는 `tasks`), `turns` 배열을 넣는다. 각 turn은 `role`(`user` 또는 `assistant`)과 공백이 아닌 `content` 문자열을 갖는다. 현재 서버는 turn 12개 이하, 사용자 답변 6개 이하, turn별 1000자 이하, 전체 내용 7000자 이하를 검증한다. 응답은 `done` 불리언, `question` 문자열, `summary` 객체이며 `summary`는 `facts`, `interpretation`, `feeling`, `unknown`, `improvement`, `followUp`, `checklist`, `cause`, `impact` 문자열을 갖는다. 키 없음·호출 한도·외부 실패 처리에는 위의 공통 상태 코드가 적용된다.

기본 화면에서 이 경로를 사용하지 않으면 시연 설명에 AI 대화가 작동한다고 쓰지 않는다. 후속 단계에서 다시 연결할 때 전송 동의와 실제 응답 검증을 별도로 확인한다.

## 변경 규칙

기존 클라이언트가 읽는 필드 이름을 바꿀 때는 화면과 서버를 같은 변경으로 갱신한다. 새 필드는 기존 필드를 제거하지 않고 추가하는 방식을 우선 검토한다. 계정·서버 저장 API가 필요해지면 인증과 데이터 삭제 계약을 먼저 문서화한다. 현재의 두 엔드포인트를 곧바로 공개 운영용 API라고 가정하지 않는다.

## Claude 연결과 별도 서버 API

Claude 설정·모델·가격·실호출 점검은 [Claude 가이드](CLAUDE_SETUP.md)를 참조한다. `/api/team5/*`는 별도의 공유 서버 기능이며 위 Claude API 계약과 독립적이다. 기본 로컬 기록의 저장 위치와 혼동하지 않는다.
