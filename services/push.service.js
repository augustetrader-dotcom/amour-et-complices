// ============================================================
// [PUSH] Service de notifications push natives (Web Push / VAPID).
// Envoie une notification système au téléphone de l'utilisateur,
// même quand l'app est fermée. Nécessite :
//   - les clés VAPID dans .env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)
//   - le service worker public/sw.js côté navigateur
//   - un abonnement enregistré (table push_subscriptions)
// ============================================================
const webpush = require("web-push");
const supabase = require("../supabaseClient");

// Configuration : on ne force pas si les clés manquent (l'app
// continue de fonctionner sans push, juste sans notifications système).
let configured = false;
try {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:contact@amour-complices.app",
      pub,
      priv
    );
    configured = true;
  } else {
    console.log("[PUSH] Clés VAPID absentes du .env : notifications push désactivées.");
  }
} catch (e) {
  console.log("[PUSH] Configuration invalide :", e.message);
}

// ------------------------------------------------------------
// Envoie une notification push à TOUS les appareils d'un utilisateur.
// payload = { title, body, tag?, url? }
// Nettoie automatiquement les abonnements morts (erreur 404/410).
// ------------------------------------------------------------
async function sendPushToUser(userId, payload) {
  if (!configured) return;

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);
  if (!subscriptions || subscriptions.length === 0) return;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload)
        );
      } catch (err) {
        // 404/410 = abonnement expiré ou navigateur a purgé -> on supprime
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );
}

module.exports = { sendPushToUser, configured };
