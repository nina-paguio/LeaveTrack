import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/session-token";
import { env } from "@/lib/env";
import { errorBody } from "@/lib/errors";
import { canAccess, homeFor } from "@/lib/roles";

// "/api/jobs/accrual" is called by Vercel Cron, which has no login cookie. It authenticates itself with a
// bearer CRON_SECRET inside the route and fails closed. Exact match only: other /api/jobs/* stay protected.
const PUBLIC_PATHS = ["/login", "/api/health", "/api/jobs/accrual"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // A forged, edited or expired cookie fails verification and is treated as signed out.
  const claims = verifySessionToken(
    request.cookies.get(env.SESSION_COOKIE_NAME)?.value,
    env.SESSION_SECRET,
  );
  const role = claims?.role ?? null;
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

  // "/dashboard" no longer exists (the docs define none); old links land on the role's home.
  if (pathname === "/login" || pathname === "/" || pathname === "/dashboard") {
    return NextResponse.redirect(new URL(homeFor(role), request.url));
  }

  if (!canAccess(pathname, role)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(errorBody("FORBIDDEN", "You do not have access to this resource."), {
        status: 403,
      });
    }
    return NextResponse.redirect(new URL(homeFor(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
