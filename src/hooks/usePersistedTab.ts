import { useState } from "react";

/**
 * Como um useState comum, mas persiste o valor no localStorage — assim a aba
 * ativa (ou o modo de visualização) não reseta quando a página é desmontada
 * ao navegar e o usuário volta depois.
 */
export function usePersistedTab<T extends string>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return (stored as T) || defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setPersisted = (next: T) => {
    setValue(next);
    try {
      window.localStorage.setItem(key, next);
    } catch {
      // localStorage indisponível (modo privado, etc.) — segue apenas em memória
    }
  };

  return [value, setPersisted] as const;
}
