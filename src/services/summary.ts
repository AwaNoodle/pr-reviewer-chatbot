import type { PRFile } from '../types';

const CACHE_STORAGE_KEY = 'pr-review-chatbot-summary-cache';
const RATE_LIMIT_STORAGE_KEY = 'pr-review-chatbot-summary-rate-limit';
const ONE_MINUTE_MS = 60_000;

export interface SummaryCacheEntry {
  content: string;
  generatedAt: number;
}

type SummaryCacheStore = Record<string, SummaryCacheEntry>;
type SummaryRateLimitStore = Record<string, number>;

export interface SummaryCacheKeyInput {
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  summaryPrompt: string;
  summaryCommands: string;
}

function hashText(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function readJsonFromSessionStorage<T>(key: string): T | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonToSessionStorage<T>(key: string, value: T): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore sessionStorage write errors
  }
}

export function buildSummaryCacheKey(input: SummaryCacheKeyInput): string {
  const repoIdentity = `${input.owner}/${input.repo}#${input.prNumber}@${input.headSha}`;
  const promptFingerprint = hashText(`${input.summaryPrompt}\n${input.summaryCommands}`);
  return `${repoIdentity}:${promptFingerprint}`;
}

export function buildSummaryRateLimitKey(owner: string, repo: string, prNumber: number, headSha: string): string {
  return `${owner}/${repo}#${prNumber}@${headSha}`;
}

export function readSummaryCache(cacheKey: string): SummaryCacheEntry | null {
  const cacheStore = readJsonFromSessionStorage<SummaryCacheStore>(CACHE_STORAGE_KEY);
  if (!cacheStore) {
    return null;
  }

  const entry = cacheStore[cacheKey];
  if (!entry || typeof entry.content !== 'string' || typeof entry.generatedAt !== 'number') {
    return null;
  }

  return entry;
}

export function writeSummaryCache(cacheKey: string, entry: SummaryCacheEntry): void {
  const cacheStore = readJsonFromSessionStorage<SummaryCacheStore>(CACHE_STORAGE_KEY) ?? {};
  cacheStore[cacheKey] = entry;
  writeJsonToSessionStorage(CACHE_STORAGE_KEY, cacheStore);
}

export function canGenerateSummary(rateLimitKey: string, now = Date.now()): boolean {
  const rateLimitStore = readJsonFromSessionStorage<SummaryRateLimitStore>(RATE_LIMIT_STORAGE_KEY) ?? {};
  const lastGeneratedAt = rateLimitStore[rateLimitKey];
  if (typeof lastGeneratedAt !== 'number') {
    return true;
  }
  return now - lastGeneratedAt >= ONE_MINUTE_MS;
}

export function markSummaryGenerated(rateLimitKey: string, generatedAt = Date.now()): void {
  const rateLimitStore = readJsonFromSessionStorage<SummaryRateLimitStore>(RATE_LIMIT_STORAGE_KEY) ?? {};
  rateLimitStore[rateLimitKey] = generatedAt;
  writeJsonToSessionStorage(RATE_LIMIT_STORAGE_KEY, rateLimitStore);
}

export function hasTextualDiffContent(files: PRFile[]): boolean {
  return files.some((file) => Boolean(file.patch && file.patch.trim().length > 0));
}
