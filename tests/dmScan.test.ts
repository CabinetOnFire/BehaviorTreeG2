import {
  scanDmFileText,
  parsePerformParams,
  parseOneParam,
  resolveOwnVarsChain,
  resolveTypeVars,
  buildTypeVars,
  type RawTypeInfo,
} from "../src/dmScan";

describe("scanDmFileText", () => {
  it("extracts behaviors, subtrees, and controllers by regex", async () => {
    const text = [
      "/datum/bt_node/ai_behavior/attack",
      "\tvar/damage = 10",
      "",
      "/datum/bt_node/subtree/combat",
      '\tbehavior_tree_json = "combat.bt.json"',
      "",
      "/datum/ai_controller/basic",
      "\tsomething = 1",
      "",
      "/datum/bt_node/decorator/inverter",
      "\tvar/invert = FALSE",
      "",
    ].join("\n");

    const result = await scanDmFileText(text, "/repo/combat.dm");

    expect(result.behaviors).toEqual(["/datum/bt_node/ai_behavior/attack"]);
    expect(result.subtrees).toEqual([
      { typePath: "/datum/bt_node/subtree/combat", filePath: "/repo/combat.dm" },
    ]);
    expect(result.controllers).toEqual([
      { typePath: "/datum/ai_controller/basic", filePath: "/repo/combat.dm" },
    ]);
    expect(result.rawBtJsonRefs).toEqual([
      {
        typePath: "/datum/bt_node/subtree/combat",
        relPath: "combat.bt.json",
        dmFsPath: "/repo/combat.dm",
      },
    ]);
  });

  it("maps ABSTRACT_AI_CLASS sentinel to the 'Abstract' relPath", async () => {
    const text = ["/datum/bt_node/subtree/base", "\tbehavior_tree_json = ABSTRACT_AI_CLASS", ""].join(
      "\n",
    );
    const result = await scanDmFileText(text, "/repo/base.dm");
    expect(result.rawBtJsonRefs).toEqual([
      { typePath: "/datum/bt_node/subtree/base", relPath: "Abstract", dmFsPath: "/repo/base.dm" },
    ]);
  });

  it("filters STRUCTURAL_VARS out of ownVars", async () => {
    const text = [
      "/datum/bt_node/ai_behavior/attack",
      "\tvar/damage = 10",
      "\tvar/children = list()",
      "",
    ].join("\n");
    const result = await scanDmFileText(text, "/repo/x.dm");
    const info = result.rawTypeInfos.get("/datum/bt_node/ai_behavior/attack")!;
    expect(info.ownVars.get("damage")).toBe("10");
    expect(info.ownVars.has("children")).toBe(false);
  });

  it("accumulates a multi-line list value until parens balance", async () => {
    const text = [
      "/datum/bt_node/ai_behavior/complex",
      "\tvar/list/targets = list(",
      '\t\t"a",',
      '\t\t"b"',
      "\t\t)",
      "",
    ].join("\n");
    const result = await scanDmFileText(text, "/repo/x.dm");
    const info = result.rawTypeInfos.get("/datum/bt_node/ai_behavior/complex")!;
    expect(info.ownVars.get("targets")).toBe('list( "a", "b" )');
  });

  it("captures a plain subtype var-default override without the var/ prefix", async () => {
    const text = [
      "/datum/bt_node/ai_behavior/attack",
      "\tvar/damage = 10",
      "",
      "/datum/bt_node/ai_behavior/attack/heavy",
      "\tdamage = 20",
      "",
    ].join("\n");
    const result = await scanDmFileText(text, "/repo/x.dm");
    expect(result.rawTypeInfos.get("/datum/bt_node/ai_behavior/attack")!.ownVars.get("damage")).toBe(
      "10",
    );
    expect(
      result.rawTypeInfos.get("/datum/bt_node/ai_behavior/attack/heavy")!.ownVars.get("damage"),
    ).toBe("20");
  });

  it("captures perform() positional params, dropping the first two", async () => {
    const text = [
      "/datum/bt_node/ai_behavior/attack",
      "\tperform(mob/living/L, seconds_per_tick, atom/target, damage_mult = 1)",
      "\t\treturn",
      "",
    ].join("\n");
    const result = await scanDmFileText(text, "/repo/x.dm");
    const info = result.rawTypeInfos.get("/datum/bt_node/ai_behavior/attack")!;
    expect(info.performParams).toEqual([
      { name: "target", defaultValue: "" },
      { name: "damage_mult", defaultValue: "1" },
    ]);
  });

  it("records typeFilePaths for every discovered type", async () => {
    const text = ["/datum/bt_node/ai_behavior/attack", "\tvar/damage = 10", ""].join("\n");
    const result = await scanDmFileText(text, "/repo/x.dm");
    expect(result.typeFilePaths["/datum/bt_node/ai_behavior/attack"]).toBe("/repo/x.dm");
  });
});

