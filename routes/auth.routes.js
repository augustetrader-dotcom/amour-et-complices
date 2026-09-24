const express = require("express");
const supabase = require("../supabaseClient");
const { translateError } = require("../utils/error-handler");

const router = express.Router();

// POST /api/auth/login
// Connexion ultra simple avec email et mot de passe
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis" });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });

  if (error) {
    let msg = error.message;
    if (msg.includes("Invalid login credentials")) {
      msg = "Email ou mot de passe incorrect.";
    }
    // Traduire d'autres messages d'erreur courants de Supabase
    if (msg.includes("Email not confirmed")) {
      msg = "Email non confirmé. Veuillez vérifier votre boîte mail.";
    }
    if (msg.includes("User already registered")) {
      msg = "Un compte avec cet email existe déjà. Connectez-vous plutôt.";
    }
    return res.status(400).json({ error: msg });
  }

  if (data.session?.user) {
    // Met à jour last_seen immédiatement dès la connexion pour une présence temps réel instantanée
    try {
      await supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", data.session.user.id);
    } catch (e) {}
  }

  res.json({ session: data.session, user: data.user });
});

// POST /api/auth/register
// Inscription sans limite d'email (validée d'office) + auto-connexion immédiate
router.post("/register", async (req, res) => {
  const { email, password, nickname, phone } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = (phone || "").trim() || null;

  // Normalise le numéro (supprime espaces, tirets, etc.)
  const normalizedPhone = cleanPhone ? cleanPhone.replace(/[\s.\-()]/g, "") : null;

  try {
    // Vérifie si le numéro de téléphone est déjà pris par un autre compte
    if (normalizedPhone) {
      const { data: existingPhone } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", normalizedPhone)
        .maybeSingle();

      if (existingPhone) {
        return res.status(400).json({
          error: `Le numéro de téléphone ${normalizedPhone} est déjà associé à un autre compte.`
        });
      }
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        nickname: nickname?.trim() || cleanEmail.split("@")[0],
        phone: normalizedPhone,
        avatar: "🌸",
        created_at: new Date().toISOString()
      }
    });

    if (createError) {
      // Traduire le message spécifique "A user with this email address has already been registered"
      if (createError.message.includes("A user with this email address has already been registered") || 
          createError.message.includes("already registered") || 
          createError.message.includes("already exists")) {
        return res.status(400).json({ error: "Un compte avec cet email existe déjà. Connectez-vous plutôt." });
      }
      if (createError.message.includes("Database error creating new user")) {
        return res.status(400).json({
          error: "Erreur lors de l'enregistrement : ce numéro de téléphone ou cet email est peut-être déjà utilisé."
        });
      }
      // Traduire d'autres erreurs possibles
      let errorMsg = createError.message;
      if (errorMsg.includes("Password should be at least")) {
        errorMsg = "Le mot de passe doit contenir au moins 6 caractères.";
      }
      if (errorMsg.includes("Unable to validate")) {
        errorMsg = "Données invalides. Veuillez vérifier vos informations.";
      }
      return res.status(400).json({ error: errorMsg });
    }

    // Auto-connexion automatique dans la foulée
    const { data: signData, error: signError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    if (signError) {
      let errorMsg = signError.message;
      if (errorMsg.includes("Invalid login credentials")) {
        errorMsg = "Email ou mot de passe incorrect.";
      }
      return res.status(400).json({ error: errorMsg });
    }

    res.json({ session: signData.session, user: signData.user });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur. Veuillez réessayer." });
  }
});

// POST /api/auth/instant-create (compatibilité rétroactive)
router.post("/instant-create", async (req, res) => {
  const { email, password, nickname } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });
  const cleanEmail = email.trim().toLowerCase();

  try {
    await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: { nickname: nickname || cleanEmail.split("@")[0], avatar: "🌸" }
    }).catch(() => {});

    const { data: signData, error: signError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    if (signError) {
      let errorMsg = signError.message;
      if (errorMsg.includes("Invalid login credentials")) {
        errorMsg = "Email ou mot de passe incorrect.";
      }
      return res.status(400).json({ error: errorMsg });
    }
    res.json({ session: signData.session, user: signData.user });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur. Veuillez réessayer." });
  }
});

module.exports = router;
