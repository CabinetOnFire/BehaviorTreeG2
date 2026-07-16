// Pure DM source scanning: using regex to get it all
export interface TypeVarsEntry {
  /** Positional params from perform() — retained for scanning but not used in the editor. */
  params: Array<{ name: string; defaultValue: string }>;
  /** Declared vars on the type — map to vars{} in the leaf/decorator node. */
  vars: Array<{ name: string; defaultValue: string }>;
}

export interface RawTypeInfo {
  ownVars: Map<string, string>;
  performParams: Array<{ name: string; defaultValue: string }> | null;
}

export interface DmFileScanResult {
  behaviors: string[];
  subtrees: Array<{ typePath: string; filePath: string }>;
  controllers: Array<{ typePath: string; filePath: string }>;
  rawBtJsonRefs: Array<{ typePath: string; relPath: string; dmFsPath: string }>;
  rawTypeInfos: Map<string, RawTypeInfo>;
  typeFilePaths: Record<string, string>;
}

// This is where we keep nodes the editor shouldnt edit. maybe we can improve this later by marking them up on the DM side in the future?
export const STRUCTURAL_VARS = new Set([
  "children",
  "child",
  "root",
  "tick_cooldowns",
  "tick_results",
  "children_typepaths",
  "behavior_nodes",
  "parent_type",
  "child_typepath",
  "behavior_tree_json",
  "child_active",
  "owning_controller",
  "has_observer_signals",
  "observers_registered",
  "behavior_flags",
  "default_behavior_args",
  "running",
  "next_perform_time",
  "only_set_cooldown_on_success",
  "last_poll_result",
  "is_polled",
  "node_type",
  "failed_last_perform",
]);

/** Regex-scan a single .dm file's text for BT declarations, refs, and type vars. */
export async function scanDmFileText(
  text: string,
  fsPath: string,
  yield_: () => Promise<void> = () => Promise.resolve(),
): Promise<DmFileScanResult> {
  const behaviors: string[] = [];
  const subtrees: Array<{ typePath: string; filePath: string }> = [];
  const controllers: Array<{ typePath: string; filePath: string }> = [];
  const typeFilePaths: Record<string, string> = {};

  let m: RegExpExecArray | null;

  const behaviorRe = /^\/datum\/bt_node\/ai_behavior\/[\w/]+(?=\s*(?:\/\/.*)?$)/gm;
  while ((m = behaviorRe.exec(text)) !== null) {
    behaviors.push(m[0].trim());
  }

  const subtreeRe = /^\/datum\/bt_node\/subtree\/[\w/]+(?=\s*(?:\/\/.*)?$)/gm;
  while ((m = subtreeRe.exec(text)) !== null) {
    subtrees.push({ typePath: m[0].trim(), filePath: fsPath });
  }

  const controllerRe = /^\/datum\/ai_controller\/[\w/]+(?=\s*(?:\/\/.*)?$)/gm;
  while ((m = controllerRe.exec(text)) !== null) {
    controllers.push({ typePath: m[0].trim(), filePath: fsPath });
  }

  const rawBtJsonRefsMap = new Map<string, { relPath: string; dmFsPath: string }>();
  await parseBtJsonRefs(text, rawBtJsonRefsMap, fsPath, yield_);
  const rawBtJsonRefs = [...rawBtJsonRefsMap].map(([typePath, { relPath, dmFsPath }]) => ({
    typePath,
    relPath,
    dmFsPath,
  }));

  const rawTypeInfos = new Map<string, RawTypeInfo>();
  await parseTypeVarsFromText(text, rawTypeInfos, fsPath, typeFilePaths, yield_);

  // Ensure regex-found types appear in typeFilePaths even if the line parser missed them
  for (const b of behaviors) {
    if (!(b in typeFilePaths)) typeFilePaths[b] = fsPath;
  }
  for (const s of subtrees) {
    if (!(s.typePath in typeFilePaths)) typeFilePaths[s.typePath] = fsPath;
  }
  for (const c of controllers) {
    if (!(c.typePath in typeFilePaths)) typeFilePaths[c.typePath] = fsPath;
  }

  return { behaviors, subtrees, controllers, rawBtJsonRefs, rawTypeInfos, typeFilePaths };
}

