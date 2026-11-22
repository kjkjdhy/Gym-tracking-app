import { useState, useEffect } from 'react'
import { db } from '../db'
import type { ExerciseSet } from '../db'
import { syncToGitHub } from '../lib/github-sync'

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DRAFT_KEY = 'gym-log-draft'

interface Draft {
  date: string
  exercises: ExerciseSet[]
  note: string
  unit: 'kg' | 'lbs'
}

function saveDraft(draft: Draft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

export default function LogPage() {
  const [date, setDate] = useState(localToday())
  const [exercises, setExercises] = useState<ExerciseSet[]>([])
  const [note, setNote] = useState('')
  const [unit, setUnit] = useState<'kg' | 'lbs'>('lbs')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // 启动时：先恢复草稿，没草稿则加载当天已有记录
  useEffect(() => {
    async function init() {
      const draft = loadDraft()
      if (draft) {
        setDate(draft.date)
        setExercises(draft.exercises)
        setNote(draft.note)
        setUnit(draft.unit ?? 'lbs')
        setLoaded(true)
        return
      }

      // 加载当天已有记录
      const today = localToday()
      const existing = await db.workoutLogs.where('date').equals(today).first()
      if (existing) {
        setExercises(existing.exercises)
        setNote(existing.note ?? '')
        // 检测现有记录的单位
        const firstUnit = existing.exercises[0]?.sets[0]?.unit
        if (firstUnit) setUnit(firstUnit)
      }

      // 读取设置里的默认单位
      const settings = await db.settings.orderBy('id').first()
      if (settings?.weightUnit && !existing) setUnit(settings.weightUnit)

      setLoaded(true)
    }
    init()
  }, [])

  // 任何变化都自动保存草稿
  useEffect(() => {
    if (!loaded) return
    saveDraft({ date, exercises, note, unit })
  }, [date, exercises, note, unit, loaded])

  // 切换日期时加载该日已有记录
  async function handleDateChange(newDate: string) {
    setDate(newDate)
    const existing = await db.workoutLogs.where('date').equals(newDate).first()
    if (existing) {
      setExercises(existing.exercises)
      setNote(existing.note ?? '')
    } else {
      setExercises([])
      setNote('')
    }
  }

  function addExercise() {
    setExercises([...exercises, { exerciseName: '', sets: [{ reps: 0, weight: 0, unit }] }])
  }

  function updateExerciseName(i: number, name: string) {
    const updated = [...exercises]
    updated[i] = { ...updated[i], exerciseName: name }
    setExercises(updated)
  }

  function addSet(ei: number) {
    const updated = [...exercises]
    updated[ei].sets.push({ reps: 0, weight: 0, unit })
    setExercises([...updated])
  }

  function updateSet(ei: number, si: number, field: 'reps' | 'weight', value: string) {
    const updated = [...exercises]
    updated[ei].sets[si] = { ...updated[ei].sets[si], [field]: Number(value) }
    setExercises([...updated])
  }

  function removeExercise(i: number) {
    setExercises(exercises.filter((_, idx) => idx !== i))
  }

  function removeSet(ei: number, si: number) {
    const updated = [...exercises]
    updated[ei].sets = updated[ei].sets.filter((_, idx) => idx !== si)
    setExercises([...updated])
  }

  async function handleSave() {
    if (exercises.length === 0) return
    setSaving(true)

    // 同一天更新，不同天新建
    const existing = await db.workoutLogs.where('date').equals(date).first()
    if (existing) {
      await db.workoutLogs.update(existing.id!, { exercises, note })
    } else {
      await db.workoutLogs.add({ date, exercises, note, createdAt: Date.now() })
    }

    clearDraft()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)

    // 后台同步 GitHub
    db.settings.orderBy('id').first().then(s => {
      if (s?.githubToken) {
        syncToGitHub(s.githubToken)
          .then(() => db.settings.update(s.id!, { lastSyncAt: Date.now() }))
          .catch(() => {})
      }
    })
  }

  const weightLabel = unit === 'kg' ? '重量 (kg)' : '重量 (lbs)'

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">训练记录</h1>
        {/* 单位切换 */}
        <div className="flex bg-zinc-800 rounded-lg p-0.5">
          {(['lbs', 'kg'] as const).map(u => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                unit === u ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm text-zinc-400 mb-1 block">日期</label>
        <input
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100 border border-zinc-700 focus:outline-none focus:border-orange-500"
        />
      </div>

      {exercises.map((exercise, ei) => (
        <div key={ei} className="bg-zinc-900 rounded-xl p-4 space-y-3 border border-zinc-800">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="动作名称（如：深蹲）"
              value={exercise.exerciseName}
              onChange={(e) => updateExerciseName(ei, e.target.value)}
              className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-orange-500"
            />
            <button onClick={() => removeExercise(ei)} className="text-zinc-500 hover:text-red-400 px-2 py-2">✕</button>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500 px-1">
              <span>组</span>
              <span>{weightLabel}</span>
              <span>次数</span>
            </div>
            {exercise.sets.map((set, si) => (
              <div key={si} className="grid grid-cols-3 gap-2 items-center">
                <span className="text-sm text-zinc-400 pl-1">{si + 1}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={set.weight || ''}
                  onChange={(e) => updateSet(ei, si, 'weight', e.target.value)}
                  placeholder="0"
                  className="bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100 border border-zinc-700 focus:outline-none focus:border-orange-500 text-sm"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={set.reps || ''}
                    onChange={(e) => updateSet(ei, si, 'reps', e.target.value)}
                    placeholder="0"
                    className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100 border border-zinc-700 focus:outline-none focus:border-orange-500 text-sm"
                  />
                  {exercise.sets.length > 1 && (
                    <button onClick={() => removeSet(ei, si)} className="text-zinc-600 hover:text-red-400 text-xs px-1">✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => addSet(ei)} className="text-sm text-orange-400 hover:text-orange-300">
            + 添加一组
          </button>
        </div>
      ))}

      <button
        onClick={addExercise}
        className="w-full py-3 border border-dashed border-zinc-700 rounded-xl text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
      >
        + 添加动作
      </button>

      <div>
        <label className="text-sm text-zinc-400 mb-1 block">备注（可选）</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="今天感觉怎么样？"
          rows={2}
          className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-orange-500 resize-none"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving || exercises.length === 0}
        className="w-full py-3 bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-xl font-semibold transition-colors"
      >
        {saving ? '保存中...' : saved ? '已保存!' : '保存训练'}
      </button>
    </div>
  )
}
