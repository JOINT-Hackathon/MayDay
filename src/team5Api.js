export const SERVER_CATEGORIES = ['문서·자료', '회의·소통', '일정·마감', '기타'];
export const SERVER_STATUSES = {
  NOT_STARTED: '시작 전', IN_PROGRESS: '진행 중', COMPLETED: '완료', NOT_APPLICABLE: '해당 없음',
};

async function request(path, method = 'GET', body, signal) {
  let response;
  try {
    response = await fetch('/api/team5' + path, {
      method, headers: body ? { 'Content-Type': 'application/json' } : {},
      ...(body ? { body: JSON.stringify(body) } : {}), signal: signal || AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('서버에 연결하지 못했습니다. 저장 요청이었다면 목록을 확인한 뒤 다시 시도해 주세요.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) { const error = new Error(data?.error || '서버 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.'); error.status = response.status; throw error; }
  if (!data || typeof data !== 'object') throw new Error('서버 응답 형식이 올바르지 않습니다.');
  return data;
}

function id(value) {
  if (!/^[1-9]\d*$/.test(String(value))) throw new Error('기록 번호가 올바르지 않습니다.');
  return String(value);
}

async function list(promise) {
  const value = await promise;
  if (!Array.isArray(value)) throw new Error('서버 목록 형식이 올바르지 않습니다.');
  return value;
}

export const team5Api = {
  me: (signal) => request('/auth/me', 'GET', undefined, signal),
  login: (body, register = false) => request('/auth/' + (register ? 'register' : 'login'), 'POST', body),
  logout: () => request('/auth/logout', 'POST', {}),
  all: (page = 0) => request('/experiences?page=' + page),
  experience: (value) => request(`/experiences/${id(value)}`),
  updateExperience: (value, body) => request(`/experiences/${id(value)}`, 'PUT', body),
  deleteExperience: (value) => request(`/experiences/${id(value)}`, 'DELETE', {}),
  updateChecklist: (value, body) => request(`/checklist/${id(value)}`, 'PUT', body),
  deleteChecklist: (value) => request(`/checklist/${id(value)}`, 'DELETE', {}),
  reorderChecklist: (value, ids) => request(`/experiences/${id(value)}/checklist/order`, 'PUT', { ids }),
  updatePrevention: (value, body) => request(`/preventions/${id(value)}`, 'PUT', body),
  deletePrevention: (value) => request(`/preventions/${id(value)}`, 'DELETE', {}),
  recent: (signal) => list(request('/experiences/recent', 'GET', undefined, signal)),
  createExperience: (body) => request('/experiences', 'POST', body),
  checklist: (experienceId) => list(request(`/experiences/${id(experienceId)}/checklist`)),
  addChecklist: (experienceId, body) => request(`/experiences/${id(experienceId)}/checklist`, 'POST', body),
  setStatus: (itemId, status) => request(`/checklist/${id(itemId)}/status`, 'PATCH', { status }),
  preventions: (experienceId) => list(request(`/experiences/${id(experienceId)}/preventions`)),
  addPrevention: (experienceId, body) => request(`/experiences/${id(experienceId)}/preventions`, 'POST', body),
  byCategory: (category) => list(request('/preventions?category=' + encodeURIComponent(category))),
  recommend: (body) => request('/recommendations', 'POST', body),
};
