import type { BtNode, SubtreeDescriptor } from "../../shared/types";
import { BT_PARALLEL_SUCCESS_ALL } from "../../shared/btConstants";

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

type TokenKind =
  | "IDENT"
  | "TYPEPATH"
  | "STRING"
  | "NUMBER"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "EQ"
  | "LIST_OPEN";

interface Token {
  kind: TokenKind;
  value: string;
  offset: number; // offset in the *pre-processed* text
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

function tokenize(text: string, baseOffset: number): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const peek = () => text[i];

  while (i < text.length) {
    // Skip whitespace
    if (/\s/.test(text[i])) {
      i++;
      continue;
    }

    const start = i;

    // String literal
    if (text[i] === '"') {
      i++;
      let s = "";
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\") {
          i++; // skip escape char
        }
        s += text[i++];
      }
      i++; // closing "
      tokens.push({ kind: "STRING", value: s, offset: baseOffset + start });
      continue;
    }

    // Typepath — starts with /datum or / followed by letter
    if (text[i] === "/" && i + 1 < text.length && /[a-zA-Z_]/.test(text[i + 1])) {
      let path = "";
      while (i < text.length && /[a-zA-Z0-9_/]/.test(text[i])) {
        path += text[i++];
      }
      tokens.push({ kind: "TYPEPATH", value: path, offset: baseOffset + start });
      continue;
    }

    // Identifier or keyword
    if (/[a-zA-Z_]/.test(text[i])) {
      let ident = "";
      while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) {
        ident += text[i++];
      }
      // Special: "list" followed by "(" → LIST_OPEN
      if (ident === "list" && peek() === "(") {
        i++; // consume "("
        tokens.push({ kind: "LIST_OPEN", value: "list(", offset: baseOffset + start });
      } else {
        tokens.push({ kind: "IDENT", value: ident, offset: baseOffset + start });
      }
      continue;
    }

    // Number (possibly negative)
    if (/[0-9]/.test(text[i]) || (text[i] === "-" && /[0-9]/.test(text[i + 1] ?? ""))) {
      let num = "";
      if (text[i] === "-") num += text[i++];
      while (i < text.length && /[0-9.]/.test(text[i])) {
        num += text[i++];
      }
      tokens.push({ kind: "NUMBER", value: num, offset: baseOffset + start });
      continue;
    }

    if (text[i] === "(") { tokens.push({ kind: "LPAREN", value: "(", offset: baseOffset + start }); i++; continue; }
    if (text[i] === ")") { tokens.push({ kind: "RPAREN", value: ")", offset: baseOffset + start }); i++; continue; }
    if (text[i] === ",") { tokens.push({ kind: "COMMA", value: ",", offset: baseOffset + start }); i++; continue; }
    if (text[i] === "=") { tokens.push({ kind: "EQ", value: "=", offset: baseOffset + start }); i++; continue; }

    // Skip unknown character
    i++;
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Recursive-descent parser over token stream
// ---------------------------------------------------------------------------

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  peek(ahead = 0): Token | undefined {
    return this.tokens[this.pos + ahead];
  }

  consume(): Token {
    const t = this.tokens[this.pos];
    if (!t) throw new Error("Unexpected end of token stream");
    this.pos++;
    return t;
  }

  expect(kind: TokenKind): Token {
    const t = this.consume();
    if (t.kind !== kind) {
      throw new Error(`Expected ${kind} but got ${t.kind} ("${t.value}")`);
    }
    return t;
  }

  /** Parse a single BT_* macro call. pos must be at the IDENT token for the macro name. */
  parseMacroCall(): BtNode {
    const nameToken = this.consume(); // IDENT — macro name
    if (nameToken.kind !== "IDENT") {
      throw new Error(`Expected macro name IDENT, got ${nameToken.kind} ("${nameToken.value}")`);
    }
    this.expect("LPAREN");

    const name = nameToken.value;

    if (name === "BT_SELECTOR" || name === "BT_SEQUENCE") {
      const children = this.parseVariadicMacroChildren();
      return {
        kind: name === "BT_SELECTOR" ? "selector" : "sequence",
        children,
      };
    }

    if (name === "BT_PARALLEL") {
      const failurePolicy = this.parseValue();
      this.skipOptionalComma();
      const children = this.parseVariadicMacroChildren();
      return {
        kind: "parallel",
        failurePolicy,
        successPolicy: BT_PARALLEL_SUCCESS_ALL,
        children,
      };
    }

    if (name === "BT_SUBTREE") {
      const behaviorType = this.parseTypepathOrIdent();
      this.expect("RPAREN");
      return { kind: "subtree", behaviorType };
    }

    if (name === "BT_LEAF") {
      const behaviorType = this.parseTypepathOrIdent();
      const args: string[] = [];
      while (this.peek()?.kind !== "RPAREN" && this.peek() !== undefined) {
        this.skipOptionalComma();
        if (this.peek()?.kind === "RPAREN") break;
        args.push(this.parseValue());
      }
      this.expect("RPAREN");
      return { kind: "leaf", behaviorType, args };
    }

    if (name === "BT_DECORATOR") {
      const nodeType = this.parseTypepathOrIdent();
      this.skipOptionalComma();
      const child = this.parseMacroCall();
      const config: Record<string, string | string[]> = {};

      // Parse trailing key = val pairs
      while (this.peek()?.kind !== "RPAREN" && this.peek() !== undefined) {
        this.skipOptionalComma();
        if (this.peek()?.kind === "RPAREN" || this.peek() === undefined) break;

        // key: STRING or IDENT
        const keyToken = this.consume();
        if (keyToken.kind !== "STRING" && keyToken.kind !== "IDENT") {
          throw new Error(`Expected config key, got ${keyToken.kind} ("${keyToken.value}")`);
        }
        this.expect("EQ");
        const val = this.parseConfigValue();
        config[keyToken.value] = val;
      }

      this.expect("RPAREN");
      return { kind: "decorator", nodeType, child, config };
    }

    throw new Error(`Unknown BT macro: "${name}"`);
  }

  /** Parse children until RPAREN (the closing paren of the parent macro call). */
  private parseVariadicMacroChildren(): BtNode[] {
    const children: BtNode[] = [];
    while (this.peek()?.kind !== "RPAREN" && this.peek() !== undefined) {
      this.skipOptionalComma();
      if (this.peek()?.kind === "RPAREN" || this.peek() === undefined) break;
      children.push(this.parseMacroCall());
    }
    this.expect("RPAREN");
    return children;
  }

  /** Parse a typepath (/datum/...) or a plain IDENT as a string value. */
  private parseTypepathOrIdent(): string {
    const t = this.consume();
    if (t.kind === "TYPEPATH" || t.kind === "IDENT") return t.value;
    throw new Error(`Expected typepath or ident, got ${t.kind} ("${t.value}")`);
  }

  /** Parse a scalar value — IDENT, TYPEPATH, STRING, or NUMBER. */
  parseValue(): string {
    const t = this.peek();
    if (!t) throw new Error("Expected value, got end of stream");
    if (
      t.kind === "IDENT" ||
      t.kind === "TYPEPATH" ||
      t.kind === "STRING" ||
      t.kind === "NUMBER"
    ) {
      this.consume();
      return t.value;
    }
    throw new Error(`Expected value, got ${t.kind} ("${t.value}")`);
  }

  /** Parse a config value — either list(...) → string[] or scalar → string. */
  private parseConfigValue(): string | string[] {
    const t = this.peek();
    if (t?.kind === "LIST_OPEN") {
      this.consume(); // consume LIST_OPEN (already ate the "(")
      const items: string[] = [];
      while (this.peek()?.kind !== "RPAREN" && this.peek() !== undefined) {
        this.skipOptionalComma();
        if (this.peek()?.kind === "RPAREN") break;
        items.push(this.parseValue());
      }
      this.expect("RPAREN");
      return items;
    }
    return this.parseValue();
  }

  private skipOptionalComma() {
    if (this.peek()?.kind === "COMMA") this.consume();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pre-process raw DM text:
 * 1. Strip backslash line continuations.
 * 2. Strip DM single-line comments (//).
 */
function preProcess(text: string): string {
  // First remove // comments (before stripping continuations to avoid mangling)
  // then strip backslash continuations
  return text
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\\\s*\n\s*/g, " ");
}

/**
 * Parse all `/datum/bt_node/subtree/…` descriptors from raw DM file text.
 */
export function parseFile(rawText: string): SubtreeDescriptor[] {
  const text = preProcess(rawText);
  const results: SubtreeDescriptor[] = [];

  // Step 1: find /datum/bt_node/subtree/ and /datum/ai_controller/ type declarations
  const subtypeRe = /\/datum\/(bt_node\/subtree|ai_controller)\/[\w/]+/g;
  let match: RegExpExecArray | null;

  while ((match = subtypeRe.exec(text)) !== null) {
    const typePath = match[0];
    const declOffset = match.index;

    // Step 2: scan forward for `behavior_nodes = BT_`
    const assignRe = /behavior_nodes\s*=\s*(BT_\w+)\s*\(/g;
    assignRe.lastIndex = declOffset;
    const assignMatch = assignRe.exec(text);
    if (!assignMatch) continue;

    // Make sure there's no other recognised type between declOffset and the assignment
    const between = text.slice(declOffset + typePath.length, assignMatch.index);
    if (/\/datum\/(bt_node\/subtree|ai_controller)\//.test(between)) continue;

    const startOffset = assignMatch.index;
    const macroStart = assignMatch.index + assignMatch[0].length - assignMatch[1].length - 1;
    // macroStart points to the BT_xxx name; assignMatch[0] ends right after the '('
    // We need to tokenize from the macro name onwards
    const macroName = assignMatch[1];

    // Find offset of macro name in the full text
    const macroNameOffset = text.indexOf(macroName, startOffset);

    // Tokenize from macro name to end of file
    const slice = text.slice(macroNameOffset);
    const tokens = tokenize(slice, macroNameOffset);

    // Parse
    const parser = new Parser(tokens);
    let root: BtNode;
    try {
      root = parser.parseMacroCall();
    } catch (e) {
      console.warn(`[btParser] Failed to parse subtree "${typePath}":`, e);
      continue;
    }

    // endOffset: offset of the last consumed token's position + 1
    // We track it by re-counting balanced parens in slice
    const endOffset = findEndOffset(text, macroNameOffset);

    results.push({ typePath, startOffset, endOffset, root });
  }

  return results;
}

/**
 * Find the offset just after the closing paren of the outermost macro call
 * starting at `from` in `text`.
 */
function findEndOffset(text: string, from: number): number {
  let depth = 0;
  let inString = false;
  let i = from;

  // skip to the opening paren
  while (i < text.length && text[i] !== "(") i++;

  for (; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && !inString) { inString = true; continue; }
    if (ch === '"' && inString) { inString = false; continue; }
    if (inString) continue;
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return i;
}
