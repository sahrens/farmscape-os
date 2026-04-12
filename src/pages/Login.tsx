import { useState } from 'react';
import { useStore } from '@/lib/store';
import farmConfig from '@/farm.config';
import { DonationBanner } from '@/components/DonationBanner';

export function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useStore(s => s.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await login(password);
    setLoading(false);
    if (!ok) setError('Invalid password');
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

        <form onSubmit={handleSubmit} className="bg-earth-800 rounded-xl p-6 shadow-lg border border-earth-700">
          <label className="block text-sm font-medium text-earth-300 mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-earth-900 border border-earth-600 rounded-lg text-earth-100 placeholder-earth-500 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent"
            placeholder="Enter password"
            autoFocus
          />
          {error && (
            <p className="mt-2 text-sm text-sunset-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="mt-4 w-full py-3 bg-forest-600 hover:bg-forest-500 disabled:bg-earth-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {loading ? 'Checking...' : 'Enter'}
          </button>
        </form>

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
