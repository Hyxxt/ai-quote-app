"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  colorLabel,
  formatAmount,
  formatDateTime,
  formatPrice,
  formatQty,
} from "@/lib/format";
import type { QuoteRecord, QuoteResponse } from "@/lib/types";

const SAMPLES = [
  {
    label: "标准询价",
    text: "张经理，我们下季要尼龙5号拉链黑色 5000 米，另外树脂四眼扣18mm 8000 粒，交期 20 天，麻烦报个价。",
  },
  {
    label: "新色号",
    text: "李女士，客户要金属四合扣12mm 3000 粒，颜色用定制蓝色，另外棉织带25mm 6000 米，交期 15 天。",
  },
  {
    label: "信息缺失",
    text: "王总，需要尼龙5号拉链黑色 5000 米，另外想要一批装饰扣，数量还没定，请报价。",
  },
];

function issueTone(issue: string) {
  if (issue.startsWith("【阻断】")) {
    return { wrap: "border-rose-200 bg-rose-50 text-rose-800", dot: "bg-rose-500" };
  }
  if (issue.startsWith("【待确认】")) {
    return { wrap: "border-amber-200 bg-amber-50 text-amber-900", dot: "bg-amber-500" };
  }
  return { wrap: "border-sky-200 bg-sky-50 text-sky-900", dot: "bg-sky-500" };
}

function buildQuoteText(result: QuoteResponse): string {
  const { quote, issues, hasBlocker } = result;
  return [
    `报价对象：${quote.customer}`,
    "",
    ...quote.lines.map(
      (line) =>
        `${line.line}. ${line.name} ${line.spec}｜${colorLabel(line.color)}｜${formatQty(
          line.qty,
        )}${line.unit} × ${formatPrice(line.price)} = ${
          line.amount === null ? "待确认" : `¥${formatAmount(line.amount)}`
        }`,
    ),
    "",
    `合计：¥${formatAmount(quote.total)}（含税）`,
    ...(quote.deliveryDays !== null
      ? [`交期：${quote.deliveryDays} 天（待确认）`]
      : []),
    hasBlocker ? "状态：有阻断项，需人工确认后才能对外报价" : "状态：可进入人工复核",
    ...(issues.length ? ["", "待确认项：", ...issues] : []),
  ].join("\n");
}

