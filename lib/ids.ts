export function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
