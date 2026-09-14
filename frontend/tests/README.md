# Frontend Tests

Vitest + Testing Library. `tests/setup.ts` loads jest-dom matchers and is wired
in via `vite.config.ts`'s `test` block.

Run:
    npm install
    npm test        # single run
    npm run test:watch
