import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname === "/login";
      
      // Let authentication pass for static assets and public routes
      const isPublicAsset = 
        nextUrl.pathname.startsWith("/api/images") ||
        nextUrl.pathname.startsWith("/_next") ||
        nextUrl.pathname.includes(".") ||
        nextUrl.pathname === "/favicon.ico";

      if (isPublicAsset) {
        return true;
      }

      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true; // Let user access login page
      }

      // Protect dashboard and all other paths
      if (!isLoggedIn) {
        return false; // Redirect to /login
      }

      return true;
    },
  },
});
