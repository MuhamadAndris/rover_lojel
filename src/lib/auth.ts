import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';
import type { UserRole } from '@/models';

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === 'development',
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 }, // 12 hours
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        userId: { label: 'User ID', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.userId || !credentials?.password) {
            throw new Error('User ID dan password wajib diisi');
          }

          if (!/^\d{7}$/.test(credentials.userId)) {
            throw new Error('User ID harus berupa 7 digit angka');
          }

          await connectDB();
          const user = await User.findOne({ userId: credentials.userId });

          if (!user) {
            throw new Error('User ID tidak ditemukan');
          }

          if (user.status !== 'active') {
            throw new Error('Akun ini tidak aktif. Hubungi admin.');
          }

          const isValid = await bcrypt.compare(
            credentials.password,
            user.passwordHash
          );

          if (!isValid) {
            throw new Error('Password salah');
          }

          return {
            id: user.userId,
            userId: user.userId,
            name: user.name,
            role: user.role,
            counterId: user.counterId || null,
          };
        } catch (err) {
          // Log the real error server-side. Without this, any unexpected
          // exception here (e.g. a DB connection failure) gets swallowed by
          // NextAuth and surfaces to the client only as a generic
          // "Configuration" error with no detail.
          console.error('[NextAuth authorize] error:', err);
          throw err;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = (user as { userId: string }).userId;
        token.role = (user as { role: UserRole }).role;
        token.counterId = (user as { counterId: string | null }).counterId;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.userId = token.userId as string;
        session.user.role = token.role as UserRole;
        session.user.counterId = token.counterId as string | null;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
};
