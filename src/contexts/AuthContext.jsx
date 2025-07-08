
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../config/supabase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);
  };

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Initialize user metadata on sign-up
        data: {
          full_name: 'New User',
          phone: '',
          signature: ''
        }
      }
    });
    return { data, error };
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const updatePassword = async (oldPassword, newPassword) => {
    // 1. Re-authenticate user with their old password
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });
  
    if (reauthError) {
      throw new Error('Old password is not correct');
    }
  
    // 2. Update the user's password to the new one
    const { data, error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
  
    if (updateError) {
      throw updateError;
    }
  
    return { data };
  };

  const deleteUser = async () => {
    // Client-side deletion is not directly possible for security reasons.
    // This function simulates deletion by signing the user out.
    // A real implementation would require a Supabase Edge Function.
    console.log("Simulating user deletion by signing out.");
    return await signOut();
  };

  const value = {
    user,
    signUp,
    signIn,
    signOut,
    updatePassword,
    deleteUser,
    loading,
    refreshUser // Expose the refresh function
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
