export interface ParsedArgs {
  oldPath: string;
  newPath: string;
  outPath?: string;
}

/** Parses `<old.bt.json|none> <new.bt.json|none> [-o out.svg]` in any argument order. */
export function parseArgs(args: string[]): ParsedArgs | null {
  const oIdx = args.indexOf("-o");
  const outPath = oIdx !== -1 ? args[oIdx + 1] : undefined;
  const positionals = oIdx === -1 ? args : args.filter((_, i) => i !== oIdx && i !== oIdx + 1);
  const [oldPath, newPath] = positionals;

  if (!oldPath || !newPath) return null;
  return { oldPath, newPath, outPath };
}
