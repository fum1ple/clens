# clens 基本設計書

本ドキュメントは要件定義書（`requirements.md`）で定義された「何を実現するか」に対して、「どう実現するか」を記述する。

### Phase スコープ

要件定義書 §1.5 に基づき、本設計書でも Phase 1 / Phase 2 の区分を明示する。各セクションで **〔Phase 2〕** と記載された箇所は Phase 1 の実装スコープ外とする。

| Phase | 設計上の主な対象 |
|-------|-----------------|
| **Phase 1** | CLI 起動、ファイルスキャン、REST API（GET / PUT）、Explorer、CodeMirror エディタ、プレビュー、保存、セキュリティミドルウェア |
| **Phase 2** | SSE / chokidar、テンプレート / 新規作成（POST）、削除（DELETE）、競合ハンドリング |

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
| リアルタイム通信 | **SSE** (hono/streaming) | サーバー → クライアントの一方向通知で十分。WebSocket 不要 **〔Phase 2〕** |
| ファイルウォッチ | chokidar v4 | ファイルシステム監視の定番。ESM-only で Node.js 20+ 要件と整合 **〔Phase 2〕** |
| フロントエンド | React 19 + Vite | 新規プロジェクトのため最新安定版を採用。HMR 対応 |
| エディタ | **CodeMirror 6** | 軽量でバンドルサイズが小さい。Markdown サポート良好 |
| プレビュー | react-markdown + remark-gfm | GFM テーブル・チェックリスト等を含む Markdown レンダリング |
| スタイリング | Tailwind CSS v4 | CSS-first 設定でゼロ JS 設定ファイル。ビルドが高速 |
| テスト | Vitest | difit と同一。co-located test files |
| Lint / Format | ESLint + Prettier | difit と同一 |
| 状態管理 | React Context | 外部ライブラリ不要。アプリの状態規模が小さく Context で十分 |

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
│   │   │   ├── sse.ts              # SSE エンドポイント              〔Phase 2〕
│   │   │   └── middleware.ts       # パス検証・セキュリティミドルウェア
│   │   ├── services/
│   │   │   ├── scanner.ts          # スキル / コマンド自動検出
│   │   │   ├── watcher.ts          # chokidar ファイルウォッチ       〔Phase 2〕
│   │   │   └── templates.ts        # テンプレート管理               〔Phase 2〕
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
│   │   │   └── NewFileDialog.tsx   # テンプレート選択ダイアログ     〔Phase 2〕
│   │   ├── contexts/
│   │   │   └── AppContext.tsx       # アプリケーション状態（選択中ファイル、ダーティ状態等）
│   │   ├── hooks/
│   │   │   ├── useSSE.ts           # SSE イベント購読              〔Phase 2〕
│   │   │   └── useFileApi.ts       # REST API 呼び出し
│   │   └── styles/
│   │
│   └── shared/                     # CLI / サーバー / フロントエンド共有
│       ├── types.ts                # API の入出力に現れる共有型（FileNode, FileTree, Template 等）
│       └── constants.ts            # パス規約、カテゴリ定義
│
├── templates/                      # 組み込みテンプレート             〔Phase 2〕
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

- **開発モード (`pnpm run dev`):** Vite dev server（HMR）+ Hono サーバーを同時起動。Vite の `server.proxy` 設定により、`/api/*` へのリクエストを Hono サーバー（別ポート）に転送する
- **本番モード (`pnpm run build`):** Vite でフロントエンドをビルド → `dist/` に出力
- **npm 配布:** ビルド済みフロントエンドをパッケージに同梱。`npx clens` で即時起動可能
- **tsconfig 分離:** `tsconfig.json`（フロントエンド / Vite 用）と `tsconfig.cli.json`（CLI + サーバー用）

---

## 5. API 設計

> **スコープ注記:** 要件定義書 US-7「CLAUDE.md のセクションをアウトラインとして見たい」は Should 要件であり、MVP（初期リリース）のスコープ外とする。アウトライン表示に関する API エンドポイントやコンポーネント設計は v2 以降で検討する。

