import { useState } from 'react'
import { db } from '../db'
import type { ExerciseSet, SetRecord } from '../db'
import { syncToGitHub } from '../lib/github-sync'

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function LogPage() {
  const [date, setDate] = useState(today())
  const [exercises, setExercises] = useState<ExerciseSet[]>([])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function addExercise() {
    setExercises([...exercises, { exerciseName: '', sets: [{ reps: 0, weight: 0, unit: 'kg' }] }])
  }

  function updateExerciseName(i: number, name: string) {
    const updated = [...exercises]
    updated[i] = { ...updated[i], exerciseName: name }
    setExercises(updated)
  }

  function addSet(exerciseIndex: number) {
    const updated = [...exercises]
    updated[exerciseIndex].sets.push({ reps: 0, weight: 0, unit: 'kg' })
    setExercises([...updated])
  }

  function updateSet(exerciseIndex: number, setIndex: number, field: keyof SetRecord, value: string | number) {
    const updated = [...exercises]
    const set = { ...updated[exerciseIndex].sets[setIndex] }
    if (field === 'reps' || field === 'weight') {
      set[field] = Number(value)
    }
    updated[exerciseIndex].sets[setIndex] = set
    setExercises(updated)
  }

  function removeExercise(i: number) {
    setExercises(exercises.filter((_, idx) => idx !== i))
  }

  function removeSet(exerciseIndex: number, setIndex: number) {
    const updated = [...exercises]
    updated[exerciseIndex].sets = updated[exerciseIndex].sets.filter((_, idx) => idx !== setIndex)
    setExercises([...updated])
  }

  async function handleSave() {
    if (exercises.length === 0) return
    setSaving(true)
    await db.workoutLogs.add({
      date,
      exercises,
      note,
      createdAt: Date.now(),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setExercises([])
    setNote('')

    // 后台自动同步到 GitHub（不阻塞 UI）
    db.settings.orderBy('id').first().then(s => {
      if (s?.githubToken) {
        syncToGitHub(s.githubToken)
          .then(() => db.settings.update(s.id!, { lastSyncAt: Date.now() }))
          .catch(() => {}) // 静默失败，不打扰用户
      }
    })
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-zinc-100">训练记录</h1>

      <div>
        <label className="text-sm text-zinc-400 mb-1 block">日期</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
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
            <button
              onClick={() => removeExercise(ei)}
              className="text-zinc-500 hover:text-red-400 px-2 py-2"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500 px-1">
              <span>组</span>
              <span>重量 (kg)</span>
              <span>次数</span>
            </div>
            {exercise.sets.map((set, si) => (
              <div key={si} className="grid grid-cols-3 gap-2 items-center">
                <span className="text-sm text-zinc-400 pl-1">{si + 1}</span>
                <input
                  type="number"
                  value={set.weight || ''}
                  onChange={(e) => updateSet(ei, si, 'weight', e.target.value)}
                  placeholder="0"
                  className="bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100 border border-zinc-700 focus:outline-none focus:border-orange-500 text-sm"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={set.reps || ''}
                    onChange={(e) => updateSet(ei, si, 'reps', e.target.value)}
                    placeholder="0"
                    className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100 border border-zinc-700 focus:outline-none focus:border-orange-500 text-sm"
                  />
                  {exercise.sets.length > 1 && (
                    <button
                      onClick={() => removeSet(ei, si)}
                      className="text-zinc-600 hover:text-red-400 text-xs px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => addSet(ei)}
            className="text-sm text-orange-400 hover:text-orange-300"
          >
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