describe("parsePerformParams / parseOneParam", () => {
  it("drops the first two positional params and parses the rest", () => {
    expect(parsePerformParams("mob/living/L, seconds_per_tick, atom/target, count = 3")).toEqual([
      { name: "target", defaultValue: "" },
      { name: "count", defaultValue: "3" },
    ]);
  });

  it("strips a var/ prefix and takes the last path segment as the name", () => {
    expect(parseOneParam("var/mob/living/target = null")).toEqual({
      name: "target",
      defaultValue: "null",
    });
  });

  it("handles a param with no default", () => {
    expect(parseOneParam("atom/target")).toEqual({ name: "target", defaultValue: "" });
  });
});

describe("resolveOwnVarsChain", () => {
  it("merges an inheritance chain, keeping first-seen order but leaf-most values", () => {
    const allTypes = new Map<string, RawTypeInfo>([
      [
        "/datum/bt_node/ai_behavior/attack",
        {
          ownVars: new Map([
            ["damage", "10"],
            ["range", "5"],
          ]),
          performParams: null,
        },
      ],
      [
        "/datum/bt_node/ai_behavior/attack/heavy",
        { ownVars: new Map([["damage", "20"]]), performParams: null },
      ],
    ]);

    const result = resolveOwnVarsChain(
      "/datum/bt_node/ai_behavior/attack/heavy",
      allTypes,
      "/datum/bt_node/ai_behavior",
    );

    expect(result).toEqual([
      { name: "damage", defaultValue: "20" },
      { name: "range", defaultValue: "5" },
    ]);
  });

  it("returns an empty list when no ancestor declared any vars", () => {
    const allTypes = new Map<string, RawTypeInfo>([
      ["/datum/bt_node/ai_behavior/idle", { ownVars: new Map(), performParams: null }],
    ]);
    expect(resolveOwnVarsChain("/datum/bt_node/ai_behavior/idle", allTypes, "/datum/bt_node/ai_behavior")).toEqual(
      [],
    );
  });
});

describe("resolveTypeVars", () => {
  it("inherits perform() params from the nearest ancestor that declares them", () => {
    const allTypes = new Map<string, RawTypeInfo>([
      [
        "/datum/bt_node/ai_behavior/attack",
        { ownVars: new Map(), performParams: [{ name: "target", defaultValue: "" }] },
      ],
      [
        "/datum/bt_node/ai_behavior/attack/heavy",
        { ownVars: new Map([["damage", "20"]]), performParams: null },
      ],
    ]);

    const entry = resolveTypeVars(
      "/datum/bt_node/ai_behavior/attack/heavy",
      allTypes,
      "/datum/bt_node/ai_behavior",
    );
    expect(entry.params).toEqual([{ name: "target", defaultValue: "" }]);
    expect(entry.vars).toEqual([{ name: "damage", defaultValue: "20" }]);
  });

  it("decorators have no perform params, only resolved vars", () => {
    const allTypes = new Map<string, RawTypeInfo>([
      ["/datum/bt_node/decorator/inverter", { ownVars: new Map([["invert", "FALSE"]]), performParams: null }],
    ]);
    const entry = resolveTypeVars(
      "/datum/bt_node/decorator/inverter",
      allTypes,
      "/datum/bt_node/decorator",
    );
    expect(entry.params).toEqual([]);
    expect(entry.vars).toEqual([{ name: "invert", defaultValue: "FALSE" }]);
  });
});

describe("buildTypeVars", () => {
  it("only resolves ai_behavior and decorator types, skipping unrelated ones", () => {
    const allTypes = new Map<string, RawTypeInfo>([
      ["/datum/bt_node/ai_behavior/attack", { ownVars: new Map(), performParams: null }],
      ["/datum/bt_node/decorator/inverter", { ownVars: new Map(), performParams: null }],
      ["/datum/bt_node/subtree/combat", { ownVars: new Map(), performParams: null }],
      ["/datum/ai_controller/basic", { ownVars: new Map(), performParams: null }],
    ]);
    const typeVars = buildTypeVars(allTypes);
    expect(Object.keys(typeVars).sort()).toEqual(
      ["/datum/bt_node/ai_behavior/attack", "/datum/bt_node/decorator/inverter"].sort(),
    );
  });
});
