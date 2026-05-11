import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { translations } from '../i18n/translations.js'

const STORAGE_KEY = 'sparkjoy.v1'
const DEFAULT_LANG = (typeof navigator !== 'undefined' && navigator.language?.startsWith('zh')) ? 'zh' : 'en'

export const CATEGORY_IDS = ['clothes', 'books', 'papers', 'komono', 'sentimental']

const initialState = {
  lang: DEFAULT_LANG,
  vision: { ideal: '', atmosphere: '', timeFor: '', images: [], updatedAt: null },
  ritualsDone: {}, // { [categoryId]: true }
  items: [], // { id, category, name, note, photo, status: 'pending'|'kept'|'released', place, createdAt, decidedAt }
  activeCategory: null
}

function load() {
  if (typeof localStorage === 'undefined') return initialState
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const parsed = JSON.parse(raw)
    return { ...initialState, ...parsed }
  } catch {
    return initialState
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LANG':
      return { ...state, lang: action.lang }
    case 'SAVE_VISION':
      return { ...state, vision: { ...action.vision, updatedAt: Date.now() } }
    case 'MARK_RITUAL':
      return { ...state, ritualsDone: { ...state.ritualsDone, [action.category]: true } }
    case 'SET_ACTIVE_CATEGORY':
      return { ...state, activeCategory: action.category }
    case 'ADD_ITEM':
      return { ...state, items: [action.item, ...state.items] }
    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i))
      }
    case 'DELETE_ITEM':
      return { ...state, items: state.items.filter((i) => i.id !== action.id) }
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
      /* quota exceeded - ignore silently */
    }
  }, [state])

  const t = useMemo(() => translations[state.lang] || translations.en, [state.lang])

  const value = useMemo(() => ({ state, dispatch, t, lang: state.lang }), [state, t])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function categoryStats(items, categoryId) {
  const inCat = items.filter((i) => i.category === categoryId)
  const kept = inCat.filter((i) => i.status === 'kept').length
  const released = inCat.filter((i) => i.status === 'released').length
  const pending = inCat.filter((i) => i.status === 'pending').length
  const total = inCat.length
  const decided = kept + released
  return { total, kept, released, pending, decided, completion: total ? decided / total : 0 }
}

export function overallStats(items) {
  const kept = items.filter((i) => i.status === 'kept').length
  const released = items.filter((i) => i.status === 'released').length
  const pending = items.filter((i) => i.status === 'pending').length
  const total = items.length
  const decided = kept + released
  return { total, kept, released, pending, decided, completion: total ? decided / total : 0 }
}
