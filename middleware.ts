import { NextResponse, userAgent, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/ssr-middleware";

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

const LOGIN_PATH = "/admin/login";
const CHANGE_PASSWORD_PATH = "/admin/change-password";

/** שער הזדהות לכל דפי /admin: מחייב סשן, ומפנה להחלפת סיסמה בכניסה ראשונה. */
async function adminAuthMiddleware(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;

  // Manifest של PWA חייב להיות ציבורי — Chrome טוען אותו בלי cookies.
  if (path.endsWith("/manifest") || path.endsWith(".webmanifest")) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  const isLogin = path === LOGIN_PATH;
  const isChangePassword = path === CHANGE_PASSWORD_PATH;

  if (!user) {
    if (isLogin) return response;
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // מחובר אך חייב להחליף סיסמה (סיסמה זמנית) — חוסמים הכל חוץ מדף ההחלפה.
  const mustChange = Boolean((user.app_metadata as { must_change_password?: boolean })?.must_change_password);
  if (mustChange && !isChangePassword) {
    const url = request.nextUrl.clone();
    url.pathname = CHANGE_PASSWORD_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // כבר מחובר ותקין — אין טעם להישאר בדף ההתחברות.
  if (isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const path = nextUrl.pathname;

  if (path.startsWith("/admin")) {
    return adminAuthMiddleware(request);
  }

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
  const isMobile = isMobileRequest(request);

  // במכשיר מובייל אמיתי — תמיד תצוגת מובייל (עוגיית view=full לא תדחוף תצוגת קיר).
  // בדסקטופ: ברירת מחדל תצוגה רגילה; ?view=mobile מאפשר תצוגת מובייל לבדיקות.
  const useMobile = isMobile ? true : cookieMode === "mobile";

  if (!useMobile) {
    return NextResponse.next();
  }

  const rewriteUrl = nextUrl.clone();
  rewriteUrl.pathname = path === "/" ? "/m" : `/m${path}`;
  return NextResponse.rewrite(rewriteUrl);
}

/** רץ על הדפים הציבוריים (תצוגת מובייל) ועל כל /admin (הזדהות). */
export const config = {
  matcher: ["/", "/display", "/contact", "/admin/:path*"]
};
