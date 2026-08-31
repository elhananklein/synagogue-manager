"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GabbaiSaveBar({
  label,
  saving,
  message,
  error,
  onSave
}: {
  label: string;
  saving: boolean;
  message: string | null;
  error: string | null;
  onSave: () => void;
}) {
  return (
    <div className="gabbai-save">
      <div className="gabbai-save-inner">
        <Button type="button" className="gabbai-save-btn" onClick={onSave} disabled={saving}>
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              שומר…
            </span>
          ) : (
            label
          )}
        </Button>
        {message ? <span className="gabbai-ok">{message}</span> : null}
        {error ? <span className="gabbai-err">{error}</span> : null}
      </div>
    </div>
  );
}
