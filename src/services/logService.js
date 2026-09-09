import { storageService } from './storageService.js';

class LogService {
  // 记录一次交互 (独立JSON对象，字段全部 snake_case)
  async logInteraction(logData) {
    const { participant_id, session_id, chat_id } = logData;
    if (!participant_id || !session_id || !chat_id) {
      throw new Error('缺少必要字段: participant_id, session_id, chat_id');
    }

    // 自动添加 logged_at
    const fullLog = {
      ...logData,
      logged_at: new Date().toISOString(),
    };

    const path = `logs/${participant_id}/${session_id}/${chat_id}.json`;
    await storageService.putObject(path, JSON.stringify(fullLog));
    return path;
  }

  // 获取某参与者的所有日志 (按会话、轮次排序)
  async getParticipantLogs(participantId) {
    const prefix = `logs/${participantId}/`;
    const blobs = await storageService.listObjects(prefix);
    const logs = [];
    for (const blob of blobs) {
      const content = await storageService.getObject(blob.key);
      if (content) {
        try {
          const log = JSON.parse(content);
          logs.push(log);
        } catch (e) { /* ignore */ }
      }
    }
    logs.sort((a, b) => new Date(a.send_time) - new Date(b.send_time));
    return logs;
  }

  // 获取所有参与者列表 (从logs前缀聚合)
  async getAllParticipants() {
    const prefix = 'logs/';
    const blobs = await storageService.listObjects(prefix);
    const participantSet = new Set();
    for (const blob of blobs) {
      const parts = blob.key.split('/');
      if (parts.length >= 2) {
        participantSet.add(parts[1]);
      }
    }
    const participants = Array.from(participantSet);
    const result = [];
    for (const pid of participants) {
      const logs = await this.getParticipantLogs(pid);
      if (logs.length > 0) {
        const lastLog = logs[logs.length - 1];
        result.push({
          participant_id: pid,
          group: lastLog.group || 'unknown',
          total_turns: logs.length,
          last_activity: lastLog.send_time || lastLog.logged_at,
        });
      }
    }
    result.sort((a, b) => a.participant_id.localeCompare(b.participant_id));
    return result;
  }


  async getAllLogs() {
    const participants = await this.getAllParticipants();
    const allLogs = [];
    for (const participant of participants) {
      allLogs.push(...await this.getParticipantLogs(participant.participant_id));
    }
    allLogs.sort((a, b) => {
      if (a.participant_id !== b.participant_id) return a.participant_id.localeCompare(b.participant_id);
      return new Date(a.send_time || a.logged_at) - new Date(b.send_time || b.logged_at);
    });
    return allLogs;
  }

  // 导出所有日志为CSV
  async exportAllCSV() {
    const allParticipants = await this.getAllParticipants();
    const allLogs = [];
    for (const p of allParticipants) {
      const logs = await this.getParticipantLogs(p.participant_id);
      allLogs.push(...logs);
    }

    allLogs.sort((a, b) => {
      if (a.participant_id !== b.participant_id) return a.participant_id.localeCompare(b.participant_id);
      if (a.session_id !== b.session_id) return a.session_id.localeCompare(b.session_id);
      return (a.turn_number || 0) - (b.turn_number || 0);
    });

    const headers = [
      'event_id',
      'experiment_run_id',
      'participant_id',
      'group',
      'mode',
      'task',
      'formal_data',
      'current_stage',
      'conversation_scope',
      'bot_id',
      'session_id',
      'conversation_session_id',
      'conversation_session_no',
      'conversation_id',
      'chat_id',
      'turn_number',
      'user_message',
      'assistant_message',
      'request_started_at',
      'send_time',
      'answer_time',
      'response_seconds',
      'status',
      'has_image',
      'image_id',
      'error_code',
      'error_message'
    ];
    let csv = '\uFEFF' + headers.join(',') + '\n';
    for (const log of allLogs) {
      const row = headers.map(h => {
        let val = log[h] ?? '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csv += row.join(',') + '\n';
    }
    return csv;
  }
}

export const logService = new LogService();
