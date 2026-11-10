import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AccountMenu, WelcomeBanner } from "@/components/AccountMenu";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { Nav } from "@/components/Nav";
import { UserProvider } from "@/components/UserContext";
import type { Posture } from "@/components/Posture";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Valid cookie but the account is gone or deactivated: clear the cookie first,
  // otherwise /login would send a "signed in" user straight back here
  if (!user) redirect("/api/auth/logout");
  const posture = await queryOne<Posture>(`SELECT * FROM fn_threat_posture()`);

  return (
    <UserProvider user={user}>
      <div className="flex min-h-screen">
        <Nav posture={posture} />
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar: signed-in user, role and sign out, like most web apps */}
          <header className="sticky top-0 z-40 flex h-16 items-center justify-end border-b border-line bg-surface/90 px-6 backdrop-blur sm:px-8 lg:px-10">
            <AccountMenu />
          </header>
          <main className="min-w-0 flex-1 px-6 py-7 sm:px-8 lg:px-10 lg:py-9">
            <div className="mx-auto max-w-[1280px]">
              <Suspense>
                <WelcomeBanner />
              </Suspense>
              {children}
            </div>
          </main>
        </div>
      </div>
    </UserProvider>
  );
}