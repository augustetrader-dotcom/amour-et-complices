// Script de diagnostic pour vérifier si la table love_quiz_responses existe
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTable() {
  console.log("🔍 Vérification de la table love_quiz_responses...");
  
  try {
    // Essayer de sélectionner depuis la table
    const { data, error } = await supabase
      .from("love_quiz_responses")
      .select("*")
      .limit(1);
    
    if (error) {
      console.error("❌ Erreur lors de l'accès à la table:", error.message);
      console.log("\n📋 La table love_quiz_responses n'existe pas encore.");
      console.log("⚠️  Vous devez exécuter le code SQL suivant dans Supabase SQL Editor:\n");
      console.log(`
-- Créer la table pour les réponses du questionnaire
create table if not exists love_quiz_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  responses jsonb not null default '{}'::jsonb,
  personalization_settings jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_love_quiz_user on love_quiz_responses(user_id);

alter table love_quiz_responses enable row level security;
drop policy if exists "Un utilisateur voit ses propres réponses" on love_quiz_responses;
drop policy if exists "Un utilisateur modifie ses propres réponses" on love_quiz_responses;
create policy "Un utilisateur voit ses propres réponses"
  on love_quiz_responses for select using (auth.uid() = user_id);
create policy "Un utilisateur modifie ses propres réponses"
  on love_quiz_responses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Ajouter une colonne dans profiles pour savoir si le questionnaire est complété
alter table profiles add column if not exists love_quiz_completed boolean default false;
      `);
    } else {
      console.log("✅ La table love_quiz_responses existe et est accessible.");
      console.log("📊 Données trouvées:", data.length > 0 ? "Oui" : "Non (table vide)");
    }
    
    // Vérifier aussi la colonne love_quiz_completed dans profiles
    console.log("\n🔍 Vérification de la colonne love_quiz_completed dans profiles...");
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("love_quiz_completed")
      .limit(1);
    
    if (profileError && profileError.message.includes("does not exist")) {
      console.log("❌ La colonne love_quiz_completed n'existe pas dans profiles.");
      console.log("⚠️  Ajoutez ceci au code SQL:");
      console.log("alter table profiles add column if not exists love_quiz_completed boolean default false;");
    } else if (profileError) {
      console.log("⚠️  Erreur lors de l'accès à profiles:", profileError.message);
    } else {
      console.log("✅ La colonne love_quiz_completed existe dans profiles.");
    }
    
  } catch (error) {
    console.error("❌ Erreur inattendue:", error.message);
  }
}

checkTable();