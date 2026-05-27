const PREFIXES = [
  "/datum/bt_node/ai_behavior/",
  "/datum/bt_node/decorator/",
  "/datum/bt_node/subtree/",
  "/datum/ai_controller/",
] as const;

/** Strip the known main-parent prefix and return the remainder of the path. */
export function shortTypePath(typePath: string): string {
  for (const prefix of PREFIXES) {
    if (typePath.startsWith(prefix)) {
      return typePath.slice(prefix.length);
    }
  }
  return typePath.split("/").filter(Boolean).pop() ?? typePath;
}
