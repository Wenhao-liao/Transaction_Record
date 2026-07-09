import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";

export default function ProfilePage() {
  return (
    <AppShell>
      <section className="px-5 py-6">
        <p className="text-sm font-medium text-slate-500">账户与偏好</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">我的</h1>
        <Card className="mt-5 border-0">
          <CardContent className="p-5">
            <p className="font-bold text-slate-950">个人投资者</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              这里预留给登录状态、Supabase 同步、复盘偏好和提醒设置。
            </p>
          </CardContent>
        </Card>
      </section>
      <BottomNav current="/profile" />
    </AppShell>
  );
}
