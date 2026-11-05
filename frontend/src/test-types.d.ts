// Registers jest-dom matchers (toHaveAttribute, toHaveClass, …) on vitest's expect for
// co-located *.test.tsx files, so `tsc` in `npm run build` type-checks them.
import '@testing-library/jest-dom/vitest'
