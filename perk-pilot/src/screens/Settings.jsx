import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Field } from '../components/ui.jsx'
import { downloadBackup, parseBackup, readFileText } from '../utils/backup.js'
import { getPermission, requestPermission } from '../utils/notifications.js'
import { syncStatus, getSession, signIn, signOut, pushState, pullState } from '../utils/sync.js'

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
        {sync.configured ? <SyncPanel /> : (
          <>
            <div className="text-sm text-mist/70 mb-1">{t.settings.syncNotConfigured}</div>
            <p className="text-[11px] text-mist/40">{t.settings.syncHint}</p>
          </>
        )}
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

function SyncPanel() {
  const { state, dispatch, t } = useApp()
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let alive = true
    getSession().then((s) => alive && setSession(s))
    return () => { alive = false }
  }, [])

  async function onSendLink(e) {
    e.preventDefault()
    const res = await signIn(email.trim())
    setMsg(res.ok ? t.settings.syncLinkSent : `⚠ ${res.reason}`)
  }
  async function onPush() {
    const res = await pushState(state)
    setMsg(res.ok ? t.settings.syncPushed : `⚠ ${res.reason}`)
  }
  async function onPull() {
    const res = await pullState()
    if (res.ok && res.data) {
      dispatch({ type: 'LOAD_STATE', payload: res.data })
      setMsg(t.settings.syncPulled)
    } else {
      setMsg(`⚠ ${res.reason || 'no data'}`)
    }
  }
  async function onSignOut() {
    await signOut()
    setSession(null)
    setMsg('')
  }

  if (!session) {
    return (
      <form onSubmit={onSendLink}>
        <Field label={t.settings.syncEmail}>
          <input className="field-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <button className="btn-primary w-full" type="submit">{t.settings.syncSendLink}</button>
        {msg && <p className="text-[11px] text-mist/50 mt-2">{msg}</p>}
      </form>
    )
  }
  return (
    <div>
      <div className="text-sm text-mist/70 mb-3">{t.settings.syncSignedInAs} <span className="text-mist">{session.user?.email}</span></div>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={onPush}>{t.settings.syncPush}</button>
        <button className="btn-ghost flex-1" onClick={onPull}>{t.settings.syncPull}</button>
      </div>
      <button className="btn-ghost w-full mt-2" onClick={onSignOut}>{t.settings.syncSignOut}</button>
      {msg && <p className="text-[11px] text-mist/50 mt-2">{msg}</p>}
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
