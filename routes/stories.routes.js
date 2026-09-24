// ============================================================
// [STORIES] Photos/vidéos éphémères 24h (comme WhatsApp Status).
// Visibles uniquement par le couple, purge automatique des
// stories expirées à chaque lecture.
// ============================================================
const express = require("express");
const supabase = require("../supabaseClient");
const { requireAuth } = require("./auth.middleware");
const { decodeDataUrl, extFromMime, signMediaPath, isValidMediaPath } = require("../services/conversation.service");
const { translateError } = require("../utils/error-handler");

const router = express.Router();
const BUCKET = "chat-media";

// Vérifie que l'utilisateur est membre du couple
async function getCoupleFor(coupleId, userId) {
  const { data: couple } = await supabase.from("couples").select("*").eq("id", coupleId).maybeSingle();
  if (!couple || (couple.user_a !== userId && couple.user_b !== userId)) return null;
  return couple;
}

// Supprime les stories expirées (et leurs fichiers Storage) — purge douce
async function purgeExpired(coupleId) {
  const { data: expired } = await supabase
    .from("stories")
    .select("id, media_path")
    .eq("couple_id", coupleId)
    .lt("expires_at", new Date().toISOString());
  if (expired && expired.length > 0) {
    await supabase.from("stories").delete().in("id", expired.map((s) => s.id));
    await supabase.storage.from(BUCKET).remove(expired.map((s) => s.media_path).filter(Boolean));
  }
}

// ------------------------------------------------------------
// GET /api/stories?coupleId=...
// Retourne mes stories + celles du/de la partenaire (non expirées),
// avec URLs signées pour les médias.
// ------------------------------------------------------------
router.get("/", requireAuth, async (req, res) => {
  try {
    const couple = await getCoupleFor(req.query.coupleId, req.user.id);
    if (!couple) return res.status(403).json({ error: "Accès refusé" });

    // Purge des expirées avant lecture (garde la base et le Storage propres)
    purgeExpired(couple.id).catch(() => {});

    const { data: stories, error } = await supabase
      .from("stories")
      .select("*")
      .eq("couple_id", couple.id)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: translateError(error.message) });

    const enriched = await Promise.all(
      (stories || []).map(async (s) => {
        const { data: author } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", s.user_id)
          .maybeSingle();
        return {
          ...s,
          media_url: await signMediaPath(s.media_path),
          media_path: undefined,
          author_name: author?.display_name || "Moi",
          author_avatar: author?.avatar_url || "🌸",
          is_mine: s.user_id === req.user.id,
        };
      })
    );

    res.json({ stories: enriched });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// ------------------------------------------------------------
// POST /api/stories   body: { coupleId, mediaPath?, mediaDataUrl?, caption?, mimeType? }
// Publie une story valable 24h (photo ou vidéo).
// [UPLOAD DIRECT] mediaPath = fichier déjà envoyé par le navigateur
// dans Storage (rapide, gros fichiers) ; mediaDataUrl = ancien mode.
// ------------------------------------------------------------
router.post("/", requireAuth, async (req, res) => {
  try {
    const { coupleId, mediaPath, mediaDataUrl, caption, mimeType: clientMime } = req.body || {};
    const couple = await getCoupleFor(coupleId, req.user.id);
    if (!couple) return res.status(403).json({ error: "Accès refusé" });
    if (!mediaDataUrl && !mediaPath) return res.status(400).json({ error: "Média requis" });

    let finalPath = null;
    let mimeType = null;
    if (mediaPath) {
      // Sécurité : dossier stories DE CE couple OU URL Cloudinary
      if (!isValidMediaPath(mediaPath, `${coupleId}/stories/`)) {
        return res.status(403).json({ error: "Chemin de média invalide" });
      }
      finalPath = mediaPath;
      mimeType = clientMime || null;
    } else {
      const decoded = decodeDataUrl(mediaDataUrl);
      mimeType = decoded.mimeType;
      finalPath = `${coupleId}/stories/${Date.now()}-${req.user.id}.${extFromMime(mimeType)}`;
      try {
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(finalPath, decoded.buffer, { contentType: mimeType });
        if (uploadError) {
          console.warn("[STORIES] Storage upload failed, falling back to data URL directly:", uploadError.message);
          finalPath = mediaDataUrl;
        }
      } catch (storageErr) {
        console.warn("[STORIES] Storage exception, falling back to data URL:", storageErr.message);
        finalPath = mediaDataUrl;
      }
    }

    let storyPayload = {
      user_id: req.user.id,
      couple_id: couple.id,
      media_path: finalPath,
      mime_type: mimeType,
      caption: caption || null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    let { data: story, error: insertError } = await supabase
      .from("stories")
      .insert(storyPayload)
      .select()
      .single();

    // Fallback : si erreur de schéma (colonne mime_type ou caption absente), réessayer sans
    if (insertError && (
      insertError.message?.includes("mime_type") ||
      insertError.message?.includes("caption") ||
      insertError.code === "PGRST204" ||
      insertError.message?.toLowerCase().includes("schema")
    )) {
      console.warn("[STORIES] Retrying without optional columns:", insertError.message);
      const { mime_type: _m, caption: _c, ...basePayload } = storyPayload;
      const retry = await supabase.from("stories").insert(basePayload).select().single();
      story = retry.data;
      insertError = retry.error;
    }

    if (insertError) return res.status(500).json({ error: translateError(insertError.message) });

    res.json({ story: { ...story, media_path: undefined } });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// ------------------------------------------------------------
// DELETE /api/stories/:id — chacun peut supprimer sa propre story
// ------------------------------------------------------------
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { data: story } = await supabase
      .from("stories")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (!story) return res.status(404).json({ error: "Story introuvable" });

    await supabase.from("stories").delete().eq("id", story.id);
    await supabase.storage.from(BUCKET).remove([story.media_path].filter(Boolean));

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

module.exports = router;
