import { useState, useEffect } from 'react'
import { db } from '../db'
import type { ExerciseSet, WorkoutPlan } from '../db'
import { syncToGitHub } from '../lib/github-sync'
import ExercisePicker from '../components/ExercisePicker'

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

function saveDraft(d: Draft) { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) }
function loadDraft(): Draft | null {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') } catch { return null }
}
function clearDraft() { localStorage.removeItem(DRAFT_KEY) }

function calcVolume(sets: ExerciseSet['sets'], unit: string) {
  const total = sets.reduce((s, r) => s + r.weight * r.reps, 0)
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
  const [showPicker, setShowPicker] = useState(false)
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null)
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null)

  useEffect(() => {
    async function init() {
      // 加载活跃计划
      const settings = await db.settings.orderBy('id').first()
      if (settings?.activePlanId) {
        const plan = await db.workoutPlans.get(settings.activePlanId)
        if (plan) setActivePlan(plan)
      }

      const draft = loadDraft()
      if (draft) {
        setDate(draft.date); setExercises(draft.exercises)
        setNote(draft.note); setUnit(draft.unit ?? 'lbs')
        setLoaded(true); return
      }
      const today = localToday()
      const existing = await db.workoutLogs.where('date').equals(today).first()
      if (existing) {
        setExercises(existing.exercises); setNote(existing.note ?? '')
        const u = existing.exercises[0]?.sets[0]?.unit
        if (u) setUnit(u)
      } else {
        if (settings?.weightUnit) setUnit(settings.weightUnit)
      }
      setLoaded(true)
    }
    init()
  }, [])

  // 选择训练日：从计划加载动作，并带入上次重量
  async function loadPlanDay(dayIndex: number) {
    if (!activePlan) return
    const day = activePlan.days[dayIndex]
    if (!day) return
    setSelectedDayIndex(dayIndex)

    const newExercises: ExerciseSet[] = await Promise.all(
      day.exercises.map(async (planEx) => {
        // 查找该动作的上次使用重量
        const recentLogs = await db.workoutLogs.orderBy('date').reverse().limit(30).toArray()
        let lastWeight = 0
        for (const log of recentLogs) {
          const found = log.exercises.find(e => e.exerciseName === planEx.name)
          if (found && found.sets.length > 0) {
            lastWeight = found.sets[0].weight
            break
          }
        }

        const sets = Array.from({ length: planEx.targetSets }, () => ({
          reps: 0,
          weight: lastWeight,
          unit,
          done: false,
        }))
        return { exerciseName: planEx.name, sets }
      })
    )
    setExercises(newExercises)
  }

  useEffect(() => {
    if (!loaded) return
    saveDraft({ date, exercises, note, unit })
  }, [date, exercises, note, unit, loaded])

  async function handleDateChange(newDate: string) {
    setDate(newDate)
    const existing = await db.workoutLogs.where('date').equals(newDate).first()
    if (existing) { setExercises(existing.exercises); setNote(existing.note ?? '') }
    else { setExercises([]); setNote('') }
  }

  function addExercise(name: string) {
    setExercises(prev => [...prev, { exerciseName: name, sets: [{ reps: 0, weight: 0, unit, done: false }] }])
  }

  function updateExerciseName(i: number, name: string) {
    setExercises(prev => prev.map((ex, idx) => idx === i ? { ...ex, exerciseName: name } : ex))
  }

  function addSet(ei: number) {
    setExercises(prev => {
      const updated = prev.map(ex => ({ ...ex, sets: [...ex.sets] }))
      const last = updated[ei].sets[updated[ei].sets.length - 1]
      updated[ei].sets.push({ reps: last?.reps ?? 0, weight: last?.weight ?? 0, unit, done: false })
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
    if (existing) await db.workoutLogs.update(existing.id!, { exercises, note })
    else await db.workoutLogs.add({ date, exercises, note, createdAt: Date.now() })
    clearDraft()
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    db.settings.orderBy('id').first().then(s => {
      if (s?.githubToken) syncToGitHub(s.githubToken)
        .then(() => db.settings.update(s.id!, { lastSyncAt: Date.now() }))
        .catch(() => {})
    })
  }

  const doneCount = exercises.flatMap(e => e.sets).filter(s => s.done).length
  const totalSets = exercises.flatMap(e => e.sets).length

  return (
    <>
      <div className="p-4 space-y-5 bg-black min-h-full">

        {/* 顶栏 */}
        <div className="flex items-start justify-between pt-1">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">训练记录</h1>
            {totalSets > 0 && (
              <p className="text-xs text-zinc-500 mt-0.5 font-medium">{doneCount} / {totalSets} 组完成</p>
            )}
          </div>
          <div className="flex bg-zinc-900 rounded-xl p-0.5 border border-white/5">
            {(['lbs', 'kg'] as const).map(u => (
              <button key={u} onClick={() => setUnit(u)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                  unit === u ? 'bg-orange-500 text-white' : 'text-zinc-500'
                }`}>
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* 训练日选择 */}
        {activePlan && activePlan.days.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4">
            {activePlan.days.map((day, i) => (
              <button key={i} onClick={() => loadPlanDay(i)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                  selectedDayIndex === i ? 'bg-orange-500 text-white' : 'bg-zinc-950 text-zinc-400 border border-white/5'
                }`}>
                {day.dayLabel}
              </button>
            ))}
          </div>
        )}

        {/* 日期 */}
        <input
          type="date"
          value={date}
          onChange={e => handleDateChange(e.target.value)}
          className="w-full bg-zinc-950 rounded-xl px-4 py-3 text-white border border-white/5 focus:outline-none focus:border-orange-500/50 text-sm"
        />

        {/* 动作列表 */}
        {exercises.map((exercise, ei) => {
          const volume = calcVolume(exercise.sets, unit)
          const doneSets = exercise.sets.filter(s => s.done).length
          return (
            <div key={ei} className="rounded-2xl overflow-hidden border border-white/5">
              {/* 动作标题 */}
              <div className="bg-zinc-950 px-4 pt-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <input
                    type="text"
                    value={exercise.exerciseName}
                    onChange={e => updateExerciseName(ei, e.target.value)}
                    placeholder="动作名称"
                    className="flex-1 bg-transparent text-white font-black text-lg tracking-tight focus:outline-none placeholder-zinc-700"
                  />
                  <button onClick={() => removeExercise(ei)} className="text-zinc-700 hover:text-red-500 mt-1 text-sm">✕</button>
                </div>
                <div className="flex gap-3 mt-1">
                  <span className="text-xs text-zinc-600 font-medium">{doneSets}/{exercise.sets.length} 组</span>
                  {volume && <span className="text-xs text-zinc-600 font-medium">总量 {volume}</span>}
                </div>
              </div>

              {/* 表头 */}
              <div className="grid grid-cols-[2.5rem_1fr_1fr_2rem] gap-2 px-4 py-2 bg-black border-t border-white/5">
                <span className="text-xs text-zinc-700 font-bold text-center">组</span>
                <span className="text-xs text-zinc-700 font-bold text-center">{unit.toUpperCase()}</span>
                <span className="text-xs text-zinc-700 font-bold text-center">次数</span>
                <span />
              </div>

              {/* 组列表 */}
              <div className="bg-black px-4 space-y-2 pb-3 pt-1">
                {exercise.sets.map((set, si) => (
                  <div key={si} className={`grid grid-cols-[2.5rem_1fr_1fr_2rem] gap-2 items-center transition-opacity ${set.done ? 'opacity-40' : ''}`}>
                    <button
                      onClick={() => toggleDone(ei, si)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors ${
                        set.done ? 'bg-orange-500 text-white' : 'border border-zinc-800 text-zinc-500'
                      }`}
                    >
                      {set.done ? '✓' : si + 1}
                    </button>
                    <input
                      type="number" inputMode="decimal"
                      value={set.weight || ''}
                      onChange={e => updateSet(ei, si, 'weight', e.target.value)}
                      placeholder="—"
                      className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-3 text-white text-center font-bold text-base focus:outline-none focus:border-orange-500/50 w-full"
                    />
                    <input
                      type="number" inputMode="numeric"
                      value={set.reps || ''}
                      onChange={e => updateSet(ei, si, 'reps', e.target.value)}
                      placeholder="—"
                      className="bg-zinc-950 border border-white/5 rounded-xl px-3 py-3 text-white text-center font-bold text-base focus:outline-none focus:border-orange-500/50 w-full"
                    />
                    <button onClick={() => removeSet(ei, si)} className="text-zinc-800 hover:text-red-500 text-sm flex items-center justify-center h-8">✕</button>
                  </div>
                ))}
              </div>

              {/* 添加一组 */}
              <button
                onClick={() => addSet(ei)}
                className="w-full py-3.5 text-sm font-bold text-zinc-600 hover:text-orange-500 bg-black border-t border-white/5 transition-colors tracking-wide"
              >
                + 添加一组
              </button>
            </div>
          )
        })}

        {/* 添加动作按钮 */}
        <button
          onClick={() => setShowPicker(true)}
          className="w-full py-4 rounded-2xl border border-white/10 text-white font-bold text-sm tracking-widest hover:border-orange-500/50 hover:text-orange-500 transition-colors"
        >
          + 添加动作
        </button>

        {/* 备注 */}
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="备注..."
          rows={2}
          className="w-full bg-zinc-950 rounded-xl px-4 py-3 text-white placeholder-zinc-700 border border-white/5 focus:outline-none focus:border-orange-500/50 resize-none text-sm"
        />

        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          disabled={saving || exercises.length === 0}
          className="w-full py-4 bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-900 disabled:text-zinc-700 rounded-2xl font-black text-base tracking-wide transition-colors"
        >
          {saving ? '保存中...' : saved ? '已保存' : '保存训练'}
        </button>

      </div>

      {/* 动作选择器 */}
      {showPicker && (
        <ExercisePicker
          onSelect={addExercise}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}
