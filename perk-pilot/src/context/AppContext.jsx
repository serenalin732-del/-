import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { translations } from '../i18n/translations.js'
import { findTemplate } from '../data/cardLibrary.js'

const STORAGE_KEY = 'perkpilot.v1'
const DEFAULT_LANG =
  typeof navigator !== 'undefined' && navigator.language?.startsWith('zh') ? 'zh' : 'en'

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const initialState = {
  lang: DEFAULT_LANG,
  people: [], // { id, name }
  cards: [], // see addCard
  benefits: [], // { id, cardId, name, value, cadence, resetBasis, trackingMode, category, note, remindDaysBefore }
  claims: {}, // 'benefitId::periodKey' -> { used, usedAmount, note, updatedAt }
  pointsTx: [], // { id, cardId, date, merchant, category, amountSpent, points, multiplier, optimal, image, note }
  settings: { notificationsEnabled: false, sync: { provider: null } }
}

function load() {
  if (typeof localStorage === 'undefined') return initialState
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const parsed = JSON.parse(raw)
    return {
      ...initialState,
      ...parsed,
      settings: { ...initialState.settings, ...(parsed.settings || {}) }
    }
  } catch {
    return initialState
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LANG':
      return { ...state, lang: action.lang }

    case 'ADD_PERSON':
      return { ...state, people: [...state.people, { id: uid(), name: action.name }] }
    case 'UPDATE_PERSON':
      return {
        ...state,
        people: state.people.map((p) => (p.id === action.id ? { ...p, name: action.name } : p))
      }
    case 'DELETE_PERSON':
      return {
        ...state,
        people: state.people.filter((p) => p.id !== action.id),
        cards: state.cards.map((c) => (c.personId === action.id ? { ...c, personId: null } : c))
      }

    case 'ADD_CARD':
      return {
        ...state,
        cards: [action.card, ...state.cards],
        benefits: [...state.benefits, ...(action.benefits || [])]
      }
    case 'UPDATE_CARD':
      return {
        ...state,
        cards: state.cards.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c))
      }
    case 'DELETE_CARD': {
      const benefitIds = new Set(state.benefits.filter((b) => b.cardId === action.id).map((b) => b.id))
      const claims = Object.fromEntries(
        Object.entries(state.claims).filter(([k]) => !benefitIds.has(k.split('::')[0]))
      )
      return {
        ...state,
        cards: state.cards.filter((c) => c.id !== action.id),
        benefits: state.benefits.filter((b) => b.cardId !== action.id),
        pointsTx: state.pointsTx.filter((t) => t.cardId !== action.id),
        claims
      }
    }

    case 'ADD_BENEFIT':
      return { ...state, benefits: [...state.benefits, { id: uid(), ...action.benefit }] }
    case 'UPDATE_BENEFIT':
      return {
        ...state,
        benefits: state.benefits.map((b) => (b.id === action.id ? { ...b, ...action.patch } : b))
      }
    case 'DELETE_BENEFIT': {
      const claims = Object.fromEntries(
        Object.entries(state.claims).filter(([k]) => k.split('::')[0] !== action.id)
      )
      return { ...state, benefits: state.benefits.filter((b) => b.id !== action.id), claims }
    }

    case 'SET_CLAIM': {
      const next = { ...state.claims }
      const payload = { ...(next[action.key] || {}), ...action.patch, updatedAt: Date.now() }
      next[action.key] = payload
      return { ...state, claims: next }
    }

    case 'ADD_POINTS_TX':
      return { ...state, pointsTx: [{ id: uid(), ...action.tx }, ...state.pointsTx] }
    case 'DELETE_POINTS_TX':
      return { ...state, pointsTx: state.pointsTx.filter((t) => t.id !== action.id) }

    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case 'LOAD_STATE': {
      const next = { ...initialState, ...action.payload }
      if (!action.payload?.lang) next.lang = state.lang
      next.settings = { ...initialState.settings, ...(action.payload?.settings || {}) }
      return next
    }
    case 'RESET':
      return { ...initialState, lang: state.lang }
    default:
      return state
  }
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* quota exceeded — ignore */
    }
  }, [state])

  const t = useMemo(() => translations[state.lang] || translations.en, [state.lang])

  // Tiny "{n}" / "{name}" interpolation helper.
  const fmt = useMemo(
    () => (str, vars = {}) =>
      String(str).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`)),
    []
  )

  const value = useMemo(
    () => ({ state, dispatch, t, fmt, lang: state.lang }),
    [state, t, fmt]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

/**
 * Build a card (+ its benefits) from a library template id, ready to dispatch
 * with ADD_CARD. Each benefit gets a fresh id wired to the new card id.
 */
export function instantiateTemplate(templateId, overrides = {}) {
  const tpl = findTemplate(templateId)
  if (!tpl) return null
  const cardId = uid()
  const card = {
    id: cardId,
    personId: overrides.personId ?? null,
    templateId,
    issuer: tpl.issuer,
    name: tpl.name,
    type: tpl.type,
    network: tpl.network,
    nickname: overrides.nickname || '',
    last4: overrides.last4 || '',
    annualFee: tpl.annualFee,
    openedDate: overrides.openedDate || null,
    multipliers: tpl.multipliers || [],
    payment: overrides.payment || { dueDay: null, statementDay: null, remindDaysBefore: 3, overdueReminder: true }
  }
  const benefits = (tpl.benefits || []).map((b) => ({ id: uid(), cardId, remindDaysBefore: 7, ...b }))
  return { card, benefits }
}

/** Build a blank custom card scaffold. */
export function blankCard(overrides = {}) {
  const cardId = uid()
  return {
    card: {
      id: cardId,
      personId: overrides.personId ?? null,
      templateId: null,
      issuer: overrides.issuer || '',
      name: overrides.name || '',
      type: overrides.type || 'personal',
      network: overrides.network || '',
      nickname: overrides.nickname || '',
      last4: overrides.last4 || '',
      annualFee: overrides.annualFee ?? 0,
      openedDate: overrides.openedDate || null,
      multipliers: [],
      payment: { dueDay: null, statementDay: null, remindDaysBefore: 3, overdueReminder: true }
    },
    benefits: []
  }
}
