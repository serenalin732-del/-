import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { db } from '../src/lib/db'
import { DEFAULT_TEMPLATE } from '../src/lib/defaultTemplate'

beforeEach(async () => {
  await db.days.clear()
  await db.templates.clear()
  await db.settings.clear()
})

describe('Five Color Planner', () => {
  it('renders 24 plan rows from the default template', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('一日五色表')).toBeInTheDocument())
    // grid has number buttons 1..24
    for (let i = 1; i <= 24; i++) {
      expect(
        screen.getByRole('button', { name: new RegExp(`第 ${i} 行`) })
      ).toBeInTheDocument()
    }
  })

  it('seeds the default template into IndexedDB on first load', async () => {
    render(<App />)
    await waitFor(async () => {
      const tpl = await db.templates.get('default')
      expect(tpl).toBeTruthy()
      expect(tpl.rows).toHaveLength(DEFAULT_TEMPLATE.rows.length)
    })
  })

  it('persists an action edit to IndexedDB', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => expect(screen.getByText('一日五色表')).toBeInTheDocument())

    const actionFields = screen.getAllByPlaceholderText('实际…')
    expect(actionFields.length).toBe(24)
    await user.type(actionFields[5], '准时起床 ✓')

    await waitFor(
      async () => {
        const all = await db.days.toArray()
        const found = all.find((d) => d.rows.some((r) => r.action.includes('准时起床')))
        expect(found).toBeTruthy()
      },
      { timeout: 3000 }
    )
  })
})
