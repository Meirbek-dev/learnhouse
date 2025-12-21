import { useCallback, useEffect, useRef, useState } from 'react';

// Function debouncing
type AnyFunction = (...args: any[]) => any;

// Implementation
export function useDebounce<T>(valueOrCallback: T, delay: number): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef<AnyFunction | null>(null);

  // keep latest callback reference (safe to call on every render)
  useEffect(() => {
    if (typeof valueOrCallback === 'function') callbackRef.current = valueOrCallback as AnyFunction;
  }, [valueOrCallback]);

  // stable debounced function
  const debouncedFn = useCallback(
    (...args: any[]) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current as ReturnType<typeof setTimeout>);
      timeoutRef.current = setTimeout(() => {
        if (callbackRef.current) callbackRef.current(...args);
      }, delay);
    },
    [delay],
  );

  // value debouncing state
  const [debouncedValue, setDebouncedValue] = useState<T>(valueOrCallback);

  useEffect(() => {
    if (typeof valueOrCallback === 'function') return; // nothing for function case

    if (timeoutRef.current) clearTimeout(timeoutRef.current as ReturnType<typeof setTimeout>);
    timeoutRef.current = setTimeout(() => setDebouncedValue(valueOrCallback), delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current as ReturnType<typeof setTimeout>);
    };
  }, [valueOrCallback, delay]);

  // Ensure cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current as ReturnType<typeof setTimeout>);
    };
  }, []);

  // return appropriate type
  if (typeof valueOrCallback === 'function') return debouncedFn as unknown as T;
  return debouncedValue;
}
