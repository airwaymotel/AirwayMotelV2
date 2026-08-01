import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Lock } from 'lucide-react';

export default function SettingsPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    if (newPassword.length < 4) {
      setStatus({ type: 'error', message: 'Password must be at least 4 characters long.' });
      return;
    }

    setIsLoading(true);

    // Fetch the admin row ID first
    const { data: adminData, error: adminError } = await supabase
      .from('admin')
      .select('id')
      .limit(1)
      .single();

    if (adminError || !adminData) {
      setStatus({ type: 'error', message: 'Could not find admin record.' });
      setIsLoading(false);
      return;
    }

    // Update the password
    const { error: updateError } = await supabase
      .from('admin')
      .update({ password: newPassword })
      .eq('id', adminData.id);

    if (updateError) {
      setStatus({ type: 'error', message: 'Failed to update password.' });
    } else {
      setStatus({ type: 'success', message: 'Password updated successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    }

    setIsLoading(false);
  };

  return (
    <div className="p-container-padding flex-1">
      <div className="mb-8">
        <h2 className="text-display-lg font-bold text-primary">Settings</h2>
        <p className="text-on-surface-variant text-body-md mt-1">Manage admin terminal preferences and security.</p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden">
          <div className="p-6 border-b border-outline-variant flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-container text-primary rounded-full flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-title-sm font-bold text-primary">Security</h3>
              <p className="text-body-sm text-on-surface-variant">Update the master admin password.</p>
            </div>
          </div>
          
          <div className="p-6">
            <form onSubmit={handlePasswordChange} className="space-y-5">
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2">
                  NEW PASSWORD
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary transition-all font-body-sm max-w-md"
                  placeholder="Enter new password"
                  required
                />
              </div>

              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant mb-2">
                  CONFIRM NEW PASSWORD
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary transition-all font-body-sm max-w-md"
                  placeholder="Confirm new password"
                  required
                />
              </div>

              {status.message && (
                <div className={`p-3 text-body-sm rounded-lg max-w-md ${status.type === 'error' ? 'bg-error-container text-on-error-container' : 'bg-green-100 text-green-800'}`}>
                  {status.message}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !newPassword || !confirmPassword}
                  className="px-6 py-2.5 bg-primary text-on-primary font-title-sm rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isLoading ? 'Saving...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
