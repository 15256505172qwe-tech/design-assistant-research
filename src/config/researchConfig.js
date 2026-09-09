export const DEFAULT_STAGE = 'practice_shopping_bag';

export const COURSE_STAGES = {
  practice_shopping_bag: {
    label: '第1课｜Shopping Bag 流程体验',
    task: 'shopping_bag',
    formal_data: false,
    version: 'practice',
    phase: 'practice',
    ai_enabled: true,
  },
  parachute_intro: {
    label: '第2课｜降落伞任务导入',
    task: 'parachute',
    formal_data: true,
    version: null,
    phase: 'intro',
    ai_enabled: false,
  },
  parachute_investigation: {
    label: '第3课｜变量实验与必要知识',
    task: 'parachute',
    formal_data: true,
    version: null,
    phase: 'investigation',
    ai_enabled: false,
  },
  parachute_design_v1: {
    label: '第4课｜方案设计与制作 V1',
    task: 'parachute',
    formal_data: true,
    version: 'V1',
    phase: 'design_v1',
    ai_enabled: false,
  },
  parachute_v1_test: {
    label: '第5课｜V1 测试与自主判断',
    task: 'parachute',
    formal_data: true,
    version: 'V1',
    phase: 'v1_test',
    ai_enabled: false,
  },
  parachute_build_v2: {
    label: '第5–6课｜自主修改并制作 V2',
    task: 'parachute',
    formal_data: true,
    version: 'V2',
    phase: 'build_v2',
    ai_enabled: false,
  },
  parachute_v2_retest: {
    label: '第6课｜V2 复测与反思',
    task: 'parachute',
    formal_data: true,
    version: 'V2',
    phase: 'v2_retest',
    ai_enabled: false,
  },
  parachute_ai_intervention: {
    label: '第7课｜唯一一次正式 AI 迭代',
    task: 'parachute',
    formal_data: true,
    version: 'V2',
    phase: 'ai',
    ai_enabled: true,
  },
  parachute_build_v3: {
    label: '第8课｜根据最终决定制作 V3',
    task: 'parachute',
    formal_data: true,
    version: 'V3',
    phase: 'build_v3',
    ai_enabled: false,
  },
  parachute_v3_final_test: {
    label: '第8课｜V3 最终复测与反思',
    task: 'parachute',
    formal_data: true,
    version: 'V3',
    phase: 'final_test',
    ai_enabled: false,
  },
  parachute_makeup: {
    label: '第9课｜机动补测',
    task: 'parachute',
    formal_data: true,
    version: 'V3',
    phase: 'makeup',
    ai_enabled: false,
  },
  parachute_reflection: {
    label: '第10–12课｜版本整理、访谈与收尾',
    task: 'parachute',
    formal_data: true,
    version: 'V3',
    phase: 'reflection',
    ai_enabled: false,
  },
};

export const COURSE_STAGE_OPTIONS = Object.entries(COURSE_STAGES).map(([value, config]) => ({
  value,
  label: config.label,
}));

export const PARACHUTE_BRIEF = {
  title: 'Model Parachute',
  goal: '在统一材料、载荷和投放条件下，设计一个能够可靠展开、稳定下降，并尽可能延长下降时间的模型降落伞。',
  criteria: [
    '能够可靠展开并完成下降',
    '下降过程尽量稳定，避免明显翻转或过度摆动',
    '在统一条件下尽可能延长下降时间',
  ],
  constraints: [
    '使用课堂规定的材料与载荷',
    '采用统一投放高度和释放方式',
    '以课堂真实测试数据作为判断依据',
  ],
  shared_knowledge: [
    '重力使降落伞向下运动',
    '空气阻力会影响下降表现',
    '伞面、载荷、悬线和结构等变量可能影响表现',
    '比较设计时要尽量保持测试条件一致',
  ],
};

export const SHOPPING_BAG_PRACTICE = {
  title: 'Shopping Bag 失败案例',
  evidence: [
    '观察：袋子的提手连接处在受力后明显拉长并发生撕裂。',
    '观察：袋身其他区域没有出现同样程度的破坏。',
    '任务：先根据这些失败证据形成自己的判断，再和 AI 讨论，最后由你自己决定如何修改。',
  ],
};

export const SCORE_FIELDS = ['G0', 'E0', 'H0', 'I0', 'G1', 'E1', 'H1', 'I1', 'Q_V1', 'Q_V2', 'Q_V3'];

export const FORMAL_RECORD_FIELDS = [
  'V1_test_data',
  'V1_problem',
  'V1_problem_evidence',
  'V1_revision_options',
  'V1_selected_revision',
  'V1_selection_reason',
  'actual_modification_v1_v2',
  'V2_test_data',
  'V2_reflection',
  'pre_ai_problem',
  'pre_ai_evidence',
  'pre_ai_revision_options',
  'pre_ai_preferred_revision',
  'pre_ai_preference_reason',
  'post_ai_problem',
  'post_ai_final_revision',
  'post_ai_final_reason',
  'actual_modification_v2_v3',
  'V3_test_data',
  'V3_reflection',
  'external_ai_use',
  'external_ai_frequency',
  'external_ai_changed_design',
  'interview_selected',
  'interview_status',
  'interview_date',
  'interview_notes',
];

export const PRACTICE_RECORD_FIELDS = [
  'practice_problem',
  'practice_evidence',
  'practice_initial_revision',
  'practice_initial_reason',
  'practice_post_problem',
  'practice_post_revision',
  'practice_post_reason',
];
