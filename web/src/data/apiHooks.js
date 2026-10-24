import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

// ─── Global In-Memory Cache & Invalidation Event Bus ─────────────────────────
const cache = new Map();
const subscribers = new Map();

/**
 * Invalidate cached entries by exact key or prefix.
 * Triggers all active useApi hooks subscribed to matching keys to refetch.
 * @param {string|string[]} keysOrPrefix
 */
export function invalidate(keysOrPrefix) {
  const targets = Array.isArray(keysOrPrefix) ? keysOrPrefix : [keysOrPrefix];

  for (const [cacheKey] of cache.entries()) {
    const isMatch = targets.some(target => cacheKey === target || cacheKey.startsWith(target));
    if (isMatch) {
      cache.delete(cacheKey);
    }
  }

  for (const [subKey, callbacks] of subscribers.entries()) {
    const isMatch = targets.some(target => subKey === target || subKey.startsWith(target));
    if (isMatch) {
      callbacks.forEach(cb => {
        try { cb(); } catch (err) { console.error('Error during subscriber invalidation:', err); }
      });
    }
  }
}

/**
 * Global WebSocket connection for reactive invalidation
 */
let wsInstance = null;
let wsStatus = 'disconnected';
const wsListeners = new Set();

export function subscribeWsStatus(listener) {
  wsListeners.add(listener);
  listener(wsStatus);
  return () => wsListeners.delete(listener);
}

export function initWebSocket(token, schoolId) {
  if (typeof window === 'undefined') return;
  if (wsInstance && (wsInstance.readyState === WebSocket.OPEN || wsInstance.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname || 'localhost';
  const port = '5000';
  const url = `${protocol}//${host}:${port}/ws?token=${token || ''}&schoolId=${schoolId || ''}`;

  try {
    wsStatus = 'connecting';
    wsListeners.forEach(l => l(wsStatus));

    wsInstance = new WebSocket(url);

    wsInstance.onopen = () => {
      wsStatus = 'connected';
      wsListeners.forEach(l => l(wsStatus));
    };

    wsInstance.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'invalidate' && payload.keys) {
          invalidate(payload.keys);
        } else if (payload.event) {
          // Event-based invalidation mapping
          const map = {
            'payment_recorded': ['fees', 'analytics/fees', 'dashboard'],
            'payment_approved': ['fees', 'analytics/fees', 'dashboard'],
            'mark_saved':       ['grades', 'results', 'analytics/academics', 'dashboard'],
            'attendance_taken': ['attendance', 'analytics/attendance', 'dashboard'],
            'exeat_updated':    ['boarding', 'exeat', 'dashboard'],
            'new_message':      ['messages', 'notifications']
          };
          const keys = map[payload.event] || ['dashboard'];
          invalidate(keys);
        }
      } catch (_) {}
    };

    wsInstance.onerror = () => {
      wsStatus = 'error';
      wsListeners.forEach(l => l(wsStatus));
    };

    wsInstance.onclose = () => {
      wsStatus = 'disconnected';
      wsListeners.forEach(l => l(wsStatus));
      wsInstance = null;
      // Reconnect attempt after 5 seconds
      setTimeout(() => initWebSocket(token, schoolId), 5000);
    };
  } catch (_) {
    wsStatus = 'error';
    wsListeners.forEach(l => l(wsStatus));
  }
}

/**
 * useApi hook: In-memory cache, de-duplication, stale-while-revalidate,
 * AbortController, and reactive invalidation listener.
 *
 * @param {string|null} key - Cache and endpoint identifier. If null, hook remains idle.
 * @param {Function} fetcher - Async function returning data
 * @param {Object} options - { params, deps = [], enabled = true, ttl = 30000, pollInterval }
 */
export function useApi(key, fetcher, options = {}) {
  const {
    params = null,
    deps = [],
    enabled = true,
    ttl = 30000,
    pollInterval = null
  } = options;

  const queryString = params ? JSON.stringify(params) : '';
  const fullKey = key ? (queryString ? `${key}:${queryString}` : key) : null;

  const cached = fullKey ? cache.get(fullKey) : null;
  const isFresh = cached && (Date.now() - cached.timestamp < ttl);

  const [data, setData] = useState(cached ? cached.data : null);
  const [loading, setLoading] = useState(Boolean(!isFresh && enabled && fullKey));
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);

  const executeFetch = useCallback(async (isBackground = false) => {
    if (!fullKey || !enabled) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (!isBackground) {
      setLoading(true);
      setError(null);
    }

    try {
      const result = await fetcher({
        signal: abortControllerRef.current.signal,
        params
      });

      // Unwrap standard response { data: ... } if present
      const finalData = result && typeof result === 'object' && 'data' in result ? result.data : result;

      cache.set(fullKey, {
        data: finalData,
        timestamp: Date.now()
      });

      setData(finalData);
      setError(null);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [fullKey, enabled, queryString, ...deps]);

  // Initial fetch and dependency trigger
  useEffect(() => {
    if (!fullKey || !enabled) return;

    const currentCached = cache.get(fullKey);
    const fresh = currentCached && (Date.now() - currentCached.timestamp < ttl);

    if (fresh) {
      setData(currentCached.data);
      setLoading(false);
    } else if (currentCached) {
      // Stale-while-revalidate: show stale data immediately, refetch in background
      setData(currentCached.data);
      executeFetch(true);
    } else {
      executeFetch(false);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fullKey, enabled, ...deps]);

  // Subscribe to invalidation bus
  useEffect(() => {
    if (!fullKey) return;

    if (!subscribers.has(fullKey)) {
      subscribers.set(fullKey, new Set());
    }
    const set = subscribers.get(fullKey);
    const subscriber = () => executeFetch(true);
    set.add(subscriber);

    return () => {
      set.delete(subscriber);
      if (set.size === 0) subscribers.delete(fullKey);
    };
  }, [fullKey, executeFetch]);

  // Optional polling (e.g. 60s fallback for dashboards)
  useEffect(() => {
    if (!pollInterval || !enabled || !fullKey) return;
    const intervalId = setInterval(() => {
      executeFetch(true);
    }, pollInterval);
    return () => clearInterval(intervalId);
  }, [pollInterval, enabled, fullKey, executeFetch]);

  const isEmpty = data === null ||
    (Array.isArray(data) && data.length === 0) ||
    (typeof data === 'object' && Object.keys(data).length === 0);

  return {
    data,
    loading,
    error,
    empty: !loading && isEmpty,
    refetch: () => executeFetch(false)
  };
}

/**
 * useUrlFilters hook: Bind search & filter state directly to URL query params
 * Supports browser back/forward and deep linking.
 */
export function useUrlFilters(initialDefaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = {};
  for (const [key, defVal] of Object.entries(initialDefaults)) {
    filters[key] = searchParams.get(key) ?? defVal;
  }

  const setFilter = useCallback((key, value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value === null || value === undefined || value === '' || value === initialDefaults[key]) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
      return next;
    }, { replace: true });
  }, [initialDefaults, setSearchParams]);

  const resetFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  return { filters, setFilter, resetFilters, searchParams };
}
