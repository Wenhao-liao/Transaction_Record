import type { UserPreferences } from "@/lib/supabase";

export type ReturnColorMode = UserPreferences["return_color_mode"];

export function getReturnColorClass(value: number | null, mode: ReturnColorMode = "red_up_green_down") {
  if (value === null) {
    return "text-slate-500";
  }

  const isUp = value >= 0;

  if (mode === "green_up_red_down") {
    return isUp ? "text-emerald-600" : "text-red-500";
  }

  return isUp ? "text-red-500" : "text-emerald-600";
}

export function getReturnColorModeLabel(mode: ReturnColorMode = "red_up_green_down") {
  return mode === "red_up_green_down" ? "上涨红色，下跌绿色" : "上涨绿色，下跌红色";
}
