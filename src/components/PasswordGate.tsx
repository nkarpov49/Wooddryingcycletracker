import React, { useState, useEffect } from 'react';
import { Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import backgroundImage from 'figma:asset/4302e5b394cc76a9bf6f44ab80c3dd81459ae7f1.png';

type PasswordGateProps = {
  children: React.ReactNode;
};

export default function PasswordGate({ children }: PasswordGateProps) {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Проверяем сохраненную сессию
    const savedAuth = sessionStorage.getItem('app_authenticated');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setChecking(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c5bcdb1f/check-app-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ password })
        }
      );

      const data = await response.json();

      if (data.success) {
        sessionStorage.setItem('app_authenticated', 'true');
        setIsAuthenticated(true);
        setPassword('');
      } else {
        setError('Neteisingas slaptažodis');
        setPassword('');
      }
    } catch (err) {
      console.error('Password check error:', err);
      setError('Klaida');
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 via-emerald-700 to-teal-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center scale-105"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
        
        {/* Multi-layer Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/60 via-green-900/50 to-teal-950/60"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-green-900/30 via-transparent to-emerald-900/30"></div>
        
        {/* Animated Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Large blur orbs */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        {/* Noise texture overlay for depth */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')] opacity-30"></div>

        {/* Content */}
        <div className="w-full max-w-md relative z-10">
          {/* Logo/Title with enhanced styling */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-28 h-28 bg-white/10 backdrop-blur-xl rounded-full mb-6 shadow-2xl border border-white/20 relative">
              {/* Glow effect behind icon */}
              <div className="absolute inset-0 bg-green-400/30 rounded-full blur-xl"></div>
              <Lock className="w-14 h-14 text-white relative z-10" />
            </div>
            <p className="text-emerald-100 text-xl font-semibold drop-shadow-lg">
              Medienos džiovinimo kontrolės sistema
            </p>
            {/* Decorative line */}
            <div className="mt-4 mx-auto w-24 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent rounded-full"></div>
          </div>

          {/* Password Form with premium glassmorphism */}
          <div className="relative">
            {/* Glow effect behind card */}
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl blur-xl opacity-30"></div>
            
            {/* Main card */}
            <div className="relative bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 border border-white/30">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-6 text-center">
                Prisijungimas į sistemą
              </h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Slaptažodis
                  </label>
                  <div className="relative group">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Įveskite slaptažodį"
                      className="w-full px-4 py-3.5 pr-12 border-2 border-gray-200 bg-white/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-lg shadow-sm transition-all group-hover:border-gray-300"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50/90 backdrop-blur-sm border-2 border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={checking || !password}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold text-lg py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                >
                  {checking ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Tikrinama...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      Prisijungti
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-200/50">
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <p>Saugi prieiga prie DryTrack sistemos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}