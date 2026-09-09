// 统一使用中性匿名编号：P01、P02……P99。
export function validateParticipantId(id) {
  return /^P\d{2}$/.test(String(id || '').toUpperCase().trim());
}

export function validateMessage(message) {
  if (typeof message !== 'string') return false;
  return message.trim().length >= 1 && message.length <= 1000;
}
