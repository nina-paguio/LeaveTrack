import { AppError } from "@/lib/errors";
import { inclusiveDays } from "@/lib/leave/days";
import type { RepoLeaveType, RepoUser } from "@/lib/leave/submit";
import type { BalanceView, LeaveRequest } from "@/types/domain";

export interface RepoBalance {
  leaveTypeId: string;
  balance: number;
  /** First day of the last month accrued into this balance, or null if never accrued. */
  lastAccruedMonth: string | null;
  updatedAt: string;
}

/** Read access for "my leave" (US-02). Every method is scoped to one user id from the session. */
export interface MineRepo {
  findUserByEmail(email: string): Promise<RepoUser | null>;
  listLeaveTypes(): Promise<RepoLeaveType[]>;
  listBalances(userId: string): Promise<RepoBalance[]>;
  /** Non-deleted requests for this user. */
  listRequests(userId: string): Promise<LeaveRequest[]>;
}

export interface MyLeave {
  requests: LeaveRequest[];
  balances: BalanceView[];
}

// Display order only; any other leave type follows alphabetically.
const TYPE_ORDER = ["Vacation", "Sick", "Unpaid"];
const rank = (name: string) => {
  const i = TYPE_ORDER.indexOf(name);
  return i === -1 ? TYPE_ORDER.length : i;
};

/**
 * US-02. Confirmed = the stored balance. Pending = inclusive days of the user's pending requests,
 * shown separately because they are not yet deducted (AC2). Unpaid has no balance (US-08).
 * `asOf` is the latest month accrued into the user's balances (set by the monthly accrual job), so the
 * page can say "accrued through October 2026". Null until the first accrual has run.
 */
export async function getMyLeave(repo: MineRepo, email: string): Promise<MyLeave> {
  const user = await repo.findUserByEmail(email);
  if (!user) throw new AppError("NOT_FOUND", "Your user profile was not found.", 404);

  const [types, balances, allRequests] = await Promise.all([
    repo.listLeaveTypes(),
    repo.listBalances(user.id),
    repo.listRequests(user.id),
  ]);

  // Second layer behind the repo's own filter: soft-deleted rows never count or display.
  const requests = allRequests
    .filter((r) => !r.isDeleted)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const asOf =
    balances
      .map((b) => b.lastAccruedMonth)
      .filter((m): m is string => m !== null)
      .sort()
      .at(-1) ?? null;

  const views: BalanceView[] = [...types]
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
    .map((type) => {
      const stored = balances.find((b) => b.leaveTypeId === type.id)?.balance ?? 0;
      const pending = requests
        .filter((r) => r.leaveTypeId === type.id && r.status === "pending")
        .reduce((sum, r) => sum + inclusiveDays(r.startDate, r.endDate), 0);
      return {
        leaveTypeId: type.id,
        leaveTypeName: type.name,
        tracksBalance: type.tracksBalance,
        confirmed: type.tracksBalance ? stored : 0,
        pending: type.tracksBalance ? pending : 0,
        asOf,
      };
    });

  return { requests, balances: views };
}
