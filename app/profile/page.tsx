"use client";

import {
  Bell,
  ChevronRight,
  Smartphone,
  RefreshCcw,
  ShieldAlert,
  Palette,
  Trash2,
  UserRound
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthNotice, ConfigNotice } from "@/components/auth-notice";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getCurrentWeekRange } from "@/lib/date-range";
import { getCachedExchangeRates } from "@/lib/quotes";
import { buildCurrentPositions } from "@/lib/positions";
import { getReturnColorModeLabel, type ReturnColorMode } from "@/lib/return-colors";
import {
  AuthRequiredError,
  clearJournalDataCache,
  DatabaseMigrationRequiredError,
  getCachedJournalData,
  loadJournalData,
  resetJournalData,
  SupabaseConfigError,
  updatePreferences
} from "@/lib/trades-api";
import { supabase, type Trade, type UserPreferences } from "@/lib/supabase";
import { cn } from "@/lib/utils";

function RowIcon({
  icon: Icon,
  className
}: {
  icon: React.ElementType;
  className: string;
}) {
  return (
    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", className)}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

export default function ProfilePage() {
  const cachedJournalData = getCachedJournalData();
  const [email, setEmail] = useState("");
  const [trades, setTrades] = useState<Trade[]>(() => cachedJournalData?.trades || []);
  const [preferences, setPreferences] = useState<UserPreferences | null>(() => cachedJournalData?.preferences || null);
  const [pageState, setPageState] = useState<"checking" | "ready" | "anonymous" | "unconfigured">(
    cachedJournalData ? "ready" : "checking"
  );
  const [accountAmountInput, setAccountAmountInput] = useState(() =>
    cachedJournalData?.preferences.account_total_amount ? String(cachedJournalData.preferences.account_total_amount) : ""
  );
  const [isSavingAmount, setIsSavingAmount] = useState(false);
  const [amountMessage, setAmountMessage] = useState("");
  const [weeklyReportDayInput, setWeeklyReportDayInput] = useState(
    cachedJournalData?.preferences.weekly_report_day || "Sunday"
  );
  const [weeklyReportTimeInput, setWeeklyReportTimeInput] = useState(
    cachedJournalData?.preferences.weekly_report_time || "20:00"
  );
  const [reviewReminderEnabledInput, setReviewReminderEnabledInput] = useState(
    cachedJournalData?.preferences.review_reminder_enabled || false
  );
  const [returnColorModeInput, setReturnColorModeInput] = useState<ReturnColorMode>(
    cachedJournalData?.preferences.return_color_mode || "red_up_green_down"
  );
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported"
  );
  const [isSavingReviewPrefs, setIsSavingReviewPrefs] = useState(false);
  const [reviewPrefsMessage, setReviewPrefsMessage] = useState("");
  const [resetConfirmInput, setResetConfirmInput] = useState("");
  const [isResettingData, setIsResettingData] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }

    async function loadProfile() {
      try {
        const { data } = await supabase.auth.getUser();
        const journalData = await loadJournalData();
        setEmail(data.user?.email || "");
        setTrades(journalData.trades);
        setPreferences(journalData.preferences);
        setAccountAmountInput(
          journalData.preferences.account_total_amount ? String(journalData.preferences.account_total_amount) : ""
        );
        setWeeklyReportDayInput(journalData.preferences.weekly_report_day);
        setWeeklyReportTimeInput(journalData.preferences.weekly_report_time);
        setReviewReminderEnabledInput(journalData.preferences.review_reminder_enabled);
        setReturnColorModeInput(journalData.preferences.return_color_mode || "red_up_green_down");
        setPageState("ready");
      } catch (error) {
        if (error instanceof SupabaseConfigError) {
          setPageState("unconfigured");
        } else if (error instanceof AuthRequiredError) {
          setPageState("anonymous");
        } else if (error instanceof DatabaseMigrationRequiredError) {
          setAmountMessage(error.message);
          setPageState("ready");
        } else {
          setAmountMessage(error instanceof Error ? error.message : "账户信息读取失败。");
          setPageState("ready");
        }
      }
    }

    void loadProfile();
  }, []);

  const currentPositions = useMemo(
    () => buildCurrentPositions(trades, preferences?.account_total_amount, getCachedExchangeRates()),
    [preferences?.account_total_amount, trades]
  );

  const weeklyReviewCount = useMemo(() => {
    const { weekStart, weekEnd } = getCurrentWeekRange();

    return trades.filter((trade) => trade.buyDate >= weekStart && trade.buyDate <= weekEnd).length;
  }, [trades]);

  const stats = useMemo(
    () => [
      { label: "交易记录", value: String(trades.length), helper: "累计" },
      {
        label: "当前持仓",
        value: String(currentPositions.length),
        helper: "股票数"
      },
      { label: "待复盘", value: String(weeklyReviewCount), helper: "本周" }
    ],
    [currentPositions.length, trades.length, weeklyReviewCount]
  );

  async function handleSignOut() {
    clearJournalDataCache();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function handleSaveAccountAmount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextAmount = Number(accountAmountInput);

    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setAmountMessage("请输入大于 0 的本金。");
      return;
    }

    setIsSavingAmount(true);
    setAmountMessage("");

    try {
      const nextPreferences = await updatePreferences({ account_total_amount: nextAmount });
      setPreferences(nextPreferences);
      setAmountMessage("本金已保存。");
    } catch (error) {
      if (error instanceof DatabaseMigrationRequiredError) {
        setAmountMessage("保存失败：请先在 Supabase SQL Editor 重新执行 supabase/schema.sql，补齐本金字段。");
      } else {
        setAmountMessage(error instanceof Error ? error.message : "保存失败，请稍后重试。");
      }
    } finally {
      setIsSavingAmount(false);
    }
  }

  async function handleSaveReviewPreferences(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSavingReviewPrefs(true);
    setReviewPrefsMessage("");

    try {
      let nextReminderEnabled = reviewReminderEnabledInput;

      if (nextReminderEnabled) {
        if (!("Notification" in window)) {
          nextReminderEnabled = false;
          setReviewReminderEnabledInput(false);
          setNotificationPermission("unsupported");
          setReviewPrefsMessage("当前浏览器不支持通知提醒，已仅保存周报周期。");
        } else if (Notification.permission === "default") {
          const permission = await Notification.requestPermission();
          setNotificationPermission(permission);
          nextReminderEnabled = permission === "granted";
          setReviewReminderEnabledInput(nextReminderEnabled);
        } else if (Notification.permission === "denied") {
          nextReminderEnabled = false;
          setReviewReminderEnabledInput(false);
          setNotificationPermission("denied");
          setReviewPrefsMessage("通知权限已被浏览器拒绝，请在浏览器设置中开启后再启用提醒。");
        }
      }

      const nextPreferences = await updatePreferences({
        weekly_report_day: weeklyReportDayInput,
        weekly_report_time: weeklyReportTimeInput,
        review_reminder_enabled: nextReminderEnabled,
        return_color_mode: returnColorModeInput
      });
      setPreferences(nextPreferences);
      setReviewPrefsMessage((currentMessage) => currentMessage || "复盘偏好已保存。");
    } catch (error) {
      if (error instanceof DatabaseMigrationRequiredError) {
        setReviewPrefsMessage("保存失败：请先在 Supabase SQL Editor 重新执行 supabase/schema.sql，补齐偏好字段。");
      } else {
        setReviewPrefsMessage(error instanceof Error ? error.message : "保存失败，请稍后重试。");
      }
    } finally {
      setIsSavingReviewPrefs(false);
    }
  }

  async function handleResetData() {
    if (resetConfirmInput !== "重新开始") {
      setResetMessage("请输入“重新开始”后再执行数据重置。");
      return;
    }

    setIsResettingData(true);
    setResetMessage("");

    try {
      await resetJournalData();
      setTrades([]);
      setResetConfirmInput("");
      setResetMessage("交易记录和 AI 周报已清空，本金与偏好已保留。");
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        setPageState("anonymous");
      } else if (error instanceof SupabaseConfigError) {
        setPageState("unconfigured");
      } else {
        setResetMessage(error instanceof Error ? error.message : "数据重置失败，请稍后重试。");
      }
    } finally {
      setIsResettingData(false);
    }
  }

  return (
    <AppShell>
      <section className="px-5 pb-4 pt-6">
        <p className="text-sm font-medium text-slate-500">账户与偏好</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">我的</h1>

        <Card className="mt-5 overflow-hidden border-0 bg-slate-950 text-white">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/12">
                <UserRound className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{email || "个人投资者"}</h2>
                  <span className="rounded-full bg-white/12 px-2 py-0.5 text-xs text-slate-200">标准版</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  记录每一次交易动作，沉淀自己的买卖逻辑，并通过周期复盘优化决策质量。
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {stats.map((item) => (
                <div key={item.label} className="rounded-2xl bg-white/10 p-3">
                  <p className="text-2xl font-bold">{item.value}</p>
                  <p className="mt-1 text-xs text-slate-300">{item.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{item.helper}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4 px-5">
        {pageState === "checking" ? <p className="px-1 text-sm text-slate-500">正在读取账户信息...</p> : null}
        {pageState === "unconfigured" ? <ConfigNotice /> : null}
        {pageState === "anonymous" ? <AuthNotice /> : null}
        {pageState !== "ready" ? (
          <Link href="/login" className="block">
            <Button className="w-full">登录账户</Button>
          </Link>
        ) : null}

        <Card className="border-0">
          <CardContent className="p-5">
            <Link className="flex items-center gap-3" href="/profile/security">
              <RowIcon icon={UserRound} className="bg-blue-50 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-950">账号安全</p>
                <p className="mt-1 truncate text-sm text-slate-500">{email || "管理登录邮箱和密码"}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300" />
            </Link>
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardContent className="p-5">
            <Link className="flex items-center gap-3" href="/install">
              <RowIcon icon={Smartphone} className="bg-sky-50 text-sky-600" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-950">安装到手机桌面</p>
                <p className="mt-1 truncate text-sm text-slate-500">像 App 一样打开交易日志</p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300" />
            </Link>
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardHeader className="pb-2">
            <CardTitle>本金</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleSaveAccountAmount}>
              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-sm font-bold text-slate-950">初始本金</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  新建交易填写价格和股数后，系统会用这里的本金自动计算仓位比例。
                </p>
                <Input
                  className="mt-3 bg-white"
                  inputMode="decimal"
                  onChange={(event) => setAccountAmountInput(event.target.value)}
                  placeholder="例如：100000"
                  value={accountAmountInput}
                />
              </div>
              {amountMessage ? <p className="text-sm text-slate-500">{amountMessage}</p> : null}
              <Button className="w-full" disabled={isSavingAmount || pageState !== "ready"} type="submit">
                {isSavingAmount ? "保存中..." : "保存本金"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardHeader className="pb-2">
            <CardTitle>复盘偏好</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleSaveReviewPreferences}>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-3">
                  <RowIcon icon={RefreshCcw} className="bg-blue-50 text-primary" />
                  <div>
                    <p className="font-bold text-slate-950">AI 周报周期</p>
                    <p className="mt-1 text-sm text-slate-500">设置默认复盘提醒时间</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={weeklyReportDayInput} onChange={(event) => setWeeklyReportDayInput(event.target.value)}>
                    <option value="Monday">周一</option>
                    <option value="Tuesday">周二</option>
                    <option value="Wednesday">周三</option>
                    <option value="Thursday">周四</option>
                    <option value="Friday">周五</option>
                    <option value="Saturday">周六</option>
                    <option value="Sunday">周日</option>
                  </Select>
                  <Input
                    onChange={(event) => setWeeklyReportTimeInput(event.target.value)}
                    type="time"
                    value={weeklyReportTimeInput}
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-3">
                  <RowIcon icon={Palette} className="bg-red-50 text-red-500" />
                  <div>
                    <p className="font-bold text-slate-950">涨跌颜色</p>
                    <p className="mt-1 text-sm text-slate-500">{getReturnColorModeLabel(returnColorModeInput)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1 shadow-sm">
                  {[
                    { label: "涨红跌绿", value: "red_up_green_down" },
                    { label: "涨绿跌红", value: "green_up_red_down" }
                  ].map((item) => {
                    const isActive = returnColorModeInput === item.value;

                    return (
                      <button
                        className={cn(
                          "rounded-xl px-3 py-2 text-sm font-semibold transition",
                          isActive ? "bg-blue-50 text-primary" : "text-slate-500"
                        )}
                        key={item.value}
                        onClick={() => setReturnColorModeInput(item.value as ReturnColorMode)}
                        type="button"
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
                <RowIcon icon={Bell} className="bg-amber-50 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-950">复盘提醒</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {reviewReminderEnabledInput
                      ? notificationPermission === "granted"
                        ? "已开启，到点提醒你查看周报"
                        : "保存后会请求浏览器通知权限"
                      : notificationPermission === "denied"
                        ? "通知权限已被拒绝"
                        : "暂未开启，仅保存周报周期"}
                  </p>
                </div>
                <button
                  aria-pressed={reviewReminderEnabledInput}
                  className={cn(
                    "flex h-8 w-14 items-center rounded-full p-1 transition",
                    reviewReminderEnabledInput ? "bg-primary" : "bg-slate-200"
                  )}
                  onClick={() => setReviewReminderEnabledInput((value) => !value)}
                  type="button"
                >
                  <span
                    className={cn(
                      "h-6 w-6 rounded-full bg-white shadow-sm transition",
                      reviewReminderEnabledInput ? "translate-x-6" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              {reviewPrefsMessage ? <p className="text-sm text-slate-500">{reviewPrefsMessage}</p> : null}
              <Button className="w-full" disabled={isSavingReviewPrefs || pageState !== "ready"} type="submit">
                {isSavingReviewPrefs ? "保存中..." : "保存复盘偏好"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardHeader className="pb-2">
            <CardTitle>数据重置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <RowIcon icon={Trash2} className="bg-white text-red-500" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-950">清空交易数据</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    会删除全部交易记录和历史 AI 周报，保留登录账号、本金和复盘偏好。此操作无法撤销。
                  </p>
                </div>
              </div>
              <Input
                className="mt-4 bg-white"
                onChange={(event) => setResetConfirmInput(event.target.value)}
                placeholder="输入：重新开始"
                value={resetConfirmInput}
              />
            </div>
            {resetMessage ? <p className="text-sm text-slate-500">{resetMessage}</p> : null}
            <Button
              className="w-full"
              disabled={isResettingData || pageState !== "ready" || resetConfirmInput !== "重新开始"}
              onClick={() => void handleResetData()}
              variant="secondary"
            >
              {isResettingData ? "重置中..." : "清空交易数据"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <RowIcon icon={ShieldAlert} className="bg-red-50 text-red-500" />
              <div>
                <p className="font-bold text-slate-950">风险提示</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  本工具用于记录交易决策与复盘，不构成投资建议。行情与 AI 分析仅供参考，最终决策需由你自己负责。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {pageState === "ready" ? (
          <Button className="w-full" onClick={handleSignOut} variant="secondary">
            退出登录
          </Button>
        ) : null}
      </section>

      <BottomNav current="/profile" />
    </AppShell>
  );
}
