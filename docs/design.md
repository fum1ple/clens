# clens 基本設計書

本ドキュメントは要件定義書（`requirements.md`）で定義された「何を実現するか」に対して、「どう実現するか」を記述する。

---

## 1. 参考設計

[difit](https://github.com/yoshiko-pg/difit) のアーキテクチャをベースとする。単一パッケージ構成で CLI + サーバー + フロントエンドを `src/` 配下に共存させ、tsconfig を CLI 用とフロントエンド用に分離するパターンを踏襲する。

Express を Hono に置き換え、read-only viewer を read/write editor に拡張する設計とする。

---

## 2. 技術スタック

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

---

## 3. ディレクトリ構成

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
│   │   └── types.ts               # サーバー内部のみで使う型
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
│       ├── types.ts                # API の入出力に現れる共有型（FileNode, FileTree, Template 等）
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

---

## 4. ビルドと配布

- **開発モード (`pnpm run dev`):** Vite dev server（HMR）+ CLI サーバーを同時起動
- **本番モード (`pnpm run build`):** Vite でフロントエンドをビルド → `dist/` に出力
- **npm 配布:** ビルド済みフロントエンドをパッケージに同梱。`npx clens` で即時起動可能
- **tsconfig 分離:** `tsconfig.json`（フロントエンド / Vite 用）と `tsconfig.cli.json`（CLI + サーバー用）

---

## 5. API 設計

### 5.1 REST API

| メソッド | パス | 説明 | リクエスト | レスポンス |
|----------|------|------|------------|------------|
| `GET` | `/api/files` | ファイルツリー取得 | — | `FileTree` |
| `GET` | `/api/files/:path` | ファイル内容取得 | — | `{ content: string, updatedAt: string }` |
| `PUT` | `/api/files/:path` | ファイル保存（上書き） | `{ content: string }` | `{ success: boolean }` |
| `POST` | `/api/files` | 新規ファイル作成 | `{ path: string, templateId?: string }` | `{ success: boolean, path: string }` |
| `DELETE` | `/api/files/:path` | ファイル削除 | — | `{ success: boolean }` |
| `GET` | `/api/templates` | テンプレート一覧取得 | — | `Template[]` |

### 5.2 SSE

| エンドポイント | イベント | ペイロード |
|----------------|----------|------------|
| `GET /api/sse` | `file:changed` | `{ path: string, content: string }` |
| | `file:created` | `{ path: string }` |
| | `file:deleted` | `{ path: string }` |

### 5.3 型定義

```typescript
// ファイルの種類
type FileCategory = 'skill' | 'command' | 'claude-md';

// ファイルツリーのノード
interface FileNode {
  name: string;
  path: string;           // プロジェクトルートからの相対パス
  category: FileCategory;
  description?: string;
  // 抽出ルール:
  //   skill: 最初の見出し（#）直後の段落テキスト
  //   command: 最初の見出し（#）のテキスト
  //   claude-md: null
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

## 6. 動作フロー

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

## 7. CLI コマンド例とフォールバック挙動

### 7.1 コマンド例

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

### 7.2 ポートフォールバック

`--port` で指定されたポートが使用中の場合は +1 にフォールバックする。

---

## 8. 画面挙動の詳細

### 8.1 エディタ入力のデバウンス

エディタへの入力に対するプレビュー反映はデバウンスを適用する。デバウンス間隔は 100ms 以下とする。

### 8.2 未保存変更時のファイル切り替え

未保存の変更がある状態で別ファイルを選択した場合、確認ダイアログを表示し以下の選択肢を提示する:
- **保存して移動:** 変更をファイルに保存してから遷移
- **破棄して移動:** 変更を破棄して遷移
- **キャンセル:** 遷移を中止

### 8.3 ブラウザ離脱時の確認

ブラウザタブを閉じようとした場合、未保存の変更があれば `beforeunload` イベントでブラウザ標準の離脱確認を表示する。

### 8.4 削除時の確認

ファイル削除時は確認ダイアログを表示する。

---

## 9. 外部変更の競合ハンドリング — フロー

1. chokidar がファイル変更を検知
2. SSE で `file:changed` イベントをブラウザに通知
3. ブラウザ側で未保存の変更があるかチェック
   - **未保存の変更なし:** エディタとプレビューを自動更新
   - **未保存の変更あり:** 警告ダイアログを表示し、「外部の変更を取り込む（自分の変更を破棄）」または「自分の変更を維持」を選択させる

---

## 10. テンプレート内容例

### 10.1 Basic Skill

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
