/**
 * SQLite 持久化：每次报价存一条完整快照（原文 + 报价 + 待确认项）。
 * 使用 Node 内置的 node:sqlite，不依赖任何原生扩展。
 */

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
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

let database: DatabaseSync | null = null;

function getDatabase(): DatabaseSync {
  if (database) return database;

  const directory =
    process.env.QUOTE_DB_DIR?.trim() || path.join(process.cwd(), ".data");
  mkdirSync(directory, { recursive: true });

  database = new DatabaseSync(path.join(directory, "quotes.db"));
  database.exec(`
    PRAGMA journal_mode = WAL;
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
    );
    CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC);
  `);

  return database;
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

export function saveQuote(input: SaveQuoteInput): number {
  const statement = getDatabase().prepare(`
    INSERT INTO quotes
      (created_at, customer, total, has_blocker, mode, extractor_note, source_text, quote_json, issues_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = statement.run(
    new Date().toISOString(),
    input.customer,
    input.total,
    input.hasBlocker ? 1 : 0,
    input.mode,
    input.extractorNote ?? null,
    input.sourceText,
    JSON.stringify(input.quote),
    JSON.stringify(input.issues),
  );

  return Number(result.lastInsertRowid);
}

export function listQuotes(limit = 10): QuoteRecord[] {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const rows = getDatabase()
    .prepare(`
      SELECT id, created_at, customer, total, has_blocker, mode, extractor_note, source_text, quote_json, issues_json
      FROM quotes
      ORDER BY id DESC
      LIMIT ?
    `)
    .all(safeLimit) as unknown as QuoteRow[];

  return rows.map((row) => {
    const mode: ExtractMode = row.mode === "llm" ? "llm" : "rule";
    return {
      id: Number(row.id),
      createdAt: row.created_at,
      customer: row.customer,
      total: row.total,
      hasBlocker: Number(row.has_blocker) === 1,
      mode,
      extractorNote: row.extractor_note ?? undefined,
      sourceText: row.source_text,
      quote: JSON.parse(row.quote_json) as Quote,
      issues: JSON.parse(row.issues_json) as string[],
    };
  });
}
