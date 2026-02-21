import { auth } from "@/lib/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;
  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/setup-totp");

  // Redirect logged-in users away from login page
  if (pathname.startsWith("/login") && isLoggedIn) {
    const mustSetupTotp = (req.auth as any)?.user?.mustSetupTotp;
    if (mustSetupTotp) {
      return Response.redirect(new URL("/setup-totp", req.nextUrl));
    }
    return Response.redirect(new URL("/dashboard", req.nextUrl));
  }

  // Allow setup-totp page only for logged-in users who need it
  if (pathname.startsWith("/setup-totp")) {
    if (!isLoggedIn) {
      return Response.redirect(new URL("/login", req.nextUrl));
    }
    return;
  }

  // Redirect unauthenticated users to login
  if (!isLoggedIn && !isAuthPage) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }

  // Redirect users who need TOTP setup to the setup page
  if (isLoggedIn && !isAuthPage) {
    const mustSetupTotp = (req.auth as any)?.user?.mustSetupTotp;
    if (mustSetupTotp) {
      return Response.redirect(new URL("/setup-totp", req.nextUrl));
    }
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logo.png).*)"],
};
