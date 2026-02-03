# clens 要件定義書

## 1. プロジェクト概要

### 1.1 背景

Claude Code や Codex などの AI コーディングエージェントの普及に伴い、Skill（`SKILL.md`）やカスタムコマンド（`.claude/commands/*.md`）、プロジェクト設定（`CLAUDE.md`）といった定義ファイルを作成・管理する機会が増えている。しかし、これらのファイルは Markdown として散在しており、一覧性がなく、プレビューしながら編集する手段も存在しない。

### 1.2 解決する課題

- プロジェクト内にどんなスキル / コマンドが定義されているか俯瞰できない
- Markdown の整形表示（レンダリング）をリアルタイムで確認しながら編集できない
- 新規スキル / コマンドを作るたびにフォーマットを手動で組み立てる必要がある

### 1.3 プロダクトビジョン

**clens**（Claude + lens）は、Claude Code のスキル・コマンド・プロジェクト設定ファイルを可視化し、プレビューしながら編集できるローカル Web サーバー型 CLI ツールである。

### 1.4 スコープ

- **対象ツール:** Claude Code（初期リリース）
- **対象外:** Codex, Cursor, Windsurf 等の他ツール（将来の拡張候補）

---

## 2. ユーザーストーリー

| # | ストーリー | 優先度 |
|---|-----------|--------|
| US-1 | 開発者として、`npx clens` を実行するだけでブラウザが開き、プロジェクト内のスキル・コマンド・CLAUDE.md を一覧で見たい | **Must** |
| US-2 | 開発者として、ファイルツリーからファイルを選択し、左にエディタ・右にプレビューの split view で編集したい | **Must** |
| US-3 | 開発者として、エディタで編集した内容がリアルタイムでプレビューに反映されてほしい | **Must** |
| US-4 | 開発者として、保存ボタンを押すと実ファイルに書き戻されてほしい | **Must** |
| US-5 | 開発者として、外部エディタ（VS Code 等）でファイルを変更したとき、ブラウザ側にも変更が自動反映されてほしい | **Must** |
| US-6 | 開発者として、テンプレートを選んで新しいスキルやコマンドをすぐに作りたい | **Must** |
| US-7 | 開発者として、CLAUDE.md のセクションをアウトラインとして見たい | **Should** |
| US-8 | 開発者として、ファイルを削除できるようにしたい | **Should** |

---

## 3. 対象ファイル

### 3.1 検出対象

| 種類 | パス | 形式 | ツリー上の分類 |
|------|------|------|---------------|
| スキル | `.claude/skills/**/SKILL.md` | ディレクトリ + SKILL.md | 📂 Skills |
| カスタムコマンド | `.claude/commands/*.md` | 単体 Markdown | 📂 Commands |
| プロジェクト設定 | `CLAUDE.md`（プロジェクトルート） | 単体 Markdown | 📄 CLAUDE.md（最上位に独立表示） |

### 3.2 CLAUDE.md の扱い

- ツリー上ではスキル / コマンドとは別枠で最上位に独立表示する
- 編集・プレビューは同じ split view を使用する
- テンプレートの対象外とする（プロジェクト固有のため）
- セクション単位のアウトライン表示を提供する（Should）

---

## 4. 画面構成

```
┌──────────────────────────────────────────────────────────┐
│  clens                                [+ New] [Settings] │
├─────────────┬────────────────────────────────────────────┤
│  📁 Explorer │                                            │
│             │   ┌── Editor ────────┬── Preview ────────┐ │
│  📄 CLAUDE.md│   │                  │                    │ │
│             │   │  # Skill Name    │  Skill Name        │ │
│  📂 Skills   │   │  Description...  │  Description...    │ │
│   ├ skill-a │   │                  │  (rendered MD)     │ │
│   └ skill-b │   │                  │                    │ │
│             │   │                  │                    │ │
│  📂 Commands │   └──────────────────┴────────────────────┘ │
│   ├ cmd-1   │                                            │
│   └ cmd-2   │                           [Save] [Revert] │
└─────────────┴────────────────────────────────────────────┘
```

### 4.1 左ペイン — Explorer

