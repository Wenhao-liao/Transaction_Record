import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AuthNotice({
  title = "请先登录",
  description = "登录后即可同步保存你的交易日志，并在多设备间访问。"
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Card className="border-0">
      <CardContent className="flex flex-col items-center px-6 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-primary">
          <KeyRound className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-slate-950">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        <Link href="/login" className="mt-5 w-full">
          <Button className="w-full">去登录</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function ConfigNotice() {
  return (
    <Card className="border-0">
      <CardContent className="px-6 py-8 text-center">
        <h3 className="text-lg font-bold text-slate-950">Supabase 尚未配置</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          请在部署环境中配置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY 后再使用线上数据功能。
        </p>
      </CardContent>
    </Card>
  );
}
