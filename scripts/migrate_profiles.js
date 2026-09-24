// Migration : copie les user_metadata des comptes existants vers la table profiles.
// À lancer UNE FOIS après avoir ajouté la table profiles au schéma.
//   npm run migrate:profiles
const supabase = require("../supabaseClient");

async function migrateProfiles() {
  const { data: users, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error("Impossible de lister les utilisateurs :", error.message);
    process.exit(1);
  }

  let migrated = 0;
  let skipped = 0;
  for (const u of users.users || []) {
    const meta = u.user_metadata || {};
    const profile = {
      id: u.id,
      display_name: meta.nickname || u.email?.split("@")[0] || "Moi",
      phone: meta.phone || null,
      avatar_url: meta.avatar || "🌸",
      bio: meta.bio || "",
      theme: meta.theme || "default",
      sound: meta.sound !== false,
      created_at: meta.created_at || new Date().toISOString(),
    };

    const { data: existing } = await supabase.from("profiles").select("id").eq("id", u.id).maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }

    const { error: insetError } = await supabase.from("profiles").insert(profile);
    if (insetError) {
      console.error(`Erreur pour ${u.email} :`, insetError.message);
      continue;
    }
    migrated++;
  }

  console.log(`Migration terminée : ${migrated} profil(s) créé(s), ${skipped} déjà présent(s).`);
  process.exit(0);
}

migrateProfiles();