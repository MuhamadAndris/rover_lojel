import { DefaultSession } from 'next-auth';
import type { UserRole } from '@/models';

declare module 'next-auth' {
  interface Session {
    user: {
      userId: string;
      role: UserRole;
      counterId: string | null;
      name: string;
    } & DefaultSession['user'];
  }

  interface User {
    userId: string;
    role: UserRole;
    counterId: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    role: UserRole;
    counterId: string | null;
  }
}
