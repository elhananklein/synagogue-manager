import { NextResponse, userAgent, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/ssr-middleware";
import { parseSynagogueId, SYNAGOGUE_ID_COOKIE, SYNAGOGUE_ID_COOKIE_MAX_AGE } from "@/lib/synagogue-id";

/** עוגיה לדריסת זיהוי המכשיר: "full" = תצוגת קיר/דסקטופ, "mobile" = תצוגת מובייל. */
const VIEW_COOKIE = "viewMode";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function withSynagogueCookie(request: NextRequest, response: NextResponse): NextResponse {
  const fromQuery = parseSynagogueId(request.nextUrl.searchParams.get("synagogueId"));
  if (fromQuery) {
    response.cookies.set(SYNAGOGUE_ID_COOKIE, fromQuery, {
      path: "/",
      maxAge: SYNAGOGUE_ID_COOKIE_MAX_AGE,
      sameSite: "lax"
    });
  }
  return response;
}

function knownSynagogueId(request: NextRequest): string | null {
  return (
    parseSynagogueId(request.nextUrl.searchParams.get("synagogueId")) ??
    parseSynagogueId(request.cookies.get(SYNAGOGUE_ID_COOKIE)?.value)
  );
}

function mobileDisplayUrl(request: NextRequest, synagogueId: string): URL {
  const url = request.nextUrl.clone();
  url.pathname = "/m/display";
  url.search = "";
  url.searchParams.set("synagogueId", synagogueId);
  const minyan = request.nextUrl.searchParams.get("minyan")?.trim();
  if (minyan) url.searchParams.set("minyan", minyan);
  return url;
}

function isTvUa(ua: string) {
  return /TV|SmartTV|Smart-TV|BRAVIA|AFT[A-Z0-9]|GoogleTV|CrKey|HbbTV|Web0S|Tizen|VIDAA|Hisense|NetCast|Android TV|AppleTV|Fire TV/i.test(
    ua
  );
}

/** טלפון בלבד — לא טלוויזיה, לא סטיק, לא טאבלט בלי Mobile. */
function isPhoneRequest(request: NextRequest): boolean {
  const { device, ua } = userAgent(request);
  if (isTvUa(ua)) return false;
  if (/iPhone|iPod|IEMobile|Opera Mini/i.test(ua)) return true;
  if (/Android/i.test(ua) && /Mobile/i.test(ua) && !/iPad/i.test(ua)) return true;
  if (device.type === "mobile" && /Mobile/i.test(ua)) return true;
  return false;
}

function isTabletRequest(request: NextRequest): boolean {
  const { device, ua } = userAgent(request);
  if (isTvUa(ua) || isPhoneRequest(request)) return false;
  return device.type === "tablet" || /iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
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
    return withSynagogueCookie(request, response);
  }

  const cookieMode = request.cookies.get(VIEW_COOKIE)?.value;
  const isPhone = isPhoneRequest(request);
  const isTablet = isTabletRequest(request);
  const isDisplayPath = path === "/display" || path.startsWith("/display/");
  const isMobileDisplayPath = path === "/m/display" || path.startsWith("/m/display/");

  // קיר שכבר נפל ל־/m/display: מחזירים לתצוגת קיר, אלא אם זה טלפון אמיתי.
  if (isMobileDisplayPath && !isPhone && cookieMode !== "mobile") {
    const wallUrl = nextUrl.clone();
    wallUrl.pathname = path.replace(/^\/m/, "") || "/display";
    return withSynagogueCookie(request, NextResponse.redirect(wallUrl));
  }

  // /display = כתובת הקיר. לא בורחים למובייל בגלל עוגיה ישנה או Android של סטיק/טלוויזיה.
  let useMobile = false;
  if (cookieMode === "full") useMobile = false;
  else if (isDisplayPath) useMobile = isPhone;
  else if (cookieMode === "mobile") useMobile = true;
  else useMobile = isPhone || isTablet;

  const synagogueId = knownSynagogueId(request);
  const wantsPicker = nextUrl.searchParams.get("pick") === "1";

  // קישור/עוגייה כבר מזהים בית כנסת — לא מציגים מסך בחירה.
  if (useMobile && !wantsPicker && synagogueId && (path === "/" || path === "/m")) {
    return withSynagogueCookie(request, NextResponse.redirect(mobileDisplayUrl(request, synagogueId)));
  }

  if (!useMobile || path === "/m" || path.startsWith("/m/")) {
    return withSynagogueCookie(request, NextResponse.next());
  }

  const mobileUrl = nextUrl.clone();
  if (path === "/" && synagogueId && !wantsPicker) {
    mobileUrl.pathname = "/m/display";
    mobileUrl.search = "";
    mobileUrl.searchParams.set("synagogueId", synagogueId);
    const minyan = nextUrl.searchParams.get("minyan")?.trim();
    if (minyan) mobileUrl.searchParams.set("minyan", minyan);
  } else {
    mobileUrl.pathname = path === "/" ? "/m" : `/m${path}`;
  }
  return withSynagogueCookie(request, NextResponse.redirect(mobileUrl));
}

/** רץ על הדפים הציבוריים (תצוגת מובייל) ועל כל /admin (הזדהות). */
export const config = {
  matcher: ["/", "/display", "/contact", "/m", "/m/:path*", "/admin/:path*"]
};
