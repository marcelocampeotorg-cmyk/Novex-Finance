import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Permitir arquivos estáticos, rotas de auth e webhooks
  const isPublic =
    path === "/login" ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/webhooks") ||
    path.startsWith("/api/health") ||
    path.startsWith("/brand") ||
    path.startsWith("/_next") ||
    path.includes(".");

  if (isPublic) {
    return NextResponse.next();
  }

  // Verificar cookie de sessão do Better Auth
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie || !sessionCookie.value) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
