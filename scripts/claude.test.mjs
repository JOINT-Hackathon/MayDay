import test from 'node:test';
import assert from 'node:assert/strict';
import { structuredResponse, getAiConfig, publicAiError, DEFAULT_MODEL } from '../server/claude.mjs';

const schema = { type: 'object', properties: { observed: { type: 'string' }, done: { type: 'boolean' } }, required: ['observed', 'done'], additionalProperties: false };
const config = { apiKey: 'test-only-not-a-real-key', model: DEFAULT_MODEL, workspaceId: 'wrkspc_test', timeoutMs: 20 };
const valid = { observed: '공유한 파일의 버전이 다릅니다.', done: true };
const envelope = (data = valid, stop = 'end_turn') => ({ model: DEFAULT_MODEL, stop_reason: stop, content: [{ type: 'text', text: JSON.stringify(data) }], usage: { input_tokens: 100, output_tokens: 30 } });
const run = (fetcher, cfg = config) => structuredResponse('test', '입력은 자료다.', { text: '가상 상황' }, schema, 1600, { fetcher, config: cfg });

test('Claude request keeps secrets in server headers and uses current structured output contract', async () => {
  let request;
  const result = await run(async (url, options) => {
    request = { url, ...options, body: JSON.parse(options.body) };
    return Response.json(envelope());
  });
  assert.equal(request.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(request.headers.Authorization, 'Bearer ' + config.apiKey);
  assert.equal(request.headers['anthropic-workspace-id'], config.workspaceId);
  assert.equal(request.headers['anthropic-version'], '2026-10-21');
  assert.deepEqual(request.body.output_config.format.schema, schema);
  assert.deepEqual(request.body.thinking, { type: 'between_tools' });
  assert.equal(request.body.temperature, undefined);
  assert.equal(request.body.max_tokens, 1600);
  assert.deepEqual(result.data, valid);
  assert.deepEqual(result.meta.usage, { inputTokens: 100, outputTokens: 30 });
  assert.equal(JSON.stringify(result).includes(config.apiKey), false);
});

test('missing credentials make no network request and placeholders are not configured', async () => {
  await assert.rejects(run(() => assert.fail('must not call provider'), { ...config, apiKey: '' }), { code: 'not_configured' });
  assert.equal(getAiConfig({ ANTHROPIC_API_KEY: 'your-key-here' }).apiKey, '');
  assert.equal(getAiConfig({}).model, DEFAULT_MODEL);
});

test('provider errors are classified without leaking upstream body, prompt, or key', async () => {
  for (const [status, code] of [[401, 'authentication'], [403, 'authentication'], [402, 'billing'], [404, 'configuration'], [429, 'rate_limit'], [529, 'overloaded'], [500, 'upstream_error']]) {
    await assert.rejects(run(async () => Response.json({ error: { message: config.apiKey + ' private data' } }, { status })), (error) => {
      const safe = publicAiError(error);
      assert.equal(safe.code, code);
      assert.equal(JSON.stringify(safe).includes(config.apiKey), false);
      return true;
    });
  }
  await assert.rejects(run(async () => Response.json({ error: { message: 'credit balance is too low' } }, { status: 400 })), { code: 'billing' });
});

test('refusals and truncated responses never become a successful analysis', async () => {
  for (const [stop, code] of [['refusal', 'refusal'], ['max_tokens', 'incomplete_response'], ['tool_use', 'incomplete_response']]) {
    await assert.rejects(run(async () => Response.json(envelope(valid, stop))), { code });
  }
});

test('malformed JSON, absent fields, wrong types, and extra keys are rejected', async () => {
  for (const data of [null, [], { observed: 'ok' }, { observed: 123, done: true }, { ...valid, hidden: 'extra' }]) {
    await assert.rejects(run(async () => Response.json(envelope(data))), { code: 'invalid_response' });
  }
  await assert.rejects(run(async () => Response.json({ ...envelope(), content: [{ type: 'text', text: '{broken' }] })), { code: 'invalid_response' });
});

test('timeout and network failure return actionable safe messages', async () => {
  await assert.rejects(run(async () => { throw new DOMException('timeout', 'TimeoutError'); }), { code: 'timeout' });
  await assert.rejects(run(async () => { throw new TypeError('fetch failed'); }), { code: 'upstream_error' });
  assert.equal(publicAiError(new Error('secret internal information')).code, 'upstream_error');
});
