import { useEffect, useState, useCallback, useRef } from 'react'
import Header from './components/Header'
import DayGrid from './components/DayGrid'
import SidePanel from './components/SidePanel'
import ColorLegend from './components/ColorLegend'
import SettingsModal from './components/SettingsModal'
import TemplatesModal from './components/TemplatesModal'
import StatsModal from './components/StatsModal'
import {
  loadDay,
  saveDay,
  getTemplate,
  saveTemplate,
  getSetting,
  setSetting
} from './lib/db'
import { DEFAULT_TEMPLATE, blankDay } from './lib/defaultTemplate'
import { commitDay, pullDay, isConfigured } from './lib/github'

function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export default function App() {
  const [date, setDate] = useState(todayStr())
  const [day, setDay] = useState(null)
  const [github, setGithub] = useState({ enabled: false })
  const [syncStatus, setSyncStatus] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const dirtyRef = useRef(false)
  const saveTimer = useRef(null)

  // bootstrap — seed default template, load settings
  useEffect(() => {
    let alive = true
    ;(async () => {
      const existing = await getTemplate('default')
      if (!existing) await saveTemplate(DEFAULT_TEMPLATE)
      const gh = await getSetting('github')
      if (alive && gh) setGithub(gh)
    })()
    return () => {
      alive = false
    }
  }, [])

  // load day whenever the date or github config changes
  useEffect(() => {
    let alive = true
    ;(async () => {
      let d = await loadDay(date)
      if (!d && isConfigured(github)) {
        try {
          setSyncStatus('☁ 从 GitHub 拉取…')
          const cloud = await pullDay(date, github)
          if (cloud) {
            d = cloud
            await saveDay(d)
            setSyncStatus('☁ 已从 GitHub 恢复')
          } else {
            setSyncStatus('')
          }
        } catch (e) {
          setSyncStatus('⚠️ 拉取失败：' + e.message)
        }
      }
      if (!d) {
        const tpl = (await getTemplate('default')) || DEFAULT_TEMPLATE
        d = blankDay(date, tpl)
      }
      if (alive) {
        setDay(d)
        dirtyRef.current = false
      }
    })()
    return () => {
      alive = false
    }
  }, [date, github.enabled, github.owner, github.repo])

  // schedule save when day is mutated by user
  const update = useCallback((updater) => {
    setDay((prev) => {
      if (!prev) return prev
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      return next
    })
    dirtyRef.current = true
  }, [])

  useEffect(() => {
    if (!day || !dirtyRef.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const saved = await saveDay(day)
        setSyncStatus('💾 已存本地 ' + new Date().toLocaleTimeString())
        if (isConfigured(github)) {
          setSyncStatus('☁ 同步到 GitHub…')
          await commitDay(saved, github)
          setSyncStatus('✅ 已同步 ' + new Date().toLocaleTimeString())
        }
        dirtyRef.current = false
      } catch (e) {
        setSyncStatus('⚠️ ' + e.message)
      }
    }, 1200)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [day, github])

  const applyTemplate = (tpl) => {
    if (
      !confirm(`应用模板「${tpl.name}」会覆盖当前 Plan 与颜色（Action / 记录保留）。继续？`)
    )
      return
    update((d) => ({
      ...d,
      rows: tpl.rows.map((r) => {
        const old = d.rows.find((x) => x.id === r.id) || {}
        return { id: r.id, color: r.color, plan: r.plan, action: old.action || '' }
      }),
      templateUsed: tpl.id
    }))
  }

  if (!day) {
    return <div className="p-8 text-center text-gray-500">加载中…</div>
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        date={date}
        setDate={setDate}
        onOpenSettings={() => setShowSettings(true)}
        onOpenTemplates={() => setShowTemplates(true)}
        onOpenStats={() => setShowStats(true)}
        syncStatus={syncStatus}
        githubEnabled={!!github.enabled}
      />
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
        <section className="bg-white border border-gray-300 rounded-lg overflow-hidden self-start">
          <div className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,260px)] bg-gray-100 border-b border-gray-300 text-xs font-semibold">
            <div className="p-2 text-center">#</div>
            <div className="p-2 border-l border-gray-300">Plan</div>
            <div className="p-2 border-l border-gray-300">Action</div>
          </div>
          <DayGrid day={day} update={update} />
        </section>
        <aside className="space-y-3">
          <SidePanel day={day} update={update} />
          <ColorLegend day={day} />
        </aside>
      </main>
      <footer className="text-center text-[11px] text-gray-400 py-3">
        一日五色表 · 智慧时间打卡 · 数据存于本设备
        {github.enabled ? ' + 你的 GitHub 私有仓库' : ''}
      </footer>

      {showSettings && (
        <SettingsModal
          github={github}
          onClose={() => setShowSettings(false)}
          onSave={async (next) => {
            setGithub(next)
            await setSetting('github', next)
            setShowSettings(false)
          }}
        />
      )}
      {showTemplates && (
        <TemplatesModal
          currentDay={day}
          onClose={() => setShowTemplates(false)}
          onApply={(tpl) => {
            applyTemplate(tpl)
            setShowTemplates(false)
          }}
        />
      )}
      {showStats && <StatsModal onClose={() => setShowStats(false)} />}
    </div>
  )
}
