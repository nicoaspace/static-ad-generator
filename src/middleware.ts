export { auth as middleware } from "@/auth";

export const config = {
  // Protect all routes except auth API endpoints, static assets, images, etc.
  matcher: ["/((?!api/auth|api/images|_next/static|_next/image|favicon.ico).*)"],
};
