/** 领域类型：前后端共用，全部可 JSON 序列化 */

export type ExtractedItem = {
  /** 命中的价目表 SKU；为空表示没认出来，后端会判为「阻断」 */
  sku: string;
  /** 原文里的产品名，用于展示和兜底匹配 */
  product: string;
  spec: string;
  color: string;
  qty: number | null;
  unit: string;
  notes: string;
};

export type Extraction = {
  customer: string;
  deliveryDays: number | null;
  notes: string;
  items: ExtractedItem[];
};

export type QuoteLineStatus = "正常" | "缺数量" | "缺价";

export type QuoteLine = {
  line: number;
  sku: string;
  name: string;
  spec: string;
  color: string;
  qty: number | null;
  unit: string;
  price: number | null;
  amount: number | null;
  status: QuoteLineStatus;
};

export type Quote = {
  customer: string;
  lines: QuoteLine[];
  total: number;
  currency: "CNY";
  taxIncluded: boolean;
  notes: string;
  deliveryDays: number | null;
};

/** llm = 大模型提取；rule = 无 Key / 调用失败时的规则兜底 */
export type ExtractMode = "llm" | "rule";

export type QuoteResponse = {
  id: number;
  mode: ExtractMode;
  extractorNote?: string;
  quote: Quote;
  issues: string[];
  hasBlocker: boolean;
};

export type QuoteRecord = QuoteResponse & {
  createdAt: string;
  sourceText: string;
};
