import type { Trade } from "@/lib/supabase";

export const trades: Trade[] = [
  {
    id: "nvda-2026-06-28",
    stockName: "英伟达",
    stockCode: "NVDA",
    market: "美股",
    buyPrice: 128.4,
    buyDate: "2026-06-28",
    tradeType: "趋势交易",
    whyNow: "股价重新站上 20 日均线，成交量温和放大，AI 算力主线仍保持市场关注。",
    bullishFactors: "数据中心收入增长明确，生态壁垒高，机构资金持续流入科技龙头。",
    riskFactors: "估值处于高位，若财报指引低于预期，可能触发快速回撤。",
    invalidation: "跌破买入后形成的平台低点，且无法在两个交易日内收回。",
    targetReturn: "18%",
    holdingPeriod: "4-8 周",
    stopLossPrice: 119.8,
    positionRatio: "12%",
    status: "持仓中",
    currentReturn: "+6.8%"
  },
  {
    id: "0700-2026-06-21",
    stockName: "腾讯控股",
    stockCode: "0700",
    market: "港股",
    buyPrice: 382.2,
    buyDate: "2026-06-21",
    tradeType: "长期投资",
    whyNow: "回调接近长期估值区间下沿，核心业务现金流稳定，适合分批配置。",
    bullishFactors: "游戏、广告和金融科技业务韧性强，回购持续改善每股价值。",
    riskFactors: "港股流动性波动大，宏观风险偏好变化会压制估值。",
    invalidation: "核心业务连续两个季度低于预期，且管理层回购明显放缓。",
    targetReturn: "25%",
    holdingPeriod: "6-12 个月",
    stopLossPrice: 344,
    positionRatio: "15%",
    status: "持仓中",
    currentReturn: "+3.1%"
  },
  {
    id: "300750-2026-06-10",
    stockName: "宁德时代",
    stockCode: "300750",
    market: "A股",
    buyPrice: 204.7,
    buyDate: "2026-06-10",
    tradeType: "反弹交易",
    whyNow: "连续下跌后出现放量阳线，新能源板块有短线修复迹象。",
    bullishFactors: "行业龙头优势明显，新技术发布带动情绪修复。",
    riskFactors: "板块仍受价格竞争影响，反弹持续性需要成交量确认。",
    invalidation: "反弹未能突破前高且重新跌破买入价。",
    targetReturn: "10%",
    holdingPeriod: "2-4 周",
    stopLossPrice: 194.5,
    positionRatio: "8%",
    status: "持仓中",
    currentReturn: "-1.4%"
  }
];

export const recentActivities = [
  {
    title: "新增买入逻辑",
    subtitle: "英伟达 NVDA · 趋势交易",
    time: "今天"
  },
  {
    title: "更新止损计划",
    subtitle: "腾讯控股 0700 · 长期投资",
    time: "昨天"
  },
  {
    title: "完成交易复盘",
    subtitle: "宁德时代 300750 · 反弹交易",
    time: "6月30日"
  }
];
