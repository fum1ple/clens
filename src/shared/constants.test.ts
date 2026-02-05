import { describe, expect, it } from 'vitest';

import {
  ALLOWED_PATH_PATTERNS,
  CATEGORY_LABELS,
  CLAUDE_MD_PATH,
  COMMANDS_GLOB,
  DEFAULT_HOST,
  DEFAULT_PORT,
  DEFAULT_ROOT,
  FILE_CATEGORIES,
  SKILLS_GLOB,
  isAllowedPath,
} from './constants';

describe('isAllowedPath', () => {
  describe('許可されるパス', () => {
    it('CLAUDE.md を許可する', () => {
      expect(isAllowedPath('CLAUDE.md')).toBe(true);
    });

    it('.claude/skills 直下のスキルを許可する', () => {
      expect(isAllowedPath('.claude/skills/code-review/SKILL.md')).toBe(true);
    });

    it('ネストされたスキルを許可する', () => {
      expect(isAllowedPath('.claude/skills/testing/unit/SKILL.md')).toBe(true);
    });

    it('深くネストされたスキルを許可する', () => {
      expect(
        isAllowedPath('.claude/skills/a/b/c/SKILL.md'),
      ).toBe(true);
    });

    it('.claude/commands 直下のコマンドを許可する', () => {
      expect(isAllowedPath('.claude/commands/fix-lint.md')).toBe(true);
    });

    it('ハイフン付きコマンド名を許可する', () => {
      expect(isAllowedPath('.claude/commands/my-command.md')).toBe(true);
    });
  });

  describe('拒否されるパス', () => {
    it('任意のソースファイルを拒否する', () => {
      expect(isAllowedPath('src/index.ts')).toBe(false);
    });

    it('パストラバーサルを拒否する', () => {
      expect(isAllowedPath('../etc/passwd')).toBe(false);
    });

    it('.claude/skills 直下の SKILL.md を拒否する（ディレクトリ名が必要）', () => {
      expect(isAllowedPath('.claude/skills/SKILL.md')).toBe(false);
    });

    it('コマンドのネストを拒否する', () => {
      expect(isAllowedPath('.claude/commands/sub/cmd.md')).toBe(false);
    });

    it('SKILL.md 以外のスキルファイルを拒否する', () => {
      expect(isAllowedPath('.claude/skills/code-review/README.md')).toBe(false);
    });

    it('.md 以外のコマンドファイルを拒否する', () => {
      expect(isAllowedPath('.claude/commands/fix-lint.txt')).toBe(false);
    });

    it('ルート以外の CLAUDE.md を拒否する', () => {
      expect(isAllowedPath('subdir/CLAUDE.md')).toBe(false);
    });

    it('空文字列を拒否する', () => {
      expect(isAllowedPath('')).toBe(false);
    });
  });
});

describe('ALLOWED_PATH_PATTERNS', () => {
  it('3 つのパターンが定義されている', () => {
    expect(ALLOWED_PATH_PATTERNS).toHaveLength(3);
  });
});

describe('glob パターン定数', () => {
  it('CLAUDE_MD_PATH が正しい', () => {
    expect(CLAUDE_MD_PATH).toBe('CLAUDE.md');
  });

  it('SKILLS_GLOB が正しい', () => {
    expect(SKILLS_GLOB).toBe('.claude/skills/**/SKILL.md');
  });

  it('COMMANDS_GLOB が正しい', () => {
    expect(COMMANDS_GLOB).toBe('.claude/commands/*.md');
  });
});

describe('FILE_CATEGORIES', () => {
  it('すべてのカテゴリが定義されている', () => {
    expect(FILE_CATEGORIES.SKILL).toBe('skill');
    expect(FILE_CATEGORIES.COMMAND).toBe('command');
    expect(FILE_CATEGORIES.CLAUDE_MD).toBe('claude-md');
  });
});

describe('CATEGORY_LABELS', () => {
  it('すべてのカテゴリの表示ラベルが定義されている', () => {
    expect(CATEGORY_LABELS['skill']).toBe('Skills');
    expect(CATEGORY_LABELS['command']).toBe('Commands');
    expect(CATEGORY_LABELS['claude-md']).toBe('CLAUDE.md');
  });
});

describe('CLI デフォルト値', () => {
  it('DEFAULT_PORT が 4567', () => {
    expect(DEFAULT_PORT).toBe(4567);
  });

  it('DEFAULT_HOST が 127.0.0.1', () => {
    expect(DEFAULT_HOST).toBe('127.0.0.1');
  });

  it('DEFAULT_ROOT が .', () => {
    expect(DEFAULT_ROOT).toBe('.');
  });
});
