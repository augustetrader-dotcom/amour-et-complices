const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");
const { translateError } = require("../utils/error-handler");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET /api/love-quiz/questions - Récupérer les questions du questionnaire
router.get("/questions", async (req, res) => {
  try {
    // Lire le fichier JSON des questions
    const fs = require("fs");
    const path = require("path");
    const questionsPath = path.join(__dirname, "../content/love_quiz_questions.json");
    
    const questionsData = JSON.parse(fs.readFileSync(questionsPath, "utf8"));
    res.json(questionsData);
  } catch (error) {
    console.error("Erreur lors de la récupération des questions:", error);
    res.status(500).json({ error: translateError(error.message) });
  }
});

// GET /api/love-quiz/responses - Récupérer les réponses de l'utilisateur
router.get("/responses", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return res.status(401).json({ error: "Token invalide" });
    }

    const { data: responses, error } = await supabase
      .from("love_quiz_responses")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") { // PGRST116 = not found
      throw error;
    }

    res.json(responses || { responses: {}, personalization_settings: {} });
  } catch (error) {
    console.error("Erreur lors de la récupération des réponses:", error);
    res.status(500).json({ error: translateError(error.message) });
  }
});

// POST /api/love-quiz/responses - Sauvegarder les réponses du questionnaire
router.post("/responses", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return res.status(401).json({ error: "Token invalide" });
    }

    const { responses, personalization_settings } = req.body;

    // Validation : vérifier que l'utilisateur a répondu à toutes les questions
    if (!responses || typeof responses !== 'object') {
      return res.status(400).json({ error: "Réponses invalides" });
    }

    // Vérifier que chaque question a au moins une réponse
    const requiredQuestions = [1, 2, 3, 4, 6, 8, 9, 10, 11]; // Questions à choix unique
    const multipleChoiceQuestions = [5, 7, 12]; // Questions à choix multiples

    // Vérifier les questions à choix unique
    for (const questionId of requiredQuestions) {
      if (!responses[questionId]) {
        return res.status(400).json({ error: `Veuillez répondre à la question ${questionId}` });
      }
    }

    // Vérifier les questions à choix multiples (au moins une sélection)
    for (const questionId of multipleChoiceQuestions) {
      if (!responses[questionId] || !Array.isArray(responses[questionId]) || responses[questionId].length === 0) {
        return res.status(400).json({ error: `Veuillez sélectionner au moins une option pour la question ${questionId}` });
      }
    }

    // Calculer les paramètres de personnalisation basés sur les réponses
    const settings = calculatePersonalization(responses);

    // Vérifier si l'utilisateur a déjà des réponses
    const { data: existingResponses } = await supabase
      .from("love_quiz_responses")
      .select("*")
      .eq("user_id", user.id)
      .single();

    let data;
    let error;

    if (existingResponses) {
      // Mettre à jour les réponses existantes
      const result = await supabase
        .from("love_quiz_responses")
        .update({
          responses: responses,
          personalization_settings: personalization_settings || settings,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user.id)
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    } else {
      // Créer de nouvelles réponses
      const result = await supabase
        .from("love_quiz_responses")
        .insert({
          user_id: user.id,
          responses: responses,
          personalization_settings: personalization_settings || settings,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    }

    if (error) throw error;

    // Marquer le questionnaire comme complété dans le profil
    await supabase
      .from("profiles")
      .update({ love_quiz_completed: true })
      .eq("id", user.id);

    res.json(data);
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des réponses:", error);
    res.status(500).json({ error: "Erreur lors de la sauvegarde des réponses" });
  }
});

// Fonction pour calculer les paramètres de personnalisation
function calculatePersonalization(responses) {
  const settings = {
    theme: "default",
    notification_style: "gentle",
    content_tone: "sweet",
    feature_priorities: [],
    notification_preferences: [],
    content_recommendations: []
  };

  // Mapping des réponses aux paramètres
  Object.keys(responses).forEach(questionId => {
    const answer = responses[questionId];
    
    // Thème basé sur la préférence d'ambiance (question 2)
    if (questionId === "2") {
      const themeMap = {
        "romantic": "default",
        "passionate": "blush",
        "playful": "sunset",
        "calm": "emerald",
        "adventurous": "noir"
      };
      settings.theme = themeMap[answer] || "default";
    }

    // Style de notification basé sur le style de communication (question 6)
    if (questionId === "6") {
      const notificationMap = {
        "direct": "immediate",
        "subtle": "gentle",
        "creative": "playful",
        "humorous": "fun",
        "actions": "minimal"
      };
      settings.notification_style = notificationMap[answer] || "gentle";
    }

    // Ton de contenu basé sur la personnalité (question 8)
    if (questionId === "8") {
      const toneMap = {
        "romantic": "sweet",
        "adventurous": "energetic",
        "humorous": "funny",
        "thoughtful": "deep",
        "passionate": "intense"
      };
      settings.content_tone = toneMap[answer] || "sweet";
    }

    // Priorités de fonctionnalités basées sur l'objectif (question 9)
    if (questionId === "9") {
      const priorityMap = {
        "communication": ["chat", "notifications"],
        "fun": ["games", "quiz"],
        "memories": ["stories", "photos"],
        "growth": ["quiz", "compatibility"],
        "intimacy": ["private_messages", "once_view"]
      };
      settings.feature_priorities = priorityMap[answer] || [];
    }

    // Préférences de notification (question 7)
    if (questionId === "7" && Array.isArray(answer)) {
      settings.notification_preferences = answer;
    }

    // Recommandations de contenu basées sur les activités (question 5)
    if (questionId === "5" && Array.isArray(answer)) {
      const contentMap = {
        "dinners": ["date_ideas"],
        "movies": ["date_ideas", "romantic_messages"],
        "travel": ["date_ideas", "memory_prompts"],
        "sports": ["date_ideas"],
        "games": ["couple_games"],
        "cooking": ["date_ideas"],
        "music": ["romantic_messages"],
        "nature": ["date_ideas", "memory_prompts"]
      };
      
      answer.forEach(activity => {
        if (contentMap[activity]) {
          settings.content_recommendations.push(...contentMap[activity]);
        }
      });
      
      // Dédupliquer
      settings.content_recommendations = [...new Set(settings.content_recommendations)];
    }
  });

  return settings;
}

// GET /api/love-quiz/personalization - Obtenir les paramètres de personnalisation
router.get("/personalization", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return res.status(401).json({ error: "Token invalide" });
    }

    const { data: responses, error } = await supabase
      .from("love_quiz_responses")
      .select("personalization_settings")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    // Si pas de réponses, retourner les paramètres par défaut
    const defaultSettings = {
      theme: "default",
      notification_style: "gentle",
      content_tone: "sweet",
      feature_priorities: [],
      notification_preferences: ["messages"],
      content_recommendations: ["romantic_messages", "couple_games"]
    };

    res.json(responses?.personalization_settings || defaultSettings);
  } catch (error) {
    console.error("Erreur lors de la récupération de la personnalisation:", error);
    res.status(500).json({ error: translateError(error.message) });
  }
});

module.exports = router;