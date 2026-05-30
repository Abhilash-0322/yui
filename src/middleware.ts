import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  // Paths requiring authentication
  const isProtectedPath = pathname.startsWith("/channels") || pathname.startsWith("/invite");
  
  // Paths for unauthenticated users
  const isAuthPath = pathname === "/login" || pathname === "/register";

  if (!token && isProtectedPath) {
    // Redirect to login if trying to access channels/invites without being logged in
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (token && (isAuthPath || pathname === "/")) {
    // Redirect to /channels/@me if already logged in and visiting login/register/root
    const dashboardUrl = new URL("/channels/@me", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/channels/:path*",
    "/invite/:path*",
  ],
};
