# Testing: Monflo

100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence — without them, vibe coding is just yolo coding. With tests, it's a superpower.

## Framework
- **Primary:** Vitest
- **UI:** @testing-library/react-native

## How to run
```bash
npm test
```

## Test Layers
- **Unit tests:** Domain logic (tracking, accounting, social). Located in `tests/domain/`.
- **Integration tests:** Cross-context data flow.
- **E2E tests:** Critical user journeys.

## Conventions
- Name files: `*.test.ts` or `*.spec.ts`.
- Place tests in the `tests/` directory matching the `src/` structure.
- Mock all external dependencies (DB, API, Native Bridges).
