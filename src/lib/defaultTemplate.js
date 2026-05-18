// Default daily template — recreated from the reference image
// (Teacher Ye's team's "一日五色工作表" example).
// Users can override per-day or save their own templates.
export const DEFAULT_TEMPLATE = {
  id: 'default',
  name: '叶老师标准日（参考模板）',
  rows: [
    { id: 1, color: 'black', plan: '休息、睡觉' },
    { id: 2, color: 'black', plan: '' },
    { id: 3, color: 'black', plan: '' },
    { id: 4, color: 'black', plan: '' },
    { id: 5, color: 'black', plan: '' },
    { id: 6, color: 'yellow', plan: '6:30 起床' },
    { id: 7, color: 'yellow', plan: '7:00 运动10-20分钟　7:30 早餐' },
    { id: 8, color: 'yellow', plan: '8:00 洗漱、化妆　8:30 开车去公司' },
    { id: 9, color: 'yellow', plan: '短信、邮件、电话沟通 5 位客户' },
    { id: 10, color: 'blue', plan: '整理潜在客户名单　每天撰写一份市场更新（100字）　周五 auto Scheduler' },
    { id: 11, color: 'yellow', plan: '休息 30 分钟　11:30 每天 5 封信件并投递' },
    { id: 12, color: 'yellow', plan: '搜素市场，提交 NDA，review 数据' },
    { id: 13, color: 'black', plan: '午餐 1 小时' },
    { id: 14, color: 'white', plan: '自由安排时间 / 可以安排保险内容的学习（2pm-5pm 也作为客户看房 showing 时间段）' },
    { id: 15, color: 'blue', plan: '15-30 分钟整理 CRM　15-30 创建更新新社交平台内容' },
    { id: 16, color: 'blue', plan: '1 小时　搭建 Email Campaign 平台自动化' },
    { id: 17, color: 'yellow', plan: '开车回家，准备晚餐' },
    { id: 18, color: 'yellow', plan: '晚餐时间' },
    { id: 19, color: 'white', plan: '灵活时间，作为阅读，或者家庭时间' },
    { id: 20, color: 'white', plan: '' },
    { id: 21, color: 'blue', plan: '断网时间，洗漱，睡前一日记录，次日安排的调整计划' },
    { id: 22, color: 'black', plan: '' },
    { id: 23, color: 'black', plan: '' },
    { id: 24, color: 'black', plan: '10:00 休息' }
  ]
}

export function blankDay(date, template = DEFAULT_TEMPLATE) {
  return {
    date,
    rows: template.rows.map(r => ({ ...r, action: '' })),
    unplanned: ['', '', ''],
    records: ['', '', '', '', '', '', '', ''],
    evaluation: '',
    templateUsed: template.id,
    updatedAt: null
  }
}
