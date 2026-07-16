export interface VarDecl {
  name: string;
  defaultValue: string;
}

export interface ConfigRow {
  key: string;
  value: string;
  isDefault: boolean;
}

/** Last path segment, e.g. "/datum/bt_node/ai_behavior/attack" -> "attack". */
export function lastSegment(v: string): string {
  const trimmed = v.trim();
  const parts = trimmed.split("/").filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : trimmed;
}

/**
 * Build the display rows for a leaf/decorator node's vars{} config.
 */
export function rowsFor(
  config: Record<string, string | string[]>,
  varDecls: VarDecl[],
  resolveBinding: (value: string) => string = (v) => v,
): ConfigRow[] {
  const rows: ConfigRow[] = [];

  if (varDecls.length > 0) {
    for (const v of varDecls) {
      const val = config[v.name];
      if (val !== undefined) {
        rows.push({
          key: v.name,
          value: Array.isArray(val) ? `[${val.length}]` : lastSegment(resolveBinding(val)),
          isDefault: false,
        });
      } else if (v.defaultValue !== "null") {
        rows.push({ key: v.name, value: v.defaultValue, isDefault: true });
      }
    }
  } else {
    for (const [k, v] of Object.entries(config)) {
      rows.push({
        key: k,
        value: Array.isArray(v) ? `[${v.length}]` : lastSegment(resolveBinding(v)),
        isDefault: false,
      });
    }
  }

  return rows;
}