### 5.1 REST API

`:path` パラメータにはスラッシュを含む相対パス（例: `.claude/skills/my-skill/SKILL.md`）が入る。Hono のデフォルトルーターは `/` をパスセグメントの区切りとして扱うため、ワイルドカードルート構文を使用する。

実装時のルート定義: `/api/files/:path{.+}`

| メソッド | パス | 説明 | リクエスト | レスポンス | Phase |
|----------|------|------|------------|------------|-------|
| `GET` | `/api/files` | ファイルツリー取得 | — | `FileTree` | 1 |
| `GET` | `/api/files/:path{.+}` | ファイル内容取得 | — | `{ content: string, updatedAt: string }` | 1 |
| `PUT` | `/api/files/:path{.+}` | ファイル保存（上書き）。成功時 200 | `{ content: string }` | `{ updatedAt: string }` | 1 |
| `POST` | `/api/files` | 新規ファイル作成。指定パスに既存ファイルがある場合は 409 Conflict を返す | `{ path: string, templateId?: string }` | `{ path: string }` | 2 |
| `DELETE` | `/api/files/:path{.+}` | ファイル削除。スキルの場合はディレクトリごと削除する。成功時 204 No Content | — | （なし） | 2 |
| `GET` | `/api/templates` | テンプレート一覧取得 | — | `Template[]` | 2 |

#### 主要エラーステータスコード

すべてのエラーレスポンスは `ApiError` 型（§5.3 参照）に準拠する。

| ステータスコード | エラーコード | 発生条件 |
|---|---|---|
| `400 Bad Request` | `BAD_REQUEST` | リクエストボディの形式不正 |
| `403 Forbidden` | `FORBIDDEN` | パストラバーサル検出、対象外ファイルへのアクセス |
| `404 Not Found` | `NOT_FOUND` | 指定パスのファイルが存在しない |
| `409 Conflict` | `CONFLICT` | POST で既存ファイルと衝突 |
| `500 Internal Server Error` | `INTERNAL_ERROR` | サーバー内部エラー |

### 5.2 SSE **〔Phase 2〕**

| エンドポイント | イベント | ペイロード |
|----------------|----------|------------|
| `GET /api/sse` | `file:changed` | `{ path: string }` |
| | `file:created` | `{ path: string }` |
| | `file:deleted` | `{ path: string }` |

> **設計判断:** `file:changed` のペイロードにはファイル内容を含めない。クライアントは通知を受け取った後、現在開いているファイルの変更であれば `GET /api/files/:path{.+}` で最新内容を取得する。これにより、開いていないファイルの変更時に不要なデータ転送を回避する。

### 5.3 型定義

```typescript
// ファイルの種類
type FileCategory = 'skill' | 'command' | 'claude-md';

// ファイルツリーのノード
interface FileNode {
  name: string;
  // 導出ルール（カテゴリ別）:
  //   skill:     SKILL.md の直上ディレクトリ名
  //              例: .claude/skills/code-review/SKILL.md → "code-review"
  //              例: .claude/skills/testing/unit/SKILL.md → "unit"
  //   command:   ファイル名から拡張子 .md を除いた部分
  //              例: .claude/commands/fix-lint.md → "fix-lint"
  //   claude-md: 固定値 "CLAUDE.md"
  path: string;           // プロジェクトルートからの相対パス
  category: FileCategory;
  description?: string;
  // 抽出ルール:
  //   skill:     最初の見出し（#）直後の段落テキスト
  //   command:   YAML frontmatter の description フィールド。
  //              frontmatter が存在しない、または description フィールドがない場合は null
  //   claude-md: null
  //
  // 実装メモ: コマンドファイルの YAML frontmatter 解析には、`---` で囲まれた
  // 先頭ブロックを抽出し、description フィールドの値を取得する。
  // frontmatter が不正な YAML の場合は description を null として扱う。
}

// ファイルツリー全体
interface FileTree {
  root: string;           // プロジェクトルートの絶対パス
  claudeMd: FileNode | null;
  skills: FileNode[];
  commands: FileNode[];
}

// ソート順:
//   skills:   path の辞書順
//   commands: name の辞書順

// テンプレート
interface Template {
  id: string;
  name: string;
  category: 'skill' | 'command';
  description: string;
  content: string;
}

// エラーレスポンス共通型
interface ApiError {
  error: string;          // エラーコード（例: "NOT_FOUND", "FORBIDDEN", "CONFLICT"）
  message: string;        // 人間可読なエラーメッセージ
}
```

