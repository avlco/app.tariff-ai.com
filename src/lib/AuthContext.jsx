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
    let isMounted = true; // Flag to prevent memory leaks

    const checkUserAuth = async () => {
      try {
        const userData = await base44.auth.me();
        
        if (!isMounted) return; // Check if component is still mounted
        
        if (userData?.id) {
          setUser(userData);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        
        if (!isMounted) return;
        
        if (error?.status === 403 && error?.message?.includes('not registered')) {
          setUserRegistrationError(error.message);
        }
        
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        if (isMounted) {
          setIsLoadingAuth(false);
        }
      }
    };

    const checkAppState = async () => {
      try {
        setIsLoadingPublicSettings(true);

        if (!appParams.appId) {
          console.error('App ID is missing');
          if (isMounted) {
            setIsLoadingPublicSettings(false);
            setIsLoadingAuth(false);
          }
          return;
        }

        // Fetch public settings
        const appClient = await import('../api/base44Client').then(m => m.appClient);
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        
        if (!isMounted) return; // Check before updating state
        
        setAppPublicSettings(publicSettings);

        // Check authentication if token exists
        if (appParams.token) {
          await checkUserAuth();
        } else {
          if (!isMounted) return;
          
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
        }

        if (!isMounted) return;
        
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('Error fetching app settings:', appError);
        
        if (!isMounted) return;
        
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    };

    checkAppState();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []);

  const logout = async () => {
    try {
      // Optional: Call logout endpoint if needed
      // await base44.auth.logout();
      
      setIsAuthenticated(false);
      setUser(null);
      
      // Redirect to login or home
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
