import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '../api/base44Client';
import { appParams } from './app-params';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const [userRegistrationError, setUserRegistrationError] = useState(null);

  useEffect(() => {
    const checkUserAuth = async () => {
      try {
        const userData = await base44.auth.me();
        if (userData?.id) {
          setUser(userData);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (error?.status === 403 && error?.message?.includes('not registered')) {
          setUserRegistrationError(error.message);
        }
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    const checkAppState = async () => {
      try {
        setIsLoadingPublicSettings(true);

        if (!appParams.appId) {
          console.error('App ID is missing');
          setIsLoadingPublicSettings(false);
          setIsLoadingAuth(false);
          return;
        }

        const publicSettingsRes = await fetch(
          `https://api.base44.com/prod/public-settings/by-id/${appParams.appId}`
        );
        
        if (!publicSettingsRes.ok) {
          throw new Error('Failed to fetch public settings');
        }

        const publicSettings = await publicSettingsRes.json();
        setAppPublicSettings(publicSettings);

        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
        }

        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('Error fetching app settings:', appError);
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    };

    checkAppState();
  }, []);

  const logout = async () => {
    try {
      setIsAuthenticated(false);
      setUser(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await base44.auth.me();
      if (userData?.id) {
        setUser(userData);
        return userData;
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
    return null;
  };

  const value = {
    isAuthenticated,
    user,
    isLoadingAuth,
    isLoadingPublicSettings,
    appPublicSettings,
    userRegistrationError,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
