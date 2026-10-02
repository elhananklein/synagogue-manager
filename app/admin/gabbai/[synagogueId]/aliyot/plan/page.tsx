import { AliyahPlanner } from "@/components/admin/aliyah-planner";
import { AliyahSubnav } from "@/components/admin/aliyah-subnav";
import { listSynagogueMinyanOptions } from "@/lib/congregant-db";
import { isIsoDate } from "@/lib/hebrew-civil-date";

export default async function AliyotPlanPage({
  params,
  searchParams
}: {
  params: Promise<{ synagogueId: string }>;
  searchParams: Promise<{ minyan?: string; date?: string }>;
}) {
  const { synagogueId } = await params;
  const query = await searchParams;
  const minyanim = await listSynagogueMinyanOptions(synagogueId);
  const date = typeof query.date === "string" && isIsoDate(query.date) ? query.date : null;

  return (
    <>
      <h1 className="gabbai-page-title">עליות</h1>
      <AliyahSubnav synagogueId={synagogueId} active="plan" />
      <p className="gabbai-page-desc">
        המערכת מציעה מי לכבד בכל עלייה: קודם חיובים (יארצייט, בר מצווה, חתן…), ואחר כך מי שלא עלה הכי הרבה זמן.
        אפשר לשנות כל עלייה, לשמור, להדפיס דף לבימה — והדף נשלח גם במייל בבוקר ערב שבת.
      </p>
      <AliyahPlanner
        synagogueId={synagogueId}
        initialMinyanim={minyanim}
        initialMinyanId={typeof query.minyan === "string" ? query.minyan : null}
        initialDate={date}
      />
    </>
  );
}
