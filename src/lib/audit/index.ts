import { createId } from "@/lib/domain/ids";
import type { AppState, AuditAction, AuditEvent, Role } from "@/types";

export function appendAudit(
  state: AppState,
  input: {
    actorId: string;
    actorRole: Role;
    entityType: string;
    entityId: string;
    action: AuditAction;
    summary: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    reason?: string | null;
    timestamp?: string;
  }
): AuditEvent {
  return {
    id: createId("audit"),
    actorId: input.actorId,
    actorRole: input.actorRole,
    timestamp: input.timestamp ?? new Date().toISOString(),
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    summary: input.summary,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason ?? null,
  };
}

export function fieldDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): { field: string; from: unknown; to: unknown }[] {
  const keys = Array.from(
    new Set([...Object.keys(before), ...Object.keys(after)])
  );
  return keys
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((field) => ({ field, from: before[field], to: after[field] }));
}
