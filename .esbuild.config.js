const esbuild = require("esbuild");

const watch = process.argv.includes("--watch");

const sharedConfig = {
  bundle: true,
  sourcemap: true,
  minify: false,
};

async function main() {
  const extensionCtx = await esbuild.context({
    ...sharedConfig,
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.js",
    platform: "node",
    external: ["vscode"],
    format: "cjs",
  });

  const webviewCtx = await esbuild.context({
    ...sharedConfig,
    entryPoints: ["media/editor/btEditor.tsx"],
    outfile: "dist/editor.js",
    platform: "browser",
    format: "iife",
    globalName: "BtEditor",
    define: {
      "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production"),
    },
  });

  const actionCtx = await esbuild.context({
    ...sharedConfig,
    sourcemap: false,
    entryPoints: ["src/action/index.ts"],
    outfile: "dist/action.js",
    platform: "node",
    format: "cjs",
  });

  const cliCtx = await esbuild.context({
    ...sharedConfig,
    entryPoints: ["src/cli/index.ts"],
    outfile: "dist/bt-diff.js",
    platform: "node",
    format: "cjs",
  });

  const localPublishCtx = await esbuild.context({
    ...sharedConfig,
    entryPoints: ["src/action/localPublish.ts"],
    outfile: "dist/local-publish.js",
    platform: "node",
    format: "cjs",
  });

  const contexts = [extensionCtx, webviewCtx, actionCtx, cliCtx, localPublishCtx];

  if (watch) {
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log("[esbuild] watching...");
  } else {
    for (const ctx of contexts) {
      await ctx.rebuild();
      await ctx.dispose();
    }
    console.log("[esbuild] build complete");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
