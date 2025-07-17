
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

  // This function is kept for cases where a manual refresh is desired,
  // but it will be replaced by a more direct state update for profile changes.
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
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword,
    });
  
    if (reauthError) {
      throw new Error('Old password is not correct');
    }
  
    const { data, error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
  
    if (updateError) {
      throw updateError;
    }
  
    return { data };
  };

  const deleteUser = async () => {
    console.log("Simulating user deletion by signing out.");
    return await signOut();
  };

  const value = {
    user,
    setUser, // Expose the state setter function
    signUp,
    signIn,
    signOut,
    updatePassword,
    deleteUser,
    loading,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