### 5.4 ネストされたスキルの Explorer 表示ルール

`FileTree.skills` は `FileNode[]`（フラット配列）のままとし、ツリーの階層化は行わない。
Explorer での表示名は以下のロジックで決定する（フロントエンド `Explorer.tsx` 側で `path` から算出）:

1. `skills` 配列内で `name` が一意の場合: `name` をそのまま表示
2. `skills` 配列内で同一 `name` が複数存在する場合: `.claude/skills/` からの相対パス（`SKILL.md` を除く）を表示に使用する

`FileNode` 型への追加フィールドは不要。`path` フィールドから算出可能なため。

**例:**

ファイルシステム:
```
.claude/skills/code-review/SKILL.md
.claude/skills/frontend/utils/SKILL.md
.claude/skills/backend/utils/SKILL.md
```

`FileTree.skills` のレスポンス（`path` の辞書順）:
```json
[
  { "name": "utils",       "path": ".claude/skills/backend/utils/SKILL.md",  "category": "skill" },
  { "name": "code-review", "path": ".claude/skills/code-review/SKILL.md",    "category": "skill" },
  { "name": "utils",       "path": ".claude/skills/frontend/utils/SKILL.md", "category": "skill" }
]
```

Explorer 表示:
```
Skills
 ├─ backend/utils        ← name "utils" が重複するため親パスを付与
 ├─ code-review          ← name が一意なのでそのまま
 └─ frontend/utils       ← name "utils" が重複するため親パスを付与
```

### 5.5 セキュリティ設計

要件定義書 §8.3 で定義されたセキュリティ要件を以下の方針で実現する。

#### パストラバーサル防止

API ルート `/api/files/:path{.+}` に対する共通ミドルウェアで、受け取ったパスを以下の手順で検証する。

1. `path.resolve()` でパスを正規化し、`..` を含むトラバーサルを排除する
2. 正規化後のパスが `--root` で指定されたプロジェクトルートディレクトリ配下であることを検証する
3. 検証に失敗した場合は `403 Forbidden` を返す

#### 対象ファイル制限

ファイル操作 API は以下のパスパターンに一致するファイルのみを許可するホワイトリスト方式とする。

- `CLAUDE.md`（プロジェクトルート直下）
- `.claude/skills/**/SKILL.md`
- `.claude/commands/*.md`

上記に一致しないパスへのアクセスは `403 Forbidden` を返す。

#### 実装方針

上記のパス検証とファイル制限は、各 API ルートで個別に実装するのではなく、Hono のミドルウェアとして `src/server/routes/middleware.ts` 内に共通処理として実装する。

---

## 6. 動作フロー

### 6.1 Phase 1 フロー

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
  │      ├─ REST API ルート登録（GET, PUT のみ）
  │      └─ ビルド済みフロントエンドを静的配信
  │
  ├─ 4. ブラウザを自動起動（localhost:4567）
  │
  └─ 5. ユーザー操作ループ
         ├─ ファイルツリーからファイル選択 → GET /api/files/:path{.+}
         ├─ エディタで編集 → リアルタイムプレビュー反映
         └─ Save ボタン → PUT /api/files/:path{.+} → ファイルに書き戻し
