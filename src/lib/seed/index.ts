import { buildSeedState } from "@/lib/seed/data";
import type { AppState } from "@/types";

export const SEED_VERSION = 1;
export const STORAGE_KEY = "dst-projectops-v1";

export function createSeedState(): AppState {
  return buildSeedState();
}

export function isCompatiblePersisted(version: number | undefined): boolean {
  return version === SEED_VERSION;
}
