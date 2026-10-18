import type {
  AuditLogEntry,
  BalanceView,
  LeavePolicy,
  LeaveRequest,
  LeaveType,
  Role,
  User,
} from "@/types/domain";

// Mock data only (Day 0). Day 1 replaces these with queries; components take data via props.

export const users: User[] = [
  {
    id: "u-hr1",
    name: "Hana Villanueva",
    email: "hana@example.com",
    role: "hr_admin",
    managerId: null,
  },
  {
    id: "u-mgr1",
    name: "Maria Santos",
    email: "maria@example.com",
    role: "manager",
    managerId: null,
  },
  {
    id: "u-mgr2",
    name: "Paolo Reyes",
    email: "paolo@example.com",
    role: "manager",
    managerId: null,
  },
  {
    id: "u-emp1",
    name: "Ana Cruz",
    email: "ana@example.com",
    role: "employee",
    managerId: "u-mgr1",
  },
  {
    id: "u-emp2",
    name: "Ben Lim",
    email: "ben@example.com",
    role: "employee",
    managerId: "u-mgr1",
  },
  {
    id: "u-emp3",
    name: "Carla Dizon",
    email: "carla@example.com",
    role: "employee",
    managerId: "u-mgr1",
  },
  {
    id: "u-emp4",
    name: "Dan Ocampo",
    email: "dan@example.com",
    role: "employee",
    managerId: "u-mgr2",
  },
  {
    id: "u-emp5",
    name: "Ella Tan",
    email: "ella@example.com",
    role: "employee",
    managerId: "u-mgr2",
  },
];

export const leaveTypes: LeaveType[] = [
  { id: "lt-vacation", name: "Vacation", tracksBalance: true },
  { id: "lt-sick", name: "Sick", tracksBalance: true },
  { id: "lt-unpaid", name: "Unpaid", tracksBalance: false },
];

export const policies: LeavePolicy[] = users
  .filter((u) => u.role !== "hr_admin")
  .flatMap((u) => [
    { id: `p-${u.id}-vac`, userId: u.id, leaveTypeId: "lt-vacation", accrualPerMonth: 1.25 },
    { id: `p-${u.id}-sick`, userId: u.id, leaveTypeId: "lt-sick", accrualPerMonth: 0.5 },
  ]);

export const requests: LeaveRequest[] = [
  {
    id: "r-1",
    userId: "u-emp1",
    leaveTypeId: "lt-vacation",
    startDate: "2026-11-02",
    endDate: "2026-11-04",
    reason: "Family trip",
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    isDeleted: false,
    createdAt: "2026-10-10T08:00:00Z",
  },
  {
    id: "r-2",
    userId: "u-emp1",
    leaveTypeId: "lt-sick",
    startDate: "2026-09-14",
    endDate: "2026-09-14",
    reason: "Flu",
    status: "approved",
    decidedBy: "u-mgr1",
    decidedAt: "2026-09-14T09:30:00Z",
    isDeleted: false,
    createdAt: "2026-09-14T07:45:00Z",
  },
  {
    id: "r-3",
    userId: "u-emp1",
    leaveTypeId: "lt-vacation",
    startDate: "2026-08-03",
    endDate: "2026-08-05",
    reason: "Long weekend",
    status: "rejected",
    decidedBy: "u-mgr1",
    decidedAt: "2026-07-28T10:00:00Z",
    isDeleted: false,
    createdAt: "2026-07-27T12:00:00Z",
  },
  {
    id: "r-4",
    userId: "u-emp2",
    leaveTypeId: "lt-vacation",
    startDate: "2026-11-16",
    endDate: "2026-11-20",
    reason: "Travel",
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    isDeleted: false,
    createdAt: "2026-10-12T09:00:00Z",
  },
  {
    id: "r-5",
    userId: "u-emp3",
    leaveTypeId: "lt-unpaid",
    startDate: "2026-12-01",
    endDate: "2026-12-05",
    reason: "Personal matters",
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    isDeleted: false,
    createdAt: "2026-10-13T11:20:00Z",
  },
  // Belongs to another manager's team: must never appear in Maria's queue (US-03 AC3 / US-04).
  {
    id: "r-6",
    userId: "u-emp4",
    leaveTypeId: "lt-vacation",
    startDate: "2026-11-09",
    endDate: "2026-11-10",
    reason: "Errands",
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    isDeleted: false,
    createdAt: "2026-10-11T10:00:00Z",
  },
];

export const auditLog: AuditLogEntry[] = [
  {
    id: "a-1",
    leaveRequestId: "r-3",
    actorId: "u-emp1",
    action: "submitted",
    occurredAt: "2026-07-27T12:00:00Z",
  },
  {
    id: "a-2",
    leaveRequestId: "r-3",
    actorId: "u-mgr1",
    action: "rejected",
    occurredAt: "2026-07-28T10:00:00Z",
  },
  {
    id: "a-3",
    leaveRequestId: "r-2",
    actorId: "u-emp1",
    action: "submitted",
    occurredAt: "2026-09-14T07:45:00Z",
  },
  {
    id: "a-4",
    leaveRequestId: "r-2",
    actorId: "u-mgr1",
    action: "approved",
    occurredAt: "2026-09-14T09:30:00Z",
  },
  {
    id: "a-5",
    leaveRequestId: "r-1",
    actorId: "u-emp1",
    action: "submitted",
    occurredAt: "2026-10-10T08:00:00Z",
  },
];

export const balancesFor = (userId: string): BalanceView[] => {
  void userId; // mock: same figures for everyone
  return [
    {
      leaveTypeId: "lt-vacation",
      leaveTypeName: "Vacation",
      tracksBalance: true,
      confirmed: 12.5,
      pending: 3,
      asOf: "2026-10-01",
    },
    {
      leaveTypeId: "lt-sick",
      leaveTypeName: "Sick",
      tracksBalance: true,
      confirmed: 5,
      pending: 0,
      asOf: "2026-10-01",
    },
    {
      leaveTypeId: "lt-unpaid",
      leaveTypeName: "Unpaid",
      tracksBalance: false,
      confirmed: 0,
      pending: 0,
      asOf: "2026-10-01",
    },
  ];
};

/** Mock identity for each mock role. */
export const MOCK_USER_BY_ROLE: Record<Role, string> = {
  employee: "u-emp1",
  manager: "u-mgr1",
  hr_admin: "u-hr1",
};

export const userById = (id: string): User | undefined => users.find((u) => u.id === id);
export const leaveTypeById = (id: string): LeaveType | undefined =>
  leaveTypes.find((t) => t.id === id);
export const requestsFor = (userId: string): LeaveRequest[] =>
  requests.filter((r) => r.userId === userId && !r.isDeleted);

/**
 * Mock of the team-scoped query. Day 1 MUST apply this filter inside the SQL
 * (WHERE manager_id = :current_user_id), never only in application code.
 */
export const teamRequestsFor = (managerId: string): LeaveRequest[] => {
  const reportIds = new Set(users.filter((u) => u.managerId === managerId).map((u) => u.id));
  return requests.filter((r) => reportIds.has(r.userId) && !r.isDeleted);
};