```

### 6.2 Phase 2 フロー（Phase 1 に追加される要素）

```
  ├─ 3. Hono サーバーを起動
  │      ├─ REST API ルート登録（POST, DELETE, GET /api/templates を追加）
  │      ├─ SSE エンドポイント登録
  │      └─ chokidar でファイルウォッチ開始
  │
  └─ 5. ユーザー操作ループ（追加分）
         ├─ 外部で変更 → chokidar 検知 → SSE で通知 → ブラウザ自動更新
         ├─ + New → テンプレート選択 → POST /api/files → 作成してエディタで開く
         └─ 削除 → 確認ダイアログ → DELETE /api/files/:path{.+}
```

### 6.3 watcher → SSE モジュール間通信 **〔Phase 2〕**

`watcher.ts` と `sse.ts` 間の通信には Node.js 標準の `EventEmitter` パターンを採用する。

1. `watcher.ts` が `EventEmitter` のインスタンスを公開する
2. `sse.ts` が起動時にそのインスタンスのイベントを購読する
3. ファイル変更検知時、`watcher.ts` がイベントを emit し、`sse.ts` が接続中の全クライアントに SSE メッセージを配信する

複数クライアントが同時に SSE 接続している場合は、全接続に対して同一イベントをブロードキャストする。

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

### 8.4 削除時の確認 **〔Phase 2〕**

ファイル削除時は確認ダイアログを表示する。

---

## 9. 外部変更の競合ハンドリング — フロー **〔Phase 2〕**

1. chokidar がファイル変更を検知
2. SSE で `file:changed` イベントをブラウザに通知
3. ブラウザ側で未保存の変更があるかチェック
   - **未保存の変更なし:** エディタとプレビューを自動更新
   - **未保存の変更あり:** 警告ダイアログを表示し、「外部の変更を取り込む（自分の変更を破棄）」または「自分の変更を維持」を選択させる

---

## 10. テンプレート内容例 **〔Phase 2〕**

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

### 10.2 Basic Command

```markdown
---
description: [Brief description of what this command does]
---

# [Command Name]

[Detailed instructions for the AI agent when this command is invoked]

## Steps

1. [Step 1]
2. [Step 2]
3. [Step 3]

## Constraints

- [Constraint 1]
- [Constraint 2]
```

---

## 11. 実装単位（Phase 1）

Phase 1 の実装を以下の 10 ユニットに分割する。各ユニットは独立してテスト可能な境界を持ち、依存ユニットの完了後に着手できる。

### 依存グラフ

```
U1 プロジェクト初期化
 └─ U2 共有型・定数
     ├─ U3 Scanner サービス ─────┐
     ├─ U4 セキュリティミドルウェア ─┤
     │                          ▼
     │                    U5 REST API + サーバー
     │                     └─ U6 CLI
     └─ U7 フロントエンド基盤
         ├─ U8 Explorer
         ├─ U9 Editor + Preview
         │   │
         ▼   ▼
       U10 画面統合
```

> U3 / U4 は互いに独立しており並行実装可能。U8 / U9 も同様。

---

### U1: プロジェクト初期化

| 項目 | 内容 |
|------|------|
| 対象ファイル | `package.json`, `tsconfig.json`, `tsconfig.cli.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `.eslintrc.*`, `.prettierrc` |
| 依存 | なし |
| 境界 | — |
| 完了条件 | `pnpm install` が成功する。`pnpm run build` が空のフロントエンドをビルドできる。`pnpm test` が Vitest を起動できる（テスト 0 件で正常終了） |

**実装メモ:**
- `package.json` の `bin` フィールドに CLI エントリポイントを定義（実体は U6 で実装）
- `vite.config.ts` に `server.proxy` 設定（`/api` → Hono サーバー）を含める（§4 参照）
- `tsconfig.cli.json` は `src/cli/` と `src/server/` と `src/shared/` を対象とする

---

### U2: 共有型・定数

| 項目 | 内容 |
|------|------|
| 対象ファイル | `src/shared/types.ts`, `src/shared/constants.ts` |
| 依存 | U1 |
| 境界 | 他のすべてのユニットがインポートする型と定数を提供する |
| 完了条件 | `FileCategory`, `FileNode`, `FileTree`, `ApiError` の型が定義されている。パスパターン（`CLAUDE.md`, `.claude/skills/**/SKILL.md`, `.claude/commands/*.md`）の定数が定義されている |

