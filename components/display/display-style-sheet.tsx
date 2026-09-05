import type { DisplayStyle } from "@/lib/display-theme";

/**
 * טוען CSS של סגנון קיר רק כשהוא נבחר.
 * סגנונות ישנים נשארים ב-globals.css כמו היום — כאן אין להם הפניה.
 */
const STYLE_STYLESHEETS: Partial<Record<DisplayStyle, string>> = {
  veryBold: "/display/very-bold.css?v=46"
};

export function DisplayStyleSheet({ style }: { style: DisplayStyle }) {
  const href = STYLE_STYLESHEETS[style];
  if (!href) return null;
  return <link rel="stylesheet" href={href} />;
}
