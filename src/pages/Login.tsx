import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/lib/store';
import * as api from '@/lib/api';
import farmConfig from '@/farm.config';
import { DonationBanner } from '@/components/DonationBanner';

type Step = 'email' | 'code' | 'name';

export function Login() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const setUser = useStore(s => s.setUser);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Handle ?error= query param from magic link redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err === 'expired') {
      setError('Link expired or already used. Please request a new one.');
    } else if (err === 'not_found') {
      setError('Account not found.');
    }
    // Clean up URL
    if (err) {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setCooldown(c => {
          if (c <= 1) {
            clearInterval(cooldownRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(cooldownRef.current);
    }
  }, [cooldown]);

  // Auto-focus code input when step changes
  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => codeInputRef.current?.focus(), 100);
    }
  }, [step]);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim() || loading) return;
    setError('');
    setLoading(true);
    try {
      await api.auth.requestOtp(email.trim());
      setStep('code');
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    }
    setLoading(false);
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setError('');
    setLoading(true);
    try {
      await api.auth.requestOtp(email.trim());
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!code.trim() || loading) return;
    setError('');
    setLoading(true);
    try {
      const result = await api.auth.verifyOtp(email.trim(), code.trim());
      if (result.needsName) {
        setStep('name');
      } else {
        setUser(result.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    }
    setLoading(false);
  };

  const handleSetName = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim() || loading) return;
    setError('');
    setLoading(true);
    try {
      await api.auth.setName(name.trim());
      // Re-check auth to get updated user
      const check = await api.auth.check();
      if (check.user) {
        setUser(check.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set name');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-earth-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-forest-300 mb-2">
            {farmConfig.name}
          </h1>
          {farmConfig.subtitle && (
            <p className="text-earth-400 text-sm">
              {farmConfig.subtitle}
            </p>
          )}
        </div>

        <div className="bg-earth-800 rounded-xl p-6 shadow-lg border border-earth-700">
          {/* Step 1: Email */}
          {step === 'email' && (
            <form onSubmit={handleRequestOtp}>
              <label className="block text-sm font-medium text-earth-300 mb-2">
                Email
              </label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-earth-900 border border-earth-600 rounded-lg text-earth-100 placeholder-earth-500 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent"
                placeholder="you@example.com"
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-sunset-400">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="mt-4 w-full py-3 bg-forest-600 hover:bg-forest-500 disabled:bg-earth-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {loading ? 'Sending...' : 'Send login link'}
              </button>
            </form>
          )}

          {/* Step 2: OTP Code */}
          {step === 'code' && (
            <form onSubmit={handleVerifyOtp}>
              <p className="text-sm text-earth-400 mb-4">
                We sent a login link to <span className="text-earth-200 font-medium">{email}</span>. Tap it to log in, or enter the code below.
              </p>
              <label className="block text-sm font-medium text-earth-300 mb-2">
                Login code
              </label>
              <input
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 bg-earth-900 border border-earth-600 rounded-lg text-earth-100 placeholder-earth-500 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent text-center text-2xl tracking-[0.3em] font-mono"
                placeholder="000000"
              />
              {error && (
                <p className="mt-2 text-sm text-sunset-400">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="mt-4 w-full py-3 bg-forest-600 hover:bg-forest-500 disabled:bg-earth-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setCode(''); setError(''); }}
                  className="text-sm text-earth-500 hover:text-earth-300 transition-colors"
                >
                  Change email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                  className="text-sm text-forest-400 hover:text-forest-300 disabled:text-earth-600 disabled:cursor-not-allowed transition-colors"
                >
                  {cooldown > 0 ? `Send again (${cooldown}s)` : 'Send again'}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Set display name (first login) */}
          {step === 'name' && (
            <form onSubmit={handleSetName}>
              <p className="text-sm text-earth-400 mb-4">
                Welcome! What should we call you?
              </p>
              <label className="block text-sm font-medium text-earth-300 mb-2">
                Your name
              </label>
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 bg-earth-900 border border-earth-600 rounded-lg text-earth-100 placeholder-earth-500 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent"
                placeholder="e.g. Spencer"
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-sunset-400">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="mt-4 w-full py-3 bg-forest-600 hover:bg-forest-500 disabled:bg-earth-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </form>
          )}
        </div>

        {farmConfig.address && (
          <p className="text-center text-earth-500 text-xs mt-6">
            {farmConfig.address}
          </p>
        )}

        <div className="mt-6">
          <DonationBanner variant="inline" />
        </div>

        <p className="text-center text-earth-600 text-xs mt-3">
          Powered by <a href="https://github.com/sahrens/farmscape-os" className="text-earth-500 hover:text-earth-400 underline" target="_blank" rel="noopener">FarmscapeOS</a>
        </p>
      </div>
    </div>
  );
}
