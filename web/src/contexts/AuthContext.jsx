import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext(null);

// ─── Constants ────────────────────────────────────────────────────────────────
const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const STORAGE_TOKEN_KEY     = 'schoolbase_token';
const STORAGE_USER_KEY      = 'schoolbase_user';
const STORAGE_SCHOOL_KEY    = 'schoolbase_active_school_id';
const STORAGE_LAST_ACTIVE   = 'schoolbase_last_active';

// Use sessionStorage so the session is cleared whenever the browser tab/window is closed.
// A new browser session always starts at the login page.
const store = sessionStorage;

// ─── Activity events that reset the inactivity clock ─────────────────────────
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

export const AuthProvider = ({ children }) => {
  const [user, setUser]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [activeSchoolId, setActiveSchoolId] = useState(null);
  const inactivityTimer               = useRef(null);

  // ─── Clear all auth storage ───────────────────────────────────────────────
  const clearStorage = useCallback(() => {
    store.removeItem(STORAGE_TOKEN_KEY);
    store.removeItem(STORAGE_USER_KEY);
    store.removeItem(STORAGE_SCHOOL_KEY);
    store.removeItem(STORAGE_LAST_ACTIVE);
  }, []);

  // ─── Perform logout ───────────────────────────────────────────────────────
  const logout = useCallback((reason = 'manual') => {
    clearStorage();
    setUser(null);
    setActiveSchoolId(null);
    clearTimeout(inactivityTimer.current);
    // Redirect to login — preserve reason in query string for UI message
    if (window.location.pathname !== '/login') {
      window.location.replace(`/login${reason === 'inactivity' ? '?expired=1' : ''}`);
    }
  }, [clearStorage]);

  // ─── Reset inactivity timer on any user activity ──────────────────────────
  const resetInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    store.setItem(STORAGE_LAST_ACTIVE, Date.now().toString());
    inactivityTimer.current = setTimeout(() => {
      logout('inactivity');
    }, INACTIVITY_TIMEOUT_MS);
  }, [logout]);

  // ─── Start/stop activity listeners ───────────────────────────────────────
  const startActivityTracking = useCallback(() => {
    ACTIVITY_EVENTS.forEach(evt =>
      window.addEventListener(evt, resetInactivityTimer, { passive: true })
    );
    resetInactivityTimer(); // Start the first timer immediately
  }, [resetInactivityTimer]);

  const stopActivityTracking = useCallback(() => {
    ACTIVITY_EVENTS.forEach(evt =>
      window.removeEventListener(evt, resetInactivityTimer)
    );
    clearTimeout(inactivityTimer.current);
  }, [resetInactivityTimer]);

  // ─── Restore session from sessionStorage on app load ─────────────────────
  useEffect(() => {
    const token    = store.getItem(STORAGE_TOKEN_KEY);
    const savedUser = store.getItem(STORAGE_USER_KEY);
    const lastActive = store.getItem(STORAGE_LAST_ACTIVE);

    if (token && savedUser) {
      // Check if session was idle for too long before this page load
      if (lastActive && Date.now() - parseInt(lastActive, 10) > INACTIVITY_TIMEOUT_MS) {
        // Session was idle — clear and force re-login
        clearStorage();
        setLoading(false);
        if (window.location.pathname !== '/login') {
          window.location.replace('/login?expired=1');
        }
        return;
      }

      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        if (parsedUser.role === 'super_admin') {
          const savedSchool = store.getItem(STORAGE_SCHOOL_KEY);
          if (savedSchool) setActiveSchoolId(savedSchool);
        } else {
          setActiveSchoolId(parsedUser.school_id);
        }
        startActivityTracking();
      } catch {
        clearStorage();
      }
    }

    setLoading(false);

    // Cleanup on unmount
    return () => stopActivityTracking();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Login ────────────────────────────────────────────────────────────────
  const login = async (username, password) => {
    try {
      const result = await api.post('/auth/login', { username, password });
      const { token, user: loggedUser } = result.data;

      // Store in sessionStorage (dies when tab is closed)
      store.setItem(STORAGE_TOKEN_KEY, token);
      store.setItem(STORAGE_USER_KEY, JSON.stringify(loggedUser));
      store.setItem(STORAGE_LAST_ACTIVE, Date.now().toString());

      setUser(loggedUser);
      if (loggedUser.role === 'super_admin') {
        setActiveSchoolId(null);
      } else {
        setActiveSchoolId(loggedUser.school_id);
      }

      startActivityTracking();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ─── Change Active School (Super Admin only) ──────────────────────────────
  const changeActiveSchool = (schoolId) => {
    if (user?.role === 'super_admin') {
      setActiveSchoolId(schoolId);
      if (schoolId) {
        store.setItem(STORAGE_SCHOOL_KEY, schoolId);
      } else {
        store.removeItem(STORAGE_SCHOOL_KEY);
      }
    }
  };

  const value = {
    user,
    loading,
    activeSchoolId,
    login,
    logout,
    changeActiveSchool,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
