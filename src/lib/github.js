// Minimal GitHub REST client. Stores each day record as JSON in the configured
// private repo. The PAT lives only in the user's browser IndexedDB.

async function ghFetch(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json()).message || '' } catch {}
    throw new Error(`GitHub ${res.status} ${detail || res.statusText}`)
  }
  if (res.status === 204) return null
  return res.json()
}

function b64encode(str) {
  return btoa(unescape(encodeURIComponent(str)))
}

function b64decode(str) {
  return decodeURIComponent(escape(atob(str.replace(/\n/g, ''))))
}

function dayPath(date) {
  return `days/${date}.json`
}

export function isConfigured(s) {
  return !!(s && s.enabled && s.token && s.owner && s.repo)
}

export async function testConnection(s) {
  return ghFetch(`/repos/${s.owner}/${s.repo}`, { token: s.token })
}

export async function commitDay(day, settings) {
  if (!isConfigured(settings)) throw new Error('GitHub 同步未启用或配置不完整')
  const { token, owner, repo, branch = 'main' } = settings
  const path = dayPath(day.date)
  let sha
  try {
    const current = await ghFetch(
      `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
      { token }
    )
    sha = current.sha
  } catch (e) {
    if (!String(e.message).includes('404')) throw e
  }
  return ghFetch(`/repos/${owner}/${repo}/contents/${path}`, {
    token,
    method: 'PUT',
    body: {
      message: `chore(planner): ${day.date}`,
      content: b64encode(JSON.stringify(day, null, 2)),
      branch,
      sha
    }
  })
}

export async function pullDay(date, settings) {
  if (!isConfigured(settings)) return null
  const { token, owner, repo, branch = 'main' } = settings
  try {
    const file = await ghFetch(
      `/repos/${owner}/${repo}/contents/${dayPath(date)}?ref=${encodeURIComponent(branch)}`,
      { token }
    )
    return JSON.parse(b64decode(file.content))
  } catch (e) {
    if (String(e.message).includes('404')) return null
    throw e
  }
}
