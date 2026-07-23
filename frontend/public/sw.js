/* Timesheet Portal service worker.
 *
 * Handles incoming Web Push messages (dispatched by the Go backend's 17:00 WIB
 * cron reminder) and renders a native browser notification. Clicking the
 * notification focuses an existing tab or opens the dashboard.
 */

self.addEventListener("install", (event) => {
  // Activate this worker immediately without waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Timesheet Portal",
    body: "Waktunya isi timesheet hari ini!",
    url: "/dashboard",
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    tag: "timesheet-reminder",
    renotify: true,
    data: { url: payload.url || "/dashboard" },
    actions: [{ action: "open", title: "Isi Sekarang" }],
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
