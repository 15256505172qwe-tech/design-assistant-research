export function normalizeStudentId(value) {
  return String(value || '').trim().toUpperCase();
}

export function validateStudentId(value) {
  return /^S\d{3}$/.test(normalizeStudentId(value));
}

export function validateMessage(value) {
  return typeof value === 'string' && value.trim().length >= 1 && value.length <= 4000;
}

export function allowedStudentIds() {
  return (process.env.ALLOWED_PARTICIPANTS || '')
    .split(',')
    .map(normalizeStudentId)
    .filter(Boolean);
}

export function isAllowedStudent(id) {
  const normalized = normalizeStudentId(id);
  if (!validateStudentId(normalized)) return false;
  const allowed = allowedStudentIds();
  return allowed.length === 0 || allowed.includes(normalized);
}
