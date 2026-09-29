const express = require("express");
const supabase = require("../supabaseClient");
const { requireAuth } = require("./auth.middleware");
const { getProfile, updateProfile } = require("../services/profile.service");
// [PHASE 2] Création automatique de la conversation "couple" si absente
const { ensureCoupleConversation } = require("../services/conversation.service");
const { translateError } = require("../utils/error-handler");

const router = express.Router();

// [PHASE 2] La simulation de messages en mémoire a été SUPPRIMÉE :
// le chat couple passe par chat.routes.js (table `messages`), et les
// amis/groupes par friends.routes.js + group.routes.js (Supabase réel).

function generateInviteCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sans caractères ambigus
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

// POST /api/couple/create-invite
router.post("/create-invite", requireAuth, async (req, res) => {
  const code = generateInviteCode();
  const { error } = await supabase.from("invites").insert({ code, user_id: req.user.id });
  if (error) return res.status(500).json({ error: translateError(error.message) });
  res.json({ code });
});

// POST /api/couple/join  body: { code }
router.post("/join", requireAuth, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Code requis" });

  const { data: invite, error: inviteError } = await supabase
    .from("invites")
    .select("*")
    .eq("code", code.toUpperCase())
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (inviteError) return res.status(500).json({ error: translateError(inviteError.message) });
  if (!invite) return res.status(404).json({ error: "Code invalide ou expiré" });
  if (invite.user_id === req.user.id) return res.status(400).json({ error: "Tu ne peux pas utiliser ton propre code" });

  // Vérifie si le couple existe déjà
  const { data: existingCouple } = await supabase
    .from("couples")
    .select("*")
    .or(`and(user_a.eq.${invite.user_id},user_b.eq.${req.user.id}),and(user_a.eq.${req.user.id},user_b.eq.${invite.user_id})`)
    .maybeSingle();

  if (existingCouple) {
    await supabase.from("invites").delete().eq("code", code.toUpperCase());
    return res.json({ coupleId: existingCouple.id });
  }

  const { data: couple, error: coupleError } = await supabase
    .from("couples")
    .insert({ user_a: invite.user_id, user_b: req.user.id })
    .select()
    .single();

  if (coupleError) return res.status(500).json({ error: translateError(coupleError.message) });

  await supabase.from("invites").delete().eq("code", code.toUpperCase());

  res.json({ coupleId: couple.id });
});

// POST /api/couple/instant-connect
// [PHASE 0] Endpoint neutralisé et sécurisé : il ne fait QUE vérifier si
// l'utilisateur connecté possède déjà un couple. Aucun pairage aléatoire
// n'est plus possible (l'ancien fallback qui associahit à un compte
// RANDOM d'un vrai utilisateur a été retiré — fuite de données).
// Pas de partenaire -> { couple: null } et le frontend passe en mode solo.
router.post("/instant-connect", requireAuth, async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from("couples")
      .select("id")
      .or(`user_a.eq.${req.user.id},user_b.eq.${req.user.id}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) return res.json({ coupleId: existing.id });
    res.json({ couple: null });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// POST /api/couple/heartbeat
// Signal de vie envoyé par le frontend (~28s) pour last_seen / "En ligne".
router.post("/heartbeat", requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", req.user.id);
    if (error) return res.status(500).json({ error: translateError(error.message) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// GET /api/couple/mine
router.get("/mine", requireAuth, async (req, res) => {
  const { data: couples, error } = await supabase
    .from("couples")
    .select("*")
    .or(`user_a.eq.${req.user.id},user_b.eq.${req.user.id}`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) return res.status(500).json({ error: translateError(error.message) });
  const couple = couples && couples.length > 0 ? couples[0] : null;
  if (!couple) return res.json({ couple: null, partner: null });

  const partnerId = couple.user_a === req.user.id ? couple.user_b : couple.user_a;

  // [PHASE 2] Garantit qu'une conversation "couple" existe (couples créés
  // avant la migration : le trigger SQL ne s'applique qu'aux nouveaux).
  const conversationSetup = ensureCoupleConversation(couple);

  let partnerInfo = { id: partnerId, nickname: "Moitié", avatar: null, last_seen: null, phone: null, is_online: false };

  try {
    const [profileResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", partnerId).maybeSingle(),
      conversationSetup,
    ]);
    const partnerProfile = profileResult.data;
    if (partnerProfile) {
      // [PHASE 1] Présence : "en ligne" = heartbeat de moins de 90s
      const isOnline =
        !!partnerProfile.last_seen && Date.now() - new Date(partnerProfile.last_seen).getTime() < 90_000;
      partnerInfo = {
        id: partnerId,
        email: null,
        nickname: partnerProfile.display_name || "Moitié",
        avatar: partnerProfile.avatar_url || null,
        phone: partnerProfile.phone || null,
        last_seen: partnerProfile.last_seen,
        is_online: isOnline,
      };
    } else {
      const { data: partnerUser } = await supabase.auth.admin.getUserById(partnerId);
      if (partnerUser?.user) {
        partnerInfo = {
          id: partnerId,
          email: partnerUser.user.email,
          nickname: partnerUser.user.user_metadata?.nickname || "Moitié",
          avatar: partnerUser.user.user_metadata?.avatar || null,
          phone: partnerUser.user.user_metadata?.phone || null,
          last_seen: partnerUser.user.user_metadata?.last_seen || null,
        };
      }
    }
  } catch (e) {
    console.log("Impossible de charger le profil du partenaire:", e.message);
  }

  res.json({ couple, partner: partnerInfo });
});

// GET /api/couple/profile
router.get("/profile", requireAuth, async (req, res) => {
  const profile = await getProfile(req.user.id, req.user.user_metadata || {});
  res.json({
    id: req.user.id,
    email: req.user.email,
    nickname: profile.display_name || (req.user.email ? req.user.email.split("@")[0] : "Moi"),
    avatar: profile.avatar_url || null,
    phone: profile.phone || null,
    background: profile.background || req.user.user_metadata?.background || null,
    last_seen: req.user.user_metadata?.last_seen || new Date().toISOString(),
    theme: profile.theme || "default",
  });
});

// POST /api/couple/profile
router.post("/profile", requireAuth, async (req, res) => {
  const { nickname, avatar, background, phone } = req.body;
  const result = await updateProfile(
    req.user.id,
    { display_name: nickname, avatar_url: avatar, phone, theme: req.body.theme },
    req.user.user_metadata || {}
  );
  if (result.error) return res.status(500).json({ error: translateError(result.error.message) });
  res.json({ ok: true, profile: result.profile || {} });
});

// [PHASE 0] Les anciennes routes /api/couple/messages (simulation en
// mémoire, jamais utilisées par le vrai chat) ont été SUPPRIMÉES.
// Le chat couple réel vit dans routes/chat.routes.js.

module.exports = router;