export async function parseBtJsonRefs(
  text: string,
  btJsonRefs: Map<string, { relPath: string; dmFsPath: string }>,
  dmFsPath: string,
  yield_: () => Promise<void>,
): Promise<void> {
  let currentType: string | null = null;
  let lineCount = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    if (++lineCount % 500 === 0) await yield_();

    // Column-0 type declaration
    if (rawLine.startsWith("/datum/")) {
      const typeM = rawLine.match(/^(\/datum\/(?:[\w]+\/)*[\w]+)\s*(?:\/\/.*)?$/);
      currentType = typeM ? typeM[1] : null;
      continue;
    }

    // Reset context on non-indented non-empty lines
    if (
      rawLine.trim() &&
      !rawLine.startsWith("\t") &&
      !rawLine.startsWith("//") &&
      !rawLine.startsWith("#")
    ) {
      currentType = null;
      continue;
    }

    if (!currentType) continue;

    if (rawLine.startsWith("\t") && !rawLine.startsWith("\t\t")) {
      const btM = rawLine.match(/^\t+behavior_tree_json\s*=\s*(?:"([^"]+)"|(\w+))/);
      if (btM && !btJsonRefs.has(currentType)) {
        const relPath = btM[1] ?? (btM[2] === "ABSTRACT_AI_CLASS" ? "Abstract" : undefined);
        if (relPath) btJsonRefs.set(currentType, { relPath, dmFsPath });
      }
    }
  }
}

export async function parseTypeVarsFromText(
  text: string,
  allTypes: Map<string, RawTypeInfo>,
  filePath = "",
  typeFilePaths: Record<string, string> = {},
  yield_: () => Promise<void> = () => Promise.resolve(),
): Promise<void> {
  let currentType: string | null = null;
  let currentIsBehavior = false;
  let pendingVar: { name: string; accum: string; depth: number } | null = null;
  let lineCount = 0;

  const finalizePendingVar = () => {
    if (!pendingVar || !currentType) return;
    if (!STRUCTURAL_VARS.has(pendingVar.name)) {
      allTypes.get(currentType)!.ownVars.set(pendingVar.name, pendingVar.accum.trim());
    }
    pendingVar = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    if (++lineCount % 200 === 0) await yield_();

    // If we're accumulating a multi-line list value, keep collecting until parens balance
    if (pendingVar) {
      for (const ch of rawLine) {
        if (ch === "(") pendingVar.depth++;
        else if (ch === ")") pendingVar.depth--;
      }
      pendingVar.accum += " " + rawLine.trim();
      if (pendingVar.depth <= 0) finalizePendingVar();
      continue;
    }

    if (rawLine.startsWith("/datum/")) {
      const perfM = rawLine.match(
        /^(\/datum\/bt_node\/ai_behavior(?:\/[\w]+)+)\/perform\s*\(([^)]*)\)\s*(?:\/\/.*)?$/,
      );
      if (perfM) {
        const typeForPerform = perfM[1];
        if (!allTypes.has(typeForPerform)) {
          allTypes.set(typeForPerform, { ownVars: new Map(), performParams: null });
        }
        if (filePath && !(typeForPerform in typeFilePaths))
          typeFilePaths[typeForPerform] = filePath;
        const info = allTypes.get(typeForPerform)!;
        if (info.performParams === null) {
          info.performParams = parsePerformParams(perfM[2]);
        }
        currentType = null;
        currentIsBehavior = false;
        continue;
      }

      const typeM = rawLine.match(/^(\/datum\/(?:[\w]+\/)*[\w]+)\s*(?:\/\/.*)?$/);
      if (typeM) {
        currentType = typeM[1];
        currentIsBehavior = /^\/datum\/bt_node\/ai_behavior\//.test(currentType);
        if (!allTypes.has(currentType)) {
          allTypes.set(currentType, { ownVars: new Map(), performParams: null });
        }
        if (filePath && !(currentType in typeFilePaths)) typeFilePaths[currentType] = filePath;
        continue;
      }

      currentType = null;
      currentIsBehavior = false;
      continue;
    }

    if (
      rawLine.trim() &&
      !rawLine.startsWith("\t") &&
      !rawLine.startsWith("//") &&
      !rawLine.startsWith("#") &&
      !rawLine.startsWith("/*")
    ) {
      currentType = null;
      currentIsBehavior = false;
      continue;
    }

    if (!currentType) continue;

    if (rawLine.startsWith("\t") && !rawLine.startsWith("\t\t")) {
      if (currentIsBehavior) {
        const perfM = rawLine.match(/^\t(?:\/proc\/)?perform\s*\(([^)]*)\)\s*(?:\/\/.*)?$/);
        if (perfM) {
          const info = allTypes.get(currentType)!;
          if (info.performParams === null) {
            info.performParams = parsePerformParams(perfM[1]);
          }
        }
      }
      const varM = rawLine.match(/^\tvar\/(?:[\w/]*\/)?(\w+)(?:\s*=\s*(.+?))?\s*(?:\/\/.*)?$/);
      if (varM) {
        const [, varName, defaultVal = ""] = varM;
        if (!STRUCTURAL_VARS.has(varName)) {
          // Count unmatched open parens — if > 0 the value spans multiple lines
          let depth = 0;
          for (const ch of defaultVal) {
            if (ch === "(") depth++;
            else if (ch === ")") depth--;
          }
          if (depth > 0) {
            pendingVar = { name: varName, accum: defaultVal, depth };
          } else {
            allTypes.get(currentType)!.ownVars.set(varName, defaultVal);
          }
        }
      }
      // Also catch plain subtype var-default overrides: `\tvarname = value` (no var/ prefix).
      // DM subtypes commonly set a parent var's default this way without re-declaring it.
      const plainVarM = !varM && rawLine.match(/^\t(\w+)\s*=\s*(.+?)\s*(?:\/\/.*)?$/);
      if (plainVarM) {
        const [, varName, defaultVal] = plainVarM;
        if (!STRUCTURAL_VARS.has(varName)) {
          let depth = 0;
          for (const ch of defaultVal) {
            if (ch === "(") depth++;
            else if (ch === ")") depth--;
          }
          if (depth > 0) {
            pendingVar = { name: varName, accum: defaultVal, depth };
          } else {
            allTypes.get(currentType)!.ownVars.set(varName, defaultVal);
          }
        }
      }
    }
  }
  // Flush any still-open accumulator at EOF
  finalizePendingVar();
}

