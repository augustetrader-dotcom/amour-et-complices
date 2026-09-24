// ============================================================
// [PUSH] Routes d'abonnement aux notifications push natives.
// Le navigateur (service worker) s'abonne ici après accord de
// l'utilisateur ; le serveur stocke l'abonnement pour pouvoir
// notifier cet appareil plus tard.
// ============================================================
const express = require("express");
const supabase = require("../supabaseClient");
const { requireAuth } = require("./auth.middleware");
const { translateError } = require("../utils/error-handler");

const router = express.Router();

// GET /api/push/key — la clé publique VAPID pour le navigateur
router.get("/key", requireAuth, (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

// POST /api/push/subscribe   body: { subscription: { endpoint, keys } }
// Enregistre (ou met à jour) l'abonnement de cet appareil.
router.post("/subscribe", requireAuth, async (req, res) => {
  try {
    const { subscription } = req.body || {};
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: "Abonnement invalide" });
    }

    // Upsert sur l'endpoint (un appareil = un abonnement unique)
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: req.user.id,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        { onConflict: "endpoint" }
      );
    if (error) return res.status(500).json({ error: translateError(error.message) });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// POST /api/push/unsubscribe   body: { endpoint }
router.post("/unsubscribe", requireAuth, async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: "endpoint requis" });
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("user_id", req.user.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

module.exports = router;
