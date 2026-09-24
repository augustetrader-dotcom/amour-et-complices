/* ============================================================
   [PUSH] Service worker — notifications push natives.
   Enregistré par le navigateur lors de l'activation des
   notifications (bouton dans les Paramètres). Il reçoit les
   messages push du serveur et les affiche en notification
   système, même quand l'app est fermée.
   ============================================================ */

// Réception d'un push -> affiche la notification système
self.addEventListener("push", (event) => {
  let data = { title: "💌 Amour & Complices", body: "Nouveau message", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    // payload non JSON : on garde les valeurs par défaut
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || "amour-complices", // regroupe les notifs identiques
      renotify: true,
      vibrate: [100, 50, 100],
      data: { url: data.url || "/" },
    })
  );
});

// Clic sur la notification -> ouvre/centre l'application
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Si une fenêtre de l'app est déjà ouverte : on la focusse
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Sinon : on ouvre une nouvelle fenêtre
      return self.clients.openWindow(url);
    })
  );
});
