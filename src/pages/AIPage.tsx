import { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// --- 时间工具 ---
function lastMonthStart(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

function lastYearStart(): string {
  return `${new Date().getFullYear() - 1}-01-01`
}

function monthOf(date: string): string {
  return date.slice(0, 7)
}

function yearOf(date: string): string {
  return date.slice(0, 4)
}

// --- 构建 AI 上下文 ---
async function buildSystemPrompt(): Promise<string> {
  const [recentLogs, settings] = await Promise.all([
    db.workoutLogs.orderBy('date').reverse().limit(14).toArray(),
    db.settings.orderBy('id').first(),
  ])

  const activePlan = settings?.activePlanId
    ? await db.workoutPlans.get(settings.activePlanId)
    : null

  const recentWeeklySummaries = await db.aiSummaries
    .where('type').equals('weekly')
    .reverse().sortBy('periodStart')
    .then(arr => arr.slice(0, 4))

  const latestMonthlySummary = await db.aiSummaries
    .where('type').equals('monthly')
    .last()

  const latestYearlySummary = await db.aiSummaries
    .where('type').equals('yearly')
    .last()

  const logsText = recentLogs.length > 0
    ? recentLogs.map(log => {
        const exercises = log.exercises.map(ex =>
          `  - ${ex.exerciseName}: ${ex.sets.map(s => `${s.weight}kg×${s.reps}`).join(', ')}`
        ).join('\n')
        return `${log.date}:\n${exercises}${log.note ? `\n  备注: ${log.note}` : ''}`
      }).join('\n\n')
    : '暂无训练记录'

  const planText = activePlan
    ? `当前计划: ${activePlan.name}\n` + activePlan.days.map(d =>
        `  ${d.dayLabel}:\n` + d.exercises.map(e =>
          `    - ${e.name}: ${e.targetSets}组×${e.targetReps}${e.targetWeight ? ` @${e.targetWeight}kg` : ''}`
        ).join('\n')
      ).join('\n')
    : '暂无活跃训练计划'

  const weeklySummaryText = recentWeeklySummaries.length > 0
    ? recentWeeklySummaries.map((s, i) => `[周总结 ${i + 1} - ${s.periodStart}]\n${s.content}`).join('\n\n')
    : ''

  return `你是一个专业的健身教练AI助手。以下是用户的训练数据：

=== 最近14天训练记录 ===
${logsText}

=== 当前训练计划 ===
${planText}

${weeklySummaryText ? `=== 近期周总结（最近4条）===\n${weeklySummaryText}` : ''}

${latestMonthlySummary ? `=== 最新月总结（${monthOf(latestMonthlySummary.periodStart)}）===\n${latestMonthlySummary.content}` : ''}

${latestYearlySummary ? `=== 最新年总结（${yearOf(latestYearlySummary.periodStart)}年）===\n${latestYearlySummary.content}` : ''}

请根据以上数据，以专业、鼓励的态度回答用户关于健身的问题。可以分析进步趋势、调整训练计划、解答健身疑问。回答用中文。`
}

// --- 自动生成月/年总结 ---
async function checkAndGenerateAutoSummaries(apiKey: string): Promise<void> {
  const genAI = new GoogleGenerativeAI(apiKey)

  // 检查上个月是否有月总结
  const lms = lastMonthStart()
  const lmsMonth = monthOf(lms)
  const existingMonthly = await db.aiSummaries
    .where('type').equals('monthly')
    .filter(s => monthOf(s.periodStart) === lmsMonth)
    .first()

  if (!existingMonthly) {
    const monthlyWeeklies = await db.aiSummaries
      .where('type').equals('weekly')
      .filter(s => monthOf(s.periodStart) === lmsMonth)
      .toArray()
    const monthlyLogs = await db.workoutLogs
      .filter(l => monthOf(l.date) === lmsMonth)
      .toArray()

    if (monthlyWeeklies.length > 0 || monthlyLogs.length > 0) {
      const sourceText = monthlyWeeklies.length > 0
        ? `以下是${lmsMonth}的周总结：\n\n` + monthlyWeeklies.map(s => s.content).join('\n\n---\n\n')
        : `以下是${lmsMonth}的训练记录：\n\n` + monthlyLogs.map(log =>
            `${log.date}: ` + log.exercises.map(ex =>
              `${ex.exerciseName} ${ex.sets.map(s => `${s.weight}kg×${s.reps}`).join(',')}`
            ).join('; ')
          ).join('\n')

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: '你是专业健身教练，请根据提供的训练数据生成月度总结，包括：本月整体训练情况、主要进步、不足之处、下月建议。用中文回答，简洁清晰。',
      })
      const result = await model.generateContent(sourceText)
      const content = result.response.text()
      if (content) {
        await db.aiSummaries.add({ type: 'monthly', periodStart: lms, content, createdAt: Date.now() })
      }
    }
  }

  // 检查上一年是否有年总结
  const lys = lastYearStart()
  const lysYear = yearOf(lys)
  const existingYearly = await db.aiSummaries
    .where('type').equals('yearly')
    .filter(s => yearOf(s.periodStart) === lysYear)
    .first()

  if (!existingYearly) {
    const yearlyMonthlies = await db.aiSummaries
      .where('type').equals('monthly')
      .filter(s => yearOf(s.periodStart) === lysYear)
      .toArray()

    if (yearlyMonthlies.length > 0) {
      const sourceText = `以下是${lysYear}年的月总结：\n\n` +
        yearlyMonthlies.map(s => `[${monthOf(s.periodStart)}]\n${s.content}`).join('\n\n---\n\n')

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: '你是专业健身教练，请根据提供的月度总结生成年度健身总结，包括：全年训练概览、最大进步、关键里程碑、明年目标建议。用中文回答，重点突出。',
      })
      const result = await model.generateContent(sourceText)
      const content = result.response.text()
      if (content) {
        await db.aiSummaries.add({ type: 'yearly', periodStart: lys, content, createdAt: Date.now() })
      }
    }
  }
}

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoSummaryStatus, setAutoSummaryStatus] = useState('')
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const settings = useLiveQuery(() => db.settings.orderBy('id').first())
  const hasCheckedRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const apiKey = settings?.groqApiKey
    if (!apiKey || hasCheckedRef.current) return
    hasCheckedRef.current = true
    setAutoSummaryStatus('检查总结...')
    checkAndGenerateAutoSummaries(apiKey)
      .then(() => setAutoSummaryStatus(''))
      .catch(() => setAutoSummaryStatus(''))
  }, [settings?.groqApiKey])

  async function sendMessage() {
    if (!input.trim() || loading) return
    const apiKey = settings?.groqApiKey
    if (!apiKey) { setError('请先在设置中填入 Gemini API Key'); return }

    const userMsg: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setError('')

    try {
      const systemPrompt = await buildSystemPrompt()
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: systemPrompt,
      })

      // 转换历史消息格式（Gemini 用 'model' 而非 'assistant'）
      const history = newMessages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }],
      }))

      const chat = model.startChat({ history })
      const result = await chat.sendMessage(userMsg.content)
      const content = result.response.text()

      setMessages([...newMessages, { role: 'assistant', content }])
    } catch (e) {
      setError(`请求失败: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  async function generateWeeklySummary() {
    const apiKey = settings?.groqApiKey
    if (!apiKey) { setError('请先填入 Gemini API Key'); return }

    setLoading(true)
    setError('')
    try {
      const systemPrompt = await buildSystemPrompt()
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: systemPrompt,
      })
      const result = await model.generateContent(
        '请对我最近的训练做一个详细周总结，包括：训练频率、各项目的进步情况、优缺点分析，以及下周的训练建议。'
      )
      const content = result.response.text()
      const periodStart = new Date().toISOString().slice(0, 10)
      await db.aiSummaries.add({ type: 'weekly', periodStart, content, createdAt: Date.now() })
      setMessages(prev => [...prev, { role: 'assistant', content: `周总结（${periodStart}）\n\n${content}` }])
    } catch {
      setError('生成总结失败，请检查网络')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">AI 助手</h1>
          {autoSummaryStatus && (
            <p className="text-xs text-zinc-500">{autoSummaryStatus}</p>
          )}
        </div>
        <button
          onClick={generateWeeklySummary}
          disabled={loading}
          className="text-sm text-orange-400 hover:text-orange-300 disabled:text-zinc-600"
        >
          生成周总结
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <p className="text-zinc-400">你好！我是你的 AI 健身教练。</p>
            <p className="text-zinc-500 text-sm">我已读取你的训练数据和历史总结，可以问我任何健身问题。</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-orange-500 text-white rounded-br-sm'
                : 'bg-zinc-800 text-zinc-100 rounded-bl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3">
              <span className="text-zinc-400 text-sm">思考中...</span>
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-zinc-800 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="问任何健身问题..."
          className="flex-1 bg-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-orange-500 text-sm"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 text-white rounded-xl px-4 py-3 font-medium transition-colors"
        >
          发送
        </button>
      </div>
    </div>
  )
}
