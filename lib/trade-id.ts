export function createTradeId(stockCode: string) {
  const code = stockCode.trim().toLowerCase() || "trade";
  return `${code}-${Date.now()}`;
}
