/**
 * 接口冒烟测试：需要先启动服务（npm run dev 或 npm start）。
 * 用法：npm run smoke
 * 可选：BASE_URL=http://localhost:3100 npm run smoke
 *
 * 强制走规则解析（mock: true），保证断言可重复。
 */

const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

const cases = [
  {
    name: "标准询价",
    text: "张经理，我们下季要尼龙5号拉链黑色 5000 米，另外树脂四眼扣18mm 8000 粒，交期 20 天，麻烦报个价。",
    expectedTotal: 9130,
    expectedBlocker: false,
    expectedLines: 2,
  },
  {
    name: "新色号",
    text: "李女士，客户要金属四合扣12mm 3000 粒，颜色用定制蓝色，另外棉织带25mm 6000 米，交期 15 天。",
    expectedTotal: 6960,
    expectedBlocker: false,
    expectedLines: 2,
    expectedIssue: "定制蓝色",
  },
  {
    name: "信息缺失",
    text: "王总，需要尼龙5号拉链黑色 5000 米，另外想要一批装饰扣，数量还没定，请报价。",
    expectedTotal: 8250,
    expectedBlocker: true,
    expectedLines: 2,
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function postQuote(text) {
  const response = await fetch(`${base}/api/quotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, mock: true }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`POST /api/quotes 失败：HTTP ${response.status} ${data.error ?? ""}`);
  }
  return data;
}

let failures = 0;

for (const testCase of cases) {
  try {
    const data = await postQuote(testCase.text);
    assert(data.quote.total === testCase.expectedTotal, `合计应为 ${testCase.expectedTotal}，实际 ${data.quote.total}`);
    assert(data.hasBlocker === testCase.expectedBlocker, `hasBlocker 应为 ${testCase.expectedBlocker}，实际 ${data.hasBlocker}`);
    assert(data.quote.lines.length === testCase.expectedLines, `行数应为 ${testCase.expectedLines}，实际 ${data.quote.lines.length}`);
    if (testCase.expectedIssue) {
      assert(
        data.issues.some((issue) => issue.includes(testCase.expectedIssue)),
        `问题清单里应包含「${testCase.expectedIssue}」`,
      );
    }
    console.log(`✓ ${testCase.name}：合计 ¥${data.quote.total}，${data.quote.lines.length} 行，阻断=${data.hasBlocker}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${testCase.name}：${error.message}`);
  }
}

const history = await (await fetch(`${base}/api/quotes`)).json();
console.log(`历史记录：${history.quotes.length} 条`);

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log("全部通过。");
}
