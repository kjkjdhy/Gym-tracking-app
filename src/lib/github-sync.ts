import { db } from '../db'

const REPO = 'kjkjdhy/Gym-tracking-app'
const FILE_PATH = 'workout-data.md'

// --- 生成 Markdown 格式的训练数据 ---
export async function generateMarkdown(): Promise<string> {
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })

  const [settings, allLogs, allPlans, allSummaries] = await Promise.all([
    db.settings.orderBy('id').first(),
    db.workoutLogs.orderBy('date').reverse().limit(60).toArray(),
    db.workoutPlans.toArray(),
    db.aiSummaries.orderBy('createdAt').reverse().toArray(),
  ])

  const activePlan = settings?.activePlanId
    ? allPlans.find(p => p.id === settings.activePlanId)
    : null

  const lines: string[] = []
  lines.push(`# 健身数据`)
  lines.push(`最后同步：${now}`)
  lines.push('')

  // 当前训练计划
  if (activePlan) {
    lines.push(`## 当前训练计划：${activePlan.name}`)
    lines.push('')
    for (const day of activePlan.days) {
      lines.push(`### ${day.dayLabel}`)
      for (const ex of day.exercises) {
        const weight = ex.targetWeight ? ` @${ex.targetWeight}kg` : ''
        lines.push(`- ${ex.name}: ${ex.targetSets}组×${ex.targetReps}${weight}`)
      }
      lines.push('')
    }
  } else {
    lines.push('## 当前训练计划')
    lines.push('暂未设置')
    lines.push('')
  }

  // 最近训练记录
  lines.push('## 最近训练记录')
  lines.push('')
  if (allLogs.length === 0) {
    lines.push('暂无记录')
  } else {
    for (const log of allLogs) {
      lines.push(`### ${log.date}`)
      for (const ex of log.exercises) {
        const sets = ex.sets.map(s => `${s.weight}kg×${s.reps}`).join(', ')
        lines.push(`- ${ex.exerciseName}: ${sets}`)
      }
      if (log.note) lines.push(`> ${log.note}`)
      lines.push('')
    }
  }

  // AI 总结
  const weeklySummaries = allSummaries.filter(s => s.type === 'weekly').slice(0, 4)
  const monthlySummaries = allSummaries.filter(s => s.type === 'monthly').slice(0, 3)
  const yearlySummaries = allSummaries.filter(s => s.type === 'yearly')

  if (weeklySummaries.length > 0 || monthlySummaries.length > 0 || yearlySummaries.length > 0) {
    lines.push('## 训练总结')
    lines.push('')

    for (const s of yearlySummaries) {
      lines.push(`### 年总结（${s.periodStart.slice(0, 4)}年）`)
      lines.push(s.content)
      lines.push('')
    }

    for (const s of monthlySummaries) {
      lines.push(`### 月总结（${s.periodStart.slice(0, 7)}）`)
      lines.push(s.content)
      lines.push('')
    }

    for (const s of weeklySummaries) {
      lines.push(`### 周总结（${s.periodStart}）`)
      lines.push(s.content)
      lines.push('')
    }
  }

  return lines.join('\n')
}

// --- 推送到 GitHub ---
export async function syncToGitHub(token: string): Promise<void> {
  const content = await generateMarkdown()
  const apiUrl = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`

  // 获取当前文件的 SHA（更新文件时需要）
  let sha: string | undefined
  const getRes = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  if (getRes.ok) {
    const data = await getRes.json() as { sha: string }
    sha = data.sha
  }

  // 将内容 base64 编码
  const encoded = btoa(unescape(encodeURIComponent(content)))

  const body: Record<string, unknown> = {
    message: `sync: workout data ${new Date().toISOString().slice(0, 10)}`,
    content: encoded,
  }
  if (sha) body.sha = sha

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!putRes.ok) {
    const err = await putRes.json() as { message?: string }
    throw new Error(err.message ?? `HTTP ${putRes.status}`)
  }
}
