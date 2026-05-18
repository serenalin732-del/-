// Five-color palette based on Teacher Ye's wisdom time method.
// The labels are user-facing Chinese descriptions; users can re-interpret them.
export const COLORS = {
  black: {
    id: 'black',
    label: '黑色 · 睡眠/不可支配时间',
    bg: '#1f2937',
    text: '#f9fafb',
    swatch: '#1f2937'
  },
  yellow: {
    id: 'yellow',
    label: '黄色 · 日常必要事',
    bg: '#fde68a',
    text: '#1f2937',
    swatch: '#fde68a'
  },
  blue: {
    id: 'blue',
    label: '蓝色 · 重要计划事（深度工作）',
    bg: '#bfdbfe',
    text: '#1f2937',
    swatch: '#bfdbfe'
  },
  red: {
    id: 'red',
    label: '红色 · 计划外/紧急事',
    bg: '#fecaca',
    text: '#7f1d1d',
    swatch: '#fecaca'
  },
  white: {
    id: 'white',
    label: '白色 · 灵活时间/留白',
    bg: '#ffffff',
    text: '#1f2937',
    swatch: '#ffffff'
  }
}

export const COLOR_ORDER = ['black', 'yellow', 'blue', 'red', 'white']

export function colorOf(key) {
  return COLORS[key] || COLORS.white
}
