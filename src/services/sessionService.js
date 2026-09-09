import { storageService } from './storageService.js';
import { v4 as uuidv4 } from 'uuid';

class SessionService {
  // 获取或创建学生会话
  async getOrCreateSession(participantId) {
    const participantKey = `participants/${participantId}.json`;
    let participantData = await storageService.getObject(participantKey);

    if (participantData) {
      const participant = JSON.parse(participantData);
      const sessionKey = `sessions/${participant.session_id}.json`;
      const sessionContent = await storageService.getObject(sessionKey);
      if (sessionContent) {
        const session = JSON.parse(sessionContent);
        if (session.active !== false) {
          let needsMigration = false;
          if (!session.active_conversation_id && session.conversation_id) {
            session.active_conversation_id = session.conversation_id;
            needsMigration = true;
          }
          if (!session.conversation_session_id) {
            session.conversation_session_id = session.session_id;
            needsMigration = true;
          }
          if (!session.conversation_session_no) {
            session.conversation_session_no = participant.conversation_session_no || 1;
            needsMigration = true;
          }
          if (needsMigration) {
            await storageService.putObject(sessionKey, JSON.stringify(session));
          }
          return session;
        }
      }
    }

    // 创建新会话
    const sessionId = `sess_${uuidv4().replace(/-/g, '')}`;
    const participant = participantData ? JSON.parse(participantData) : {};
    const conversationSessionNo = Number(participant.conversation_session_no) || 1;
    const session = {
      session_id: sessionId,
      conversation_session_id: sessionId,
      conversation_session_no: conversationSessionNo,
      participant_id: participantId,
      active_conversation_id: null, // 首次发送消息时由Coze创建
      turn_count: 0,
      created_at: new Date().toISOString(),
      active: true,
    };

    await storageService.putObject(`sessions/${sessionId}.json`, JSON.stringify(session));

    const updatedParticipant = {
      ...participant,
      participant_id: participantId,
      session_id: sessionId,
      active_conversation_id: null,
      conversation_session_no: conversationSessionNo,
      last_active: new Date().toISOString(),
    };
    await storageService.putObject(participantKey, JSON.stringify(updatedParticipant));

    return session;
  }

  // 更新当前会话的 conversation id
  async updateConversationId(sessionId, conversationId) {
    const sessionKey = `sessions/${sessionId}.json`;
    const content = await storageService.getObject(sessionKey);
    if (!content) throw new Error('会话不存在');
    const session = JSON.parse(content);
    session.active_conversation_id = conversationId;
    session.conversation_started_at = session.conversation_started_at || new Date().toISOString();
    await storageService.putObject(sessionKey, JSON.stringify(session));

    const participantKey = `participants/${session.participant_id}.json`;
    const participantContent = await storageService.getObject(participantKey);
    if (participantContent) {
      const participant = JSON.parse(participantContent);
      if (participant.session_id === sessionId) {
        participant.active_conversation_id = conversationId;
        participant.last_active = new Date().toISOString();
        await storageService.putObject(participantKey, JSON.stringify(participant));
      }
    }
    return session;
  }

  // 归档当前会话，并为下一次进入准备一个空白会话
  async startNewConversation(participantId) {
    const participantKey = `participants/${participantId}.json`;
    const participantContent = await storageService.getObject(participantKey);
    const participant = participantContent
      ? JSON.parse(participantContent)
      : { participant_id: participantId };
    const currentSession = participant.session_id
      ? await this.getSession(participant.session_id)
      : null;
    if (currentSession && currentSession.active !== false) {
      currentSession.active = false;
      currentSession.status = 'ended';
      currentSession.archived = true;
      currentSession.conversation_ended_at = new Date().toISOString();
      currentSession.active_conversation_id = null;
      await storageService.putObject(
        `sessions/${currentSession.session_id}.json`,
        JSON.stringify(currentSession)
      );
    }

    const nextSessionNo = (Number(currentSession?.conversation_session_no) || Number(participant.conversation_session_no) || 0) + 1;
    const nextSessionId = `sess_${uuidv4().replace(/-/g, '')}`;
    const nextSession = {
      session_id: nextSessionId,
      conversation_session_id: nextSessionId,
      conversation_session_no: nextSessionNo,
      participant_id: participantId,
      active_conversation_id: null,
      turn_count: 0,
      created_at: new Date().toISOString(),
      active: true,
    };
    await storageService.putObject(`sessions/${nextSessionId}.json`, JSON.stringify(nextSession));

    participant.session_id = nextSessionId;
    participant.active_conversation_id = null;
    participant.conversation_session_no = nextSessionNo;
    participant.last_active = new Date().toISOString();
    await storageService.putObject(participantKey, JSON.stringify(participant));
    return nextSession;
  }

  // 增加轮数
  async incrementTurn(sessionId) {
    const sessionKey = `sessions/${sessionId}.json`;
    const content = await storageService.getObject(sessionKey);
    if (!content) throw new Error('会话不存在');
    const session = JSON.parse(content);
    session.turn_count += 1;
    await storageService.putObject(sessionKey, JSON.stringify(session));
    return session.turn_count;
  }

  // 获取会话
  async getSession(sessionId) {
    const sessionKey = `sessions/${sessionId}.json`;
    const content = await storageService.getObject(sessionKey);
    if (!content) return null;
    return JSON.parse(content);
  }

  // 根据participant_id获取会话
  async getSessionByParticipant(participantId) {
    const participantKey = `participants/${participantId}.json`;
    const content = await storageService.getObject(participantKey);
    if (!content) return null;
    const participant = JSON.parse(content);
    return this.getSession(participant.session_id);
  }
}

export const sessionService = new SessionService();
