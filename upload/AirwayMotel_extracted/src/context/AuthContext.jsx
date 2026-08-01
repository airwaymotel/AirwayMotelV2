import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in via local storage for simplicity (MVP)
    const storedAuth = localStorage.getItem('airway_admin_auth');
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const login = async (password) => {
    // Fetch the admin password from supabase
    const { data, error } = await supabase
      .from('admin')
      .select('password')
      .limit(1)
      .single();

    if (error || !data) {
      console.error("Login Error:", error);
      return false;
    }

    if (data.password === password) {
      setIsAuthenticated(true);
      localStorage.setItem('airway_admin_auth', 'true');
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('airway_admin_auth');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
