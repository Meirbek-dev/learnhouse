import { useEffect, useRef, useState } from 'react';

// Function debouncing
type AnyFunction = (...args: any[]) => any;

export function useDebounce<T extends AnyFunction>(callback: T, delay: number): T;
export function useDebounce<T>(value: T, delay: number): T;

// Implementation
export function useDebounce<T>(valueOrCallback: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(valueOrCallback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // If it's a function, return a debounced version of it
    if (typeof valueOrCallback === 'function') {
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }

    // For values, update the debounced value after the delay
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(valueOrCallback);
    }, delay);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [valueOrCallback, delay]);

  // If it's a function, return a debounced version
  if (typeof valueOrCallback === 'function') {
    return ((...args: any[]) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        (valueOrCallback as AnyFunction)(...args);
      }, delay);
    }) as T;
  }

  // For values, return the debounced value
  return debouncedValue;
}
