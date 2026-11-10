/**
 * 报价快照持久化。
 *
 * 本地默认使用 Node 内置的 node:sqlite（零配置）；
 * 部署到无持久磁盘的平台时，配置 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN，
 * 自动切换到 Turso 云数据库。两边都是 SQLite 语法，表结构完全一致。
 */

import { mkdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Client } from "@libsql/client";
import type { ExtractMode, Quote, QuoteRecord } from "./types";

type QuoteRow = {
  id: number | bigint;
  created_at: string;
  customer: string;
  total: number;
  has_blocker: number | bigint;
  mode: string;
  extractor_note: string | null;
  source_text: string;
  quote_json: string;
  issues_json: string;
};

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    customer TEXT NOT NULL,
    total REAL NOT NULL,
    has_blocker INTEGER NOT NULL,
    mode TEXT NOT NULL,
    extractor_note TEXT,
    source_text TEXT NOT NULL,
    quote_json TEXT NOT NULL,
    issues_json TEXT NOT NULL
  )
`;

const CREATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC)
`;

const INSERT_SQL = `
  INSERT INTO quotes
    (created_at, customer, total, has_blocker, mode, extractor_note, source_text, quote_json, issues_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const SELECT_SQL = `
  SELECT id, created_at, customer, total, has_blocker, mode, extractor_note, source_text, quote_json, issues_json
  FROM quotes
  ORDER BY id DESC
  LIMIT ?
`;

let localDbPromise: Promise<DatabaseSync> | null = null;
let remoteClientPromise: Promise<Client> | null = null;

function tursoUrl(): string {
  return process.env.TURSO_DATABASE_URL?.trim() ?? "";
}

function isTursoEnabled(): boolean {
  return tursoUrl().length > 0;
}

async function getLocalDb(): Promise<DatabaseSync> {
  if (!localDbPromise) {
    localDbPromise = (async () => {
      const { DatabaseSync } = await import("node:sqlite");
      const directory =
        process.env.QUOTE_DB_DIR?.trim() || path.join(process.cwd(), ".data");
      mkdirSync(directory, { recursive: true });

      const database = new DatabaseSync(path.join(directory, "quotes.db"));
      database.exec("PRAGMA journal_mode = WAL;");
      database.exec(CREATE_TABLE_SQL);
      database.exec(CREATE_INDEX_SQL);
      return database;
    })();
  }
  return localDbPromise;
}

async function getRemoteClient(): Promise<Client> {
  if (!remoteClientPromise) {
    remoteClientPromise = (async () => {
      // 只加载 web 客户端：走 HTTPS，不依赖原生扩展，适合 Vercel 等 Serverless 环境
      const { createClient } = await import("@libsql/client/web");
      const client = createClient({
        url: tursoUrl(),
        authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
      });
      await client.execute(CREATE_TABLE_SQL);
      await client.execute(CREATE_INDEX_SQL);
      return client;
    })();
  }
  return remoteClientPromise;
}

function mapRow(row: QuoteRow): QuoteRecord {
  const mode: ExtractMode = row.mode === "llm" ? "llm" : "rule";
  return {
    id: Number(row.id),
    createdAt: String(row.created_at),
    hasBlocker: Number(row.has_blocker) === 1,
    mode,
    extractorNote:
      row.extractor_note === null ? undefined : String(row.extractor_note),
    sourceText: String(row.source_text),
    quote: JSON.parse(String(row.quote_json)) as Quote,
    issues: JSON.parse(String(row.issues_json)) as string[],
  };
}

export type SaveQuoteInput = {
  customer: string;
  total: number;
  hasBlocker: boolean;
  mode: ExtractMode;
  extractorNote?: string;
  sourceText: string;
  quote: Quote;
  issues: string[];
};

export async function saveQuote(input: SaveQuoteInput): Promise<number> {
  const values: (string | number | null)[] = [
    new Date().toISOString(),
    input.customer,
    input.total,
    input.hasBlocker ? 1 : 0,
    input.mode,
    input.extractorNote ?? null,
    input.sourceText,
    JSON.stringify(input.quote),
    JSON.stringify(input.issues),
  ];

  if (isTursoEnabled()) {
    const client = await getRemoteClient();
    const result = await client.execute({ sql: INSERT_SQL, args: values });
    return Number(result.lastInsertRowid ?? 0);
  }

  const statement = (await getLocalDb()).prepare(INSERT_SQL);
  const result = statement.run(...values);
  return Number(result.lastInsertRowid);
}

export async function listQuotes(limit = 10): Promise<QuoteRecord[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);

  if (isTursoEnabled()) {
    const client = await getRemoteClient();
    const result = await client.execute({ sql: SELECT_SQL, args: [safeLimit] });
    return result.rows.map((row) => mapRow(row as unknown as QuoteRow));
  }

  const rows = (await getLocalDb())
    .prepare(SELECT_SQL)
    .all(safeLimit) as unknown as QuoteRow[];
  return rows.map(mapRow);
}
