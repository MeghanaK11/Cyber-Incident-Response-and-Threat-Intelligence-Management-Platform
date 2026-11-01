import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { UserProvider } from "@/components/UserContext";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <UserProvider user={user}>
      <Nav />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </UserProvider>
  );
}