function ModeBadge({ mode }: { mode: QuoteResponse["mode"] }) {
  const llm = mode === "llm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        llm ? "bg-violet-50 text-violet-700" : "bg-zinc-100 text-zinc-600"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${llm ? "bg-violet-500" : "bg-zinc-400"}`}
      />
      {llm ? "大模型提取" : "规则解析"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "正常") return null;
  return (
    <span
      className={`ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
        status === "缺价"
          ? "bg-rose-50 text-rose-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      {status}
    </span>
  );
}

function QuoteResult({ result }: { result: QuoteResponse }) {
  const { quote, issues, hasBlocker, extractorNote } = result;
  const [copied, setCopied] = useState(false);
  const blockerCount = issues.filter((issue) =>
    issue.startsWith("【阻断】"),
  ).length;

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(buildQuoteText(result));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {extractorNote && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          {extractorNote}
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl bg-zinc-50 px-4 py-3">
        <div>
          <p className="text-xs text-zinc-500">客户</p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-900">
            {quote.customer}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">合计（含税）</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight text-zinc-900">
            ¥{formatAmount(quote.total)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <table className="w-full min-w-[430px] text-left text-xs">
          <thead className="bg-zinc-50 text-[11px] text-zinc-500">
            <tr>
              <th className="px-2.5 py-2 font-medium">产品</th>
              <th className="px-2.5 py-2 font-medium">颜色</th>
              <th className="px-2.5 py-2 text-right font-medium">数量</th>
              <th className="px-2.5 py-2 text-right font-medium">单价</th>
              <th className="px-2.5 py-2 text-right font-medium">金额</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {quote.lines.map((line) => (
              <tr key={line.line} className="align-top">
                <td className="px-2.5 py-2.5">
                  <span className="mr-1.5 tabular-nums text-[10px] text-zinc-400">
                    {line.line}
                  </span>
                  <span className="font-medium text-zinc-900">{line.name}</span>
                  <span className="ml-1 text-[11px] text-zinc-500">
                    {line.spec || line.sku}
                  </span>
                  <StatusBadge status={line.status} />
                </td>
                <td className="whitespace-nowrap px-2.5 py-2.5 text-zinc-600">
                  {colorLabel(line.color)}
                </td>
                <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums text-zinc-700">
                  {formatQty(line.qty)}{" "}
                  <span className="text-[10px] text-zinc-400">{line.unit}</span>
                </td>
                <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums text-zinc-700">
                  {formatPrice(line.price)}
                </td>
                <td className="whitespace-nowrap px-2.5 py-2.5 text-right tabular-nums font-medium text-zinc-900">
                  {line.amount === null ? "—" : `¥${formatAmount(line.amount)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          hasBlocker
            ? "border-rose-200 bg-rose-50 text-rose-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}
      >
        {hasBlocker
          ? `有 ${blockerCount} 项阻断：报价前必须人工确认`
          : "没有阻断项，可进入人工复核"}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
          待确认 / 风险
        </p>
        {issues.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            无异常
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {issues.map((issue, index) => {
              const tone = issueTone(issue);
              return (
                <li
                  key={index}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-5 ${tone.wrap}`}
                >
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${tone.dot}`}
                  />
                  {issue}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={copySummary}
        className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:border-teal-300 hover:text-teal-800"
      >
        {copied ? "已复制到剪贴板" : "复制报价摘要"}
      </button>
    </div>
  );
}

function HistoryPanel({
  records,
  activeId,
  onSelect,
}: {
  records: QuoteRecord[];
  activeId?: number;
  onSelect: (record: QuoteRecord) => void;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            03 · 记录
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-900">最近报价</h2>
        </div>
        <span className="text-xs text-zinc-400">{records.length} 条</span>
      </div>

      {records.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-8 text-center text-sm text-zinc-500">
          还没有记录，提交第一条询价后会出现在这里。
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {records.map((record) => (
            <li key={record.id}>
              <button
                type="button"
                onClick={() => onSelect(record)}
                className={`flex w-full flex-col gap-1.5 rounded-lg px-2 py-3 text-left transition hover:bg-zinc-50 ${
                  activeId === record.id ? "bg-teal-50/70" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium text-zinc-800">
                    {record.quote.customer}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-zinc-700">
                    ¥{formatAmount(record.quote.total)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-zinc-400">
                    {formatDateTime(record.createdAt)}
                  </span>
                  <ModeBadge mode={record.mode} />
                  {record.hasBlocker && (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                      有阻断
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Home() {
  const [text, setText] = useState(SAMPLES[0].text);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuoteResponse | null>(null);
  const [history, setHistory] = useState<QuoteRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/quotes", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { quotes?: QuoteRecord[] };
      setHistory(Array.isArray(data.quotes) ? data.quotes : []);
    } catch {
      // 历史记录加载失败不影响主流程
    }
  }, []);

  useEffect(() => {
    // 首屏从接口拉取历史记录；setState 发生在 fetch 回调里，不是同步级联更新
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHistory();
  }, [loadHistory]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setError("请先输入客户询价内容");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = (await response.json()) as QuoteResponse & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || `请求失败（${response.status}）`);
      }
      setResult(data);
      void loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:py-12">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-700 text-lg font-semibold text-white shadow-sm">
            报
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
                AI 报价工作台
              </h1>
              <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800">
                AI 应用自测项目
              </span>
            </div>
            <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-600">
              把客户的一口语询价，变成可核对的报价单。大模型负责提取需求，确定性代码负责查价、算钱和列出风险。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
          {["Next.js + TypeScript", "LLM 结构化输出", "SQLite"].map(
            (label) => (
              <span
                key={label}
                className="rounded-full border border-zinc-200 bg-white px-2.5 py-1"
              >
                {label}
              </span>
            ),
          )}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="flex min-w-0 flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                01 · 输入
              </p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-900">
                客户询价
              </h2>
            </div>
            <span className="text-xs text-zinc-400">{text.length}/4000</span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
            <label htmlFor="inquiry" className="sr-only">
              客户询价内容
            </label>
            <textarea
              id="inquiry"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={10}
              maxLength={4000}
              placeholder="粘贴客户微信原文，例如：张经理，要尼龙5号拉链黑色5000米，交期20天……"
              className="min-h-56 w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm leading-7 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
            />

            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500">试试示例</p>
              <div className="flex flex-wrap gap-2">
                {SAMPLES.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => {
                      setText(sample.text);
                      setError(null);
                    }}
                    className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
              >
                {error}
              </p>
            )}

            <div className="mt-auto flex flex-col gap-2">
              <button
                type="submit"
                disabled={loading || !text.trim()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {loading ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    正在提取并报价…
                  </>
                ) : (
                  "提取并报价"
                )}
              </button>
              <p className="text-center text-xs leading-5 text-zinc-400">
                未配置 LLM_API_KEY 时自动使用规则解析，演示不受影响。
              </p>
            </div>
          </form>
        </section>

        <section className="flex min-w-0 flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                02 · 输出
              </p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-900">
                报价结果
              </h2>
            </div>
            {result && <ModeBadge mode={result.mode} />}
          </div>

          {result ? (
            <QuoteResult key={result.id} result={result} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-14 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-white text-xl shadow-sm">
                ¥
              </div>
              <p className="mt-4 text-sm font-medium text-zinc-700">
                提交一条询价
              </p>
              <p className="mt-1 max-w-xs text-sm leading-6 text-zinc-500">
                这里会生成逐行报价、合计金额和需要人工确认的风险项。
              </p>
            </div>
          )}
        </section>
      </div>

      <HistoryPanel
        records={history}
        activeId={result?.id}
        onSelect={(record) => setResult(record)}
      />

      <footer className="pb-4 text-center text-xs leading-6 text-zinc-400">
        自测项目 · 价目表与客户均为虚构数据，不连接任何真实业务系统
      </footer>
    </main>
  );
}
