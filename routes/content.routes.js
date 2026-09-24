const express = require("express");
const supabase = require("../supabaseClient");
const { translateError } = require("../utils/error-handler");

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

module.exports = router;
