import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// With Vitest `globals: false`, Testing Library's automatic cleanup is not
// registered, so unmount between tests ourselves to avoid DOM bleed.
afterEach(() => cleanup())
