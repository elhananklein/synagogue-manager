import { Loader2 } from "lucide-react";

export function GabbaiLoadingPanel({
  title = "טוען את ממשק הגבאי…"
}: {
  title?: string;
}) {
  return (
    <div
      className="mt-8 flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card px-6 py-16 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      <div
        className="relative h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="טוען"
      >
        <div className="gabbai-loading-bar absolute inset-y-0 w-1/3 rounded-full bg-primary" />
      </div>
    </div>
  );
}
