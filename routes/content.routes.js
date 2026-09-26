const express = require("express");
const supabase = require("../supabaseClient");
const { translateError } = require("../utils/error-handler");
const { requireAuth } = require("./auth.middleware");

const router = express.Router();

// GET /api/content/games
router.get("/games", async (req, res) => {
  const { data, error } = await supabase.from("game_cards").select("*");
  if (error) return res.status(500).json({ error: translateError(error.message) });
  res.json({ cards: data });
});

// GET /api/content/words
router.get("/words", async (req, res) => {
  const { data, error } = await supabase.from("sweet_messages").select("*");
  if (error) return res.status(500).json({ error: translateError(error.message) });
  res.json({ messages: data });
});

// GET /api/content/truth-dare
// [PHASE 4] Banque de cartes "Action ou Vérité" (3 niveaux :
// doux / complice / osé). Le frontend filtre et pioche aléatoirement.
router.get("/truth-dare", async (req, res) => {
  const { data, error } = await supabase.from("truth_dare_cards").select("*");
  if (error) return res.status(500).json({ error: translateError(error.message) });
  res.json({ cards: data });
});

// GET /api/content/gifs?q=... — proxy authentifié pour ne pas exposer la clé Tenor.
router.get("/gifs", requireAuth, async (req, res) => {
  const query = String(req.query.q || "").trim().slice(0, 100);
  const apiKey = process.env.TENOR_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "La recherche GIF n'est pas configurée. Ajoute TENOR_API_KEY dans le fichier .env du serveur." });
  if (!query) return res.status(400).json({ error: "Saisis un mot-clé pour rechercher un GIF." });

  try {
    const params = new URLSearchParams({
      key: apiKey,
      client_key: "amour_complices",
      q: query,
      limit: "12",
      media_filter: "gif",
      contentfilter: "medium",
      locale: "fr_FR"
    });
    const response = await fetch(`https://tenor.googleapis.com/v2/search?${params}`, {
      signal: AbortSignal.timeout(8000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(502).json({ error: "La recherche Tenor a échoué. Vérifie la clé API et son activation." });
    res.set("Cache-Control", "private, max-age=30");
    res.json({ results: data.results || [] });
  } catch (error) {
    res.status(502).json({ error: "Tenor est momentanément inaccessible. Réessaie dans un instant." });
  }
});

module.exports = router;
