import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { errorBody } from "@/lib/errors";
import { canAccess, isRole } from "@/lib/roles";

// "/api/jobs/accrual" is called by Vercel Cron, which has no login cookie. It authenticates itself with a
// bearer CRON_SECRET inside the route and fails closed. Exact match only: other /api/jobs/* stay protected.
const PUBLIC_PATHS = ["/login", "/api/health", "/api/jobs/accrual"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const raw = request.cookies.get(env.SESSION_COOKIE_NAME)?.value;
  const role = isRole(raw) ? raw : null;
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!role) {
    if (isPublic) return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(errorBody("UNAUTHENTICATED", "Authentication required."), {
        status: 401,
      });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/login" || pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!canAccess(pathname, role)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(errorBody("FORBIDDEN", "You do not have access to this resource."), {
        status: 403,
      });
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
