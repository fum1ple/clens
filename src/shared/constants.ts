import type { FileCategory } from './types';

// ---------------------------------------------------------------------------
// パスパターン（glob 文字列） — Scanner (U3) でのファイル検出に使用
// ---------------------------------------------------------------------------

export const CLAUDE_MD_PATH = 'CLAUDE.md';
export const SKILLS_GLOB = '.claude/skills/**/SKILL.md';
export const COMMANDS_GLOB = '.claude/commands/*.md';

// ---------------------------------------------------------------------------
// ホワイトリスト検証用の正規表現 — Middleware (U4) でのパス検証に使用
// ---------------------------------------------------------------------------

export const ALLOWED_PATH_PATTERNS: readonly RegExp[] = [
  /^CLAUDE\.md$/,
  /^\.claude\/skills\/(?:[^/]+\/)+SKILL\.md$/,
  /^\.claude\/commands\/[^/]+\.md$/,
];

/**
 * 相対パスがホワイトリストに一致するかを判定する。
 * Middleware (U4) やテストから利用する。
 */
export function isAllowedPath(relativePath: string): boolean {
  return ALLOWED_PATH_PATTERNS.some((pattern) => pattern.test(relativePath));
}

// ---------------------------------------------------------------------------
// カテゴリ定義
// ---------------------------------------------------------------------------

export const FILE_CATEGORIES = {
  SKILL: 'skill',
  COMMAND: 'command',
  CLAUDE_MD: 'claude-md',
} as const satisfies Record<string, FileCategory>;

/** UI 表示用カテゴリラベル */
export const CATEGORY_LABELS: Record<FileCategory, string> = {
  skill: 'Skills',
  command: 'Commands',
  'claude-md': 'CLAUDE.md',
};

// ---------------------------------------------------------------------------
// CLI デフォルト値
// ---------------------------------------------------------------------------

export const DEFAULT_PORT = 4567;
export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_ROOT = '.';
