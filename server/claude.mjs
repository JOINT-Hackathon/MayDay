export const DEFAULT_MODEL = 'claude-sonnet-5-5';

export function getAiConfig(env = process.env) {
  const key = (env.ANTHROPIC_API_KEY || '').trim();
  return {
    apiKey: /^(your[-_]|replace|paste|여기에|<)/i.test(key) ? '' : key,
    model: (env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim(),
    workspaceId: (env.ANTHROPIC_WORKSPACE_ID || '').trim(),
    timeoutMs: 45_000,
  };
}

class AiError extends Error {
  constructor(code) { super(code); this.code = code; }
}

const FAILURES = {
  not_configured: [503, 'AI가 아직 설정되지 않았어요. 기본 정리나 직접 입력을 사용할 수 있어요.'],
  authentication: [503, 'AI 인증을 확인하지 못했어요. 운영자가 API 키와 접근 권한을 확인해야 합니다.'],
  billing: [503, 'AI 사용 잔액 또는 결제 설정을 확인해야 합니다. 기본 정리로 계속할 수 있어요.'],
  configuration: [503, 'AI 모델 또는 요청 설정을 확인해야 합니다. 기본 정리로 계속할 수 있어요.'],
  rate_limit: [429, 'AI 요청이 잠시 몰렸어요. 잠시 후 재시도하거나 기본 정리로 계속해 주세요.'],
  overloaded: [503, 'AI 연결이 잠시 불안정해요. 기본 정리로 계속하거나 나중에 다시 시도해 주세요.'],
  timeout: [504, 'AI 응답이 지연되고 있어요. 입력은 남아 있으니 재시도하거나 기본 정리로 계속해 주세요.'],
  refusal: [422, '이 내용은 AI 초안으로 정리하지 못했어요. 직접 정리하기를 이용해 주세요.'],
  incomplete_response: [502, 'AI 초안이 끝까지 도착하지 않았어요. 재시도하거나 직접 정리해 주세요.'],
  invalid_response: [502, 'AI 초안 형식을 확인하지 못했어요. 재시도하거나 직접 정리해 주세요.'],
  upstream_error: [502, 'AI에 연결하지 못했어요. 입력은 그대로 남아 있으며 기본 정리로 계속할 수 있어요.'],
};

export function publicAiError(error) {
  const code = Object.hasOwn(FAILURES, error?.code) ? error.code
    : Object.hasOwn(FAILURES, error?.message) ? error.message : 'upstream_error';
  const [status, message] = FAILURES[code];
  return { status, code, message };
}

// This adapter only supports the object/string/boolean schema subset used by Mayday.
function conforms(value, schema) {
  if (schema.type === 'object') {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      && schema.required.every((key) => Object.hasOwn(value, key))
      && Object.keys(value).every((key) => Object.hasOwn(schema.properties, key))
      && Object.entries(schema.properties).every(([key, child]) => conforms(value[key], child));
  }
  return typeof value === schema.type;
}

export async function structuredResponse(name, instructions, input, schema, maxTokens = 1600, options = {}) {
  const config = options.config || getAiConfig();
  const fetcher = options.fetcher || fetch;
  if (!config.apiKey) throw new AiError('not_configured');
  const startedAt = Date.now();
  try {
    const response = await fetcher('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.apiKey,
        ...(config.workspaceId ? { 'anthropic-workspace-id': config.workspaceId } : {}),
        'anthropic-version': '2026-10-21',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        // Sonnet 5.5 rejects thinking:disabled. No tools are used here.
        ...(config.model === DEFAULT_MODEL ? { thinking: { type: 'between_tools' } } : {}),
        system: instructions,
        messages: [{ role: 'user', content: JSON.stringify(input) }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) {
      // Inspect only for classification; never forward provider messages or credentials.
      const detail = await response.json().catch(() => ({}));
      const message = typeof detail?.error?.message === 'string' ? detail.error.message : '';
      const code = response.status === 401 || response.status === 403 ? 'authentication'
        : response.status === 402 || (response.status === 400 && /credit|balance|billing|spend limit/i.test(message)) ? 'billing'
          : response.status === 429 ? 'rate_limit'
            : response.status === 400 || response.status === 404 ? 'configuration'
              : response.status === 529 || response.status === 503 ? 'overloaded' : 'upstream_error';
      throw new AiError(code);
    }
    const result = await response.json();
    if (result.stop_reason === 'refusal') throw new AiError('refusal');
    if (result.stop_reason !== 'end_turn') throw new AiError('incomplete_response');
    const output = Array.isArray(result.content)
      ? result.content.filter((part) => part.type === 'text' && typeof part.text === 'string').map((part) => part.text).join('') : '';
    let data;
    try { data = JSON.parse(output); } catch { throw new AiError('invalid_response'); }
    if (!conforms(data, schema)) throw new AiError('invalid_response');
    const tokenCount = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
    return {
      data,
      meta: {
        provider: 'anthropic', model: typeof result.model === 'string' ? result.model : config.model,
        durationMs: Date.now() - startedAt, promptVersion: name + '-v2',
        usage: { inputTokens: tokenCount(result.usage?.input_tokens), outputTokens: tokenCount(result.usage?.output_tokens) },
      },
    };
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new AiError('timeout');
    throw new AiError('upstream_error');
  }
}
