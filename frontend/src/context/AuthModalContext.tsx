import { createContext, useContext } from "react";

export const OpenAuthModalContext = createContext<(() => void) | null>(null);

export function useOpenAuthModal() {
  const open = useContext(OpenAuthModalContext);
  return open ?? (() => {});
}
