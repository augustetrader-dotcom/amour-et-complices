// ============================================================
// [JEU SYNCHRONISÉ] Routes du Défi complice — état partagé en base.
// Avant : chaque partenaire piochait sa propre carte dans son navigateur
// (aucune sync, aucune notif). Désormais l'état vit dans la table
// `game_state` : même carte pour les deux, révélation croisée équitable.
// ============================================================
const express = require("express");
const supabase = require("../supabaseClient");
const { requireAuth } = require("./auth.middleware");
const { translateError } = require("../utils/error-handler");

const router = express.Router();

// Vérifie que l'utilisateur est bien membre du couple demandé
async function getCoupleFor(coupleId, userId) {
  const { data: couple } = await supabase
    .from("couples")
    .select("*")
    .eq("id", coupleId)
    .maybeSingle();
  if (!couple || (couple.user_a !== userId && couple.user_b !== userId)) return null;
  return couple;
}

// Lit la ligne d'état du jeu du couple (ou null si aucune partie)
async function getStateRow(coupleId) {
  const { data } = await supabase
    .from("game_state")
    .select("*")
    .eq("couple_id", coupleId)
    .maybeSingle();
  return data || null;
}

// ------------------------------------------------------------
// Construit la réponse PERSONNALISÉE selon qui demande :
// - chacun voit sa propre réponse (my_answer)
// - la réponse du partenaire n'est JAMAIS envoyée avant que les
//   deux aient répondu -> jeu équitable, pas de triche possible
// ------------------------------------------------------------
function buildState(state, couple, myId) {
  if (!state || !state.card_prompt) return null;

  const answers = state.answers || {};
  const partnerId = couple.user_a === myId ? couple.user_b : couple.user_a;
  const mine = answers[myId] || null;
  const partner = answers[partnerId] || null;
  const revealed = !!mine && !!partner; // révélation croisée uniquement

  return {
    card: { id: state.card_id, prompt: state.card_prompt, category: state.card_category },
    my_answer: mine,
    partner_answered: !!partner,
    partner_answer: revealed ? partner : null, // secret tant que pas les deux
    revealed,
  };
}

// ------------------------------------------------------------
// GET /api/game/state?coupleId=...
// État actuel de la partie (null si aucune carte en cours)
// ------------------------------------------------------------
router.get("/state", requireAuth, async (req, res) => {
  try {
    const couple = await getCoupleFor(req.query.coupleId, req.user.id);
    if (!couple) return res.status(403).json({ error: "Accès refusé" });

    const state = await getStateRow(couple.id);
    res.json({ state: buildState(state, couple, req.user.id) });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// ------------------------------------------------------------
// POST /api/game/draw   body: { coupleId }
// Pioche une carte AU HASARD dans la banque (150 cartes) et
// l'enregistre comme partie en cours du couple -> les deux
// partenaires partagent exactement la même carte.
// ------------------------------------------------------------
router.post("/draw", requireAuth, async (req, res) => {
  try {
    const { coupleId } = req.body || {};
    const couple = await getCoupleFor(coupleId, req.user.id);
    if (!couple) return res.status(403).json({ error: "Accès refusé" });

    // Tirage aléatoire : on compte les cartes puis on prend un offset au hasard
    const { count } = await supabase
      .from("game_cards")
      .select("*", { count: "exact", head: true });
    const total = count || 0;
    if (total === 0) return res.status(404).json({ error: "Aucune carte en banque (npm run seed ?)" });
    const offset = Math.floor(Math.random() * total);

    const { data: cards, error: cardError } = await supabase
      .from("game_cards")
      .select("*")
      .range(offset, offset);
    if (cardError || !cards || cards.length === 0) {
      return res.status(500).json({ error: translateError(cardError?.message) || "Carte introuvable" });
    }
    const card = cards[0];

    // Enregistre la nouvelle partie (réponses réinitialisées)
    const { data: state, error: upsertError } = await supabase
      .from("game_state")
      .upsert({
        couple_id: couple.id,
        card_id: card.id,
        card_prompt: card.prompt,
        card_category: card.category,
        answers: {},
        status: "waiting",
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (upsertError) return res.status(500).json({ error: translateError(upsertError.message) });

    res.json({ state: buildState(state, couple, req.user.id) });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// ------------------------------------------------------------
// POST /api/game/answer   body: { coupleId, text }
// Enregistre ma réponse. Si les deux partenaires ont répondu ->
// statut "revealed" : les deux réponses deviennent visibles des deux côtés.
// ------------------------------------------------------------
router.post("/answer", requireAuth, async (req, res) => {
  try {
    const { coupleId, text } = req.body || {};
    if (!text || !String(text).trim()) return res.status(400).json({ error: "Réponse requise" });

    const couple = await getCoupleFor(coupleId, req.user.id);
    if (!couple) return res.status(403).json({ error: "Accès refusé" });

    const state = await getStateRow(couple.id);
    if (!state || !state.card_prompt) return res.status(404).json({ error: "Pioche d'abord une carte !" });

    // Fusionne les réponses sans écraser celle du partenaire
    const answers = { ...(state.answers || {}), [req.user.id]: String(text).trim() };
    const partnerId = couple.user_a === req.user.id ? couple.user_b : couple.user_a;
    const bothAnswered = !!answers[partnerId];

    const { data: updated, error } = await supabase
      .from("game_state")
      .update({
        answers,
        status: bothAnswered ? "revealed" : "waiting",
        updated_at: new Date().toISOString(),
      })
      .eq("couple_id", couple.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: translateError(error.message) });

    res.json({ state: buildState(updated, couple, req.user.id) });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

module.exports = router;
