import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const tradeTypes = ["趋势交易", "反弹交易", "长期投资", "事件驱动"];

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export default function NewTradePage() {
  return (
    <AppShell>
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/70 bg-slate-50/95 px-5 py-4 backdrop-blur">
        <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="text-sm font-medium text-slate-500">记录一次买入决策</p>
          <h1 className="text-xl font-bold text-slate-950">新建交易</h1>
        </div>
      </header>

      <form className="space-y-4 px-5 py-5">
        <Card className="border-0">
          <CardHeader>
            <CardTitle>股票信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="股票名称">
              <Input placeholder="例如：英伟达" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="股票代码">
                <Input placeholder="NVDA" />
              </Field>
              <Field label="市场">
                <Select defaultValue="美股">
                  <option>美股</option>
                  <option>港股</option>
                  <option>A股</option>
                  <option>其他</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="买入价格">
                <Input inputMode="decimal" placeholder="128.40" />
              </Field>
              <Field label="买入日期">
                <Input type="date" />
              </Field>
            </div>
            <Field label="交易类型">
              <div className="grid grid-cols-2 gap-2">
                {tradeTypes.map((type) => (
                  <label
                    key={type}
                    className="flex h-11 items-center justify-center rounded-2xl border bg-white text-sm font-semibold text-slate-600 has-[:checked]:border-primary has-[:checked]:bg-blue-50 has-[:checked]:text-primary"
                  >
                    <input className="sr-only" name="tradeType" type="radio" defaultChecked={type === "趋势交易"} />
                    {type}
                  </label>
                ))}
              </div>
            </Field>
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardHeader>
            <CardTitle>交易逻辑</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="为什么现在买？">
              <Textarea placeholder="触发买入的价格、趋势、基本面或情绪信号。" />
            </Field>
            <Field label="看涨因素">
              <Textarea placeholder="列出你认为股价上涨的核心依据。" />
            </Field>
            <Field label="风险因素">
              <Textarea placeholder="写下估值、行业、财报、流动性等潜在风险。" />
            </Field>
            <Field label="什么情况证明我错？">
              <Textarea placeholder="提前定义失效条件，避免临场找理由。" />
            </Field>
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardHeader>
            <CardTitle>交易计划</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="目标收益">
                <Input placeholder="18%" />
              </Field>
              <Field label="预计持有时间">
                <Input placeholder="4-8 周" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="止损价格">
                <Input inputMode="decimal" placeholder="119.80" />
              </Field>
              <Field label="仓位比例">
                <Input placeholder="12%" />
              </Field>
            </div>
          </CardContent>
        </Card>

        <div className="sticky bottom-[5.75rem] z-20">
          <Button className="h-14 w-full rounded-3xl text-base shadow-ios" type="button">
            保存交易日志
          </Button>
        </div>
      </form>

      <BottomNav current="/trades/new" />
    </AppShell>
  );
}
