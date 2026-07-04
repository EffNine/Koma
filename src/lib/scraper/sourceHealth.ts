import { db } from '../db';
import type { Source } from './sources';

export type HealthKind = 'chapter-resolution' | 'page-load';

export interface SourceHealth {
  sourceId: string;
  chapterResolutionSuccesses: number;
  chapterResolutionFailures: number;
  pageLoadSuccesses: number;
  pageLoadFailures: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  lastErrorCategory?: string;
  updatedAt: number;
}

const UNKNOWN_SCORE = 0.5;
const HEALTHY_THRESHOLD = 0.5;

/** Return a short machine-readable category for an error. */
export function errorCategory(e: unknown, fallback: HealthKind = 'chapter-resolution'): string {
  const msg = String(e ?? '');
  const lower = msg.toLowerCase();
  if (lower.includes('proxy')) return 'proxy';
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('abort')) return 'timeout';
  if (lower.includes('no page') || lower.includes('no pages') || lower.includes('no image')) return 'no-pages';
  if (/\b(4\d\d|5\d\d)\b/.test(msg)) return 'http';
  if (msg.includes('network')) return 'network';
  if (fallback === 'page-load') return 'image-load';
  return 'chapter-resolution';
}

export async function getSourceHealth(sourceId: string): Promise<SourceHealth | undefined> {
  return db.sourceHealth.get(sourceId);
}

export async function recordHealth(
  sourceId: string,
  outcome: 'success' | 'failure',
  kind: HealthKind,
  error?: unknown,
): Promise<void> {
  if (!sourceId) return;
  try {
    const existing = await db.sourceHealth.get(sourceId);
    const now = Date.now();
    const next: SourceHealth = {
      sourceId,
      chapterResolutionSuccesses: existing?.chapterResolutionSuccesses ?? 0,
      chapterResolutionFailures: existing?.chapterResolutionFailures ?? 0,
      pageLoadSuccesses: existing?.pageLoadSuccesses ?? 0,
      pageLoadFailures: existing?.pageLoadFailures ?? 0,
      lastSuccessAt: existing?.lastSuccessAt,
      lastFailureAt: existing?.lastFailureAt,
      updatedAt: now,
    };

    if (kind === 'chapter-resolution') {
      if (outcome === 'success') {
        next.chapterResolutionSuccesses++;
        next.lastSuccessAt = now;
      } else {
        next.chapterResolutionFailures++;
        next.lastFailureAt = now;
        next.lastErrorCategory = errorCategory(error, kind);
      }
    } else {
      if (outcome === 'success') {
        next.pageLoadSuccesses++;
        next.lastSuccessAt = now;
      } else {
        next.pageLoadFailures++;
        next.lastFailureAt = now;
        next.lastErrorCategory = errorCategory(error, kind);
      }
    }

    await db.sourceHealth.put(next);
  } catch (e) {
    // Health recording must never break the reading flow.
    console.error('Failed to record source health:', e);
  }
}

export async function resetSourceHealth(sourceId: string): Promise<void> {
  await db.sourceHealth.delete(sourceId);
}

/** A source with no health history is considered viable. */
export function isHealthy(health: SourceHealth | undefined): boolean {
  if (!health) return true;
  const total = health.chapterResolutionSuccesses + health.chapterResolutionFailures
    + health.pageLoadSuccesses + health.pageLoadFailures;
  if (total === 0) return true;
  const successes = health.chapterResolutionSuccesses + health.pageLoadSuccesses;
  const rate = successes / total;
  if (rate < HEALTHY_THRESHOLD) return false;
  // If the most recent event was a failure, treat it as temporarily unhealthy.
  if (health.lastFailureAt !== undefined) {
    if (health.lastSuccessAt === undefined || health.lastFailureAt > health.lastSuccessAt) {
      return false;
    }
  }
  return true;
}

export async function loadSourceHealth(sources: Source[]): Promise<Record<string, SourceHealth>> {
  const ids = sources.map((s) => s.id);
  const rows = await db.sourceHealth.bulkGet(ids);
  const map: Record<string, SourceHealth> = {};
  for (const row of rows) {
    if (row) map[row.sourceId] = row;
  }
  return map;
}

/** Score between 0 (unhealthy) and 1 (healthy). Unknown sources stay viable. */
export function sourceScore(health: SourceHealth | undefined): number {
  if (!health) return UNKNOWN_SCORE;
  const total = health.chapterResolutionSuccesses + health.chapterResolutionFailures
    + health.pageLoadSuccesses + health.pageLoadFailures;
  if (total === 0) return UNKNOWN_SCORE;
  const successes = health.chapterResolutionSuccesses + health.pageLoadSuccesses;
  const base = successes / total;
  return isHealthy(health) ? 0.5 + base * 0.5 : base * 0.5;
}

/**
 * Rank enabled sources by health, using configured priority as a tiebreaker.
 * The preferred source is kept first when its recent health is acceptable.
 * Disabled sources are excluded. Unknown/new sources remain viable.
 */
export function rankSources(
  sources: Source[],
  healthById: Record<string, SourceHealth>,
  preferredSourceId?: string,
): Source[] {
  const enabled = sources.filter((s) => s.enabled !== false);
  const preferred = preferredSourceId ? enabled.find((s) => s.id === preferredSourceId) : undefined;

  const sorted = enabled.sort((a, b) => {
    const scoreA = sourceScore(healthById[a.id]);
    const scoreB = sourceScore(healthById[b.id]);
    if (scoreB !== scoreA) return scoreB - scoreA;
    const priorityA = a.priority ?? 0;
    const priorityB = b.priority ?? 0;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.id.localeCompare(b.id);
  });

  if (preferred && isHealthy(healthById[preferred.id])) {
    return [preferred, ...sorted.filter((s) => s.id !== preferredSourceId)];
  }
  return sorted;
}
