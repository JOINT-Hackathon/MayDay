const emotionFields = ['interpretation', 'feeling', 'emotionFocus', 'emotionNeed', 'emotionClosing', 'compassion'];
const taskFields = ['unknown', 'improvement', 'followUp', 'checklist', 'cause', 'impact', 'overview'];

export function savedTracks(record) {
  return Array.isArray(record.savedTracks) ? record.savedTracks.filter((track) => ['feelings', 'tasks'].includes(track)) : ['feelings', 'tasks'];
}

export function saveRecordTrack(record, previous, track) {
  if (!['feelings', 'tasks'].includes(track)) throw new Error('invalid track');
  const result = previous ? { ...previous } : {
    id: record.id, createdAt: record.createdAt, mode: record.mode, source: record.source,
    taskType: record.taskType, facts: record.facts, causeStatus: 'unknown',
    ...Object.fromEntries([...emotionFields, ...taskFields].map((key) => [key, ''])),
    actionChecked: [], addonDrafts: {}, usedAt: null, outcome: '',
  };
  for (const key of track === 'feelings' ? emotionFields : [...taskFields, 'causeStatus', 'actionChecked', 'addonDrafts', 'usedAt', 'outcome']) {
    if (record[key] !== undefined) result[key] = record[key];
  }
  result.facts = record.facts;
  result.savedTracks = [...new Set([...(previous ? savedTracks(previous) : []), track])];
  return result;
}
