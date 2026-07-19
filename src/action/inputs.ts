export function getInput(name: string): string {
  return (process.env[`INPUT_${name.replace(/-/g, "_").toUpperCase()}`] ?? "").trim();
}

export function requireInput(name: string): string {
  const value = getInput(name);
  if (!value) {
    console.error(`input "${name}" is required`);
    process.exit(1);
  }
  return value;
}
