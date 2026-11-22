import { useState, useEffect } from 'react'
import { db } from '../db'
import type { ExerciseSet, SetRecord } from '../db'
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
  } catch { return null }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

function calcVolume(sets: SetRecord[], unit: 'kg' | 'lbs') {
  const total = sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
  return total > 0 ? `${total.toLocaleString()} ${unit}` : null
}

export default function LogPage() {
  const [date, setDate] = useState(localToday())
  const [exercises, setExercises] = useState<ExerciseSet[]>([])
  const [note, setNote] = useState('')
  const [unit, setUnit] = useState<'kg' | 'lbs'>('lbs')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)

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
      const today = localToday()
      const existing = await db.workoutLogs.where('date').equals(today).first()
      if (existing) {
        setExercises(existing.exercises)
        setNote(existing.note ?? '')
        const firstUnit = existing.exercises[0]?.sets[0]?.unit
        if (firstUnit) setUnit(firstUnit)
      } else {
        const settings = await db.settings.orderBy('id').first()
        if (settings?.weightUnit) setUnit(settings.weightUnit)
      }
      setLoaded(true)
    }
    init()
  }, [])

  useEffect(() => {
    if (!loaded) return
    saveDraft({ date, exercises, note, unit })
  }, [date, exercises, note, unit, loaded])

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
    setExercises(prev => [...prev, { exerciseName: '', sets: [{ reps: 0, weight: 0, unit, done: false }] }])
  }

  function updateExerciseName(i: number, name: string) {
    setExercises(prev => prev.map((ex, idx) => idx === i ? { ...ex, exerciseName: name } : ex))
  }

  function addSet(ei: number) {
    setExercises(prev => {
      const updated = [...prev]
      const lastSet = updated[ei].sets[updated[ei].sets.length - 1]
      updated[ei] = {
        ...updated[ei],
        sets: [...updated[ei].sets, {
          reps: lastSet?.reps ?? 0,
          weight: lastSet?.weight ?? 0,
          unit,
          done: false,
        }],
      }
      return updated
    })
  }

  function updateSet(ei: number, si: number, field: 'reps' | 'weight', value: string) {
    setExercises(prev => {
      const updated = prev.map(ex => ({ ...ex, sets: [...ex.sets] }))
      updated[ei].sets[si] = { ...updated[ei].sets[si], [field]: Number(value) }
      return updated
    })
  }

  function toggleDone(ei: number, si: number) {
    setExercises(prev => {
      const updated = prev.map(ex => ({ ...ex, sets: [...ex.sets] }))
      updated[ei].sets[si] = { ...updated[ei].sets[si], done: !updated[ei].sets[si].done }
      return updated
    })
  }

  function removeExercise(i: number) {
    setExercises(prev => prev.filter((_, idx) => idx !== i))
  }

  function removeSet(ei: number, si: number) {
    setExercises(prev => {
      const updated = prev.map(ex => ({ ...ex, sets: [...ex.sets] }))
      updated[ei].sets = updated[ei].sets.filter((_, idx) => idx !== si)
      return updated
    })
  }

  async function handleSave() {
    if (exercises.length === 0) return
    setSaving(true)
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
    db.settings.orderBy('id').first().then(s => {
      if (s?.githubToken) {
        syncToGitHub(s.githubToken)
          .then(() => db.settings.update(s.id!, { lastSyncAt: Date.now() }))
          .catch(() => {})
      }
    })
  }

  const doneCount = exercises.flatMap(e => e.sets).filter(s => s.done).length
  const totalSets = exercises.flatMap(e => e.sets).length

  return (
    <div className="p-4 space-y-4">
      {/* 顶栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">训练记录</h1>
          {totalSets > 0 && (
            <p className="text-xs text-zinc-500 mt-0.5">{doneCount}/{totalSets} 组完成</p>
          )}
        </div>
        <div className="flex bg-zinc-800 rounded-lg p-0.5">
          {(['lbs', 'kg'] as const).map(u => (
            <button key={u} onClick={() => setUnit(u)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                unit === u ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}>
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* 日期 */}
      <input
        type="date"
        value={date}
        onChange={(e) => handleDateChange(e.target.value)}
        className="w-full bg-zinc-800 rounded-lg px-3 py-2.5 text-zinc-100 border border-zinc-700 focus:outline-none focus:border-orange-500"
      />

      {/* 动作列表 */}
      {exercises.map((exercise, ei) => {
        const volume = calcVolume(exercise.sets, unit)
        const doneSets = exercise.sets.filter(s => s.done).length
        return (
          <div key={ei} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
            {/* 动作标题 */}
            <div className="flex items-center gap-2 px-4 pt-4 pb-2">
              <input
                type="text"
                placeholder="动作名称"
                value={exercise.exerciseName}
                onChange={(e) => updateExerciseName(ei, e.target.value)}
                className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-600 font-semibold text-base focus:outline-none"
              />
              <button onClick={() => removeExercise(ei)} className="text-zinc-600 hover:text-red-400 text-sm p-1">✕</button>
            </div>

            {/* 统计行 */}
            <div className="flex items-center gap-3 px-4 pb-2">
              <span className="text-xs text-zinc-500">{doneSets}/{exercise.sets.length} 组</span>
              {volume && <span className="text-xs text-zinc-500">总量 {volume}</span>}
            </div>

            {/* 组列表表头 */}
            <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 px-4 pb-1">
              <span className="text-xs text-zinc-600 text-center">组</span>
              <span className="text-xs text-zinc-600 text-center">{unit}</span>
              <span className="text-xs text-zinc-600 text-center">次数</span>
              <span />
            </div>

            {/* 组列表 */}
            <div className="px-4 space-y-2 pb-3">
              {exercise.sets.map((set, si) => (
                <div key={si} className={`grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 items-center rounded-xl px-0 py-1 transition-colors ${set.done ? 'opacity-60' : ''}`}>
                  {/* 组号 / 打勾 */}
                  <button
                    onClick={() => toggleDone(ei, si)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      set.done
                        ? 'bg-orange-500 text-white'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}
                  >
                    {set.done ? '✓' : si + 1}
                  </button>

                  {/* 重量 */}
                  <input
                    type="number"
                    inputMode="decimal"
                    value={set.weight || ''}
                    onChange={(e) => updateSet(ei, si, 'weight', e.target.value)}
                    placeholder="0"
                    className="bg-zinc-800 rounded-xl px-3 py-2.5 text-zinc-100 text-center text-sm border border-zinc-700 focus:outline-none focus:border-orange-500 w-full"
                  />

                  {/* 次数 */}
                  <input
                    type="number"
                    inputMode="numeric"
                    value={set.reps || ''}
                    onChange={(e) => updateSet(ei, si, 'reps', e.target.value)}
                    placeholder="0"
                    className="bg-zinc-800 rounded-xl px-3 py-2.5 text-zinc-100 text-center text-sm border border-zinc-700 focus:outline-none focus:border-orange-500 w-full"
                  />

                  {/* 删除 */}
                  <button
                    onClick={() => removeSet(ei, si)}
                    className="text-zinc-700 hover:text-red-400 text-sm flex items-center justify-center h-7"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* 添加一组 */}
            <button
              onClick={() => addSet(ei)}
              className="w-full py-3 text-sm text-zinc-500 hover:text-orange-400 border-t border-zinc-800 transition-colors"
            >
              + 添加一组
            </button>
          </div>
        )
      })}

      {/* 添加动作 */}
      <button
        onClick={addExercise}
        className="w-full py-3.5 border border-dashed border-zinc-700 rounded-2xl text-zinc-500 hover:text-zinc-200 hover:border-zinc-500 transition-colors text-sm"
      >
        + 添加动作
      </button>

      {/* 备注 */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="备注"
        rows={2}
        className="w-full bg-zinc-900 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 border border-zinc-800 focus:outline-none focus:border-orange-500 resize-none text-sm"
      />

      {/* 保存 */}
      <button
        onClick={handleSave}
        disabled={saving || exercises.length === 0}
        className="w-full py-4 bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-2xl font-semibold text-base transition-colors"
      >
        {saving ? '保存中...' : saved ? '已保存!' : '保存训练'}
      </button>
    </div>
  )
}
