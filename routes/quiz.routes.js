const express = require("express");
const supabase = require("../supabaseClient");
const { requireAuth } = require("./auth.middleware");
const {
  computeScores,
  getPrimaryLanguage,
  computeCompatibilityScore,
  generateInsights,
} = require("../services/compatibility.service");
const { translateError } = require("../utils/error-handler");

const router = express.Router();

// GET /api/quiz/questions
router.get("/questions", async (req, res) => {
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("*")
    .order("order_index", { ascending: true });

  if (error) return res.status(500).json({ error: translateError(error.message) });
  res.json({ questions: data });
});

// POST /api/quiz/submit   body: { answers: [{ chosen_language }, ...] }
router.post("/submit", requireAuth, async (req, res) => {
  const { answers } = req.body;
  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: "Réponses manquantes" });
  }

  const scores = computeScores(answers);
  const primaryLanguage = getPrimaryLanguage(scores);

  const { data, error } = await supabase
    .from("quiz_results")
    .insert({ user_id: req.user.id, scores, primary_language: primaryLanguage })
    .select()
    .single();

  if (error) return res.status(500).json({ error: translateError(error.message) });
  res.json({ result: data });
});

// GET /api/quiz/compatibility?coupleId=...
router.get("/compatibility", requireAuth, async (req, res) => {
  const { coupleId } = req.query;

  const { data: couple, error: coupleError } = await supabase
    .from("couples")
    .select("*")
    .eq("id", coupleId)
    .single();

  if (coupleError || !couple) return res.status(404).json({ error: "Couple introuvable" });
  if (couple.user_a !== req.user.id && couple.user_b !== req.user.id) {
    return res.status(403).json({ error: "Accès refusé" });
  }

  const [{ data: resultA }, { data: resultB }] = await Promise.all([
    supabase.from("quiz_results").select("*").eq("user_id", couple.user_a).order("completed_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("quiz_results").select("*").eq("user_id", couple.user_b).order("completed_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (!resultA || !resultB) {
    return res.status(409).json({ error: "Les deux partenaires n'ont pas encore terminé le quiz" });
  }

  const compatibilityScore = computeCompatibilityScore(resultA.scores, resultB.scores);
  const insights = generateInsights(resultA.scores, resultB.scores);

  const { data: saved, error: saveError } = await supabase
    .from("couple_compatibility")
    .insert({
      couple_id: coupleId,
      user_a_result_id: resultA.id,
      user_b_result_id: resultB.id,
      compatibility_score: compatibilityScore,
      shared_insights: insights,
    })
    .select()
    .single();

  if (saveError) return res.status(500).json({ error: translateError(saveError.message) });
  res.json({ compatibility: saved });
});

module.exports = router;
