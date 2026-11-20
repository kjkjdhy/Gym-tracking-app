import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { WorkoutPlan, PlanDay, PlanExercise } from '../db'

function newPlan(): Omit<WorkoutPlan, 'id'> {
  return {
    name: '',
    days: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function newDay(): PlanDay {
  return { dayLabel: '', exercises: [] }
}

function newExercise(): PlanExercise {
  return { name: '', targetSets: 3, targetReps: '8-12' }
}

export default function PlanPage() {
  const plans = useLiveQuery(() => db.workoutPlans.toArray()) ?? []
  const settings = useLiveQuery(() => db.settings.orderBy("id").first())
  const [editing, setEditing] = useState<WorkoutPlan | null>(null)
  const [isNew, setIsNew] = useState(false)

  async function handleSave() {
    if (!editing) return
    if (isNew) {
      await db.workoutPlans.add({ ...editing, createdAt: Date.now(), updatedAt: Date.now() })
    } else {
      await db.workoutPlans.update(editing.id!, { ...editing, updatedAt: Date.now() })
    }
    setEditing(null)
    setIsNew(false)
  }

  async function handleDelete(id: number) {
    await db.workoutPlans.delete(id)
  }

  async function handleSetActive(id: number) {
    const existing = await db.settings.orderBy("id").first()
    if (existing) {
      await db.settings.update(existing.id!, { activePlanId: id })
    } else {
      await db.settings.add({ groqApiKey: '', activePlanId: id, weightUnit: 'kg' })
    }
  }

  if (editing) {
    return (
      <PlanEditor
        plan={editing}
        onChange={setEditing}
        onSave={handleSave}
        onCancel={() => { setEditing(null); setIsNew(false) }}
      />
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">健身计划</h1>
        <button
          onClick={() => { setEditing(newPlan() as WorkoutPlan); setIsNew(true) }}
          className="bg-orange-500 hover:bg-orange-400 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
        >
          + 新建
        </button>
      </div>

      {plans.length === 0 && (
        <p className="text-zinc-500 text-center py-12">还没有计划，点击右上角新建</p>
      )}

      {plans.map((plan) => (
        <div key={plan.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-zinc-100">{plan.name || '未命名计划'}</h2>
              <p className="text-sm text-zinc-500">{plan.days.length} 个训练日</p>
            </div>
            {settings?.activePlanId === plan.id && (
              <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">当前计划</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(plan)}
              className="flex-1 py-1.5 text-sm border border-zinc-700 rounded-lg text-zinc-300 hover:border-zinc-500"
            >
              编辑
            </button>
            <button
              onClick={() => handleSetActive(plan.id!)}
              className="flex-1 py-1.5 text-sm border border-orange-500/50 rounded-lg text-orange-400 hover:bg-orange-500/10"
            >
              设为当前
            </button>
            <button
              onClick={() => handleDelete(plan.id!)}
              className="py-1.5 px-3 text-sm border border-zinc-800 rounded-lg text-zinc-500 hover:text-red-400"
            >
              删除
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function PlanEditor({
  plan,
  onChange,
  onSave,
  onCancel,
}: {
  plan: WorkoutPlan
  onChange: (p: WorkoutPlan) => void
  onSave: () => void
  onCancel: () => void
}) {
  function updateDay(di: number, day: PlanDay) {
    const days = [...plan.days]
    days[di] = day
    onChange({ ...plan, days })
  }

  function addDay() {
    onChange({ ...plan, days: [...plan.days, newDay()] })
  }

  function removeDay(di: number) {
    onChange({ ...plan, days: plan.days.filter((_, i) => i !== di) })
  }

  function addExercise(di: number) {
    const days = [...plan.days]
    days[di] = { ...days[di], exercises: [...days[di].exercises, newExercise()] }
    onChange({ ...plan, days })
  }

  function updateExercise(di: number, ei: number, ex: PlanExercise) {
    const days = [...plan.days]
    const exercises = [...days[di].exercises]
    exercises[ei] = ex
    days[di] = { ...days[di], exercises }
    onChange({ ...plan, days })
  }

  function removeExercise(di: number, ei: number) {
    const days = [...plan.days]
    days[di] = { ...days[di], exercises: days[di].exercises.filter((_, i) => i !== ei) }
    onChange({ ...plan, days })
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-200">←</button>
        <h1 className="text-xl font-bold text-zinc-100 flex-1">编辑计划</h1>
        <button onClick={onSave} className="bg-orange-500 hover:bg-orange-400 text-white px-4 py-1.5 rounded-lg text-sm font-medium">
          保存
        </button>
      </div>

      <input
        type="text"
        placeholder="计划名称"
        value={plan.name}
        onChange={(e) => onChange({ ...plan, name: e.target.value })}
        className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-orange-500"
      />

      {plan.days.map((day, di) => (
        <div key={di} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="训练日名称（如：胸背日）"
              value={day.dayLabel}
              onChange={(e) => updateDay(di, { ...day, dayLabel: e.target.value })}
              className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-orange-500 text-sm"
            />
            <button onClick={() => removeDay(di)} className="text-zinc-500 hover:text-red-400 px-2">✕</button>
          </div>

          {day.exercises.map((ex, ei) => (
            <div key={ei} className="bg-zinc-800 rounded-lg p-3 space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="动作名称"
                  value={ex.name}
                  onChange={(e) => updateExercise(di, ei, { ...ex, name: e.target.value })}
                  className="flex-1 bg-zinc-700 rounded px-2 py-1.5 text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <button onClick={() => removeExercise(di, ei)} className="text-zinc-500 hover:text-red-400 text-xs">✕</button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-zinc-500">目标组数</label>
                  <input
                    type="number"
                    value={ex.targetSets}
                    onChange={(e) => updateExercise(di, ei, { ...ex, targetSets: Number(e.target.value) })}
                    className="w-full bg-zinc-700 rounded px-2 py-1.5 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-zinc-500">目标次数</label>
                  <input
                    type="text"
                    value={ex.targetReps}
                    onChange={(e) => updateExercise(di, ei, { ...ex, targetReps: e.target.value })}
                    placeholder="8-12"
                    className="w-full bg-zinc-700 rounded px-2 py-1.5 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-zinc-500">目标重量</label>
                  <input
                    type="number"
                    value={ex.targetWeight ?? ''}
                    onChange={(e) => updateExercise(di, ei, { ...ex, targetWeight: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="kg"
                    className="w-full bg-zinc-700 rounded px-2 py-1.5 text-zinc-100 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>
          ))}

          <button onClick={() => addExercise(di)} className="text-sm text-orange-400 hover:text-orange-300">
            + 添加动作
          </button>
        </div>
      ))}

      <button
        onClick={addDay}
        className="w-full py-3 border border-dashed border-zinc-700 rounded-xl text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
      >
        + 添加训练日
      </button>
    </div>
  )
}
