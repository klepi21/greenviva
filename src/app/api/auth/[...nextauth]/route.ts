import NextAuth, { AuthOptions, Session } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  }
}

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, trigger, session }) {
      // Copy the error from the session to the token
      if (trigger === 'update' && session?.error) {
        token.error = session.error;
      }

      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.error = undefined; // Clear any errors when we get new tokens
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      session.error = token.error;
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Always redirect to the dashboard after sign in
      if (url.startsWith(baseUrl)) {
        return `${baseUrl}/dashboard`;
      }
      // Allows relative callback URLs
      else if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      return baseUrl;
    },
  },
  pages: {
    signIn: '/',
    error: '/dashboard', // Redirect to dashboard on error
  },
  secret: process.env.NEXTAUTH_SECRET,
  // Add debug logs in development
  debug: process.env.NODE_ENV === 'development',
  // Increase timeout for the callback
  timeout: 10000,
  // Better error handling
  events: {
    async error(error) {
      console.error('NextAuth Error:', error);
    },
    async signIn({ user, account, profile, isNewUser }) {
      console.log('Successful sign in:', {
        user: user.email,
        isNewUser,
        hasAccessToken: !!account?.access_token,
        hasRefreshToken: !!account?.refresh_token,
      });
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 