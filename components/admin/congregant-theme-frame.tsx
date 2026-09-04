import {
  resolveDisplayFont,
  type DisplayFont
} from "@/lib/display-font";
import {
  isDisplayStyle,
  resolveDisplayPalette,
  type DisplayPalette,
  type DisplayStyle
} from "@/lib/display-theme";
import type { CongregantMinyanOption } from "@/lib/congregant-types";

export function congregantThemeFromMinyan(minyan?: CongregantMinyanOption | null): {
  style: DisplayStyle;
  palette: DisplayPalette;
  font: DisplayFont;
} {
  const style = isDisplayStyle(minyan?.displayStyle) ? minyan.displayStyle : "classic";
  return {
    style,
    palette: resolveDisplayPalette(style, minyan?.displayPalette),
    font: resolveDisplayFont(minyan?.displayFont)
  };
}

export function CongregantThemeFrame({
  minyan,
  children
}: {
  minyan?: CongregantMinyanOption | null;
  children: React.ReactNode;
}) {
  const theme = congregantThemeFromMinyan(minyan);
  return (
    <div
      className="congregant-theme"
      data-display-style={theme.style}
      data-display-palette={theme.palette}
      data-display-font={theme.font}
    >
      {children}
    </div>
  );
}