export function parsePerformParams(
  paramsStr: string,
): Array<{ name: string; defaultValue: string }> {
  const parts = paramsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.slice(2).map(parseOneParam);
}

export function parseOneParam(param: string): { name: string; defaultValue: string } {
  let defaultValue = "";
  const eqIdx = param.indexOf("=");
  if (eqIdx !== -1) {
    defaultValue = param.slice(eqIdx + 1).trim();
    param = param.slice(0, eqIdx).trim();
  }
  if (param.startsWith("var/")) param = param.slice(4);
  const segments = param.split("/").filter(Boolean);
  const name = segments[segments.length - 1] ?? param;
  return { name, defaultValue };
}

export function resolveOwnVarsChain(
  typePath: string,
  allTypes: Map<string, RawTypeInfo>,
  stopAt: string,
): Array<{ name: string; defaultValue: string }> {
  const chain: string[] = [];
  let cur = typePath;
  for (;;) {
    if (allTypes.has(cur)) chain.push(cur);
    if (cur === stopAt) break;
    const segs = cur.split("/").filter(Boolean);
    if (segs.length <= 1) break;
    cur = "/" + segs.slice(0, -1).join("/");
  }
  chain.reverse();

  const merged = new Map<string, string>();
  const order: string[] = [];
  for (const tp of chain) {
    const info = allTypes.get(tp)!;
    for (const [name, defaultVal] of info.ownVars) {
      if (!merged.has(name)) order.push(name);
      merged.set(name, defaultVal);
    }
  }
  return order.map((n) => ({ name: n, defaultValue: merged.get(n)! }));
}

export function resolveTypeVars(
  typePath: string,
  allTypes: Map<string, RawTypeInfo>,
  stopAt: string,
): TypeVarsEntry {
  const isBehavior = stopAt === "/datum/bt_node/ai_behavior";

  if (isBehavior) {
    let params: Array<{ name: string; defaultValue: string }> = [];
    let cur = typePath;
    for (;;) {
      const info = allTypes.get(cur);
      if (info && info.performParams !== null) {
        params = info.performParams;
        break;
      }
      if (cur === stopAt) break;
      const segs = cur.split("/").filter(Boolean);
      if (segs.length <= 1) break;
      cur = "/" + segs.slice(0, -1).join("/");
    }
    const vars = resolveOwnVarsChain(typePath, allTypes, stopAt);
    return { params, vars };
  }

  // Decorators: no perform params, only ownVars
  return { params: [], vars: resolveOwnVarsChain(typePath, allTypes, stopAt) };
}

/** Resolve the final typeVars map (Phase 5 of the workspace scan) from merged per-type raw info. */
export function buildTypeVars(allTypes: Map<string, RawTypeInfo>): Record<string, TypeVarsEntry> {
  const typeVars: Record<string, TypeVarsEntry> = {};
  for (const [typePath] of allTypes) {
    const isBehavior = /^\/datum\/bt_node\/ai_behavior\//.test(typePath);
    const isDecorator = /^\/datum\/bt_node\/decorator\//.test(typePath);
    if (!isBehavior && !isDecorator) continue;
    const stopAt = isBehavior ? "/datum/bt_node/ai_behavior" : "/datum/bt_node/decorator";
    typeVars[typePath] = resolveTypeVars(typePath, allTypes, stopAt);
  }
  return typeVars;
}
