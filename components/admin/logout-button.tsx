"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/ssr-client";

export function LogoutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.assign("/admin/login");
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={onLogout} disabled={loading} className={className}>
      <LogOut className="ml-1 h-4 w-4" />
      {loading ? "מתנתק…" : "התנתקות"}
    </Button>
  );
}
