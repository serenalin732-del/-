import { useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Field } from '../components/ui.jsx'
import { downloadBackup, parseBackup, readFileText } from '../utils/backup.js'
import { getPermission, requestPermission } from '../utils/notifications.js'
import { syncStatus } from '../utils/sync.js'

export default function Settings() {
  const { state, dispatch, t, lang } = useApp()
  const [newPerson, setNewPerson] = useState('')
  const [perm, setPerm] = useState(getPermission())
  const fileRef = useRef(null)
  const sync = syncStatus()

  async function enableNotifications() {
    const p = await requestPermission()
    setPerm(p)
    dispatch({ type: 'SET_SETTINGS', patch: { notificationsEnabled: p === 'granted' } })
  }

  async function onImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await readFileText(file)
      const payload = parseBackup(text)
      dispatch({ type: 'LOAD_STATE', payload })
    } catch (err) {
      alert(lang === 'zh' ? '导入失败：文件无效' : 'Import failed: invalid file')
    }
    e.target.value = ''
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-mist">{t.settings.title}</h1>

      <Block title={t.settings.language}>
        <div className="flex gap-2">
          <button className={lang === 'zh' ? 'btn-primary flex-1' : 'btn-ghost flex-1'} onClick={() => dispatch({ type: 'SET_LANG', lang: 'zh' })}>中文</button>
          <button className={lang === 'en' ? 'btn-primary flex-1' : 'btn-ghost flex-1'} onClick={() => dispatch({ type: 'SET_LANG', lang: 'en' })}>English</button>
        </div>
      </Block>

      <Block title={t.settings.people}>
        <div className="space-y-2 mb-3">
          {state.people.map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-ink/50 rounded-xl px-3 py-2">
              <input
                className="bg-transparent text-mist outline-none flex-1"
                value={p.name}
                onChange={(e) => dispatch({ type: 'UPDATE_PERSON', id: p.id, name: e.target.value })}
              />
              <button className="text-rose/70 text-sm hover:text-rose" onClick={() => dispatch({ type: 'DELETE_PERSON', id: p.id })}>
                {t.common.delete}
              </button>
            </div>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newPerson.trim()) return
            dispatch({ type: 'ADD_PERSON', name: newPerson.trim() })
            setNewPerson('')
          }}
        >
          <input className="field-input" placeholder={t.settings.addPerson} value={newPerson} onChange={(e) => setNewPerson(e.target.value)} />
          <button className="btn-primary" type="submit">{t.common.add}</button>
        </form>
      </Block>

      <Block title={t.settings.notifications}>
        <button className={perm === 'granted' ? 'btn-ghost w-full' : 'btn-primary w-full'} onClick={enableNotifications} disabled={perm === 'denied'}>
          {perm === 'granted' ? '✓ ' + t.settings.enableNotif : perm === 'denied' ? t.settings.enableNotif + ' (blocked)' : t.settings.enableNotif}
        </button>
        <p className="text-[11px] text-mist/40 mt-2">{t.settings.notifHint}</p>
      </Block>

      <Block title={t.settings.backup}>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => downloadBackup(state)}>{t.settings.export}</button>
          <button className="btn-ghost flex-1" onClick={() => fileRef.current?.click()}>{t.settings.import}</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImport} />
        </div>
        <p className="text-[11px] text-mist/40 mt-2">{t.settings.dataNote}</p>
      </Block>

      <Block title={t.settings.sync}>
        <div className="text-sm text-mist/70 mb-1">
          {sync.configured ? 'Supabase ✓' : t.settings.syncNotConfigured}
        </div>
        <p className="text-[11px] text-mist/40">{t.settings.syncHint}</p>
      </Block>

      <button
        className="btn-danger w-full"
        onClick={() => {
          if (confirm(t.settings.resetConfirm)) dispatch({ type: 'RESET' })
        }}
      >
        {t.settings.reset}
      </button>
    </div>
  )
}

function Block({ title, children }) {
  return (
    <div className="card-surface p-4">
      <div className="text-sm font-semibold text-mist/70 mb-3">{title}</div>
      {children}
    </div>
  )
}
