'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#161B27',
            color: '#F5F6F8',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#249688', secondary: '#fff' } },
          error: { iconTheme: { primary: '#CC4757', secondary: '#fff' } },
        }}
      />
    </SessionProvider>
  );
}
