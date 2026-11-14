export async function enableJourneyNotifications(): Promise<string> {
  if (typeof Notification === "undefined")
    return "Browser notifications are unavailable. On-screen journey alerts remain active.";
  try {
    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== "granted")
      return "Notifications are off. On-screen journey alerts remain active.";
    if ("serviceWorker" in navigator)
      await navigator.serviceWorker.register("/notifications-sw.js");
    return "Journey notifications enabled. Keep SafarNav open for location updates.";
  } catch {
    return "Browser notifications could not be enabled. On-screen journey alerts remain active.";
  }
}
export async function sendJourneyNotification(body: string, tag: string) {
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  )
    return;
  try {
    const registration =
      "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistration()
        : undefined;
    if (registration?.active)
      await registration.showNotification("SafarNav · section ahead", {
        body,
        tag,
        icon: "/icon.svg",
      });
    else
      new Notification("SafarNav · section ahead", {
        body,
        tag,
        icon: "/icon.svg",
      });
  } catch {
    /* The visible alert remains available when platform notifications fail. */
  }
}
