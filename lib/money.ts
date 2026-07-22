export function formatAmount(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "未填写";
  }

  return value.toLocaleString("zh-CN", {
    maximumFractionDigits: 2
  });
}
