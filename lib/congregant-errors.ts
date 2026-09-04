export function mapCongregantApiError(error?: string) {
  if (error === "missing_congregants_table") {
    return "חסרה טבלת המתפללים. הריצו ב-Supabase את הקובץ supabase/congregants-migration.sql";
  }
  if (error === "unauthorized") return "יש להתחבר מחדש";
  if (error === "forbidden") return "אין הרשאה לבית הכנסת הזה";
  if (error === "missing_registration_status") {
    return "חסרה עמודת סטטוס הרשמה. הריצו ב-Supabase את הקובץ supabase/congregants-registration-status-migration.sql";
  }
  if (error === "synagogue_not_found") return "בית הכנסת לא נמצא";
  if (error === "invalid_id") return "מזהה בית כנסת לא תקין";
  if (error === "missing_file") return "לא נבחר קובץ";
  if (error === "invalid_file_type") return "יש להעלות קובץ אקסל או CSV";
  if (error === "file_too_large") return "הקובץ גדול מדי";
  if (error === "no_valid_rows") return "אין שורות תקינות לייבוא";
  return error ?? "הפעולה נכשלה. נסו שוב.";
}
