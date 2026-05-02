import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import * as db from '../services/database';
import { User } from '../types';

interface AuthContextType {
  user: (User & { sync_frequency?: string; last_sync?: string | null }) | null;
  isLoading: boolean;
  isDbReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  updateSyncFrequency: (frequency: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<(User & { sync_frequency?: string; last_sync?: string | null }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      // Initialize local database
      await db.initDatabase();
      setIsDbReady(true);
      
      // Check for local user first
      const localUser = await db.getLocalUser();
      if (localUser) {
        setUser(localUser);
        setIsLoading(false);
        return;
      }
      
      // If no local user, check token for cloud auth
      const token = await AsyncStorage.getItem('token');
      if (token) {
        try {
          const userData = await api.getMe();
          await db.saveUser({ ...userData, sync_frequency: 'manual' });
          setUser({ ...userData, sync_frequency: 'manual', last_sync: null });
        } catch (error) {
          await AsyncStorage.removeItem('token');
        }
      }
    } catch (error) {
      console.error('Init error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const { token, user: userData } = await api.login(email, password);
    await AsyncStorage.setItem('token', token);
    await db.saveUser({ ...userData, sync_frequency: 'manual' });
    setUser({ ...userData, sync_frequency: 'manual', last_sync: null });
  };

  const register = async (email: string, password: string, name: string) => {
    const { token, user: userData } = await api.register(email, password, name);
    await AsyncStorage.setItem('token', token);
    await db.saveUser({ ...userData, sync_frequency: 'manual' });
    setUser({ ...userData, sync_frequency: 'manual', last_sync: null });
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    await db.clearAllData();
    setUser(null);
  };

  const updateUser = (userData: User) => {
    setUser(prev => prev ? { ...prev, ...userData } : null);
  };

  const updateSyncFrequency = async (frequency: string) => {
    if (user) {
      await db.updateSyncFrequency(user.id, frequency);
      setUser(prev => prev ? { ...prev, sync_frequency: frequency } : null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isDbReady, login, register, logout, updateUser, updateSyncFrequency }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
