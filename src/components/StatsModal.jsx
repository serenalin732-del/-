import { useEffect, useState } from 'react'
import Modal from './Modal'
import { listDays } from '../lib/db'
import { COLORS, COLOR_ORDER } from '../lib/colors'

export default function StatsModal({ onClose }) {
  const [days, setDays] = useState([])
  const [range, setRange] = useState(7)

  useEffect(() => {
    listDays().then(setDays)
  }, [])

  const recent = days.slice(0, range)
  const totals = COLOR_ORDER.reduce((acc, k) => ((acc[k] = 0), acc), {})
  let totalRows = 0
  recent.forEach((d) => {
    d.rows.forEach((r) => {
      totals[r.color] = (totals[r.color] || 0) + 1
      totalRows++
    })
  })

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold flex-1">五色统计</h2>
          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value={7}>近 7 天</option>
            <option value={14}>近 14 天</option>
            <option value={30}>近 30 天</option>
            <option value={365}>近一年</option>
          </select>
        </div>

        <div className="text-xs text-gray-500">
          基于本地保存过的 {recent.length} 天 · 共 {totalRows} 行
        </div>

        <div className="space-y-2">
          {COLOR_ORDER.map((k) => {
            const pct = totalRows ? (totals[k] / totalRows) * 100 : 0
            return (
              <div key={k} className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded border border-gray-300 shrink-0"
                  style={{ background: COLORS[k].swatch }}
                />
                <span className="text-xs w-44 truncate">{COLORS[k].label}</span>
                <div className="flex-1 h-3 rounded bg-gray-100 overflow-hidden">
                  <div
                    className="h-full"
                    style={{ width: `${pct}%`, background: COLORS[k].swatch }}
                  />
                </div>
                <span className="text-xs tabular-nums text-gray-600 w-20 text-right">
                  {totals[k]} · {pct.toFixed(1)}%
                </span>
              </div>
            )
          })}
        </div>

        <div className="border-t border-gray-200 pt-3">
          <div className="text-sm font-semibold mb-2">每日色条</div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {recent.map((d) => (
              <DayBar key={d.date} day={d} />
            ))}
            {recent.length === 0 && (
              <div className="text-xs text-gray-500">还没有记录数据</div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 border border-gray-300 rounded text-sm">
            关闭
          </button>
        </div>
      </div>
    </Modal>
  )
}

function DayBar({ day }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] tabular-nums text-gray-600 w-20">{day.date}</span>
      <div className="flex-1 flex h-4 rounded overflow-hidden border border-gray-200">
        {day.rows.map((r) => (
          <span
            key={r.id}
            className="flex-1"
            style={{ background: COLORS[r.color]?.swatch || '#fff' }}
            title={`${r.id} · ${COLORS[r.color]?.label}`}
          />
        ))}
      </div>
    </div>
  )
}
