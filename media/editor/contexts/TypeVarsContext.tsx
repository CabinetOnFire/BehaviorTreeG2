import { createContext, useContext } from "react";
import type { BtBindingDeclarations } from "../../../shared/types";

export interface TypeVarsEntry {
  params: Array<{ name: string; defaultValue: string }>;
  vars: Array<{ name: string; defaultValue: string }>;
}

export type TypeVarsMap = Record<string, TypeVarsEntry>;

export const TypeVarsContext = createContext<TypeVarsMap | null>(null);

export function useTypeVars(): TypeVarsMap | null {
  return useContext(TypeVarsContext);
}

export const ActiveBindingsContext = createContext<BtBindingDeclarations | undefined>(undefined);

export function useResolveBinding(): (value: string) => string {
  const bindings = useContext(ActiveBindingsContext);
  return (value: string) => {
    if (!value.startsWith("$") || !bindings) return value;
    const id = value.slice(1);
    const decl = bindings[id];
    return decl ? `$${decl.label}` : value;
  };
}
