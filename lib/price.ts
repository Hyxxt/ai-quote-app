/**
 * 确定性报价引擎：只查表、算钱、列风险，不调用任何模型。
 * 输入是「已提取的结构化需求」，输出可以直接给客户看的报价单和待确认项。
 */

import {
  CATALOG,
  VALID_COLORS,
  normalizeColor,
  resolveSku,
} from "./catalog";
import type { Extraction, Quote, QuoteLine } from "./types";

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits }).format(value);
}

export function priceQuote(extraction: Extraction): {
  quote: Quote;
  issues: string[];
  hasBlocker: boolean;
} {
  const issues: string[] = [];
  const lines: QuoteLine[] = [];
  let total = 0;

  if (extraction.items.length === 0) {
    issues.push("【阻断】没有识别出任何产品行，请人工确认客户到底要什么");
  }
  if (!extraction.customer) {
    issues.push("【待确认】客户名称未识别，报价单抬头需补");
  }

  extraction.items.forEach((item, index) => {
    const lineNo = index + 1;
    const color = normalizeColor(item.color);
    const sku = resolveSku(item);
    const catalogItem = sku ? CATALOG[sku] : undefined;

    // 型号不认识 → 不出价
    if (!catalogItem) {
      issues.push(
        `【阻断】第 ${lineNo} 行型号「${item.sku || item.product || "空"}」不在价目表内，无法报价，需确认是哪个产品`,
      );
      lines.push({
        line: lineNo,
        sku: item.sku || "待确认",
        name: "未知型号",
        spec: item.spec || item.product || "未识别",
        color: color || "待定",
        qty: item.qty,
        unit: item.unit,
        price: null,
        amount: null,
        status: "缺价",
      });
      return;
    }

    // 数量缺失 → 不出价
    const qty =
      typeof item.qty === "number" && Number.isFinite(item.qty) && item.qty > 0
        ? item.qty
        : null;

    if (qty === null) {
      issues.push(`【待确认】第 ${lineNo} 行「${catalogItem.name}」没有数量，需客户补充`);
      lines.push({
        line: lineNo,
        sku: catalogItem.sku,
        name: catalogItem.name,
        spec: catalogItem.spec,
        color: color || "待定",
        qty: null,
        unit: catalogItem.unit,
        price: catalogItem.price,
        amount: null,
        status: "缺数量",
      });
      return;
    }

    const amount = round2(qty * catalogItem.price);
    total = round2(total + amount);

    // 低于起订量 → 照常报价，但要提示
    if (qty < catalogItem.moq) {
      issues.push(
        `【待确认】第 ${lineNo} 行「${catalogItem.name} ${catalogItem.spec}」数量 ${formatNumber(qty, 2)}${catalogItem.unit} 低于起订量 ${formatNumber(catalogItem.moq)}${catalogItem.unit}，需确认是否加收小单费`,
      );
    }

    // 色号不在白名单 → 提示
    if (color && !VALID_COLORS.has(color)) {
      issues.push(
        `【待确认】第 ${lineNo} 行色号「${color}」不在色卡内，新色号需先确认能否做`,
      );
    }

    if (item.notes) {
      issues.push(`【客户备注】第 ${lineNo} 行：${item.notes}`);
    }

    lines.push({
      line: lineNo,
      sku: catalogItem.sku,
      name: catalogItem.name,
      spec: catalogItem.spec,
      color: color || "待定",
      qty,
      unit: catalogItem.unit,
      price: catalogItem.price,
      amount,
      status: "正常",
    });
  });

  if (extraction.deliveryDays !== null && extraction.deliveryDays !== undefined) {
    issues.push(
      `【客户要求】交期 ${formatNumber(extraction.deliveryDays)} 天，需确认排产能否满足`,
    );
  }

  const quote: Quote = {
    customer: extraction.customer || "未识别",
    lines,
    total,
    currency: "CNY",
    taxIncluded: true,
    notes: extraction.notes,
    deliveryDays: extraction.deliveryDays,
  };

  return {
    quote,
    issues,
    hasBlocker: issues.some((issue) => issue.startsWith("【阻断】")),
  };
}
