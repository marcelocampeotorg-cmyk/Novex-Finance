import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth-context";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireSession();
  } catch (error) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
