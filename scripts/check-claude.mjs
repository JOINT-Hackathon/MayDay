import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getAiConfig, publicAiError } from '../server/claude.mjs';
import { organize } from '../server/reflection.mjs';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);
if (!getAiConfig().apiKey) {
  console.error('미설정: 프로젝트 .env의 ANTHROPIC_API_KEY에 키를 입력한 후 다시 실행하세요. 키를 채팅에 보내지 마세요.');
  process.exitCode = 1;
} else {
  const samples = [
    { id: 'mistake', mode: 'mistake', text: '견적서 v1을 보낸 뒤 최신본이 v2인 것을 확인했어요. 당황스럽고 팀장님이 저를 무능하게 볼까 걱정돼요. 상대가 파일을 열었는지는 모르고, 아직 정정 메일을 보내지 않았어요.' },
    { id: 'feedback', mode: 'feedback', text: '회의에서 팀장님이 보고서의 핵심 내용을 먼저 보여 달라고 하셨어요. 어떤 구성이 좋은지는 아직 물어보지 않았어요.' },
    { id: 'uncertain', mode: 'feedback', text: '팀장님이 나를 싫어하는 것 같아요. 직접 그런 말을 들은 적은 없어요.' },
  ];
  const results = [];
  console.log('가상 문장 3개를 Claude에 전송합니다. 호출 비용이 발생하며 실제 사용자 데이터는 사용하지 않습니다.');
  for (const sample of samples) {
    try {
      const result = await organize(sample.text, sample.mode);
      results.push({ ...sample, ok: true, ...result });
      console.log(`${sample.id}: 응답 성공 · ${result.meta.model} · ${result.meta.durationMs}ms · 입력 ${result.meta.usage.inputTokens} / 출력 ${result.meta.usage.outputTokens} 토큰`);
    } catch (error) {
      const failure = publicAiError(error);
      results.push({ id: sample.id, ok: false, code: failure.code, error: failure.message });
      console.error(`${sample.id}: ${failure.code} · ${failure.message}`);
      process.exitCode = 1;
      break;
    }
  }
  const folder = fileURLToPath(new URL('../artifacts/', import.meta.url));
  mkdirSync(folder, { recursive: true });
  const filename = folder + 'claude-check-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  writeFileSync(filename, JSON.stringify({ checkedAt: new Date().toISOString(), model: getAiConfig().model, results }, null, 2));
  console.log('가상 샘플 응답 보고서: ' + filename);
  console.log('응답 성공은 사실성 합격이 아닙니다. 보고서에서 미확인 수신·미실행 조치·상대 의도를 만들어내지 않았는지 검토하세요.');
}
