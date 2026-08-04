import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth";

/** אזור מנהל-מערכת בלבד. גבאי שאינו system יופנה החוצה. */
export default async function SystemAdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  if (ctx.role !== "system") redirect("/admin");
  return <>{children}</>;
}
