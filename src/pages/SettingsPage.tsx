import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportToJSON, importFromJSON } from '../db'

export default function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.orderBy("id").first())
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [importStatus, setImportStatus] = useState('')

  async function saveApiKey() {
    const existing = await db.settings.orderBy("id").first()
    if (existing) {
      await db.settings.update(existing.id!, { groqApiKey: apiKey })
    } else {
      await db.settings.add({ groqApiKey: apiKey, weightUnit: 'kg' })
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold text-zinc-100">设置</h1>

      {/* Gemini API Key */}
      <div className="space-y-2">
        <h2 className="font-semibold text-zinc-200">Gemini API Key</h2>
        <p className="text-sm text-zinc-500">
          前往 <span className="text-orange-400">Google AI Studio</span> 免费注册获取
        </p>
        <input
          type="password"
          placeholder={settings?.groqApiKey ? '已设置（点击修改）' : '粘贴你的 API Key'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 border border-zinc-700 focus:outline-none focus:border-orange-500"
        />
        <button
          onClick={saveApiKey}
          disabled={!apiKey}
          className="w-full py-2 bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg font-medium transition-colors"
        >
          {saved ? '已保存!' : '保存 API Key'}
        </button>
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
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </label>

        <p className="text-xs text-zinc-600">
          导入会覆盖所有现有数据，请确保已备份
        </p>
      </div>

      {/* 关于 */}
      <div className="space-y-1 pt-2 border-t border-zinc-800">
        <p className="text-sm text-zinc-500">Gym Tracker v0.1.0</p>
        <p className="text-xs text-zinc-600">数据存储在本地设备，不上传至任何服务器</p>
      </div>
    </div>
  )
}
