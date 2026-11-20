import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportToJSON, importFromJSON } from '../db'
import { syncToGitHub } from '../lib/github-sync'

export default function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.orderBy('id').first())
  const [githubToken, setGithubToken] = useState('')
  const [tokenSaved, setTokenSaved] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [importStatus, setImportStatus] = useState('')

  async function saveGithubToken() {
    const existing = await db.settings.orderBy('id').first()
    if (existing) {
      await db.settings.update(existing.id!, { githubToken })
    } else {
      await db.settings.add({ groqApiKey: '', githubToken, weightUnit: 'kg' })
    }
    setTokenSaved(true)
    setTimeout(() => setTokenSaved(false), 2000)
    setGithubToken('')
  }

  async function handleManualSync() {
    const token = settings?.githubToken
    if (!token) { setSyncMsg('请先设置 GitHub Token'); return }
    setSyncing(true)
    setSyncMsg('')
    try {
      await syncToGitHub(token)
      const existing = await db.settings.orderBy('id').first()
      if (existing) await db.settings.update(existing.id!, { lastSyncAt: Date.now() })
      setSyncMsg('同步成功!')
    } catch (e) {
      setSyncMsg(`同步失败: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(''), 4000)
    }
  }

  async function handleExport() {
    const json = await exportToJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gym-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus('导入中...')
    try {
      const text = await file.text()
      await importFromJSON(text)
      setImportStatus('导入成功!')
    } catch {
      setImportStatus('导入失败，请检查文件格式')
    }
    setTimeout(() => setImportStatus(''), 3000)
    e.target.value = ''
  }

  const lastSync = settings?.lastSyncAt
    ? new Date(settings.lastSyncAt).toLocaleString('zh-CN')
    : '从未同步'

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold text-zinc-100">设置</h1>

      {/* GitHub 同步 */}
      <div className="space-y-2">
        <h2 className="font-semibold text-zinc-200">GitHub 同步</h2>
        <p className="text-sm text-zinc-500">
          训练数据自动同步到仓库，在 VS Code 里 git pull 后直接与 Claude 讨论
        </p>
        <div className="bg-zinc-900 rounded-lg p-3 text-xs text-zinc-400 space-y-1">
          <p>上次同步：{lastSync}</p>
        </div>
        <input
          type="password"
          placeholder={settings?.githubToken ? '已设置（点击修改）' : '粘贴 GitHub Personal Access Token'}
          value={githubToken}
          onChange={(e) => setGithubToken(e.target.value)}
          className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-orange-500 text-sm"
        />
        <p className="text-xs text-zinc-600">
          GitHub → Settings → Developer settings → Personal access tokens → 勾选 repo 权限
        </p>
        <div className="flex gap-2">
          <button
            onClick={saveGithubToken}
            disabled={!githubToken}
            className="flex-1 py-2 bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors"
          >
            {tokenSaved ? '已保存!' : '保存 Token'}
          </button>
          <button
            onClick={handleManualSync}
            disabled={syncing || !settings?.githubToken}
            className="flex-1 py-2 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:border-zinc-500 disabled:text-zinc-600 transition-colors"
          >
            {syncing ? '同步中...' : '立即同步'}
          </button>
        </div>
        {syncMsg && (
          <p className={`text-sm ${syncMsg.includes('失败') ? 'text-red-400' : 'text-green-400'}`}>
            {syncMsg}
          </p>
        )}
      </div>

      {/* 数据管理 */}
      <div className="space-y-3">
        <h2 className="font-semibold text-zinc-200">数据管理</h2>
        <button
          onClick={handleExport}
          className="w-full py-3 border border-zinc-700 rounded-xl text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors text-sm"
        >
          导出数据 (JSON)
        </button>
        <label className="block">
          <div className="w-full py-3 border border-zinc-700 rounded-xl text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors text-sm text-center cursor-pointer">
            {importStatus || '导入数据 (JSON)'}
          </div>
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
        <p className="text-xs text-zinc-600">导入会覆盖所有现有数据，请确保已备份</p>
      </div>

      {/* 关于 */}
      <div className="space-y-1 pt-2 border-t border-zinc-800">
        <p className="text-sm text-zinc-500">Gym Tracker v0.1.0</p>
        <p className="text-xs text-zinc-600">数据存储在本地设备</p>
      </div>
    </div>
  )
}
