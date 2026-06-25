import { NextResponse, userAgent, type NextRequest } from "next/server";

/** עוגיה לדריסת זיהוי המכשיר: "full" = תצוגת דסקטופ/קיר, "mobile" = תצוגת מובייל. */
const VIEW_COOKIE = "viewMode";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** גיבוי לזיהוי המובנה של Next (כולל מכשירים שה־parser מפספס). */
const MOBILE_UA_RE = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Silk/i;

function isMobileRequest(request: NextRequest): boolean {
  const { device, ua } = userAgent(request);
  if (device.type === "mobile") return true;
  if (device.type === "tablet") return false;
  return MOBILE_UA_RE.test(ua);
}

export function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const path = nextUrl.pathname;
  const viewParam = nextUrl.searchParams.get("view");

  // דריסה מפורשת דרך ?view= — שומרים בעוגיה ומנקים את הכתובת בהפניה חד־פעמית.
  if (viewParam === "full" || viewParam === "mobile" || viewParam === "auto") {
    const cleanUrl = nextUrl.clone();
    cleanUrl.searchParams.delete("view");
    const response = NextResponse.redirect(cleanUrl);
    if (viewParam === "auto") {
      response.cookies.delete(VIEW_COOKIE);
    } else {
      response.cookies.set(VIEW_COOKIE, viewParam, { path: "/", maxAge: COOKIE_MAX_AGE });
    }
    return response;
  }

  const cookieMode = request.cookies.get(VIEW_COOKIE)?.value;
  const useMobile =
    cookieMode === "full" ? false : cookieMode === "mobile" ? true : isMobileRequest(request);

  if (!useMobile) {
    return NextResponse.next();
  }

  const rewriteUrl = nextUrl.clone();
  rewriteUrl.pathname = path === "/" ? "/m" : `/m${path}`;
  return NextResponse.rewrite(rewriteUrl);
}

/** רץ רק על הדפים הציבוריים; /m, /admin, /api וסטטיים לא מטופלים. */
export const config = {
  matcher: ["/", "/display", "/contact"]
};
