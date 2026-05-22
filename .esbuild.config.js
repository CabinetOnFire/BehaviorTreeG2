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
      "process.env.NODE_ENV": JSON.stringify(
        watch ? "development" : "production"
      ),
    },
  });

  if (watch) {
    await extensionCtx.watch();
    await webviewCtx.watch();
    console.log("[esbuild] watching...");
  } else {
    await extensionCtx.rebuild();
    await extensionCtx.dispose();
    await webviewCtx.rebuild();
    await webviewCtx.dispose();
    console.log("[esbuild] build complete");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
