let counter = 0;

/** Deterministic-friendly ID generator for demo + tests */
export function createId(prefix: string): string {
  counter += 1;
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}-${counter}`;
}

export function resetIdCounter(): void {
  counter = 0;
}

export function invoiceNumber(seq: number): string {
  return `INV-DEMO-${String(seq).padStart(4, "0")}`;
}
