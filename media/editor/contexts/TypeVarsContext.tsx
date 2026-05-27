import { createContext, useContext } from "react";

export type TypeVarsMap = Record<string, Array<{ name: string; defaultValue: string }>>;

export const TypeVarsContext = createContext<TypeVarsMap | null>(null);

export function useTypeVars(): TypeVarsMap | null {
  return useContext(TypeVarsContext);
}
