import Dexie, { type EntityTable } from 'dexie'

export interface WorkoutLog {
  id?: number
  date: string // YYYY-MM-DD
  exercises: ExerciseSet[]
  note?: string
  createdAt: number
}

export interface ExerciseSet {
  exerciseName: string
  sets: SetRecord[]
}

export interface SetRecord {
  reps: number
  weight: number
  unit: 'kg' | 'lbs'
  done?: boolean
}

export interface WorkoutPlan {
  id?: number
  name: string
  days: PlanDay[]
  createdAt: number
  updatedAt: number
}

export interface PlanDay {
  dayLabel: string
  exercises: PlanExercise[]
}

export interface PlanExercise {
  name: string
  targetSets: number
  targetReps: string // e.g. "8-12"
  targetWeight?: number
  note?: string
}

export interface AISummary {
  id?: number
  type: 'weekly' | 'monthly' | 'yearly'
  periodStart: string // YYYY-MM-DD (first day of the period)
  content: string
  createdAt: number
}

export interface Settings {
  id?: number
  groqApiKey: string
  githubToken?: string
  activePlanId?: number
  weightUnit: 'kg' | 'lbs'
  lastSyncAt?: number
}

class GymDB extends Dexie {
  workoutLogs!: EntityTable<WorkoutLog, 'id'>
  workoutPlans!: EntityTable<WorkoutPlan, 'id'>
  aiSummaries!: EntityTable<AISummary, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor() {
    super('GymTrackerDB')
    this.version(1).stores({
      workoutLogs: '++id, date, createdAt',
      workoutPlans: '++id, name, createdAt',
      aiSummaries: '++id, weekStart, createdAt',
      settings: '++id',
    })
    this.version(2).stores({
      workoutLogs: '++id, date, createdAt',
      workoutPlans: '++id, name, createdAt',
      aiSummaries: '++id, type, periodStart, createdAt',
      settings: '++id',
    }).upgrade(tx => {
      // Migrate old records: add type='weekly' and periodStart from weekStart
      return tx.table('aiSummaries').toCollection().modify((summary: Record<string, unknown>) => {
        if (!summary['type']) {
          summary['type'] = 'weekly'
          summary['periodStart'] = summary['weekStart'] ?? new Date().toISOString().slice(0, 10)
        }
      })
    })
  }
}

export const db = new GymDB()

// --- JSON 导出 ---
export async function exportToJSON(): Promise<string> {
  const [workoutLogs, workoutPlans, aiSummaries, settings] = await Promise.all([
    db.workoutLogs.toArray(),
    db.workoutPlans.toArray(),
    db.aiSummaries.toArray(),
    db.settings.toArray(),
  ])
  return JSON.stringify({ workoutLogs, workoutPlans, aiSummaries, settings }, null, 2)
}

// --- JSON 导入 ---
export async function importFromJSON(json: string): Promise<void> {
  const data = JSON.parse(json)
  await db.transaction('rw', db.workoutLogs, db.workoutPlans, db.aiSummaries, db.settings, async () => {
    if (data.workoutLogs) {
      await db.workoutLogs.clear()
      await db.workoutLogs.bulkAdd(data.workoutLogs)
    }
    if (data.workoutPlans) {
      await db.workoutPlans.clear()
      await db.workoutPlans.bulkAdd(data.workoutPlans)
    }
    if (data.aiSummaries) {
      await db.aiSummaries.clear()
      await db.aiSummaries.bulkAdd(data.aiSummaries)
    }
    if (data.settings) {
      await db.settings.clear()
      await db.settings.bulkAdd(data.settings)
    }
  })
}
