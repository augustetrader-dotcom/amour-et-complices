// ============================================================
// [PHASE 2] Routes AMIS réelles (Supabase) — remplace l'ancien
// stockage "en mémoire" qui perdait tout au redémarrage.
//
// Fonctionnement (comme WhatsApp) :
//   1. J'ajoute un ami par son numéro de téléphone
//   2. Si le numéro existe dans l'app -> demande d'ami envoyée
//   3. L'ami accepte -> amitié créée + conversation 1:1 ouverte
// ============================================================
const express = require("express");
const supabase = require("../supabaseClient");
const { requireAuth } = require("./auth.middleware");
const { translateError } = require("../utils/error-handler");
const {
  normalizePhone,
  findProfileByPhone,
  findOrCreateFriendConversation,
} = require("../services/conversation.service");

const router = express.Router();

// ------------------------------------------------------------
// Construit une ligne "ami" enrichie avec le profil de l'ami
// et l'id de la conversation 1:1 associée (pour ouvrir le chat).
// ------------------------------------------------------------
async function buildFriendRow(myId, friendId) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, phone, last_seen")
    .eq("id", friendId)
    .maybeSingle();

  // "En ligne" = signal de vie de moins de 90 secondes
  const isOnline =
    !!profile?.last_seen && Date.now() - new Date(profile.last_seen).getTime() < 90_000;

  // Trouve (ou crée) la conversation 1:1 entre nous deux
  let conversationId = null;
  try {
    conversationId = await findOrCreateFriendConversation(myId, friendId);
  } catch (e) {
    console.log("findOrCreateFriendConversation:", e.message);
  }

  return {
    id: friendId,
    display_name: profile?.display_name || "Ami",
    avatar_url: profile?.avatar_url || "💫",
    phone: profile?.phone || null,
    last_seen: profile?.last_seen || null,
    is_online: isOnline,
    conversation_id: conversationId,
  };
}

