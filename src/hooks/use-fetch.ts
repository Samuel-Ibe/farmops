"use client";

import { useState, useEffect, useCallback } from "react";

interface UseFetchOptions {
  immediate?: boolean;
}

export function useFetch<T>(
  url: string | null,
  options: UseFetchOptions = { immediate: true }
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed: ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (options.immediate !== false && url) {
      fetchData();
    }
  }, [fetchData, options.immediate]);

  return { data, error, loading, refetch: fetchData, setData };
}
