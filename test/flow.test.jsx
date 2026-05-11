import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App.jsx'
import { AppProvider } from '../src/context/AppContext.jsx'
import { buildBackup, parseBackup } from '../src/utils/backup.js'
import { getDemoState } from '../src/utils/demoData.js'

function setup() {
  return render(
    <AppProvider>
      <App />
    </AppProvider>
  )
}

function navTo(target) {
  // bottom nav buttons have data-nav={id}
  const btn = document.querySelector(`button[data-nav="${target}"]`)
  if (!btn) throw new Error(`nav button not found: ${target}`)
  return btn
}

// ---------- Pure utilities ----------

describe('backup roundtrip', () => {
  it('demo data survives buildBackup → JSON → parseBackup', () => {
    const demo = getDemoState('zh')
    const backup = buildBackup({ lang: 'zh', ...demo })
    const json = JSON.stringify(backup)
    const restored = parseBackup(json)
    expect(restored.items.length).toBe(demo.items.length)
    expect(restored.vision.ideal).toBe(demo.vision.ideal)
    expect(restored.ritualsDone.clothes).toBe(true)
    for (const it of restored.items) {
      expect(['clothes', 'books', 'papers', 'komono', 'sentimental']).toContain(it.category)
      expect(['kept', 'released', 'pending']).toContain(it.status)
      expect(typeof it.name).toBe('string')
    }
  })

  it('parseBackup rejects garbage', () => {
    expect(() => parseBackup('not json')).toThrow()
    expect(() => parseBackup('"hello"')).toThrow()
    expect(() => parseBackup('{"state":{"items":"oops"}}')).toThrow()
  })

  it('parseBackup sanitises unknown enum values', () => {
    const r = parseBackup(
      JSON.stringify({
        state: {
          items: [
            { name: 'mystery', category: 'totally-fake', status: 'maybe' },
            { name: 'good', category: 'books', status: 'kept' }
          ]
        }
      })
    )
    expect(r.items).toHaveLength(2)
    expect(r.items[0].category).toBe('komono')
    expect(r.items[0].status).toBe('pending')
    expect(r.items[1].status).toBe('kept')
  })
})

// ---------- UI flow ----------

describe('home screen', () => {
  it('renders title and shows demo card when empty', () => {
    setup()
    // App title appears (header has the brand name)
    expect(screen.getAllByText(/Spark Joy|怦然心动整理/i).length).toBeGreaterThan(0)
    // Demo card with load button visible
    expect(screen.getByRole('button', { name: /载入示例数据|Load sample data/i })).toBeInTheDocument()
  })

  it('loads demo data: button disappears and summary shown', async () => {
    const user = userEvent.setup()
    setup()
    const loadBtn = screen.getByRole('button', { name: /^载入示例数据$|^Load sample data$/i })
    await user.click(loadBtn)
    // After load: demo card hides because items now exist.
    // The button briefly says "已载入" via flash, then card disappears at next render — but card itself only renders when empty.
    // So the button with the original name should no longer exist.
    expect(screen.queryByRole('button', { name: /^载入示例数据$|^Load sample data$/i })).toBeNull()
    // Summary card should now appear (kept count > 0)
    // Demo has 5 kept items in zh by default
    const keptCount = await screen.findByText(/^7$/) // 5 clothes-kept (3) + books-kept (2) + papers-kept (1) + komono-kept (1) = 7
    expect(keptCount).toBeInTheDocument()
  })
})

describe('vision screen', () => {
  it('saves vision and reflects on home', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(navTo('vision'))
    const idealInput = screen.getByPlaceholderText(/洒满阳光|sunlit/i)
    await user.type(idealInput, '简单生活')
    await user.click(screen.getByRole('button', { name: /^保存$|^Save$/ }))
    // The save button flashes "已保存" / "Saved" — exists somewhere
    expect(screen.getByRole('button', { name: /已保存|Saved/i })).toBeInTheDocument()
    // Back to home
    await user.click(navTo('home'))
    expect(screen.getByText('简单生活')).toBeInTheDocument()
  })
})

describe('category + spark joy flow', () => {
  it('ritual gate → add item → spark joy keep → place stored', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(navTo('categories'))
    // Click Clothes category card
    await user.click(screen.getByRole('button', { name: /衣服|Clothes/ }))
    // Ritual gate shown
    expect(screen.getByText(/开始仪式|Opening ritual/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /已经把这一类集中好了|gathered everything/i }))
    // Add item flow
    await user.click(screen.getByRole('button', { name: /添加物品|Add an item/i }))
    await user.type(screen.getByPlaceholderText(/白色棉质衬衫|White cotton shirt/i), '红色围巾')
    await user.click(screen.getByRole('button', { name: /保存并感受|Save and feel/i }))
    // Decision modal — spark joy question shown
    expect(screen.getByText(/它让你怦然心动吗|Does it spark joy/i)).toBeInTheDocument()
    // Tap keep -> opens place prompt
    await user.click(screen.getByRole('button', { name: /心动 · 留下|Spark · Keep/i }))
    const placeInput = screen.getByPlaceholderText(/衣柜第二层|Second shelf/i)
    await user.type(placeInput, '玄关挂钩')
    // Second keep button (in the place modal) finalises
    const keepButtons = screen.getAllByRole('button', { name: /心动 · 留下|Spark · Keep/i })
    await user.click(keepButtons[keepButtons.length - 1])
    // Item visible in list with place
    expect(screen.getByText('红色围巾')).toBeInTheDocument()
    expect(screen.getByText(/玄关挂钩/)).toBeInTheDocument()
  })

  it('release flow shows gratitude prompt', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(navTo('categories'))
    await user.click(screen.getByRole('button', { name: /衣服|Clothes/ }))
    await user.click(screen.getByRole('button', { name: /已经把这一类集中好了|gathered everything/i }))
    await user.click(screen.getByRole('button', { name: /添加物品|Add an item/i }))
    await user.type(screen.getByPlaceholderText(/白色棉质衬衫|White cotton shirt/i), '旧外套')
    await user.click(screen.getByRole('button', { name: /保存并感受|Save and feel/i }))
    await user.click(screen.getByRole('button', { name: /不心动 · 送别|No spark · Release/i }))
    expect(screen.getByText(/谢谢这件物品|Thank this item/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^好的$|^Done$/ }))
    expect(screen.getByText('旧外套')).toBeInTheDocument()
  })
})

describe('progress + backup', () => {
  it('shows demo stats and backup section', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /^载入示例数据$|^Load sample data$/i }))
    await user.click(navTo('progress'))
    // Percentage shown (find any \d+% in document)
    const allText = document.body.textContent || ''
    expect(allText).toMatch(/\d+%/)
    expect(screen.getByText(/回顾|Reflection/i)).toBeInTheDocument()
    expect(screen.getByText(/备份与恢复|Backup & restore/i)).toBeInTheDocument()
  })

  it('export triggers anchor click', async () => {
    const user = userEvent.setup()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    setup()
    await user.click(screen.getByRole('button', { name: /^载入示例数据$|^Load sample data$/i }))
    await user.click(navTo('progress'))
    await user.click(screen.getByRole('button', { name: /导出为 JSON|Export as JSON/i }))
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })
})

describe('language toggle', () => {
  it('switches UI labels between zh and en', async () => {
    const user = userEvent.setup()
    setup()
    const toggle = screen.getByRole('button', { name: /toggle language/i })
    const initial = toggle.textContent
    await user.click(toggle)
    expect(toggle.textContent).not.toBe(initial)
    await user.click(toggle)
    expect(toggle.textContent).toBe(initial)
  })
})
