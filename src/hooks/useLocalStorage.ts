/**
 * useLocalStorage Hook
 * Persist data in browser localStorage
 */

import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Get from localStorage or use initial value
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error loading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Update localStorage when value changes
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error saving localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue] as const;
}

/**
 * API Keys Interface
 */
export interface ApiKeys {
  e2b: string;
  neosantara: string;
  groq: string;
  backendUrl: string;
}

/**
 * Hook for managing API keys
 */
export function useApiKeys() {
  const [apiKeys, setApiKeys] = useLocalStorage<ApiKeys>('apilab_api_keys', {
    e2b: '',
    neosantara: '',
    groq: '',
    backendUrl: import.meta.env.VITE_API_URL || 'http://localhost:8787',
  });

  const updateKey = (provider: keyof ApiKeys, value: string) => {
    setApiKeys({ ...apiKeys, [provider]: value });
  };

  const hasE2bKey = !!apiKeys.e2b;
  const hasLLMKey = !!apiKeys.neosantara || !!apiKeys.groq;
  const isConfigured = hasE2bKey && hasLLMKey;

  return {
    apiKeys,
    updateKey,
    hasE2bKey,
    hasLLMKey,
    isConfigured,
  };
}
