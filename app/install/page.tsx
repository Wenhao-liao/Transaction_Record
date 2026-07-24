"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, MonitorDown, PlusSquare, Share, Smartphone } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DeviceType = "ios" | "android" | "desktop" | "installed";

function StepNumber({ value }: { value: string }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-primary">
      {value}
    </div>
  );
}

function InstallSteps({ deviceType }: { deviceType: DeviceType }) {
  if (deviceType === "installed") {
    return (
      <div className="rounded-3xl bg-blue-50 p-5 text-center">
        <p className="text-lg font-bold text-slate-950">已经在独立窗口中打开</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">现在的体验已经接近原生 App，可以从手机桌面直接进入。</p>
      </div>
    );
  }

  const steps =
    deviceType === "ios"
      ? [
          { title: "用 Safari 打开网站", description: "iPhone 需要使用 Safari 添加到主屏幕。" },
          { title: "点击底部分享按钮", description: "分享按钮通常在 Safari 底部工具栏中间。" },
          { title: "选择添加到主屏幕", description: "确认名称后，桌面会出现交易日志图标。" }
        ]
      : deviceType === "android"
        ? [
            { title: "用 Chrome 打开网站", description: "访问你的线上 HTTPS 地址。" },
            { title: "点击浏览器菜单", description: "选择安装应用或添加到主屏幕。" },
            { title: "确认安装", description: "安装后可以从桌面独立打开。" }
          ]
        : [
            { title: "打开线上网站", description: "建议使用 Chrome、Edge 或 Safari。" },
            { title: "点击地址栏安装按钮", description: "部分浏览器会在地址栏显示安装图标。" },
            { title: "确认安装", description: "安装后可以从系统应用列表或桌面打开。" }
          ];

  return (
    <div className="space-y-3">
      {steps.map((step, index) => (
        <div className="flex gap-3 rounded-3xl bg-slate-50 p-4" key={step.title}>
          <StepNumber value={String(index + 1)} />
          <div>
            <p className="font-bold text-slate-950">{step.title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InstallPage() {
  const [deviceType, setDeviceType] = useState<DeviceType>("desktop");

  useEffect(() => {
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
    const userAgent = navigator.userAgent.toLowerCase();

    if (isStandalone) {
      setDeviceType("installed");
    } else if (/iphone|ipad|ipod/.test(userAgent)) {
      setDeviceType("ios");
    } else if (/android/.test(userAgent)) {
      setDeviceType("android");
    } else {
      setDeviceType("desktop");
    }
  }, []);

  const deviceOptions = [
    { label: "iPhone", value: "ios" },
    { label: "Android", value: "android" },
    { label: "桌面端", value: "desktop" }
  ];

  return (
    <AppShell>
      <section className="px-5 pb-4 pt-6">
        <Link
          className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm"
          href="/profile"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-primary">
          <Smartphone className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950">安装到手机桌面</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          添加后可以像 App 一样从桌面打开交易日志，拥有独立窗口和更稳定的移动端体验。
        </p>
      </section>

      <section className="space-y-4 px-5">
        {deviceType !== "installed" ? (
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
            {deviceOptions.map((item) => {
              const isActive = deviceType === item.value;

              return (
                <button
                  className={cn(
                    "h-10 rounded-xl text-sm font-bold transition",
                    isActive ? "bg-white text-primary shadow-sm" : "text-slate-500"
                  )}
                  key={item.value}
                  onClick={() => setDeviceType(item.value as DeviceType)}
                  type="button"
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        ) : null}

        <Card className="border-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              {deviceType === "ios" ? (
                <Share className="h-5 w-5 text-primary" />
              ) : deviceType === "android" ? (
                <PlusSquare className="h-5 w-5 text-primary" />
              ) : (
                <MonitorDown className="h-5 w-5 text-primary" />
              )}
              安装步骤
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InstallSteps deviceType={deviceType} />
          </CardContent>
        </Card>

        <Card className="border-0">
          <CardContent className="p-5">
            <p className="font-bold text-slate-950">小提示</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              请使用线上 HTTPS 地址安装。本地 localhost 适合开发调试，但不适合给真实用户安装。
            </p>
          </CardContent>
        </Card>
      </section>

      <BottomNav current="/profile" />
    </AppShell>
  );
}
