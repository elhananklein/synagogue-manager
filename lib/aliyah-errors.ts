export function mapAliyahApiError(error?: string) {
  if (error === "missing_aliyot_table") {
    return "חסרה טבלת העליות. הריצו ב-Supabase את הקובץ supabase/aliyot-migration.sql";
  }
  if (error === "missing_congregants_table") {
    return "חסרה טבלת המתפללים. הריצו ב-Supabase את הקובץ supabase/congregants-migration.sql";
  }
  if (error === "missing_aliyah_plan_table") {
    return "חסרות טבלאות תכנון העליות. הריצו ב-Supabase את הקובץ supabase/aliyah-plan-migration.sql";
  }
  if (error === "mail_not_configured") return "שליחת מיילים לא הוגדרה בשרת (CONTACT_SMTP_*)";
  if (error === "no_recipients") return "לא נמצאו כתובות מייל — הגדירו נמענים בהגדרות התכנון";
  if (error === "smtp_auth_failed") return "שרת המייל דחה את פרטי ההתחברות";
  if (error === "send_failed" || error === "smtp_connect_failed" || error === "smtp_envelope_failed") {
    return "שליחת המייל נכשלה. נסו שוב מאוחר יותר.";
  }
  if (error === "invalid_kind") return "סוג החיוב אינו תקין";
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
