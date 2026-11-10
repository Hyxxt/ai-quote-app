const COLOR_LABELS: Record<string, string> = {
  "BLK-01": "黑色",
  "WHT-02": "白色",
  "NVY-03": "藏青",
  "RED-04": "红色",
  "BEG-05": "米色",
  "GRY-06": "灰色",
  "OLV-07": "军绿",
  "BRN-08": "棕色",
};

export function colorLabel(value: string): string {
  if (!value || value === "待定") return "待定";
  return COLOR_LABELS[value] ? `${COLOR_LABELS[value]} · ${value}` : value;
}

export function formatQty(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(
    value,
  );
}

export function formatPrice(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(value);
}

export function formatAmount(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
