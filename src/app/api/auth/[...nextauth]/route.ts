import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

// mongoose and bcryptjs are not Edge-runtime compatible — force Node.js
// runtime explicitly, otherwise Next.js may attempt to run this route on
// the Edge runtime and crash at module-load time (surfaces to the client
// as a generic NextAuth "Configuration" error).
export const runtime = 'nodejs';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
