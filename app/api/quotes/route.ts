import { connection } from "next/server";
import { listQuotes, saveQuote } from "@/lib/db";
import { extractWithRules } from "@/lib/extract";
import { LlmUnavailableError, extractWithLlm } from "@/lib/llm";
import { priceQuote } from "@/lib/price";
import type { ExtractMode } from "@/lib/types";

function readText(payload: unknown): string {
  if (payload !== null && typeof payload === "object" && "text" in payload) {
    const value = (payload as { text?: unknown }).text;
    return typeof value === "string" ? value.trim() : "";
  }
  return "";
}

function wantsRuleMode(payload: unknown): boolean {
  if (process.env.USE_RULE_EXTRACTOR === "1") return true;
  return (
    payload !== null &&
    typeof payload === "object" &&
    (payload as { mock?: unknown }).mock === true
  );
}

export async function GET() {
  // 数据库查询依赖请求时的环境变量，显式标记为请求时执行
  await connection();
  return Response.json({ quotes: await listQuotes(10) });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const text = readText(payload);
  if (!text) {
    return Response.json({ error: "请先粘贴客户询价内容" }, { status: 400 });
  }
  if (text.length > 4000) {
    return Response.json(
      { error: "询价文本最多 4000 字，请拆分后再提交" },
      { status: 400 },
    );
  }

  let extraction;
  let mode: ExtractMode;
  let extractorNote: string | undefined;

  if (wantsRuleMode(payload)) {
    extraction = extractWithRules(text);
    mode = "rule";
  } else {
    try {
      extraction = await extractWithLlm(text);
      mode = "llm";
    } catch (error) {
      extraction = extractWithRules(text);
      mode = "rule";
      if (error instanceof LlmUnavailableError && error.code === "NO_KEY") {
        extractorNote =
          "未配置 LLM_API_KEY，本次使用内置规则解析；配置后会自动切换为大模型提取。";
      } else {
        extractorNote = `大模型调用失败，已回退到规则解析：${
          error instanceof Error ? error.message : "未知错误"
        }`;
      }
    }
  }

  const { quote, issues, hasBlocker } = priceQuote(extraction);
  const id = await saveQuote({
    customer: quote.customer,
    total: quote.total,
    hasBlocker,
    mode,
    extractorNote,
    sourceText: text,
    quote,
    issues,
  });

  return Response.json({
    id,
    mode,
    extractorNote,
    quote,
    issues,
    hasBlocker,
  });
}
