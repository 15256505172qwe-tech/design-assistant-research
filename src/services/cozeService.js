class CozeService {
  token(){const v=process.env.COZE_ACCESS_TOKEN;if(!v)throw new Error('Missing COZE_ACCESS_TOKEN');return v;}
  botId(mode){
    if(mode==='scaffold'){const id=process.env.COZE_STRUCTURED_BOT_ID;if(!id)throw new Error('Missing COZE_STRUCTURED_BOT_ID');return id;}
    if(mode==='regular'||mode==='practice'){const id=process.env.COZE_AUTONOMOUS_BOT_ID;if(!id)throw new Error('Missing COZE_AUTONOMOUS_BOT_ID');return id;}
    throw new Error('Invalid AI mode');
  }
  modelName(){return process.env.COZE_MODEL_NAME||'configured-in-coze';}
  headers(){return{Authorization:`Bearer ${this.token()}`,'Content-Type':'application/json'};}
  async createConversation(participantId,sessionId,scope,mode){
    if(process.env.COZE_MOCK==='1')return `mock_conv_${participantId}_${scope}`;
    const {default:axios}=await import('axios');const response=await axios.post('https://api.coze.cn/v1/conversation/create',{bot_id:this.botId(mode),meta_data:{participant_id:participantId,session_id:sessionId,task_type:scope,experiment_run_id:process.env.EXPERIMENT_RUN_ID||'default'}},{headers:this.headers(),timeout:20000});const id=response.data?.data?.id;if(!id)throw new Error('Coze conversation creation returned no id');return id;
  }
  async sendMessage({participantId,sessionId,scope,mode,conversationId,message}){
    if(process.env.COZE_MOCK==='1')return{bot_id:this.botId(mode),conversation_id:conversationId||`mock_conv_${participantId}_${scope}`,chat_id:`mock_chat_${Date.now()}`,message_id:`mock_msg_${Date.now()}`,assistant_message:`模拟AI回复：我已经看到了你提供的证据和想法。我们可以继续把你最在意的问题说清楚；如果你已经想清楚，也可以进入最终决定。`,model:this.modelName()};
    const {default:axios}=await import('axios');const active=conversationId||await this.createConversation(participantId,sessionId,scope,mode),botId=this.botId(mode);
    const start=await axios.post(`https://api.coze.cn/v3/chat?conversation_id=${encodeURIComponent(active)}`,{bot_id:botId,user_id:participantId,stream:false,auto_save_history:true,additional_messages:[{role:'user',content:message,content_type:'text'}]},{headers:this.headers(),timeout:30000});
    const chatId=start.data?.data?.id;if(!chatId)throw new Error('Coze chat initiation failed');let status=start.data?.data?.status||'in_progress',started=Date.now();
    while(['created','in_progress'].includes(status)){if(Date.now()-started>80000)throw new Error('Coze response timeout');await new Promise(r=>setTimeout(r,900));const q=await axios.get('https://api.coze.cn/v3/chat/retrieve',{params:{conversation_id:active,chat_id:chatId},headers:{Authorization:`Bearer ${this.token()}`},timeout:15000});status=q.data?.data?.status;if(['failed','canceled','required_action','requires_action'].includes(status))throw new Error(`Coze chat ${status}`);}
    const list=await axios.get('https://api.coze.cn/v3/chat/message/list',{params:{conversation_id:active,chat_id:chatId},headers:{Authorization:`Bearer ${this.token()}`},timeout:15000});const answers=(list.data?.data||[]).filter(m=>m.role==='assistant'&&(m.type==='answer'||!m.type));const assistant=answers.map(m=>m.content).filter(Boolean).join('\n')||'抱歉，这一轮没有生成可显示的回复。';
    return{bot_id:botId,conversation_id:active,chat_id:chatId,message_id:answers.at(-1)?.id||'',assistant_message:assistant,model:start.data?.data?.model||this.modelName()};
  }
}
export const cozeService=new CozeService();
