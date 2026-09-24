// ============================================================
// [CORRECTION 431] Purge les photos (base64) stockées dans les
// user_metadata des comptes Supabase Auth.
//
// AVANT : la photo de profil était copiée dans le JWT -> token de
// plusieurs centaines de Ko -> erreur HTTP 431 sur toutes les requêtes.
// Ce script retire les champs lourds (avatar, background) de tous les
// comptes. Les photos restent disponibles dans la table `profiles`.
//
// Lancer une fois :  npm run clean-metadata
// ============================================================
const supabase = require("../supabaseClient");

async function main() {
  console.log("Listage des comptes auth...");
  const { data: list, error } = await supabase.auth.admin.listUsers({ perPage: 500 });
  if (error) {
    console.error("Erreur de listage :", error.message);
    process.exit(1);
  }

  let cleaned = 0;
  for (const user of list.users || []) {
    const meta = user.user_metadata || {};
    const heavy = ["avatar", "background", "custom_bg", "last_seen"].filter((k) => meta[k]);

    // Ne touche qu'aux comptes qui ont effectivement des champs lourds
    if (heavy.length === 0) continue;

    const newMeta = { ...meta };
    for (const k of heavy) delete newMeta[k];

    const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: newMeta,
    });
    if (updErr) {
      console.log(`  ⚠ ${user.email || user.id} : ${updErr.message}`);
    } else {
      cleaned++;
      console.log(`  ✅ ${user.email || user.id} : purgé (${heavy.join(", ")})`);
    }
  }

  console.log(`\nTerminé : ${cleaned} compte(s) nettoyé(s).`);
  console.log("Les utilisateurs concernés doivent se RECONNECTER pour obtenir un token léger.");
}

main();
