import { Suspense } from "react";
import { AppBoot } from "@/components/shell/app-boot";
import { BottomNav, SideNav } from "@/components/shell/app-nav";
import { Loading } from "@/components/study/loading";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <SideNav />
      <main className="min-w-0 flex-1 pt-[env(safe-area-inset-top)] pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-10">
        <Suspense fallback={<Loading />}>{children}</Suspense>
      </main>
      <BottomNav />
      <AppBoot />
    </div>
  );
}
