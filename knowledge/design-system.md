# Design system (provisional)

No design export existed at scaffold time, so these tokens are placeholders. When a Figma or Claude-Design export arrives, replace the values in `src/app/globals.css` (`@theme`) and update this file.

## Tokens (HSL)

| Token | Value |
| --- | --- |
| background | `hsl(210 20% 98%)` |
| surface | `hsl(0 0% 100%)` |
| foreground | `hsl(222 47% 11%)` |
| muted | `hsl(215 16% 35%)` |
| border | `hsl(214 32% 85%)` |
| primary / hover / soft | `hsl(221 83% 45%)` / `hsl(221 83% 36%)` / `hsl(221 83% 96%)` |
| success / soft | `hsl(142 71% 24%)` / `hsl(142 60% 93%)` |
| warning / soft | `hsl(30 90% 26%)` / `hsl(45 95% 91%)` |
| error / soft | `hsl(0 72% 40%)` / `hsl(0 85% 96%)` |
| radius md / lg | 6px / 10px |
| font | system UI stack (no network font fetch) |

Status mapping: pending = warning, approved = success, rejected = error, always with icon + text.

## Icons
`@tabler/icons-react`, sizes 16 / 20 / 24.

## Components (`src/components`)
- `ui/`: Button, Input, DateField, Select, Textarea, FormField, Card, StatusBadge, DataTable (table at md+, cards below), Dialog, Toast, Skeleton, EmptyState (incl. forbidden), Alert
- `layout/`: AppShell (sidebar at md+, bottom tabs below), NavLinks, PageHeader, RoleSwitcher (mock sign-in only)
- `leave/`: LeaveRequestForm, BalanceCard, RequestList, TeamQueue, AuditTable, PolicyTable

## Pages
`/login`, `/dashboard`, `/leave/new`, `/leave/balance`, `/leave/requests`, `/team/requests`, `/team/requests/[id]`, `/audit`, `/admin/policies`.

## Breakpoints
Tailwind defaults, mobile-first. Verify at 320, 375, 768, 1024, 1440px.
