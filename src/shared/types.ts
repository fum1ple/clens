/** ファイルの種類 */
export type FileCategory = 'skill' | 'command' | 'claude-md';

/**
 * ファイルツリーのノード
 *
 * name の導出ルール（カテゴリ別）:
 *   skill:     SKILL.md の直上ディレクトリ名
 *              例: .claude/skills/code-review/SKILL.md → "code-review"
 *              例: .claude/skills/testing/unit/SKILL.md → "unit"
 *   command:   ファイル名から拡張子 .md を除いた部分
 *              例: .claude/commands/fix-lint.md → "fix-lint"
 *   claude-md: 固定値 "CLAUDE.md"
 *
 * description の抽出ルール:
 *   skill:     最初の見出し（#）直後の段落テキスト
 *   command:   YAML frontmatter の description フィールド（存在しない場合は undefined）
 *   claude-md: 常に undefined
 */
export interface FileNode {
  name: string;
  /** プロジェクトルートからの相対パス */
  path: string;
  category: FileCategory;
  description?: string;
}

/**
 * ファイルツリー全体
 *
 * ソート順:
 *   skills:   path の辞書順
 *   commands: name の辞書順
 */
export interface FileTree {
  /** プロジェクトルートの絶対パス */
  root: string;
  claudeMd: FileNode | null;
  skills: FileNode[];
  commands: FileNode[];
}

/** エラーレスポンス共通型 */
export interface ApiError {
  /** エラーコード（例: "NOT_FOUND", "FORBIDDEN", "CONFLICT"） */
  error: string;
  /** 人間可読なエラーメッセージ */
  message: string;
}
