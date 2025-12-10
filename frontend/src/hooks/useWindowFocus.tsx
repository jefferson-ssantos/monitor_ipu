import { useEffect, useRef } from 'react';

// Hook to prevent unnecessary re-renders on window focus changes
export function useWindowFocus() {
  const isVisible = useRef(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisible.current = !document.hidden;
    };

    const handleFocus = () => {
      isVisible.current = true;
    };

    const handleBlur = () => {
      isVisible.current = false;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return isVisible.current;
}