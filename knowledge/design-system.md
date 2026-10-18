# Design system

Tokens come from the Figma Make design (`design/make-export`, kept out of lint/build). Values live in `src/app/globals.css` (`@theme`); components use token names only.

## Tokens (HSL)

| Token | Value |
| --- | --- |
| background | `hsl(200 43% 97%)` |
| surface | `hsl(0 0% 100%)` |
| foreground | `hsl(197 44% 14%)` |
| muted | `hsl(198 14% 43%)` |
| border | `hsl(196 32% 88%)` |
| primary / hover / soft | `hsl(195 91% 33%)` / `hsl(195 92% 27%)` / `hsl(194 73% 94%)` |
| focus | `hsl(195 82% 43%)` |
| success / soft | `hsl(151 54% 31%)` / `hsl(145 40% 94%)` |
| warning / soft | `hsl(36 79% 34%)` / `hsl(43 100% 94%)` |
| error / soft | `hsl(0 51% 46%)` / `hsl(0 73% 96%)` |
| radius md / lg | 8px / 12px |
| font | system UI stack (no network font fetch) |

Primary is darkened from the design's `#087fa8` (4.39:1 with white) to reach 4.5:1 for button text. Every text/background pair is at least 4.5:1.

Status mapping: pending = warning, approved = success, rejected = error, always with icon + text.

## Layout and type rules
- Page title `text-xl sm:text-2xl` semibold; section heading `text-base sm:text-lg`; body `text-sm`; muted text for secondary lines. Page rhythm: header `mb-5 sm:mb-6`, sections `mt-6 sm:mt-8`, card grids `gap-3 sm:gap-4`.
- `DataTable` (`ui/data-table.tsx`): bordered table from `lg`, stacked cards below. Mark columns with `card`: `title`, `badge`, `line` (unlabelled), `footer` (actions) or omit for a label/value pair. A column that returns null shows "–" in the table and no row in the card.
- Dates in lists use `lib/leave/format.ts` (`formatDateRange`, `formatDateTime` in Asia/Manila), never raw ISO strings.
- A role with a single destination (manager) has no bottom tab bar.

## Loading states
- Route level: a `loading.tsx` skeleton (see `app/(app)/audit/loading.tsx`) shows at once on navigation. It does not re-show when only the query string changes.
- Form submits that change the query string (audit filters): `useTransition` + `router.push`; the button spins (`Button loading`), the inputs disable, an indeterminate `ProgressBar` runs and the report area becomes `AuditResultsSkeleton`. Announce it with an `aria-live` status.
- Pager arrows show a spinner while their navigation is pending (`LinkPendingIcon`, `useLinkStatus`). Same size as the arrow, so nothing shifts.
- All motion respects `prefers-reduced-motion` (`motion-reduce:animate-none`; the progress bar stays a still partial fill).

## Icons
`@tabler/icons-react`, sizes 16 / 20 / 24.

## Components (`src/components`)
- `ui/`: Button, Input, DateField, Select, Textarea, FormField, Card, StatusBadge, DataTable (table at md+, cards below), Dialog, Toast, Skeleton, EmptyState (incl. forbidden), Alert
- `layout/`: AppShell (sidebar at md+, bottom tabs below), NavLinks, PageHeader, RoleSwitcher (mock sign-in only)
- `leave/`: LeaveRequestForm, BalanceCard, RequestList, TeamQueue, AuditTable, PolicyTable

## Pages
`/login`, `/leave/balance` (My leave: balance + requests, employee landing), `/leave/new`, `/team/requests` (Approvals, manager landing, 10 per page), `/team/requests/[id]`, `/audit` (HR landing), `/admin/policies`. No dashboard (the docs define none).

## Breakpoints
Tailwind defaults, mobile-first. Verify at 320, 375, 768, 1024, 1440px.
