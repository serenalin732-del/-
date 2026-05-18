export default function Header({
  date,
  setDate,
  onOpenSettings,
  onOpenTemplates,
  onOpenStats,
  syncStatus,
  githubEnabled
}) {
  const shift = (delta) => {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().slice(0, 10))
  }
  const today = () => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    setDate(`${y}-${m}-${dd}`)
  }
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][
    new Date(date + 'T00:00:00').getDay()
  ]
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-3 py-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="flex w-6 flex-col rounded overflow-hidden border border-gray-300">
            <span className="h-1.5" style={{ background: '#1f2937' }} />
            <span className="h-1.5" style={{ background: '#fde68a' }} />
            <span className="h-1.5" style={{ background: '#bfdbfe' }} />
            <span className="h-1.5" style={{ background: '#fecaca' }} />
            <span className="h-1.5" style={{ background: '#ffffff' }} />
          </div>
          <h1 className="text-base font-bold tracking-tight">一日五色表</h1>
          <span className="hidden sm:inline text-xs text-gray-500">智慧时间打卡</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => shift(-1)}
            className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50"
            aria-label="昨天"
          >
            ←
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-xs"
          />
          <span className="text-xs text-gray-500 w-8">{weekday}</span>
          <button
            onClick={() => shift(1)}
            className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50"
            aria-label="明天"
          >
            →
          </button>
          <button
            onClick={today}
            className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50"
          >
            今
          </button>
          <button
            onClick={onOpenStats}
            className="px-2.5 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50"
          >
            统计
          </button>
          <button
            onClick={onOpenTemplates}
            className="px-2.5 py-1 bg-amber-500 text-white rounded text-xs hover:bg-amber-600"
          >
            模板
          </button>
          <button
            onClick={onOpenSettings}
            className={
              'px-2.5 py-1 rounded text-xs ' +
              (githubEnabled
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-800 text-white hover:bg-gray-700')
            }
          >
            {githubEnabled ? '☁ 同步' : '设置'}
          </button>
        </div>
      </div>
      {syncStatus && (
        <div className="max-w-7xl mx-auto px-3 pb-1.5 text-[11px] text-gray-500">
          {syncStatus}
        </div>
      )}
    </header>
  )
}
