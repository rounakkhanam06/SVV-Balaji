import { useEffect, useState } from 'react';

/** `value`, once it has stopped changing for `ms` - so typing a code does not fire a lookup per keystroke. */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}
