export function generateBindingId(): string {
  return "b" + Math.random().toString(36).slice(2, 9);
}

export function isBindingId(key: string): boolean {
  return /^b[0-9a-z]{7}$/.test(key);
}
