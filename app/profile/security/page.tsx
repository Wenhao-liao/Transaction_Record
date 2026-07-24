"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthNotice, ConfigNotice } from "@/components/auth-notice";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
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

export default function AccountSecurityPage() {
  const [email, setEmail] = useState("");
  const [newEmailInput, setNewEmailInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState("");
  const [pageState, setPageState] = useState<"checking" | "ready" | "anonymous" | "unconfigured">(
    isSupabaseConfigured ? "checking" : "unconfigured"
  );
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");

  useEffect(() => {
    async function loadUser() {
      if (!isSupabaseConfigured) {
        setPageState("unconfigured");
        return;
      }

      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        setPageState("anonymous");
        return;
      }

      setEmail(data.user.email || "");
      setPageState("ready");
    }

    void loadUser();
  }, []);

  async function handleUpdateEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newEmailInput || newEmailInput === email) {
      setAccountMessage("请输入一个新的邮箱地址。");
      return;
    }

    setIsSavingEmail(true);
    setAccountMessage("");

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmailInput
      });

      if (error) {
        throw error;
      }

      setNewEmailInput("");
      setAccountMessage("邮箱修改申请已提交，请打开新邮箱完成确认。");
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : "邮箱修改失败，请稍后重试。");
    } finally {
      setIsSavingEmail(false);
    }
  }

  async function handleUpdatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPasswordInput.length < 6) {
      setAccountMessage("新密码至少需要 6 位。");
      return;
    }

    if (newPasswordInput !== confirmNewPasswordInput) {
      setAccountMessage("两次输入的新密码不一致。");
      return;
    }

    setIsSavingPassword(true);
    setAccountMessage("");

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPasswordInput
      });

      if (error) {
        throw error;
      }

      setNewPasswordInput("");
      setConfirmNewPasswordInput("");
      setAccountMessage("密码已更新，下次登录请使用新密码。");
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : "密码修改失败，请稍后重试。");
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <AppShell>
      <section className="px-5 pb-4 pt-6">
        <Link
          className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm"
          href="/profile"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <p className="text-sm font-medium text-slate-500">账户设置</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">账号安全</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">管理登录邮箱和密码，保护你的交易记录数据。</p>
      </section>

      <section className="space-y-4 px-5">
        {pageState === "checking" ? <p className="px-1 text-sm text-slate-500">正在读取账号信息...</p> : null}
        {pageState === "unconfigured" ? <ConfigNotice /> : null}
        {pageState === "anonymous" ? <AuthNotice /> : null}

        <Card className="border-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              当前账号
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
              <RowIcon icon={Mail} className="bg-blue-50 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-950">登录邮箱</p>
                <p className="mt-1 break-all text-sm text-slate-500">{email || "暂未读取到邮箱"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardHeader className="pb-2">
            <CardTitle>修改邮箱</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleUpdateEmail}>
              <div className="space-y-2">
                <Label>新的登录邮箱</Label>
                <Input
                  autoComplete="email"
                  disabled={pageState !== "ready"}
                  inputMode="email"
                  onChange={(event) => setNewEmailInput(event.target.value)}
                  placeholder="new@example.com"
                  type="email"
                  value={newEmailInput}
                />
              </div>
              <p className="text-xs leading-5 text-slate-500">修改邮箱后，通常需要打开新邮箱完成确认。</p>
              <Button className="w-full" disabled={isSavingEmail || pageState !== "ready"} type="submit">
                {isSavingEmail ? "保存中..." : "提交邮箱修改"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-amber-600" />
              修改密码
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleUpdatePassword}>
              <div className="space-y-2">
                <Label>新密码</Label>
                <Input
                  autoComplete="new-password"
                  disabled={pageState !== "ready"}
                  minLength={6}
                  onChange={(event) => setNewPasswordInput(event.target.value)}
                  placeholder="至少 6 位密码"
                  type="password"
                  value={newPasswordInput}
                />
              </div>
              <div className="space-y-2">
                <Label>确认新密码</Label>
                <Input
                  autoComplete="new-password"
                  disabled={pageState !== "ready"}
                  minLength={6}
                  onChange={(event) => setConfirmNewPasswordInput(event.target.value)}
                  placeholder="再次输入新密码"
                  type="password"
                  value={confirmNewPasswordInput}
                />
              </div>
              <Button className="w-full" disabled={isSavingPassword || pageState !== "ready"} type="submit">
                {isSavingPassword ? "保存中..." : "保存新密码"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {accountMessage ? <p className="px-1 text-sm leading-6 text-slate-500">{accountMessage}</p> : null}
      </section>

      <BottomNav current="/profile" />
    </AppShell>
  );
}
