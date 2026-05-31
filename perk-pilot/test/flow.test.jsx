import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { AppProvider, instantiateTemplate, blankCard } from '../src/context/AppContext.jsx'
import App from '../src/App.jsx'

function renderApp() {
  return render(
    <AppProvider>
      <App />
    </AppProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('instantiateTemplate', () => {
  it('builds a card with fresh benefit ids wired to the card', () => {
    const built = instantiateTemplate('amex-gold', { nickname: 'Daily', last4: '1003' })
    expect(built.card.issuer).toBe('American Express')
    expect(built.card.nickname).toBe('Daily')
    expect(built.benefits.length).toBeGreaterThan(0)
    for (const b of built.benefits) {
      expect(b.cardId).toBe(built.card.id)
      expect(b.id).toBeTruthy()
    }
  })
  it('returns null for an unknown template', () => {
    expect(instantiateTemplate('does-not-exist')).toBeNull()
  })
})

describe('blankCard', () => {
  it('creates an empty custom card with default payment config', () => {
    const built = blankCard({ issuer: 'Chase', name: 'Freedom' })
    expect(built.card.issuer).toBe('Chase')
    expect(built.benefits).toEqual([])
    expect(built.card.payment.remindDaysBefore).toBe(3)
  })
})

describe('App shell', () => {
  it('renders the dashboard with an empty state and bottom nav', () => {
    renderApp()
    // 5 nav tabs
    expect(screen.getByText('🏠')).toBeInTheDocument()
    expect(screen.getByText('💳')).toBeInTheDocument()
  })

  it('navigates to the Cards tab and opens the add-card modal', () => {
    renderApp()
    fireEvent.click(screen.getByText('💳'))
    // The add button appears (could be multiple "Add card" texts in empty state + header)
    const dialogTriggers = screen.getAllByText(/Add card|添加卡片/)
    expect(dialogTriggers.length).toBeGreaterThan(0)
    fireEvent.click(dialogTriggers[0])
    // Library/custom toggle shows up inside the modal
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
