export interface ExerciseTemplate {
  name: string
  category: string
}

export const CATEGORIES = ['胸', '背', '肩', '腿', '手臂', '核心', '其他']

export const EXERCISES: ExerciseTemplate[] = [
  // 胸
  { name: '卧推', category: '胸' },
  { name: '上斜卧推', category: '胸' },
  { name: '下斜卧推', category: '胸' },
  { name: '哑铃卧推', category: '胸' },
  { name: '上斜哑铃卧推', category: '胸' },
  { name: '哑铃飞鸟', category: '胸' },
  { name: '上斜哑铃飞鸟', category: '胸' },
  { name: '龙门架夹胸', category: '胸' },
  { name: '蝴蝶机夹胸', category: '胸' },
  { name: '双杠臂屈伸', category: '胸' },

  // 背
  { name: '引体向上', category: '背' },
  { name: '高位下拉', category: '背' },
  { name: '坐姿划船', category: '背' },
  { name: '单臂哑铃划船', category: '背' },
  { name: '俯身杠铃划船', category: '背' },
  { name: 'T杠划船', category: '背' },
  { name: '硬拉', category: '背' },
  { name: '直腿硬拉', category: '背' },
  { name: '绳索直臂下压', category: '背' },
  { name: '反握高位下拉', category: '背' },

  // 肩
  { name: '杠铃肩推', category: '肩' },
  { name: '哑铃肩推', category: '肩' },
  { name: '阿诺德推举', category: '肩' },
  { name: '侧平举', category: '肩' },
  { name: '前平举', category: '肩' },
  { name: '俯身侧平举', category: '肩' },
  { name: '绳索侧平举', category: '肩' },
  { name: '颈后推举', category: '肩' },
  { name: '直立划船', category: '肩' },

  // 腿
  { name: '深蹲', category: '腿' },
  { name: '腿举', category: '腿' },
  { name: '哈克深蹲', category: '腿' },
  { name: '保加利亚深蹲', category: '腿' },
  { name: '箭步蹲', category: '腿' },
  { name: '腿屈伸', category: '腿' },
  { name: '腿弯举', category: '腿' },
  { name: '罗马尼亚硬拉', category: '腿' },
  { name: '小腿提踵', category: '腿' },
  { name: '坐姿提踵', category: '腿' },

  // 手臂
  { name: '哑铃弯举', category: '手臂' },
  { name: '杠铃弯举', category: '手臂' },
  { name: '锤式弯举', category: '手臂' },
  { name: '牧师弯举', category: '手臂' },
  { name: '绳索弯举', category: '手臂' },
  { name: '集中弯举', category: '手臂' },
  { name: '窄距卧推', category: '手臂' },
  { name: '颅骨碎裂者', category: '手臂' },
  { name: '绳索下压', category: '手臂' },
  { name: '仰卧臂屈伸', category: '手臂' },
  { name: '哑铃臂屈伸', category: '手臂' },
  { name: '绳索臂屈伸', category: '手臂' },

  // 核心
  { name: '卷腹', category: '核心' },
  { name: '仰卧起坐', category: '核心' },
  { name: '悬挂举腿', category: '核心' },
  { name: '平板支撑', category: '核心' },
  { name: '俄罗斯转体', category: '核心' },
  { name: '卷腹机', category: '核心' },
  { name: '绳索卷腹', category: '核心' },
]
