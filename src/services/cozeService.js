class CozeService {
  token() {
    const value = process.env.COZE_API_TOKEN || process.env.COZE_ACCESS_TOKEN;
    if (!value) throw new Error('Missing COZE_API_TOKEN');
    return value;
  }

  botId(mode) {
    if (mode === 'structured') {
      const id = process.env.STRUCTURED_BOT_ID || process.env.COZE_STRUCTURED_BOT_ID;
      if (!id) throw new Error('Missing STRUCTURED_BOT_ID');
      return id;
    }
    if (mode === 'autonomous' || mode === 'practice') {
      const id = process.env.AUTONOMOUS_BOT_ID || process.env.COZE_AUTONOMOUS_BOT_ID;
      if (!id) throw new Error('Missing AUTONOMOUS_BOT_ID');
      return id;
    }
    throw new Error('Invalid bot mode');
  }

  headers() { return { Authorization: `Bearer ${this.token()}`, 'Content-Type': 'application/json' }; }

  async createConversation(studentId, sessionId, scope, mode) {
    if (process.env.COZE_MOCK === '1') return `mock_conv_${studentId}_${scope}`;
    const { default: axios } = await import('axios');
    const response = await axios.post('https://api.coze.cn/v1/conversation/create', {
      bot_id: this.botId(mode),
      meta_data: { student_id: studentId, session_id: sessionId, task_type: scope, experiment_run_id: process.env.EXPERIMENT_RUN_ID || 'default' },
    }, { headers: this.headers(), timeout: 20000 });
    const id = response.data?.data?.id;
    if (!id) throw new Error('Coze conversation creation returned no id');
    return id;
  }

  async sendMessage({ studentId, sessionId, scope, mode, conversationId, message }) {
    if (process.env.COZE_MOCK === '1') {
      return {
        bot_id: this.botId(mode), conversation_id: conversationId || `mock_conv_${studentId}_${scope}`,
        chat_id: `mock_chat_${Date.now()}`, message_id: `mock_msg_${Date.now()}`,
        assistant_message: `模拟AI回复：我看到了你的想法。你可以继续说明你最依据哪条证据，以及为什么考虑这个修改方向。`,
      };
    }
    const { default: axios } = await import('axios');
    const activeConversationId = conversationId || await this.createConversation(studentId, sessionId, scope, mode);
    const botId = this.botId(mode);
    const start = await axios.post(
      `https://api.coze.cn/v3/chat?conversation_id=${encodeURIComponent(activeConversationId)}`,
      { bot_id: botId, user_id: studentId, stream: false, auto_save_history: true, additional_messages: [{ role: 'user', content: message, content_type: 'text' }] },
      { headers: this.headers(), timeout: 30000 }
    );
    const chatId = start.data?.data?.id;
    if (!chatId) throw new Error('Coze chat initiation failed');
    const started = Date.now();
    let status = start.data?.data?.status || 'in_progress';
    while (['created','in_progress'].includes(status)) {
      if (Date.now() - started > 80000) throw new Error('Coze response timeout');
      await new Promise(resolve => setTimeout(resolve, 900));
      const r = await axios.get('https://api.coze.cn/v3/chat/retrieve', { params: { conversation_id: activeConversationId, chat_id: chatId }, headers: { Authorization: `Bearer ${this.token()}` }, timeout: 15000 });
      status = r.data?.data?.status;
      if (['failed','canceled','required_action','requires_action'].includes(status)) throw new Error(`Coze chat ${status}`);
    }
    const list = await axios.get('https://api.coze.cn/v3/chat/message/list', { params: { conversation_id: activeConversationId, chat_id: chatId }, headers: { Authorization: `Bearer ${this.token()}` }, timeout: 15000 });
    const answers = (list.data?.data || []).filter(m => m.role === 'assistant' && (m.type === 'answer' || !m.type));
    const assistant = answers.map(m => m.content).filter(Boolean).join('\n') || '抱歉，这一轮没有生成可显示的回复。';
    return { bot_id: botId, conversation_id: activeConversationId, chat_id: chatId, message_id: answers.at(-1)?.id || '', assistant_message: assistant };
  }
}

export const cozeService = new CozeService();
