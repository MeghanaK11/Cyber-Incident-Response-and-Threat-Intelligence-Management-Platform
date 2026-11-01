import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { Nav } from "@/components/Nav";
import { UserProvider } from "@/components/UserContext";
import type { Posture } from "@/components/Posture";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const posture = await queryOne<Posture>(`SELECT * FROM fn_threat_posture()`);

  return (
    <UserProvider user={user}>
      <div className="flex min-h-screen">
        <Nav posture={posture} />
        <main className="min-w-0 flex-1 px-6 py-7 sm:px-8 lg:px-10 lg:py-9">
          <div className="mx-auto max-w-[1280px]">{children}</div>
        </main>
      </div>
    </UserProvider>
  );
}
