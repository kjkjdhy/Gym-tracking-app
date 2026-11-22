import { useState, useEffect, useRef } from 'react'
import { EXERCISES, CATEGORIES } from '../lib/exercises'

interface Props {
  onSelect: (name: string) => void
  onClose: () => void
}

export default function ExercisePicker({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('全部')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const categories = ['全部', ...CATEGORIES]

  const filtered = EXERCISES.filter(ex => {
    const matchCat = category === '全部' || ex.category === category
    const matchQuery = ex.name.includes(query)
    return matchCat && matchQuery
  })

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      {/* 背景遮罩 */}
      <div className="flex-1 bg-black/60" />

      {/* 底部面板 */}
      <div
        className="bg-zinc-950 border-t border-white/10 rounded-t-2xl flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 把手 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-zinc-700 rounded-full" />
        </div>

        {/* 搜索栏 */}
        <div className="px-4 pb-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索动作..."
            className="w-full bg-zinc-900 rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none border border-white/5 focus:border-orange-500/50"
          />
        </div>

        {/* 分类标签 */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                category === cat
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-900 text-zinc-400 border border-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 动作列表 */}
        <div className="overflow-y-auto flex-1 px-4 pb-6">
          {filtered.length === 0 && (
            <div className="text-center py-8">
              <p className="text-zinc-500 text-sm">没有找到"{query}"</p>
              <button
                onClick={() => { onSelect(query); onClose() }}
                className="mt-3 text-orange-500 text-sm"
              >
                直接添加"{query}"
              </button>
            </div>
          )}
          <div className="space-y-1">
            {filtered.map(ex => (
              <button
                key={ex.name}
                onClick={() => { onSelect(ex.name); onClose() }}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left"
              >
                <span className="text-white text-sm font-medium">{ex.name}</span>
                <span className="text-zinc-600 text-xs">{ex.category}</span>
              </button>
            ))}
          </div>

          {/* 自定义输入 */}
          {query && filtered.length > 0 && (
            <button
              onClick={() => { onSelect(query); onClose() }}
              className="w-full flex items-center px-4 py-3.5 rounded-xl border border-dashed border-white/10 mt-2 text-zinc-500 text-sm"
            >
              + 添加自定义"{query}"
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
