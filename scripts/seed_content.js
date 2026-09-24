// Lance ce script après avoir créé le schéma (schema.sql) :
//   npm run seed
// [PHASE 4] Chaque table est vérifiée INDÉPENDAMMENT : le script peut
// être relancé pour n'ajouter QUE le contenu manquant (ex: la nouvelle
// banque "Action ou Vérité") sans dupliquer l'existant.
const fs = require("fs");
const path = require("path");
const supabase = require("../supabaseClient");

async function seedTable(tableName, rows, mapFn) {
  const payload = rows.map(mapFn);
  // Insertion par lots de 200 pour rester sous les limites de l'API
  const batchSize = 200;
  let inserted = 0;
  for (let i = 0; i < payload.length; i += batchSize) {
    const batch = payload.slice(i, i + batchSize);
    const { error } = await supabase.from(tableName).insert(batch);
    if (error) {
      console.error(`Erreur en insérant dans ${tableName} :`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
  }
  console.log(`${tableName} : ${inserted} lignes insérées`);
}

// Vérifie le nombre de lignes d'une table (0 = à remplir)
async function countRows(tableName) {
  const { count } = await supabase.from(tableName).select("*", { count: "exact", head: true });
  return count || 0;
}

async function main() {
  // ----------------------------------------------------------
  // 1. Quiz (130 questions dont 30 nouvelles "complices")
  // [CORRECTION] On n'ajoute plus uniquement si la table est vide :
  // on insère les questions MANQUANTES (par order_index). Ainsi, une
  // table qui contient déjà les 100 questions classiques reçoit les
  // 30 nouvelles questions "Complice" sans doublon.
  // ----------------------------------------------------------
  const quiz = JSON.parse(fs.readFileSync(path.join(__dirname, "../content/quiz_questions.json"), "utf8"));
  {
    const { data: existingRows } = await supabase.from("quiz_questions").select("order_index");
    const existingIndexes = new Set((existingRows || []).map((r) => r.order_index));
    const missing = quiz.filter((q) => !existingIndexes.has(q.order_index));
    if (missing.length > 0) {
      await seedTable("quiz_questions", missing, (q) => ({
        order_index: q.order_index,
        option_a_text: q.option_a_text,
        option_a_language: q.option_a_language,
        option_b_text: q.option_b_text,
        option_b_language: q.option_b_language,
      }));
      console.log(`quiz_questions : ${missing.length} nouvelles questions ajoutées ✅`);
    } else {
      console.log("quiz_questions : déjà à jour, rien à ajouter.");
    }
  }

  // ----------------------------------------------------------
  // 2. Cartes de jeu (150)
  // ----------------------------------------------------------
  const games = JSON.parse(fs.readFileSync(path.join(__dirname, "../content/game_cards.json"), "utf8"));
  if ((await countRows("game_cards")) === 0) {
    await seedTable("game_cards", games, (c) => ({ category: c.category, prompt: c.prompt }));
  } else {
    console.log("game_cards : déjà chargé, ignoré.");
  }

  // ----------------------------------------------------------
  // 3. Mots doux (1000)
  // ----------------------------------------------------------
  const words = JSON.parse(fs.readFileSync(path.join(__dirname, "../content/sweet_messages.json"), "utf8"));
  if ((await countRows("sweet_messages")) === 0) {
    await seedTable("sweet_messages", words, (m) => ({ category: m.category, text: m.text }));
  } else {
    console.log("sweet_messages : déjà chargé, ignoré.");
  }

  // ----------------------------------------------------------
  // 4. [PHASE 4] Action ou Vérité (90 cartes : doux / complice / osé)
  // ----------------------------------------------------------
  const truthDare = JSON.parse(fs.readFileSync(path.join(__dirname, "../content/action_verite.json"), "utf8"));
  if ((await countRows("truth_dare_cards")) === 0) {
    await seedTable("truth_dare_cards", truthDare, (c) => ({ kind: c.kind, level: c.level, prompt: c.prompt }));
  } else {
    console.log("truth_dare_cards : déjà chargé, ignoré.");
  }

  console.log("Seed terminé ✅");
}

main();
