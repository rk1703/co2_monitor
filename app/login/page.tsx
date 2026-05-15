'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Detect system theme preference
    const darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(darkMode);
    setMounted(true);

    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/check', { method: 'GET', credentials: 'same-origin' });
        if (res.ok) {
          router.push('/dashboard');
        }
      } catch (e) {
        // Not authenticated, stay on login
      }
    };
    checkAuth();
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Extract username before '@' if full email is provided
      const cleanUsername = username.includes('@') ? username.split('@')[0] : username;
      
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password }),
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : (data?.error?.message || 'Login failed'));
      }
      // Login succeeded — redirect to dashboard using full page navigation
      window.location.href = '/dashboard';
    } catch (e: any) {
      setError(e?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="flex flex-col items-center gap-4 p-8 rounded-xl glass">
            <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Authenticating...</p>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="w-full max-w-sm p-6 glass rounded-xl">
        <div className="flex flex-col items-center gap-3 mb-4">
          {mounted && <img src={isDark ? '/JSW_dark.png' : '/JSW_light.png'} alt="JSW" className="w-20 h-20 object-contain" />}
          <h1 className="font-display text-lg font-bold">CO₂ Monitor Dashboard</h1>
        </div>

        <div className="mb-3">
          <label className="text-xs font-medium" style={{ color: 'var(--text)' }}>User name</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            className="mt-1 block w-full rounded-md px-3 py-2"
            style={{
              background: 'var(--bg3)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              opacity: loading ? 0.6 : 1,
            }}
          />
        </div>

        <div className="mb-3">
          <label className="text-xs font-medium" style={{ color: 'var(--text)' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="mt-1 block w-full rounded-md px-3 py-2"
            style={{
              background: 'var(--bg3)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              opacity: loading ? 0.6 : 1,
            }}
          />
        </div>

        <div className="mb-4 text-red-500 text-sm text-center">(Use your AD credintial)</div>

        {error && <div className="mb-2 text-red-500 text-sm text-center">{error}</div>}

        <button type="submit" disabled={loading} className="w-full py-2 rounded-md bg-[var(--accent)] text-white font-semibold transition-all"
          style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Signing in…' : 'Login'}
        </button>
      </form>
    </div>
  );
}
