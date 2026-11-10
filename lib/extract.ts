/**
 * 规则提取器：没有配置大模型 Key 时的兜底，也是大模型调用失败后的安全网。
 * 它只会认常见的面料辅料写法，识别不了的产品会明确进入「阻断」，而不是猜。
 */

import {
  COLOR_SWATCHES,
  inferSpec,
  isGenericProduct,
  matchFamily,
} from "./catalog";
import type { Extraction, ExtractedItem } from "./types";

const CLAUSE_SPLIT = /[，,。；;\n]+/;
const UNIT_PATTERN = "米|粒|个|条|卷|码|件|套|公斤|千克|kg";

function detectCustomer(text: string): string {
  const match = text.match(
    /(?:^|[，,。；;：:\s])([一-龥]{1,2}(?:经理|总|女士|先生|老板|姐|哥))/,
  );
  return match?.[1] ?? "";
}

function detectDeliveryDays(text: string): number | null {
  const match =
    text.match(/(?:交期|货期|交货期|工期)[^\d]{0,6}(\d{1,3})\s*(?:天|个工作日)/) ??
    text.match(/(\d{1,3})\s*(?:天|个工作日)\s*(?:内)?(?:交货|交期|发货)/);
  if (!match) return null;
  const days = Number(match[1]);
  return Number.isFinite(days) ? days : null;
}

function detectNotes(text: string): string {
  const match = text.match(/(?:备注|注意|特殊要求)[:：]\s*([^，,。；;\n]+)/);
  return match?.[1].trim() ?? "";
}

function parseQty(text: string): number | null {
  const withUnit = text.match(
    new RegExp(
      `(\\d+(?:,\\d{3})*(?:\\.\\d+)?)\\s*(万)?\\s*(?:${UNIT_PATTERN})`,
      "i",
    ),
  );
  if (withUnit) {
    const base = Number(withUnit[1].replace(/,/g, ""));
    return withUnit[2] ? base * 10000 : base;
  }

  const labelled = text.match(
    /(?:数量|需要|要|共)\s*[:：]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/,
  );
  if (labelled) return Number(labelled[1].replace(/,/g, ""));
  return null;
}

function parseColor(text: string): string {
  // 先认白名单里的颜色，输出标准色号
  const known = COLOR_SWATCHES.find((swatch) =>
    swatch.aliases.some((alias) => text.includes(alias)),
  );
  if (known) return known.code;

  // 「色号 PANTONE-19-4052」这类编码
  const code = text.match(
    /(?:色号|颜色)[^，,。；;\n]{0,10}?([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)/,
  );
  if (code) return code[1];

  // 「定制蓝色」这类非标颜色原样保留，报价时会提示需要确认；
  // 先把「颜色 / 色号 / 色卡」这些提示词去掉，避免把「颜色」本身当颜色
  const cleaned = text.replace(/颜色|色号|色卡/g, "");
  const generic = cleaned.match(/([一-龥]{1,3}色)/);
  return generic?.[1] ?? "";
}

function parseUnit(text: string): string {
  const match = text.match(
    /米|粒|个|条|卷|码|件|套|公斤|千克|kg/i,
  );
  return match?.[0] ?? "";
}

export function extractWithRules(text: string): Extraction {
  const customer = detectCustomer(text);
  const deliveryDays = detectDeliveryDays(text);
  const notes = detectNotes(text);
  const clauses = text
    .split(CLAUSE_SPLIT)
    .map((clause) => clause.trim())
    .filter(Boolean);

  const items: ExtractedItem[] = [];

  for (const clause of clauses) {
    const family = matchFamily(clause);
    const qty = parseQty(clause);
    const color = parseColor(clause);
    const spec = inferSpec(clause);

    if (family) {
      const sku = spec ? (family.specMap[spec] ?? "") : "";
      items.push({
        sku,
        product: family.name,
        spec,
        color,
        qty,
        unit: parseUnit(clause),
        notes: "",
      });
      continue;
    }

    // 「黑色」「5000 米」被逗号拆到了下一小句时，补到上一行
    const last = items[items.length - 1];
    if (last && (color || qty !== null) && !isGenericProduct(clause)) {
      if (!last.color && color) last.color = color;
      if (last.qty === null && qty !== null) last.qty = qty;
      continue;
    }

    // 只说了「装饰扣」「拉链」没给材质型号 → 生成待确认行，绝不能瞎猜
    if (isGenericProduct(clause)) {
      const product = clause
        .replace(
          /(?:另外|我们|客户|想要|需要|要|一批|一些|请|帮我|麻烦|报个?价|报价)/g,
          "",
        )
        .trim();
      items.push({
        sku: "",
        product: product || "未识别产品",
        spec,
        color,
        qty,
        unit: parseUnit(clause),
        notes: "",
      });
    }
  }

  return { customer, deliveryDays, notes, items };
}
