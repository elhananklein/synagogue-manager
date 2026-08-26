import { GabbaiLoadingPanel } from "@/components/admin/gabbai-loading";

export default function GabbaiPageLoading() {
  return (
    <main className="container py-10">
      <h1 className="text-xl font-bold sm:text-2xl">ממשק גבאי</h1>
      <GabbaiLoadingPanel title="טוען את ממשק הגבאי…" />
    </main>
  );
}