- ファイルツリー形式でスキル / コマンド / CLAUDE.md をカテゴリ分けして表示
- 各ファイルをクリックで選択 → 右の split view に表示
- カテゴリはデフォルトで展開状態
- 「+ New」ボタンからテンプレート選択ダイアログを起動

### 4.2 右ペイン — Split View

- **左半分（Editor）:** CodeMirror 6 による Markdown エディタ。シンタックスハイライト付き
- **右半分（Preview）:** react-markdown によるリアルタイムレンダリング（GFM 対応）
- エディタへの入力がリアルタイムでプレビューに反映される
- Save ボタンで実ファイルへ書き戻し
- Revert ボタンでディスク上のファイル内容に戻す

### 4.3 新規作成ダイアログ

- テンプレート一覧から選択
- ファイル名（スキル名 / コマンド名）を入力
- 作成先パスのプレビュー表示
- 作成後、自動的にエディタで開く

---

## 5. 技術アーキテクチャ

### 5.1 参考設計

[difit](https://github.com/yoshiko-pg/difit) のアーキテクチャをベースとする。単一パッケージ構成で CLI + サーバー + フロントエンドを `src/` 配下に共存させ、tsconfig を CLI 用とフロントエンド用に分離するパターンを踏襲する。

### 5.2 技術スタック

| レイヤー | 技術 | 選定理由 |
|----------|------|----------|
| CLI | Commander.js | difit と同一。引数解析の実績十分 |
| サーバー | **Hono** (@hono/node-server) | 軽量・TS-first。npx 起動時の初回ダウンロードが速い |
| リアルタイム通信 | **SSE** (hono/streaming) | サーバー → クライアントの一方向通知で十分。WebSocket 不要 |
| ファイルウォッチ | chokidar | ファイルシステム監視の定番 |
| フロントエンド | React 18 + Vite | difit と同パターン。HMR 対応 |
| エディタ | **CodeMirror 6** | 軽量でバンドルサイズが小さい。Markdown サポート良好 |
| プレビュー | react-markdown + remark-gfm | GFM テーブル・チェックリスト等を含む Markdown レンダリング |
| スタイリング | Tailwind CSS v4 | difit と同一 |
| テスト | Vitest | difit と同一。co-located test files |
| Lint / Format | ESLint + Prettier | difit と同一 |

### 5.3 ディレクトリ構成

```
clens/
├── src/
│   ├── cli/                        # CLI 層
│   │   ├── index.ts                # エントリポイント（bin）
│   │   ├── args.ts                 # 引数解析
│   │   └── open-browser.ts         # ブラウザ自動起動
│   │
│   ├── server/                     # バックエンド層（Hono）
│   │   ├── index.ts                # Hono アプリ定義
│   │   ├── routes/
│   │   │   ├── api.ts              # REST API（ファイル CRUD）
│   │   │   └── sse.ts              # SSE エンドポイント
│   │   ├── services/
│   │   │   ├── scanner.ts          # スキル / コマンド自動検出
│   │   │   ├── watcher.ts          # chokidar ファイルウォッチ
│   │   │   └── templates.ts        # テンプレート管理
│   │   └── types.ts
│   │
│   ├── app/                        # フロントエンド層（React）
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── Explorer.tsx        # ファイルツリー
│   │   │   ├── Editor.tsx          # CodeMirror エディタ
│   │   │   ├── Preview.tsx         # Markdown プレビュー
│   │   │   ├── SplitView.tsx       # 分割レイアウト管理
│   │   │   └── NewFileDialog.tsx   # テンプレート選択ダイアログ
│   │   ├── hooks/
│   │   │   ├── useSSE.ts           # SSE イベント購読
│   │   │   └── useFileApi.ts       # REST API 呼び出し
│   │   └── styles/
│   │
│   └── shared/                     # CLI / サーバー / フロントエンド共有
│       ├── types.ts                # SkillFile, CommandFile 等の型定義
│       └── constants.ts            # パス規約、カテゴリ定義
│
├── templates/                      # 組み込みテンプレート
│   ├── basic-skill.md
│   ├── code-generation-skill.md
│   ├── file-operation-skill.md
│   ├── basic-command.md
│   └── command-with-args.md
│
├── public/                         # 静的アセット
├── tsconfig.json                   # フロントエンド用
├── tsconfig.cli.json               # CLI + サーバー用
├── vite.config.ts
├── vitest.config.ts
└── package.json
```

### 5.4 ビルドと配布

- **開発モード (`pnpm run dev`):** Vite dev server（HMR）+ CLI サーバーを同時起動
- **本番モード (`pnpm run build`):** Vite でフロントエンドをビルド → `dist/` に出力
- **npm 配布:** ビルド済みフロントエンドをパッケージに同梱。`npx clens` で即時起動可能
- **tsconfig 分離:** `tsconfig.json`（フロントエンド / Vite 用）と `tsconfig.cli.json`（CLI + サーバー用）

---

## 6. API 設計

### 6.1 REST API

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|------------|------------|
| `GET` | `/api/files` | ファイルツリー取得 | — | `FileTree` |
| `GET` | `/api/files/:path` | ファイル内容取得 | — | `{ content: string, updatedAt: string }` |
| `PUT` | `/api/files/:path` | ファイル保存（上書き） | `{ content: string }` | `{ success: boolean }` |
| `POST` | `/api/files` | 新規ファイル作成 | `{ path: string, templateId?: string }` | `{ success: boolean, path: string }` |
| `DELETE` | `/api/files/:path` | ファイル削除 | — | `{ success: boolean }` |
| `GET` | `/api/templates` | テンプレート一覧取得 | — | `Template[]` |

### 6.2 SSE

| エンドポイント | イベント | ペイロード |
|----------------|----------|------------|
| `GET /api/sse` | `file:changed` | `{ path: string, content: string }` |
| | `file:created` | `{ path: string }` |
| | `file:deleted` | `{ path: string }` |

### 6.3 型定義

```typescript
// ファイルの種類
type FileCategory = 'skill' | 'command' | 'claude-md';

// ファイルツリーのノード
interface FileNode {
  name: string;
  path: string;           // プロジェクトルートからの相対パス
  category: FileCategory;
  description?: string;   // SKILL.md の先頭行等から抽出
}

// ファイルツリー全体
interface FileTree {
  root: string;           // プロジェクトルートの絶対パス
  claudeMd: FileNode | null;
  skills: FileNode[];
  commands: FileNode[];
}

// テンプレート
interface Template {
  id: string;
  name: string;
  category: 'skill' | 'command';
  description: string;
  content: string;
}
```

---

## 7. CLI インターフェース

### 7.1 基本コマンド

```bash
# 基本起動（カレントディレクトリのプロジェクトを対象）
npx clens

# ポート指定
npx clens --port 4000

# 特定ディレクトリを対象
npx clens --root ./my-project

# ブラウザ自動起動を抑制
npx clens --no-open
```

### 7.2 CLI オプション

| フラグ | デフォルト | 説明 |
|--------|-----------|------|
| `--port` | `4567` | サーバーのポート番号。使用中の場合は +1 にフォールバック |
| `--root` | `.`（カレントディレクトリ） | 対象プロジェクトのルートディレクトリ |
| `--no-open` | `false` | ブラウザの自動起動を抑制 |
| `--host` | `127.0.0.1` | バインドするホストアドレス |

---

## 8. 動作フロー

```
npx clens
  │
  ├─ 1. CLI が引数を解析（--port, --root 等）
  │
  ├─ 2. scanner がプロジェクトルートを走査
  │      ├─ .claude/skills/**/SKILL.md を検出
  │      ├─ .claude/commands/*.md を検出
  │      └─ CLAUDE.md の有無を確認
  │
  ├─ 3. Hono サーバーを起動
  │      ├─ REST API ルート登録
  │      ├─ SSE エンドポイント登録
  │      ├─ ビルド済みフロントエンドを静的配信
  │      └─ chokidar でファイルウォッチ開始
  │
  ├─ 4. ブラウザを自動起動（localhost:4567）
  │
  └─ 5. ユーザー操作ループ
         ├─ ファイルツリーからファイル選択 → GET /api/files/:path
         ├─ エディタで編集 → リアルタイムプレビュー反映
         ├─ Save ボタン → PUT /api/files/:path → ファイルに書き戻し
         ├─ 外部で変更 → chokidar 検知 → SSE で通知 → ブラウザ自動更新
         └─ + New → テンプレート選択 → POST /api/files → 作成してエディタで開く
```

---

## 9. 外部変更の競合ハンドリング

### 9.1 基本方針

MVP では「最後の書き込み勝ち」方式を採用する。ただし、ユーザーが未保存の編集中に外部変更が発生した場合は警告を表示する。

### 9.2 フロー

1. chokidar がファイル変更を検知
2. SSE で `file:changed` イベントをブラウザに通知
3. ブラウザ側で未保存の変更があるかチェック
   - **未保存の変更なし:** エディタとプレビューを自動更新
   - **未保存の変更あり:** 警告ダイアログを表示し、「外部の変更を取り込む（自分の変更を破棄）」または「自分の変更を維持」を選択させる

---

## 10. 組み込みテンプレート

### 10.1 テンプレート一覧

| ID | テンプレート名 | カテゴリ | 説明 |
|----|---------------|----------|------|
| `basic-skill` | Basic Skill | skill | 最小限の SKILL.md 雛形 |
| `code-generation-skill` | Code Generation Skill | skill | コード生成系スキルの雛形 |
| `file-operation-skill` | File Operation Skill | skill | ファイル操作系スキルの雛形 |
| `basic-command` | Basic Command | command | コマンドの基本雛形 |
| `command-with-args` | Command with Arguments | command | 引数付きコマンドの雛形 |

### 10.2 テンプレート例（Basic Skill）

```markdown
# [Skill Name]

## Overview

[Brief description of what this skill does]

## When to Use

- [Trigger condition 1]
- [Trigger condition 2]

## Instructions

[Detailed instructions for the AI agent]

## Examples

### Input
[Example input]

### Output
[Example output]
```

---

## 11. 非機能要件

### 11.1 パフォーマンス

- `npx` での初回起動（ダウンロード含む）が 10 秒以内
- サーバー起動からブラウザ表示まで 2 秒以内
- エディタ入力からプレビュー反映まで 100ms 以内（デバウンス適用）
- 外部ファイル変更から SSE 通知まで 500ms 以内

### 11.2 互換性

- Node.js >= 18.0.0
- 対応 OS: macOS, Linux, Windows (WSL 含む)
- 対応ブラウザ: Chrome, Firefox, Safari, Edge（最新版）

### 11.3 セキュリティ

- サーバーはデフォルトで `127.0.0.1` にバインド（外部アクセス不可）
- ファイル操作は `--root` で指定されたディレクトリ内に制限（パストラバーサル防止）
- 対象ファイルはスキル / コマンド / CLAUDE.md に限定（任意ファイルの読み書き不可）

### 11.4 パッケージサイズ

- npm パッケージサイズ: 2MB 以下を目標（CodeMirror 6 採用で軽量化）

---

## 12. 将来の拡張候補（v2 以降）

以下は初期リリースのスコープ外とし、将来のバージョンで検討する。

- 他ツール対応（Codex の `AGENTS.md`, Cursor の `.cursor/rules/` 等）のプラグイン機構
- スキル間の依存関係・参照関係のグラフ表示
- Git diff との連携（変更点の可視化）
- ユーザー定義テンプレートの登録・管理
- CLAUDE.md のセクションごとのアウトライン表示・ジャンプ
- バリデーション機能（必須フィールドの欠落、フォーマット不正の検出）
- CLI サブコマンド（`clens init skill my-skill` 等）

---

## 13. 参考

- **difit** ([github.com/yoshiko-pg/difit](https://github.com/yoshiko-pg/difit)): アーキテクチャの参考。単一パッケージ構成、Commander.js + Express + React + Vite + Tailwind CSS + Vitest のスタック。Express を Hono に置き換え、read-only viewer を read/write editor に拡張する設計。
