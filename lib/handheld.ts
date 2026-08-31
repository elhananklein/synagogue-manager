/** טלוויזיה / סטיק / קונסולת מסך — לא טלפון. */
export function isTvUserAgent(ua: string) {
  return /TV|SmartTV|Smart-TV|BRAVIA|AFT[A-Z0-9]|GoogleTV|CrKey|HbbTV|Web0S|Tizen|VIDAA|Hisense|NetCast|Android TV|AppleTV|Fire TV/i.test(
    ua
  );
}

/**
 * טלפון אמיתי בלבד.
 * לא Android סתם (טלוויזיה/סטיק/טאבלט), לא iPad.
 */
export function isPhoneUserAgent(ua: string) {
  if (!ua || isTvUserAgent(ua)) return false;
  if (/iPhone|iPod|IEMobile|Opera Mini/i.test(ua)) return true;
  if (/Android/i.test(ua) && /Mobile/i.test(ua) && !/iPad/i.test(ua)) return true;
  return false;
}

export function isTabletUserAgent(ua: string) {
  if (!ua || isTvUserAgent(ua) || isPhoneUserAgent(ua)) return false;
  return /iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
}

/** זיהוי מכשיר כף־יד בדפדפן — כולל iPad שמתחזה למק. לא כולל טלוויזיה. */
export function isHandheldBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (isTvUserAgent(ua)) return false;
  if (isPhoneUserAgent(ua) || isTabletUserAgent(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function isPhoneBrowser() {
  if (typeof navigator === "undefined") return false;
  return isPhoneUserAgent(navigator.userAgent);
}

export function wantsDesktopWallOverride() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") === "full") return true;
  return document.cookie.split("; ").some((part) => part === "viewMode=full");
}

/** מסך קיר טיפוסי — לא טלפון ביד. */
export function isWallSizedScreen() {
  if (typeof window === "undefined") return false;
  return Math.min(window.innerWidth, window.innerHeight) >= 700 && Math.max(window.innerWidth, window.innerHeight) >= 1100;
}
