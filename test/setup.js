// Test setup — runs before each test file.
import { beforeEach, afterEach, expect } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

// jsdom doesn't implement matchMedia
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  })
}

window.scrollTo = window.scrollTo || (() => {})

let urlCounter = 0
URL.createObjectURL = URL.createObjectURL || (() => `blob:fake-${++urlCounter}`)
URL.revokeObjectURL = URL.revokeObjectURL || (() => {})

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
})
