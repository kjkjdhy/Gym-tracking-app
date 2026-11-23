export interface ExerciseTemplate {
  name: string
  category: string
}

export const CATEGORIES = ['胸', '背', '肩', '腿', '二头', '三头', '斜方', '腹肌']

export const EXERCISES: ExerciseTemplate[] = [
  // 胸
  { name: '卧推', category: '胸' },
  { name: '哑铃飞鸟', category: '胸' },
  { name: '上斜卧推', category: '胸' },

  // 背
  { name: '高位下拉', category: '背' },
  { name: '坐姿绳索划船', category: '背' },
  { name: '引体向上', category: '背' },

  // 肩
  { name: '哑铃推肩', category: '肩' },
  { name: '哑铃侧平举', category: '肩' },
  { name: '哑铃反向飞鸟', category: '肩' },

  // 腿
  { name: '杠铃深蹲', category: '腿' },
  { name: '腿举', category: '腿' },
  { name: '哑铃箭步蹲', category: '腿' },
  { name: '提踵', category: '腿' },
  { name: '腿屈伸', category: '腿' },

  // 二头
  { name: '反手引体向上', category: '二头' },
  { name: '杠铃弯举', category: '二头' },
  { name: '哑铃垂式弯举', category: '二头' },

  // 三头
  { name: '坐姿哑铃划船', category: '三头' },
  { name: '绳索下拉', category: '三头' },
  { name: '双杠臂屈伸', category: '三头' },

  // 斜方
  { name: '斜方', category: '斜方' },

  // 腹肌
  { name: '高卷腿', category: '腹肌' },
]
