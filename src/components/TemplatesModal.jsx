import { useEffect, useState } from 'react'
import Modal from './Modal'
import { listTemplates, saveTemplate, deleteTemplate } from '../lib/db'
import { DEFAULT_TEMPLATE } from '../lib/defaultTemplate'
import { COLORS } from '../lib/colors'

export default function TemplatesModal({ currentDay, onApply, onClose }) {
  const [items, setItems] = useState([])
  const [name, setName] = useState('')

  const reload = async () => setItems(await listTemplates())
  useEffect(() => {
    reload()
  }, [])

  const saveAs = async () => {
    if (!name.trim()) return alert('请输入模板名称')
    const id = 'tpl_' + Date.now()
    await saveTemplate({
      id,
      name: name.trim(),
      rows: currentDay.rows.map((r) => ({ id: r.id, color: r.color, plan: r.plan }))
    })
    setName('')
    reload()
  }

  const restoreDefault = async () => {
    await saveTemplate(DEFAULT_TEMPLATE)
    reload()
  }

  const remove = async (tpl) => {
    const msg =
      tpl.id === 'default'
        ? '删除内置模板？可点"恢复内置默认"再放回来'
        : `删除模板「${tpl.name}」？`
    if (!confirm(msg)) return
    await deleteTemplate(tpl.id)
    reload()
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-xl">
      <div className="p-5 space-y-4">
        <h2 className="text-lg font-bold">模板</h2>
        <p className="text-xs text-gray-500">
          应用模板会替换当前日期的 Plan 列与颜色（Action 列、B/C 区、评估会保留）。
        </p>

        <div className="space-y-2">
          {items.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 border border-gray-200 rounded p-2"
            >
              <Stripe rows={t.rows} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{t.name}</div>
                <div className="text-xs text-gray-500">
                  {t.rows.length} 行 · {t.id === 'default' ? '内置' : '自定义'}
                </div>
              </div>
              <button
                onClick={() => onApply(t)}
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                应用
              </button>
              <button
                onClick={() => remove(t)}
                className="px-2 py-1 text-red-600 text-xs hover:bg-red-50 rounded"
              >
                删除
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-4">还没有模板</div>
          )}
        </div>

        <div className="border-t border-gray-200 pt-3 space-y-2">
          <div className="text-sm font-semibold">把今天另存为模板</div>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="模板名称，如：工作日 / 周末 / 出差"
              className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
            />
            <button
              onClick={saveAs}
              className="px-4 py-1.5 bg-gray-900 text-white rounded text-sm"
            >
              保存
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
          <button onClick={restoreDefault} className="text-xs text-gray-500 underline">
            恢复内置默认模板
          </button>
          <button onClick={onClose} className="px-4 py-1.5 border border-gray-300 rounded text-sm">
            关闭
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Stripe({ rows }) {
  return (
    <div className="flex flex-col w-3 h-12 rounded overflow-hidden border border-gray-300 shrink-0">
      {rows.map((r) => (
        <span key={r.id} className="flex-1" style={{ background: COLORS[r.color]?.swatch || '#fff' }} />
      ))}
    </div>
  )
}