**実装メモ:**
- §5.3 の型定義をそのまま実装する
- `constants.ts` にはパスパターンの glob 文字列、カテゴリラベル等を定義する

---

### U3: Scanner サービス

| 項目 | 内容 |
|------|------|
| 対象ファイル | `src/server/services/scanner.ts` + テスト |
| 依存 | U2 |
| 入力 | プロジェクトルートの絶対パス（`string`） |
| 出力 | `FileTree` |
| 完了条件 | 以下のテストが通る: (1) skills / commands / CLAUDE.md を正しく検出する (2) `FileNode.name` が §5.3 の導出ルールに従う (3) `FileNode.description` が §5.3 の抽出ルールに従う（skill: 見出し直後の段落、command: frontmatter の description） (4) skills は `path` の辞書順、commands は `name` の辞書順でソートされる (5) 対象ファイルが存在しない場合に空の `FileTree` を返す |

**実装メモ:**
- `glob` または `fs.readdir` + 再帰でファイルを検出する
- Markdown パース（description 抽出）は正規表現ベースの軽量実装で十分。フル Markdown パーサーは不要
- コマンドの frontmatter 解析: ファイル先頭の `---` ～ `---` ブロックを抽出し、`description:` 行の値を取得する

---

### U4: セキュリティミドルウェア

| 項目 | 内容 |
|------|------|
| 対象ファイル | `src/server/routes/middleware.ts` + テスト |
| 依存 | U2 |
| 入力 | Hono の `Context`（リクエストパスを含む） |
| 出力 | 検証通過 → `next()` / 検証失敗 → `403 Forbidden`（`ApiError` 形式） |
| 完了条件 | 以下のテストが通る: (1) `../` を含むパスを 403 で拒否する (2) ホワイトリスト外のパス（例: `src/index.ts`）を 403 で拒否する (3) `CLAUDE.md`, `.claude/skills/x/SKILL.md`, `.claude/commands/x.md` を通過させる |

**実装メモ:**
- §5.5 のパストラバーサル防止 + 対象ファイル制限の 2 段階検証を 1 つのミドルウェア関数にまとめる
- プロジェクトルートパスはミドルウェア生成時に注入する（クロージャまたはファクトリ関数）

---

### U5: REST API + サーバー

| 項目 | 内容 |
|------|------|
| 対象ファイル | `src/server/routes/api.ts`, `src/server/index.ts`, `src/server/types.ts` + テスト |
| 依存 | U3, U4 |
| 入力 | HTTP リクエスト |
| 出力 | §5.1 に準拠した HTTP レスポンス |
| 完了条件 | 以下のテストが通る: (1) `GET /api/files` → `FileTree` を返す (2) `GET /api/files/:path` → `{ content, updatedAt }` を返す (3) `PUT /api/files/:path` → ファイルに書き込み `{ updatedAt }` を返す (4) 存在しないパスに 404 を返す (5) ミドルウェアが適用されている（403 ケース） |

**実装メモ:**
- `src/server/index.ts` は Hono アプリを生成・エクスポートする関数とする。`@hono/node-server` による `serve()` 呼び出しは CLI 側（U6）で行う
- テストでは `app.request()` を使い、実際の HTTP サーバーを起動せずにルートをテストする
- ビルド済みフロントエンドの静的配信設定もこのユニットに含める（`hono/serve-static` 等）

---

### U6: CLI エントリポイント

| 項目 | 内容 |
|------|------|
| 対象ファイル | `src/cli/index.ts`, `src/cli/args.ts`, `src/cli/open-browser.ts` |
| 依存 | U5 |
| 入力 | コマンドライン引数（`--port`, `--root`, `--no-open`, `--host`） |
| 出力 | Hono サーバーの起動 + ブラウザ自動起動 |
| 完了条件 | (1) `--port`, `--root`, `--no-open`, `--host` の引数が正しく解析される (2) サーバーが起動しターミナルに URL が表示される (3) `--no-open` 指定時にブラウザが起動しない (4) ポートが使用中の場合に +1 でフォールバックする |

