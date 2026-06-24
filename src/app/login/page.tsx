'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Store, Lock, User, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^\d{7}$/.test(userId)) {
      setError('User ID harus berupa 7 digit angka');
      return;
    }

    setLoading(true);
    const res = await signIn('credentials', {
      userId,
      password,
      redirect: false,
    });
    setLoading(false);

    if (res?.error) {
      setError(res.error);
      return;
    }

    toast.success('Berhasil masuk');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand / signature element */}
      <div className="hidden lg:flex lg:w-[42%] bg-ink-950 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 opacity-[0.07]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(135deg, transparent 0, transparent 38px, rgba(36,150,136,0.5) 38px, rgba(36,150,136,0.5) 39px)',
            }}
          />
        </div>
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center">
            <Store className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-semibold text-white text-lg tracking-tight">
            Retail POS
          </span>
        </div>

        <div className="relative z-10 space-y-6">
          <p className="font-display text-3xl text-white leading-tight tracking-tight">
            Satu sistem,
            <br />
            seluruh operasional
            <br />
            toko Anda.
          </p>
          <div className="flex gap-8 pt-4 border-t border-white/10">
            <div>
              <p className="font-mono text-2xl text-brand-300 font-medium">01</p>
              <p className="text-ink-300 text-sm mt-1">Transaksi &amp; stok real-time</p>
            </div>
            <div>
              <p className="font-mono text-2xl text-brand-300 font-medium">02</p>
              <p className="text-ink-300 text-sm mt-1">Target &amp; pencapaian per SA</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-ink-400 text-xs">
          &copy; {new Date().getFullYear()} Retail POS. Internal use only.
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-ink-50">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Store className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-semibold text-ink-900 text-lg">
              Retail POS
            </span>
          </div>

          <h1 className="font-display text-2xl font-semibold text-ink-900 tracking-tight">
            Masuk ke akun Anda
          </h1>
          <p className="text-ink-400 text-sm mt-1.5 mb-8">
            Gunakan User ID 7 digit yang diberikan oleh admin.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-ink-700 mb-1.5">
                User ID
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
                <input
                  id="userId"
                  type="text"
                  inputMode="numeric"
                  maxLength={7}
                  placeholder="2212010"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value.replace(/\D/g, ''))}
                  className="input-base pl-9 font-mono"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-base pl-9"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-rose-100 border border-rose-200 px-3 py-2.5 text-sm text-rose-600">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-2">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Memproses...
                </>
              ) : (
                'Masuk'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
