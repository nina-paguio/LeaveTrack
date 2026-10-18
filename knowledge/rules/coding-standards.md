# Coding standards

Authoritative rules live in `AGENTS.md`. This file is the quick checklist.

## TypeScript
- `strict` and `noUncheckedIndexedAccess` are on. No `any`; no non-null `!` without a reason.
- Domain types live in `src/types/domain.ts` and mirror the ARCH data model.
- Import with the `@/` alias.

## API routes (Day 1)
1. Authenticate via the session; reject with 401.
2. Authorize by role and by scope; reject with 403.
3. Validate input with `zod`; reject with 400 `VALIDATION_ERROR`.
4. Query with the scope filter inside the SQL.
5. Return `okResponse(data)` or `toErrorResponse(err)`; never raw errors.

## Components
- Props in, events out. Data arrives from the page; handlers (`onSubmit`, `onDecision`) are optional props wired in Day 1.
- Cover default, hover, focus, disabled, loading, empty, and error states.

## Testing
- Vitest, files named `*.test.ts` next to the code. Test scope rules, error shape, and validation first.
