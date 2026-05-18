import { useState, useRef, useEffect } from 'react'
import { COLORS, COLOR_ORDER, colorOf } from '../lib/colors'

export default function DayGrid({ day, update }) {
  return (
    <div role="grid" aria-label="一日五色表格">
      {day.rows.map((row) => (
        <Row
          key={row.id}
          row={row}
          onChange={(patch) =>
            update((d) => ({
              ...d,
              rows: d.rows.map((r) => (r.id === row.id ? { ...r, ...patch } : r))
            }))
          }
        />
      ))}
    </div>
  )
}

function useAutoGrow(value) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])
  return ref
}

function Row({ row, onChange }) {
  const c = colorOf(row.color)
  const [pickerOpen, setPickerOpen] = useState(false)
  const planRef = useAutoGrow(row.plan)
  const actionRef = useAutoGrow(row.action)

  return (
    <div
      role="row"
      className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,260px)] border-b border-black/10 min-h-[40px] items-stretch"
      style={{ background: c.bg, color: c.text }}
    >
      <div className="relative flex items-center justify-center select-none">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="w-full h-full text-xs font-mono opacity-80 hover:opacity-100 focus:outline-none"
          title={`第 ${row.id} 行 · 点击切换颜色`}
          aria-label={`第 ${row.id} 行，当前颜色：${c.label}`}
        >
          {row.id}
        </button>
        {pickerOpen && (
          <>
            <button
              type="button"
              aria-label="关闭颜色选择"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setPickerOpen(false)}
            />
            <div className="absolute left-1 top-full z-20 bg-white border border-gray-300 rounded shadow-lg p-1 flex gap-1">
              {COLOR_ORDER.map((k) => (
                <button
                  key={k}
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange({ color: k })
                    setPickerOpen(false)
                  }}
                  className={
                    'w-6 h-6 rounded border ' +
                    (row.color === k ? 'border-gray-900 ring-2 ring-gray-400' : 'border-gray-400')
                  }
                  style={{ background: COLORS[k].swatch }}
                  title={COLORS[k].label}
                  aria-label={COLORS[k].label}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <textarea
        ref={planRef}
        value={row.plan || ''}
        onChange={(e) => onChange({ plan: e.target.value })}
        rows={1}
        className="bg-transparent px-2 py-1.5 resize-none outline-none border-l border-black/10 placeholder:text-current placeholder:opacity-40 text-sm leading-snug"
        style={{ color: c.text }}
        placeholder="计划…"
      />
      <textarea
        ref={actionRef}
        value={row.action || ''}
        onChange={(e) => onChange({ action: e.target.value })}
        rows={1}
        className="bg-transparent px-2 py-1.5 resize-none outline-none border-l border-black/10 placeholder:text-current placeholder:opacity-40 text-sm leading-snug"
        style={{ color: c.text }}
        placeholder="实际…"
      />
    </div>
  )
}
