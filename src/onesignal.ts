import OneSignal from "react-onesignal";

let oneSignalStarted = false;

export async function initOneSignal() {
  if (oneSignalStarted) return;
  oneSignalStarted = true;

  await OneSignal.init({
    appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
    allowLocalhostAsSecureOrigin: true,
    serviceWorkerPath: "/OneSignalSDKWorker.js",
    serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
  });
}

export async function requestPushPermission(): Promise<boolean> {
  await initOneSignal();

  try {
    const perm = await OneSignal.Notifications.permission;
    if (perm === true) return true;

    const accepted = await OneSignal.Notifications.requestPermission();
    return !!accepted;
  } catch (err) {
    console.error("[OneSignal] requestPushPermission error", err);
    return false;
  }
}

export async function isPushEnabled(): Promise<boolean> {
  await initOneSignal();

  try {
    return !!(await OneSignal.Notifications.permission);
  } catch (err) {
    console.error("[OneSignal] isPushEnabled error", err);
    return false;
  }
}