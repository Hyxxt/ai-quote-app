/**
 * 价目表与编码规则。
 *
 * 关键设计：价格只存在于这份配置里，大模型只负责「提取」，不负责「报价」。
 * 模型即使被提示词诱导，也无法编出一个价目表里没有的价格。
 */

import type { ExtractedItem } from "./types";

export type CatalogItem = {
  sku: string;
  name: string;
  spec: string;
  unit: string;
  price: number;
  moq: number;
};

export const CATALOG: Record<string, CatalogItem> = {
  "NYL-3#": { sku: "NYL-3#", name: "尼龙拉链", spec: "3#", unit: "米", price: 1.2, moq: 1000 },
  "NYL-5#": { sku: "NYL-5#", name: "尼龙拉链", spec: "5#", unit: "米", price: 1.65, moq: 1000 },
  "RSN-5#": { sku: "RSN-5#", name: "树脂拉链", spec: "5#", unit: "米", price: 2.8, moq: 800 },
  "RSN-8#": { sku: "RSN-8#", name: "树脂拉链", spec: "8#", unit: "米", price: 3.9, moq: 500 },
  "MTL-5#": { sku: "MTL-5#", name: "金属拉链", spec: "5#", unit: "米", price: 4.5, moq: 500 },
  "BTN-4H-15": { sku: "BTN-4H-15", name: "树脂四眼扣", spec: "15mm", unit: "粒", price: 0.085, moq: 5000 },
  "BTN-4H-18": { sku: "BTN-4H-18", name: "树脂四眼扣", spec: "18mm", unit: "粒", price: 0.11, moq: 5000 },
  "BTN-SNAP-12": { sku: "BTN-SNAP-12", name: "金属四合扣", spec: "12mm", unit: "粒", price: 0.42, moq: 2000 },
  "TAPE-COT-25": { sku: "TAPE-COT-25", name: "棉织带", spec: "25mm", unit: "米", price: 0.95, moq: 2000 },
  "TAPE-PLY-20": { sku: "TAPE-PLY-20", name: "涤纶织带", spec: "20mm", unit: "米", price: 0.62, moq: 3000 },
  "TAPE-PLY-32": { sku: "TAPE-PLY-32", name: "涤纶织带", spec: "32mm", unit: "米", price: 0.88, moq: 2000 },
};

export type ColorSwatch = {
  code: string;
  label: string;
  aliases: string[];
};

export const COLOR_SWATCHES: ColorSwatch[] = [
  { code: "BLK-01", label: "黑色", aliases: ["黑色", "黑", "BLK-01"] },
  { code: "WHT-02", label: "白色", aliases: ["白色", "白", "WHT-02"] },
  { code: "NVY-03", label: "藏青", aliases: ["藏青", "藏青色", "深蓝", "NVY-03"] },
  { code: "RED-04", label: "红色", aliases: ["红色", "红", "RED-04"] },
  { code: "BEG-05", label: "米色", aliases: ["米色", "米白", "杏色", "BEG-05"] },
  { code: "GRY-06", label: "灰色", aliases: ["灰色", "灰", "GRY-06"] },
  { code: "OLV-07", label: "军绿", aliases: ["军绿", "军绿色", "橄榄绿", "OLV-07"] },
  { code: "BRN-08", label: "棕色", aliases: ["棕色", "咖啡色", "棕", "BRN-08"] },
];

export const VALID_COLORS = new Set(COLOR_SWATCHES.map((c) => c.code));

/** 把「黑色 / BLK-01 / 未识别」统一成色号；认不出的原样返回，交给价目表逻辑提示 */
export function normalizeColor(raw: string): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  const upper = value.toUpperCase();
  if (upper === "NONE" || upper === "NULL" || value === "未识别") return "";
  if (VALID_COLORS.has(upper)) return upper;
  const hit = COLOR_SWATCHES.find((c) => c.aliases.some((alias) => value.includes(alias)));
  return hit ? hit.code : value;
}

/** 「5号 / 5 # / 5」→ 5#；「18毫米 / 18MM」→ 18mm */
export function normalizeSpec(raw: string): string {
  const value = (raw ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!value) return "";
  const hashed = value.match(/^(\d+(?:\.\d+)?)(?:#|号)$/);
  if (hashed) return `${Number(hashed[1])}#`;
  const millimetres = value.match(/^(\d+(?:\.\d+)?)(?:mm|毫米)$/);
  if (millimetres) return `${Number(millimetres[1])}mm`;
  return value;
}

/** 从一段话里推断规格：优先毫米（扣子/织带），否则 #（拉链） */
export function inferSpec(text: string): string {
  const millimetres = text.match(/(\d+(?:\.\d+)?)\s*(?:mm|毫米)/i);
  if (millimetres) return `${Number(millimetres[1])}mm`;
  const hashed = text.match(/(\d+(?:\.\d+)?)\s*(?:#|号(?!码))/);
  if (hashed) return `${Number(hashed[1])}#`;
  return "";
}

type ProductFamily = {
  test: RegExp;
  name: string;
  specMap: Record<string, string>;
};

const FAMILIES: ProductFamily[] = [
  { test: /尼龙.*拉链|拉链.*尼龙/, name: "尼龙拉链", specMap: { "3#": "NYL-3#", "5#": "NYL-5#" } },
  { test: /树脂.*拉链|拉链.*树脂/, name: "树脂拉链", specMap: { "5#": "RSN-5#", "8#": "RSN-8#" } },
  { test: /金属.*拉链|拉链.*金属/, name: "金属拉链", specMap: { "5#": "MTL-5#" } },
  { test: /树脂.*(?:四眼扣|四眼)|四眼扣/, name: "树脂四眼扣", specMap: { "15mm": "BTN-4H-15", "18mm": "BTN-4H-18" } },
  { test: /金属.*四合扣|四合扣/, name: "金属四合扣", specMap: { "12mm": "BTN-SNAP-12" } },
  { test: /棉.*织带|棉织带/, name: "棉织带", specMap: { "25mm": "TAPE-COT-25" } },
  { test: /涤纶.*织带|涤纶织带/, name: "涤纶织带", specMap: { "20mm": "TAPE-PLY-20", "32mm": "TAPE-PLY-32" } },
];

export function matchFamily(text: string): ProductFamily | null {
  return FAMILIES.find((family) => family.test.test(text)) ?? null;
}

/** 只说了「扣子 / 拉链 / 织带」但没说材质和型号 */
export function isGenericProduct(text: string): boolean {
  return /扣子|纽扣|装饰扣|拉链|织带|四合扣|四眼扣/.test(text);
}

/**
 * 把模型/规则吐出的产品行对齐到价目表 SKU。
 * 认不出来就返回空字符串，绝不猜价格。
 */
export function resolveSku(item: ExtractedItem): string {
  const requested = (item.sku ?? "").trim().toUpperCase();
  if (CATALOG[requested]) return requested;

  const text = `${item.product} ${item.spec} ${item.notes}`;
  const family = matchFamily(text);
  const spec = normalizeSpec(item.spec) || inferSpec(text);
  if (family && spec && family.specMap[spec]) return family.specMap[spec];

  if (spec) {
    const hit = Object.values(CATALOG).find(
      (catalogItem) =>
        normalizeSpec(catalogItem.spec) === spec &&
        (item.product.includes(catalogItem.name) || catalogItem.name.includes(item.product)),
    );
    if (hit) return hit.sku;
  }

  return "";
}
