export function mapAliyahApiError(error?: string) {
  if (error === "missing_aliyot_table") {
    return "חסרה טבלת העליות. הריצו ב-Supabase את הקובץ supabase/aliyot-migration.sql";
  }
  if (error === "missing_congregants_table") {
    return "חסרה טבלת המתפללים. הריצו ב-Supabase את הקובץ supabase/congregants-migration.sql";
  }
  if (error === "unauthorized") return "יש להתחבר מחדש";
  if (error === "forbidden") return "אין הרשאה לבית הכנסת הזה";
  if (error === "invalid_minyan") return "המניין שנבחר אינו שייך לבית הכנסת";
  if (error === "invalid_date") return "תאריך העליות אינו תקין";
  if (error === "invalid_congregant") return "מתפלל שנבחר אינו שייך לבית הכנסת";
  if (error === "invalid_slot") return "עלייה אינה תקינה";
  if (error === "synagogue_not_found") return "בית הכנסת לא נמצא";
  if (error === "invalid_id") return "מזהה בית כנסת לא תקין";
  return error ?? "הפעולה נכשלה. נסו שוב.";
}
