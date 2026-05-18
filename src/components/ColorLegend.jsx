import { COLORS, COLOR_ORDER } from '../lib/colors'

export default function ColorLegend({ day }) {
  const counts = COLOR_ORDER.reduce((acc, k) => {
    acc[k] = day.rows.filter((r) => r.color === k).length
    return acc
  }, {})
  const total = day.rows.length || 1
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-sm font-semibold mb-2">五色含义 · 今日占比</div>
      <div className="space-y-1.5">
        {COLOR_ORDER.map((k) => {
          const pct = Math.round((counts[k] / total) * 100)
          return (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span
                className="w-4 h-4 rounded border border-gray-300 shrink-0"
                style={{ background: COLORS[k].swatch }}
              />
              <span className="flex-1 truncate">{COLORS[k].label}</span>
              <span className="tabular-nums text-gray-500 w-14 text-right">
                {counts[k]} 行 · {pct}%
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
        点击行号切换颜色。每次输入自动保存（约 1 秒后），开启 GitHub 同步后会同时 commit 到你的私有仓库。
      </p>
    </div>
  )
}
