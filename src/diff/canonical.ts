/** Deterministic string form of a vars{}/bindings{} map — order-independent, used for both hashing and equality checks. */
export function canonicalVars(vars: Record<string, string | string[]>): string {
  return Object.keys(vars)
    .sort()
    .map((k) => {
      const v = vars[k];
      return `${k}:${Array.isArray(v) ? v.join(",") : v}`;
    })
    .join(";");
}

export function canonicalBindings(bindings: Record<string, string> | undefined): string {
  if (!bindings) return "";
  return Object.keys(bindings)
    .sort()
    .map((k) => `${k}:${bindings[k]}`)
    .join(";");
}
