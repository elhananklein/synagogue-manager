/** זיהוי מכשיר כף־יד בדפדפן — כולל iPad שמתחזה למק. */
export function isHandheldBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Silk|iPad/i.test(ua)) {
    return true;
  }
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function wantsDesktopWallOverride() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") === "full") return true;
  return document.cookie.split("; ").some((part) => part === "viewMode=full");
}
