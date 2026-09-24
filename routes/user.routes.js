const express = require("express");
const { requireAuth } = require("./auth.middleware");
const { getProfile, updateProfile } = require("../services/profile.service");
const { translateError } = require("../utils/error-handler");

const router = express.Router();

// Récupère le profil complet de l'utilisateur connecté
router.get("/profile", requireAuth, async (req, res) => {
  const profile = await getProfile(req.user.id, req.user.user_metadata || {});
  res.json({ profile });
});

// Met à jour le profil de l'utilisateur connecté
router.put("/profile", requireAuth, async (req, res) => {
  const { display_name, phone, avatar_url, bio, theme, sound } = req.body || {};
  if (phone !== undefined && phone !== null && phone !== "") {
    // Vérifie que le téléphone n'est pas pris par un autre compte
    const { data: existing } = await require("../supabaseClient")
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (existing && existing.id !== req.user.id) {
      return res.status(409).json({ error: "Ce numéro est déjà utilisé par un autre compte." });
    }
  }

  const result = await updateProfile(
    req.user.id,
    { display_name, phone, avatar_url, bio, theme, sound },
    req.user.user_metadata || {}
  );
  if (result.error) return res.status(500).json({ error: translateError(result.error.message) });
  res.json({ profile: result.profile, ok: true });
});

// Recherche si un numéro de téléphone appartient à un utilisateur de l'app.
// Utilisé pour l'ajout d'amis (Phase 2). Privé : ne renvoie que le profil public.
router.post("/lookup", requireAuth, async (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: "Numéro requis" });

  const supabase = require("../supabaseClient");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, phone")
    .eq("phone", phone)
    .maybeSingle();
  // Sécurité : on n'expose jamais un numéro d'un autre utilisateur
  if (error) return res.status(500).json({ error: translateError(error.message) });
  if (!profile) return res.json({ found: false });

  res.json({
    found: true,
    user: { id: profile.id, display_name: profile.display_name, avatar_url: profile.avatar_url },
  });
});

module.exports = router;