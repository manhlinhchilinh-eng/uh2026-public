/**
 * UMS Digital Class Logbook - Idle Session Timeout Hook
 * Milestone 6: Inactivity Detection, Multi-Tab Sync, Advance Warning Countdown
 * Path: src/hooks/useIdleTimeout.ts
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;      // 30 minutes hard timeout
export const WARNING_TIMEOUT_MS = 25 * 60 * 1000;   // 25 minutes warning (5 min countdown)
export const THROTTLE_ACTIVITY_MS = 15 * 1000;       // 15 seconds event throttle

export interface UseIdleTimeoutOptions {
  timeoutMs?: number;
  warningMs?: number;
  enabled?: boolean;
  onTimeout?: () => void;
  onWarning?: () => void;
}

export interface UseIdleTimeoutReturn {
  isWarningOpen: boolean;
  isWarningModalOpen: boolean; // Alias for test compatibility
  remainingSeconds: number;
  formattedRemaining: string;
  resetTimer: () => void;
  resetActivity: () => void;   // Alias for test compatibility
  extendSession: () => void;
  logout: () => void;
  logoutNow: () => void;       // Alias for test compatibility
}

export function useIdleTimeout(options: UseIdleTimeoutOptions = {}): UseIdleTimeoutReturn {
  const {
    timeoutMs = IDLE_TIMEOUT_MS,
    warningMs = WARNING_TIMEOUT_MS,
    enabled = true,
    onTimeout,
    onWarning,
  } = options;

  const { user, logout: authLogout } = useAuth();
  const navigate = useNavigate();

  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    Math.max(0, Math.floor((timeoutMs - warningMs) / 1000))
  );

  const lastActivityRef = useRef<number>(Date.now());
  const isWarningOpenRef = useRef<boolean>(false);
  const isTimedOutRef = useRef<boolean>(false);
  const onWarningRef = useRef(onWarning);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onWarningRef.current = onWarning;
    onTimeoutRef.current = onTimeout;
  }, [onWarning, onTimeout]);

  // Terminal logout on timeout
  const handleTimeoutLogout = useCallback(async () => {
    isTimedOutRef.current = true;
    isWarningOpenRef.current = false;
    setIsWarningOpen(false);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ums_logout_reason', 'idle_timeout');
    }

    if (onTimeoutRef.current) {
      onTimeoutRef.current();
    } else {
      await authLogout();
      navigate('/login?reason=idle_timeout');
    }
  }, [authLogout, navigate]);

  // Throttled activity updater
  const resetTimer = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current > THROTTLE_ACTIVITY_MS) {
      lastActivityRef.current = now;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ums_last_activity', now.toString());
      }
    }
  }, []);

  const resetActivity = resetTimer;

  // Extend session (dismiss warning and restart timer)
  const extendSession = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    isTimedOutRef.current = false;
    isWarningOpenRef.current = false;
    setIsWarningOpen(false);
    setRemainingSeconds(Math.max(0, Math.floor((timeoutMs - warningMs) / 1000)));

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ums_last_activity', now.toString());
    }
  }, [timeoutMs, warningMs]);

  useEffect(() => {
    if (!enabled || !user) {
      setIsWarningOpen(false);
      isWarningOpenRef.current = false;
      return;
    }

    const now = Date.now();
    lastActivityRef.current = now;
    isTimedOutRef.current = false;
    isWarningOpenRef.current = false;

    if (typeof localStorage !== 'undefined' && !localStorage.getItem('ums_last_activity')) {
      localStorage.setItem('ums_last_activity', now.toString());
    }

    // 1. User activity listeners (throttled)
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    const onUserActivity = () => {
      if (!isWarningOpenRef.current && !isTimedOutRef.current) {
        resetTimer();
      }
    };

    events.forEach((evt) => window.addEventListener(evt, onUserActivity, { passive: true }));

    // 2. Cross-tab synchronization via storage event
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ums_last_activity' && e.newValue) {
        lastActivityRef.current = parseInt(e.newValue, 10);
        if (isWarningOpenRef.current) {
          extendSession();
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 3. Single interval checking elapsed time every second
    const intervalId = window.setInterval(() => {
      if (isTimedOutRef.current) return;

      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= timeoutMs) {
        isTimedOutRef.current = true;
        isWarningOpenRef.current = false;
        setIsWarningOpen(false);
        setRemainingSeconds(0);
        handleTimeoutLogout();
      } else if (elapsed >= warningMs) {
        if (!isWarningOpenRef.current) {
          isWarningOpenRef.current = true;
          setIsWarningOpen(true);
          if (onWarningRef.current) {
            onWarningRef.current();
          }
        }
        const remaining = Math.max(0, Math.floor((timeoutMs - elapsed) / 1000));
        setRemainingSeconds(remaining);
      } else {
        if (isWarningOpenRef.current) {
          isWarningOpenRef.current = false;
          setIsWarningOpen(false);
        }
        setRemainingSeconds(Math.max(0, Math.floor((timeoutMs - warningMs) / 1000)));
      }
    }, 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, onUserActivity));
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(intervalId);
    };
  }, [
    enabled,
    user,
    timeoutMs,
    warningMs,
    resetTimer,
    extendSession,
    handleTimeoutLogout,
  ]);

  // Formatted MM:SS
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const formattedRemaining = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return {
    isWarningOpen,
    isWarningModalOpen: isWarningOpen,
    remainingSeconds,
    formattedRemaining,
    resetTimer,
    resetActivity,
    extendSession,
    logout: handleTimeoutLogout,
    logoutNow: handleTimeoutLogout,
  };
}
