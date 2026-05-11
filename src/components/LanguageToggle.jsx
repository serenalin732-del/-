import { useApp } from '../context/AppContext.jsx'

export default function LanguageToggle() {
  const { lang, dispatch } = useApp()
  return (
    <button
      onClick={() => dispatch({ type: 'SET_LANG', lang: lang === 'zh' ? 'en' : 'zh' })}
      className="chip !bg-mist/70 hover:!bg-mist"
      aria-label="toggle language"
    >
      {lang === 'zh' ? '中文 · EN' : 'EN · 中文'}
    </button>
  )
}
