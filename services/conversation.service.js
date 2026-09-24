// ============================================================
// [PHASE 2] Service conversations — logique partagée entre les
// routes amis et groupes. Toute la logique "en mémoire" des
// anciennes routes a été remplacée par du Supabase réel.
// ============================================================
const supabase = require("../supabaseClient");

// Bucket Storage partagé avec le chat du couple
const BUCKET = "chat-media";

// ------------------------------------------------------------
// Vérifie que l'utilisateur est bien membre de la conversation.
// Retourne la conversation si OK, sinon null.
// ------------------------------------------------------------
async function assertConversationMember(conversationId, userId) {
  const { data: membership } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return null;

  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();
  return conversation || null;
}

// ------------------------------------------------------------
// Trouve la conversation 1:1 entre deux amis, ou la crée.
// Utilisée quand une amitié est acceptée.
// ------------------------------------------------------------
async function findOrCreateFriendConversation(userA, userB) {
  // Supabase ne permet pas facilement "conversation qui contient exactement
  // ces 2 membres" en une seule requête : on récupère d'abord les
  // conversations de l'utilisateur A, puis on cherche B parmi elles.
  const { data: mine } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userA);

  if (mine && mine.length > 0) {
    const candidateIds = mine.map((m) => m.conversation_id);
    const { data: other } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", userB)
      .in("conversation_id", candidateIds);

    if (other && other.length > 0) {
      // Vérifie que la conversation trouvée est bien de type "friend"
      const ids = other.map((o) => o.conversation_id);
      const { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("type", "friend")
        .in("id", ids)
        .limit(1)
        .maybeSingle();
      if (conv) return conv.id;
    }
  }

  // Aucune conversation existante : on la crée avec ses deux membres
  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({ type: "friend", icon: "💫", created_by: userA })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("conversation_members").insert([
    { conversation_id: conv.id, user_id: userA },
    { conversation_id: conv.id, user_id: userB },
  ]);

  return conv.id;
}

// ------------------------------------------------------------
// Crée la conversation "couple" si le trigger SQL ne l'a pas fait
// (utile pour les couples créés AVANT la migration Phase 2).
// Idempotent : ne crée rien si une conversation couple existe déjà.
// ------------------------------------------------------------
async function ensureCoupleConversation(couple) {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("couple_id", couple.id)
    .eq("type", "couple")
    .maybeSingle();
  if (existing) return existing.id;

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({ type: "couple", couple_id: couple.id, icon: "❤️", created_by: couple.user_a })
    .select()
    .single();
  if (error) return null;

  await supabase.from("conversation_members").insert([
    { conversation_id: conv.id, user_id: couple.user_a },
    { conversation_id: conv.id, user_id: couple.user_b },
  ]);
  return conv.id;
}

// ------------------------------------------------------------
// Recherche un utilisateur public par numéro de téléphone.
// Le numéro est normalisé (espaces/tirets/points supprimés).
// ------------------------------------------------------------
function normalizePhone(phone) {
  return String(phone || "").replace(/[\s.\-()]/g, "");
}

async function findProfileByPhone(phone) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, phone")
    .eq("phone", normalizePhone(phone))
    .maybeSingle();
  return profile || null;
}

// ------------------------------------------------------------
// Décode une data-URL "data:mime;base64,..." en buffer.
// ------------------------------------------------------------
function decodeDataUrl(dataUrl) {
  const match = /^data:(.+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Format de média invalide");
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

// Extension de fichier déduite du type MIME (pour le stockage).
function extFromMime(mime) {
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("quicktime")) return "mov";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "bin";
}

// ------------------------------------------------------------
// Téléverse un média dans le bucket privé et retourne son chemin.
// Les fichiers de conversation sont rangés dans "conv/{conversationId}/".
// (Les policies Storage du couple restent valables pour chat/{coupleId}/)
// ------------------------------------------------------------
async function uploadConversationMedia(conversationId, dataUrl) {
  const { mimeType, buffer } = decodeDataUrl(dataUrl);
  const path = `conv/${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extFromMime(mimeType)}`;
  try {
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mimeType });
    if (error) {
      console.warn("[CONV] Storage upload failed, using data URL fallback:", error.message);
      return { path: dataUrl, mimeType };
    }
    return { path, mimeType };
  } catch (err) {
    console.warn("[CONV] Storage exception, using data URL fallback:", err.message);
    return { path: dataUrl, mimeType };
  }
}

// Crée une URL signée (1h) pour un média stocké, sans exposer le chemin brut.
// [CLOUDINARY/DATA-URL] Si le chemin est déjà une URL https ou data:, on la renvoie telle quelle.
async function signMediaPath(mediaPath) {
  if (!mediaPath) return null;
  if (/^(https?|data):/i.test(mediaPath)) return mediaPath;
  try {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(mediaPath, 3600);
    return signed?.signedUrl || null;
  } catch (err) {
    return null;
  }
}

// Un chemin de média est-il légitime ? (Storage Supabase OU URL Cloudinary OU Data URL)
function isValidMediaPath(path, prefix) {
  if (!path) return false;
  if (/^https:\/\/res\.cloudinary\.com\//i.test(path)) return true; // CDN Cloudinary
  if (/^data:/i.test(path)) return true; // Fallback data URL
  return path.startsWith(prefix);
}

module.exports = {
  BUCKET,
  assertConversationMember,
  findOrCreateFriendConversation,
  ensureCoupleConversation,
  normalizePhone,
  findProfileByPhone,
  decodeDataUrl,
  extFromMime,
  uploadConversationMedia,
  signMediaPath,
  isValidMediaPath,
};
