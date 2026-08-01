import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const success = await login(password);
    
    if (success) {
      navigate('/dashboard');
    } else {
      setError('Incorrect password. Please try again.');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-container text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-headline-md font-bold text-primary">Airway Motel</h1>
          <p className="text-body-sm text-on-surface-variant mt-2">Admin Terminal Access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2">
              ADMIN PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary transition-all font-body-md"
              placeholder="Enter password..."
              required
              autoFocus
            />
          </div>

          {error && (
            <div className="p-3 bg-error-container text-on-error-container text-body-sm rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full py-3 bg-primary text-on-primary font-title-sm rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex justify-center cursor-pointer"
          >
            {isLoading ? 'Authenticating...' : 'Login to Terminal'}
          </button>
        </form>
      </div>
    </div>
  );
}
