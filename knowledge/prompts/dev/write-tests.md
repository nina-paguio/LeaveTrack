# Prompt: write tests for a change

```
Write Vitest tests for <files changed>.

Map one test (at least) to each acceptance criterion of <TASK-ID>.
Always cover: the 403/scope case, validation failure (no row created), and the error envelope shape.
For accrual, test idempotency (second run in the same month changes nothing).
Do not mock the thing under test.
```
