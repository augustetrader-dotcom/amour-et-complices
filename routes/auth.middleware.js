const supabase = require("../supabaseClient");

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Non authentifié" });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: "Token invalide ou expiré" });

  req.user = data.user;
  next();
}

module.exports = { requireAuth };
