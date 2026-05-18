import { useState } from 'react'
import Modal from './Modal'
import { testConnection } from '../lib/github'

const EMPTY = { owner: '', repo: '', branch: 'main', token: '', enabled: false }

export default function SettingsModal({ github, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY, ...github })
  const [status, setStatus] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const test = async () => {
    setStatus('测试中…')
    try {
      const r = await testConnection(form)
      setStatus(`✅ 连接成功：${r.full_name}（${r.private ? '私有' : '公开'}）`)
    } catch (e) {
      setStatus('❌ ' + e.message)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-5 space-y-3">
        <h2 className="text-lg font-bold">设置 · GitHub 同步</h2>
        <p className="text-xs text-gray-600 leading-relaxed">
          每次保存会自动 commit 一份{' '}
          <code className="bg-gray-100 px-1 rounded">days/YYYY-MM-DD.json</code>{' '}
          到你指定的私有仓库。需要一个有 <strong>repo</strong> 权限的 Personal Access Token（
          <a
            href="https://github.com/settings/tokens/new?scopes=repo&description=Five%20Color%20Planner"
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline"
          >
            点此生成
          </a>
          ）。
        </p>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!form.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
          />
          启用 GitHub 同步
        </label>

        <Field
          label="GitHub 用户名 (owner)"
          value={form.owner}
          onChange={(v) => set('owner', v)}
          placeholder="例如 your-username"
        />
        <Field
          label="仓库名 (repo)"
          value={form.repo}
          onChange={(v) => set('repo', v)}
          placeholder="例如 five-color-log（建议私有）"
        />
        <Field
          label="分支"
          value={form.branch}
          onChange={(v) => set('branch', v)}
          placeholder="main"
        />
        <Field
          label="Personal Access Token"
          value={form.token}
          onChange={(v) => set('token', v)}
          type="password"
          placeholder="ghp_…"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={test}
            className="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
            disabled={!form.token || !form.owner || !form.repo}
          >
            测试连接
          </button>
          <span className="text-xs">{status}</span>
        </div>

        <div className="border-t border-gray-200 pt-3 text-[11px] text-gray-500 leading-relaxed">
          ⚠️ Token 仅存在你的浏览器本地（IndexedDB），不会发送到任何第三方服务器；但请使用
          <strong>私有</strong>仓库，并在不再使用本设备时移除 Token。
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-1.5 border border-gray-300 rounded text-sm">
            取消
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-4 py-1.5 bg-gray-900 text-white rounded text-sm"
          >
            保存
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-700">{label}</span>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono"
        autoComplete="off"
        spellCheck={false}
      />
    </label>
  )
}
