// Gestion des profils publics (table profiles) avec fallback/migration
// sur les anciennes user_metadata de Supabase Auth.
const supabase = require("../supabaseClient");

// Lit le profil d'un utilisateur.
// Si le profil n'existe pas encore en base (compte créé avant le trigger),
// il est construit à partir des user_metadata puis créé.
async function getProfile(userId, userMeta = {}) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profile) return profile;

  const fallback = {
    id: userId,
    display_name:
      userMeta.nickname || userMeta.display_name || (userMeta.email ? userMeta.email.split("@")[0] : "Moi"),
    phone: userMeta.phone || null,
    avatar_url: userMeta.avatar || "",
    bio: userMeta.bio || "",
    theme: userMeta.theme || "default",
    sound: userMeta.sound !== false,
  };

  const { data: created, error } = await supabase
    .from("profiles")
    .upsert(fallback)
    .select()
    .maybeSingle();

  if (error) {
    console.log("Impossible de créer le profil au vol :", error.message);
    return fallback;
  }
  return created;
}

// Met à jour un profil utilisateur.
// Écrit aussi dans user_metadata pour rester compatible avec l'existant
// (partenaire, heartbeat, etc.) jusqu'à la fin de la migration.
async function updateProfile(userId, changes, userMeta = {}) {
  const profileChanges = {};
  const metaChanges = {};

  if (changes.display_name !== undefined) {
    profileChanges.display_name = changes.display_name;
    metaChanges.nickname = changes.display_name;
  }
  if (changes.avatar_url !== undefined) {
    profileChanges.avatar_url = changes.avatar_url;
    // [CORRECTION 431] On ne copie PLUS l'avatar dans user_metadata :
    // la photo (base64, souvent > 100 Ko) gonflait le JWT d'authentification,
    // et le serveur rejetait les requêtes avec l'erreur 431
    // ("Request Header Fields Too Large"). La photo vit uniquement
    // dans la table `profiles`, lue via l'API — jamais dans le token.
  }
  if (changes.phone !== undefined) {
    profileChanges.phone = changes.phone;
    metaChanges.phone = changes.phone;
  }
  if (changes.bio !== undefined) {
    profileChanges.bio = changes.bio;
    metaChanges.bio = changes.bio;
  }
  if (changes.theme !== undefined) {
    profileChanges.theme = changes.theme;
    metaChanges.theme = changes.theme;
  }
  if (changes.sound !== undefined) {
    profileChanges.sound = !!changes.sound;
    metaChanges.sound = !!changes.sound;
  }

  if (Object.keys(profileChanges).length === 0) {
    return { ok: true, skipped: true };
  }

  profileChanges.updated_at = new Date().toISOString();

  let profileResult = { data: null, error: null };
  try {
    profileResult = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        ...profileChanges,
        display_name: profileChanges.display_name ?? undefined,
        avatar_url: profileChanges.avatar_url ?? undefined,
      })
      .select()
      .single();
  } catch (e) {
    profileResult = { data: null, error: e };
  }

  const metaResult = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...(userMeta || {}),
      ...metaChanges,
      updated_at: new Date().toISOString(),
    },
  });

  const { data, error } = profileResult;
  if (metaResult?.error) {
    console.log("updateProfile: erreur de synchro user_metadata :", metaResult.error.message);
  }
  if (error) return { error };
  return { ok: true, profile: data };
}

module.exports = { getProfile, updateProfile };