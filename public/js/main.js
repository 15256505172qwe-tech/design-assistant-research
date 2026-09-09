document.getElementById('loginForm').addEventListener('submit', async function (event) {
  event.preventDefault();
  const input = document.getElementById('participantId');
  const errorDiv = document.getElementById('errorMessage');
  const button = document.getElementById('loginBtn');
  const participantId = input.value.trim().toUpperCase();

  if (!participantId) {
    errorDiv.textContent = '请输入老师发给你的编号。';
    errorDiv.style.display = 'block';
    return;
  }

  button.disabled = true;
  button.textContent = '验证中…';
  errorDiv.style.display = 'none';

  try {
    const response = await fetch('/express/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId }),
    });
    const data = await response.json();
    if (!response.ok || !data.valid) {
      throw new Error(data.message || '编号验证失败，请检查后重试。');
    }
    sessionStorage.setItem('participantId', data.participantId);
    sessionStorage.setItem('sessionId', data.sessionId);
    sessionStorage.setItem('currentStage', data.current_stage || '');
    window.location.href = '/chat.html';
  } catch (err) {
    errorDiv.textContent = err.message || '网络错误，请检查后重试。';
    errorDiv.style.display = 'block';
    button.disabled = false;
    button.innerHTML = '继续 <span aria-hidden="true">→</span>';
  }
});
