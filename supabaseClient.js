require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Variables d'environnement manquantes. Copie .env.example vers .env et renseigne SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

// Clé service_role : contourne la RLS de façon stricte et permanente.
// On force les headers Authorization et apikey dans global.headers pour éviter
// que des appels comme auth.getUser(token) ou signInWithPassword n'écrasent le token service_role.
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: {
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  },
});

module.exports = supabase;
