import axios from 'axios';
import FormData from 'form-data';

class CozeService {
  constructor() {
    this.accessToken = process.env.COZE_ACCESS_TOKEN;
    if (!this.accessToken) throw new Error('COZE_ACCESS_TOKEN is required');
    this.baseURL = 'https://api.coze.cn';
    this.runId = process.env.EXPERIMENT_RUN_ID || 'default';
  }

  getBotId(mode) {
    if (mode === 'structured') {
      const id = process.env.COZE_STRUCTURED_BOT_ID;
      if (!id) throw new Error('Missing COZE_STRUCTURED_BOT_ID');
      return id;
    }
    if (mode === 'autonomous' || mode === 'practice') {
      const id = process.env.COZE_AUTONOMOUS_BOT_ID;
      if (!id) throw new Error('Missing COZE_AUTONOMOUS_BOT_ID');
      return id;
    }
    throw new Error(`Invalid AI mode: ${mode || 'empty'}`);
  }

  async createConversation(participantId, sessionId, botId, scope) {
    try {
      const response = await axios.post(
        `${this.baseURL}/v1/conversation/create`,
        {
          bot_id: botId,
          meta_data: {
            participant_id: participantId,
            session_id: sessionId,
            conversation_scope: scope,
            experiment_run_id: this.runId,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const conversationId = response.data.data?.id;
      if (!conversationId) throw new Error('Coze conversation creation failed: no id returned');
      return conversationId;
    } catch (err) {
      console.error('Coze createConversation error:', err.response?.data || err.message);
      throw new Error('创建AI会话失败，请稍后重试');
    }
  }

  async uploadImageToCoze(imageBuffer, mimeType, filename) {
    try {
      const formData = new FormData();
      formData.append('file', imageBuffer, {
        filename: filename || 'image.jpg',
        contentType: mimeType,
      });
      const response = await axios.post(`${this.baseURL}/v1/files/upload`, formData, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          ...formData.getHeaders(),
        },
        maxContentLength: 5 * 1024 * 1024,
      });
      const fileId = response.data.data?.id;
      if (!fileId) throw new Error('Coze file upload failed: no id returned');
      return fileId;
    } catch (err) {
      console.error('Coze uploadImageToCoze error:', err.response?.data || err.message);
      throw new Error('图片上传到AI服务失败，请重试');
    }
  }

  async startChat(participantId, conversationId, botId, message, imageCozeId = null) {
    const userId = participantId.toUpperCase();
    let content = message;
    let contentType = 'text';
    if (imageCozeId) {
      content = JSON.stringify([
        { type: 'image', file_id: imageCozeId },
        { type: 'text', text: message },
      ]);
      contentType = 'object_string';
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/v3/chat?conversation_id=${encodeURIComponent(conversationId)}`,
        {
          bot_id: botId,
          user_id: userId,
          stream: false,
          auto_save_history: true,
          additional_messages: [
            { role: 'user', content, content_type: contentType },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const chatData = response.data.data;
      if (!chatData?.id) throw new Error('Coze chat initiation failed');
      return {
        chat_id: chatData.id,
        conversation_id: chatData.conversation_id || conversationId,
        status: chatData.status || 'in_progress',
      };
    } catch (err) {
      console.error('Coze chat error:', err.response?.data || err.message);
      throw new Error('发起聊天失败，请重试');
    }
  }

  async retrieveChat(conversationId, chatId) {
    try {
      const response = await axios.get(`${this.baseURL}/v3/chat/retrieve`, {
        params: { conversation_id: conversationId, chat_id: chatId },
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return response.data.data;
    } catch (err) {
      console.error('Coze retrieve chat error:', err.response?.data || err.message);
      throw new Error('获取聊天状态失败');
    }
  }

  async getChatMessages(conversationId, chatId) {
    try {
      const response = await axios.get(`${this.baseURL}/v3/chat/message/list`, {
        params: { conversation_id: conversationId, chat_id: chatId },
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return response.data.data || [];
    } catch (err) {
      console.error('Coze get messages error:', err.response?.data || err.message);
      throw new Error('获取回答失败');
    }
  }

  async sendMessage({ participantId, sessionId, mode, scope, message, conversationId = null, imageBuffer = null, imageMime = null }) {
    const botId = this.getBotId(mode);
    let activeConversationId = conversationId;
    if (!activeConversationId) {
      activeConversationId = await this.createConversation(participantId, sessionId, botId, scope);
    }

    let cozeImageId = null;
    if (imageBuffer) {
      const mime = imageMime || 'image/jpeg';
      const ext = mime.split('/')[1] || 'jpg';
      cozeImageId = await this.uploadImageToCoze(imageBuffer, mime, `prototype.${ext}`);
    }

    const chatResult = await this.startChat(participantId, activeConversationId, botId, message, cozeImageId);
    const chatId = chatResult.chat_id;
    const startTime = Date.now();
    let status = chatResult.status;

    while (status === 'in_progress' || status === 'created') {
      if (Date.now() - startTime > 60000) throw new Error('timeout');
      await new Promise(resolve => setTimeout(resolve, 1000));
      const statusData = await this.retrieveChat(activeConversationId, chatId);
      status = statusData.status;
      if (status === 'completed') break;
      if (['failed', 'canceled', 'requires_action'].includes(status)) throw new Error('failed');
    }
    if (status !== 'completed') throw new Error('failed');

    const messages = await this.getChatMessages(activeConversationId, chatId);
    const assistantMessage = messages
      .filter(msg => msg.role === 'assistant' && msg.type === 'answer')
      .map(msg => msg.content)
      .join('\n') || '抱歉，我没有生成回答。';

    const answerTime = new Date().toISOString();
    const responseSeconds = Math.round(((Date.now() - startTime) / 1000) * 10) / 10;
    return {
      bot_id: botId,
      chat_id: chatId,
      conversation_id: activeConversationId,
      assistant_message: assistantMessage,
      send_time: new Date(Date.now() - responseSeconds * 1000).toISOString(),
      answer_time: answerTime,
      response_seconds: responseSeconds,
      status: 'completed',
    };
  }
}

export const cozeService = new CozeService();
