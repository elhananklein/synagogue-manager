"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function GabbaiEntryPage() {
  const [synagogueId, setSynagogueId] = useState("");

  return (
    <main className="container py-10">
      <h1 className="text-2xl font-bold">כניסה לממשק גבאי</h1>
      <p className="mt-2 text-muted-foreground">יש להזין מזהה בית כנסת כפי שהוגדר בממשק מנהל המערכת.</p>

      <form className="mt-6 max-w-xl space-y-3" action={`/admin/gabbai/${synagogueId}`}>
        <label className="block text-sm font-medium">מזהה בית כנסת</label>
        <input
          className="h-10 w-full rounded-md border border-border bg-background px-3"
          value={synagogueId}
          onChange={(event) => setSynagogueId(event.target.value.trim().toLowerCase())}
          placeholder="beit-rimon"
          required
        />
        <Button type="submit">כניסה</Button>
      </form>
    </main>
  );
}

