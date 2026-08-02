'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError('');

    try {
      if (!supabase) {
        // Fallback for local development without Supabase
        if (password === '1234') {
          localStorage.setItem('airway_auth', 'true');
          router.push('/');
          return;
        } else {
          throw new Error('Invalid password');
        }
      }

      // Query the custom admin table
      const { data, error: sbError } = await supabase
        .from('admin')
        .select('password')
        .limit(1)
        .single();

      if (sbError) {
        throw new Error('Could not connect to authentication server');
      }

      if (data && data.password === password) {
        localStorage.setItem('airway_auth', 'true');
        router.push('/');
      } else {
        throw new Error('Invalid password');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 selection:bg-amber-500/30">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-8">
        
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg mb-4">
            <svg width="36" height="36" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 28L20 12L28 28" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 22H25" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-1.5">
            <span>Airway</span>
            <span className="text-amber-500">Motel</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1 uppercase tracking-widest font-semibold">
            Admin Portal
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">
              Admin Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-5 w-5 text-zinc-500" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="pl-10 bg-zinc-950 border-zinc-800 h-10 text-white"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-10 mt-2 transition-colors"
            disabled={loading}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Log In'}
          </Button>
        </form>

      </div>
      
      <div className="mt-8 text-center text-xs text-zinc-600">
        <p>&copy; {new Date().getFullYear()} Airway Motel Management System</p>
        <p className="mt-1">Authorized Personnel Only</p>
      </div>
    </div>
  );
}
