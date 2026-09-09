export function normalizeParticipantId(value) {
  return String(value || '').trim().toUpperCase();
}
export const normalizeStudentId = normalizeParticipantId;

export function validateParticipantId(value) {
  const id = normalizeParticipantId(value);
  return /^P(?:0[1-9]|1\d|2[0-8])$/.test(id) || /^DEMO-[SR]$/.test(id);
}
export const validateStudentId = validateParticipantId;

export function validateMessage(value) {
  return typeof value === 'string' && value.trim().length >= 1 && value.length <= 5000;
}

export function allowedParticipantIds() {
  return (process.env.ALLOWED_PARTICIPANTS || '')
    .split(',')
    .map(normalizeParticipantId)
    .filter(Boolean);
}
export const allowedStudentIds = allowedParticipantIds;

export function isAllowedParticipant(id) {
  const normalized = normalizeParticipantId(id);
  if (/^DEMO-[SR]$/.test(normalized)) return true;
  if (!/^P(?:0[1-9]|1\d|2[0-8])$/.test(normalized)) return false;
  // v9默认原生支持P01–P28。若确有需要，可显式开启严格环境变量白名单。
  if (process.env.STRICT_PARTICIPANT_ALLOWLIST !== '1') return true;
  const allowed = allowedParticipantIds();
  return allowed.length === 0 || allowed.includes(normalized);
}
export const isAllowedStudent = isAllowedParticipant;