**実装メモ:**
- Commander.js で引数を定義する
- ブラウザ起動には `open` パッケージを使用する
- ポートフォールバック: `serve()` が `EADDRINUSE` を返した場合にポート +1 で再試行する

---

### U7: フロントエンド基盤

| 項目 | 内容 |
|------|------|
| 対象ファイル | `src/app/main.tsx`, `src/app/App.tsx`, `src/app/contexts/AppContext.tsx`, `src/app/hooks/useFileApi.ts`, `src/app/styles/` |
| 依存 | U2 |
| 境界 | 以下の状態と関数をコンポーネントツリーに提供する |
| 完了条件 | (1) `AppContext` が `FileTree`、選択中ファイルパス、エディタ内容、ダーティフラグを管理する (2) `useFileApi` が `GET /api/files`, `GET /api/files/:path`, `PUT /api/files/:path` を呼び出せる (3) `App.tsx` が空のレイアウト（Explorer / Editor / Preview の配置枠）をレンダリングする (4) Tailwind CSS が適用されている |

**`AppContext` が管理する状態:**

| 状態 | 型 | 説明 |
|------|----|------|
| `fileTree` | `FileTree \| null` | ファイルツリー |
| `selectedPath` | `string \| null` | 選択中ファイルの相対パス |
| `content` | `string` | エディタ上の現在の内容 |
| `savedContent` | `string` | 最後に保存 / 読み込みした内容 |
| `isDirty` | `boolean` | `content !== savedContent` |

---

### U8: Explorer コンポーネント

| 項目 | 内容 |
|------|------|
| 対象ファイル | `src/app/components/Explorer.tsx` |
| 依存 | U7 |
| 入力 | `AppContext` から `fileTree`, `selectedPath` |
| 出力 | ファイル選択イベント（`selectedPath` を更新） |
| 完了条件 | (1) CLAUDE.md / Skills / Commands のカテゴリ別にファイルを表示する (2) §5.4 のネストスキル表示名ルール（name 重複時の親パス付与）が正しく動作する (3) カテゴリはデフォルトで展開状態 (4) 選択中ファイルがハイライトされる |

---

### U9: Editor + Preview コンポーネント

| 項目 | 内容 |
|------|------|
| 対象ファイル | `src/app/components/Editor.tsx`, `src/app/components/Preview.tsx` |
| 依存 | U7 |
| 入力 | `AppContext` から `content` |
| 出力 | Editor: `content` の更新 / Preview: Markdown レンダリング |
| 完了条件 | (1) CodeMirror 6 が Markdown シンタックスハイライト付きで表示される (2) エディタ入力が `AppContext.content` を更新する (3) Preview が `content` を react-markdown + remark-gfm でレンダリングする (4) エディタ入力からプレビュー反映までの遅延が 100ms 以下（§8.1 デバウンス） |

---

### U10: 画面統合

| 項目 | 内容 |
|------|------|
| 対象ファイル | `src/app/components/SplitView.tsx`, `src/app/App.tsx`（更新） |
| 依存 | U8, U9 |
| 入力 | Explorer / Editor / Preview の各コンポーネント |
| 出力 | §4（requirements.md）のレイアウトに準拠した統合画面 |
| 完了条件 | (1) Explorer + Editor + Preview が §4 のレイアウト通り配置される (2) Editor と Preview の分割比率が 50:50 (3) Save ボタンが `PUT /api/files/:path` を呼び出し、成功時にダーティフラグをリセットする (4) Revert ボタンが `savedContent` にエディタ内容を戻す (5) Ctrl+S / Cmd+S で保存できる (6) 未保存変更時のファイル切り替えで確認ダイアログが表示される（§8.2） (7) 未保存変更時のブラウザ離脱で `beforeunload` 確認が表示される（§8.3） (8) 対象ファイルが 0 件の場合に空状態ガイダンスが表示される（§4.4）  |
