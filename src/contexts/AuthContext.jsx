import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data) setProfile(data);
    setLoading(false);
  };

  const login = async (emailOrUsername, password) => {
    // Special case for 'luiz' admin login (case-insensitive)
    const normalizedIdentifier = emailOrUsername.toLowerCase().trim();
    const email = normalizedIdentifier === 'luiz' ? 'luiz@fofoca.com' : emailOrUsername;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: name }
      }
    });

    if (error) throw error;

    // Supabase trigger usually handles profile, but let's be safe
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username: name,
        role: 'user',
        is_active: false // Approval required
      });
    }

    return data;
  };

  const logout = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, signUp }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