// ------------------------------------------------------------
// GET /api/friends
// Retourne : mes amis acceptés + demandes reçues + demandes envoyées
// ------------------------------------------------------------
router.get("/", requireAuth, async (req, res) => {
  try {
    const myId = req.user.id;

    // 1. Mes amitiés acceptées (stockées dans les deux sens)
    const { data: friendRows, error: friendsError } = await supabase
      .from("friends")
      .select("user_id, friend_id")
      .or(`user_id.eq.${myId},friend_id.eq.${myId}`);
    if (friendsError) return res.status(500).json({ error: translateError(friendsError.message) });

    // [CORRECTION DOUBLONS] L'amitié est stockée dans les DEUX sens
    // (A→B et B→A), donc une même personne apparaissait 2 fois.
    // On déduplique avec Set avant de construire la liste.
    const friendIds = [...new Set(
      (friendRows || []).map((r) => (r.user_id === myId ? r.friend_id : r.user_id))
    )];
    const friends = [];
    for (const fid of friendIds) {
      friends.push(await buildFriendRow(myId, fid));
    }

    // 2. Demandes d'ami REÇUES (avec profil de l'expéditeur)
    const { data: incomingRows } = await supabase
      .from("friend_requests")
      .select("id, from_user, created_at")
      .eq("to_user", myId)
      .eq("status", "pending");

    const incoming = [];
    for (const r of incomingRows || []) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, phone")
        .eq("id", r.from_user)
        .maybeSingle();
      incoming.push({
        request_id: r.id,
        user: {
          id: p?.id || r.from_user,
          display_name: p?.display_name || "Quelqu'un",
          avatar_url: p?.avatar_url || "💫",
          phone: p?.phone || null,
        },
        created_at: r.created_at,
      });
    }

    // 3. Demandes d'ami ENVOYÉES (en attente de réponse)
    const { data: outgoingRows } = await supabase
      .from("friend_requests")
      .select("id, to_user, created_at")
      .eq("from_user", myId)
      .eq("status", "pending");

    const outgoing = [];
    for (const r of outgoingRows || []) {
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", r.to_user)
        .maybeSingle();
      outgoing.push({ request_id: r.id, display_name: p?.display_name || "…", created_at: r.created_at });
    }

    res.json({ friends, requests: { incoming, outgoing } });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// ------------------------------------------------------------
// POST /api/friends/request   body: { phone }
// Ajoute un ami par numéro de téléphone (comme WhatsApp).
// - Numéro inconnu        -> erreur claire "pas sur l'app"
// - Déjà amis             -> erreur "déjà dans vos contacts"
// - Demande inverse pende -> acceptation automatique (mutuel)
// - Sinon                 -> demande d'ami créée
// ------------------------------------------------------------
router.post("/request", requireAuth, async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone) return res.status(400).json({ error: "Numéro de téléphone requis" });

    const target = await findProfileByPhone(phone);
    if (!target) {
      return res.status(404).json({
        error: "Ce numéro n'est pas sur Amour & Complices. Invite la personne à créer un compte !",
      });
    }
    if (target.id === req.user.id) {
      return res.status(400).json({ error: "Tu ne peux pas t'ajouter toi-même 🙂" });
    }

    // Déjà amis ?
    const { data: existingFriend } = await supabase
      .from("friends")
      .select("user_id")
      .or(`and(user_id.eq.${req.user.id},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${req.user.id})`)
      .maybeSingle();
    if (existingFriend) {
      return res.status(409).json({ error: "Vous êtes déjà amis ✅" });
    }

    // Demande inverse en attente ? -> acceptation automatique
    const { data: reverse } = await supabase
      .from("friend_requests")
      .select("id")
      .eq("from_user", target.id)
      .eq("to_user", req.user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (reverse) {
      await acceptRequestById(reverse.id, target.id, req.user.id);
      return res.json({ ok: true, auto_accepted: true, friend_id: target.id });
    }

    // Crée la demande (upsert pour éviter les doublons)
    const { error } = await supabase
      .from("friend_requests")
      .upsert(
        { from_user: req.user.id, to_user: target.id, status: "pending" },
        { onConflict: "from_user,to_user" }
      );
    if (error) return res.status(500).json({ error: translateError(error.message) });

    res.json({ ok: true, sent: true, target: { id: target.id, display_name: target.display_name } });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// ------------------------------------------------------------
// Accepte une demande d'ami (interne + route).
// Crée l'amitié dans les 2 sens + la conversation 1:1.
// ------------------------------------------------------------
async function acceptRequestById(requestId, fromUserId, toUserId) {
  // 1. Marque la demande comme acceptée
  await supabase.from("friend_requests").update({ status: "accepted" }).eq("id", requestId);

  // 2. Crée l'amitié dans les deux sens (idempotent)
  await supabase.from("friends").upsert(
    [
      { user_id: fromUserId, friend_id: toUserId },
      { user_id: toUserId, friend_id: fromUserId },
    ],
    { onConflict: "user_id,friend_id" }
  );

  // 3. Ouvre la conversation 1:1
  await findOrCreateFriendConversation(fromUserId, toUserId);
}

// POST /api/friends/accept   body: { requestId }
router.post("/accept", requireAuth, async (req, res) => {
  try {
    const { requestId } = req.body || {};
    if (!requestId) return res.status(400).json({ error: "requestId requis" });

    const { data: request } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("id", requestId)
      .eq("to_user", req.user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (!request) return res.status(404).json({ error: "Demande introuvable ou déjà traitée" });

    await acceptRequestById(request.id, request.from_user, request.to_user);
    res.json({ ok: true, friend_id: request.from_user });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// POST /api/friends/decline   body: { requestId }
router.post("/decline", requireAuth, async (req, res) => {
  try {
    const { requestId } = req.body || {};
    if (!requestId) return res.status(400).json({ error: "requestId requis" });

    const { error } = await supabase
      .from("friend_requests")
      .update({ status: "declined" })
      .eq("id", requestId)
      .eq("to_user", req.user.id);
    if (error) return res.status(500).json({ error: translateError(error.message) });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

module.exports = router;
