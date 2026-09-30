// ============================================================
// [STORIES] Stories 24h visibles par le couple, les amis acceptés et les groupes partagés.
// ============================================================
const express = require("express");
const supabase = require("../supabaseClient");
const { requireAuth } = require("./auth.middleware");
const { decodeDataUrl, extFromMime, signMediaPaths, isValidMediaPath } = require("../services/conversation.service");
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

async function getStoryViewCounts(storyIds) {
  const counts = new Map();
  if (!storyIds.length) return counts;
  const { data, error } = await supabase
    .from("story_views")
    .select("story_id")
    .in("story_id", storyIds);
  if (error) {
    console.warn("Impossible de charger les compteurs de vues:", error.message);
    return counts;
  }
  for (const view of data || []) counts.set(view.story_id, (counts.get(view.story_id) || 0) + 1);
  return counts;
}

async function canViewFriendStory(ownerId, viewerId) {
  const { data: relation } = await supabase
    .from("friends")
    .select("user_id")
    .or(`and(user_id.eq.${ownerId},friend_id.eq.${viewerId}),and(user_id.eq.${viewerId},friend_id.eq.${ownerId})`)
    .limit(1)
    .maybeSingle();
  if (relation) return true;

  const { data: viewerMemberships } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", viewerId);
  const conversationIds = (viewerMemberships || []).map(row => row.conversation_id);
  if (!conversationIds.length) return false;

  const { data: ownerMemberships } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", ownerId)
    .in("conversation_id", conversationIds);
  const sharedIds = (ownerMemberships || []).map(row => row.conversation_id);
  if (!sharedIds.length) return false;

  const { data: sharedGroup } = await supabase
    .from("conversations")
    .select("id")
    .eq("type", "group")
    .in("id", sharedIds)
    .limit(1)
    .maybeSingle();
  return !!sharedGroup;
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
      .eq("audience", "couple")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: translateError(error.message) });

    const authorIds = [...new Set((stories || []).map(story => story.user_id).filter(Boolean))];
    const ownStoryIds = (stories || []).filter(story => story.user_id === req.user.id).map(story => story.id);
    const [profilesResult, signedUrls, viewCounts] = await Promise.all([
      authorIds.length
        ? supabase.from("profiles").select("id, display_name, avatar_url").in("id", authorIds)
        : Promise.resolve({ data: [] }),
      signMediaPaths((stories || []).map(story => story.media_path)),
      getStoryViewCounts(ownStoryIds),
    ]);
    const profiles = new Map((profilesResult.data || []).map(profile => [profile.id, profile]));
    const enriched = (stories || []).map(story => {
      const author = profiles.get(story.user_id);
      const { media_path, ...rest } = story;
      return {
        ...rest,
        media_url: signedUrls.get(media_path) || null,
        author_name: author?.display_name || "Moi",
        author_avatar: author?.avatar_url || "🌸",
        is_mine: story.user_id === req.user.id,
        ...(story.user_id === req.user.id ? { view_count: viewCounts.get(story.id) || 0 } : {}),
      };
    });

    res.json({ stories: enriched });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// GET /api/stories/friends — stories des amis et des contacts de groupes partagés.
router.get("/friends", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: relations, error: relationError } = await supabase
      .from("friends")
      .select("user_id, friend_id")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
    if (relationError) return res.status(500).json({ error: translateError(relationError.message) });

    const friendIds = [...new Set((relations || []).map(row =>
      row.user_id === userId ? row.friend_id : row.user_id
    ))];
    const { data: memberships, error: membershipError } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", userId);
    if (membershipError) return res.status(500).json({ error: translateError(membershipError.message) });
    const conversationIds = [...new Set((memberships || []).map(row => row.conversation_id))];
    let groupIds = [];
    if (conversationIds.length) {
      const { data: groupConversations, error: groupError } = await supabase
        .from("conversations")
        .select("id")
        .eq("type", "group")
        .in("id", conversationIds);
      if (groupError) return res.status(500).json({ error: translateError(groupError.message) });
      groupIds = (groupConversations || []).map(row => row.id);
    }

    let groupMemberIds = [];
    if (groupIds.length) {
      const { data: groupMembers, error: membersError } = await supabase
        .from("conversation_members")
        .select("user_id")
        .in("conversation_id", groupIds);
      if (membersError) return res.status(500).json({ error: translateError(membersError.message) });
      groupMemberIds = (groupMembers || []).map(row => row.user_id);
    }

    const visibleUserIds = [...new Set([userId, ...friendIds, ...groupMemberIds])];
    const { data: stories, error } = await supabase
      .from("stories")
      .select("*")
      .in("audience", ["friends", "couple"])
      .in("user_id", visibleUserIds)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: translateError(error.message) });

<<<<<<< HEAD
    const authorIds = [...new Set((stories || []).map(story => story.user_id).filter(Boolean))];
    const ownStoryIds = (stories || []).filter(story => story.user_id === userId).map(story => story.id);
    const [profilesResult, signedUrls, viewCounts] = await Promise.all([
      authorIds.length
        ? supabase.from("profiles").select("id, display_name, avatar_url").in("id", authorIds)
        : Promise.resolve({ data: [] }),
      signMediaPaths((stories || []).map(story => story.media_path)),
      getStoryViewCounts(ownStoryIds),
    ]);
    const profiles = new Map((profilesResult.data || []).map(profile => [profile.id, profile]));
    const enriched = (stories || []).map(story => {
      const profile = profiles.get(story.user_id);
      const { media_path, ...rest } = story;
      return {
        ...rest,
        media_url: signedUrls.get(media_path) || null,
        author_name: profile?.display_name || (story.user_id === userId ? "Moi" : "Ami"),
        author_avatar: profile?.avatar_url || "🌸",
        is_mine: story.user_id === userId,
        ...(story.user_id === userId ? { view_count: viewCounts.get(story.id) || 0 } : {}),
      };
    });
    res.json({ stories: enriched });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

<<<<<<< HEAD
router.post("/:id/view", requireAuth, async (req, res) => {
  try {
    const { data: story, error } = await supabase
      .from("stories")
      .select("id, user_id, couple_id, audience")
      .eq("id", req.params.id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error) return res.status(500).json({ error: translateError(error.message) });
    if (!story) return res.status(404).json({ error: "Story introuvable ou expirée" });
    if (story.user_id === req.user.id) return res.json({ viewed_at: null, own_story: true });

    const allowed = story.audience === "couple"
      ? !!(story.couple_id && await getCoupleFor(story.couple_id, req.user.id))
      : await canViewFriendStory(story.user_id, req.user.id);
    if (!allowed) return res.status(403).json({ error: "Accès refusé" });

    const viewedAt = new Date().toISOString();
    const { error: viewError } = await supabase
      .from("story_views")
      .upsert({ story_id: story.id, viewer_id: req.user.id, viewed_at: viewedAt }, { onConflict: "story_id,viewer_id" });
    if (viewError) return res.status(500).json({ error: translateError(viewError.message) });
    res.json({ viewed_at: viewedAt });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

router.get("/:id/views", requireAuth, async (req, res) => {
  try {
    const { data: story, error: storyError } = await supabase
      .from("stories")
      .select("id")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (storyError) return res.status(500).json({ error: translateError(storyError.message) });
    if (!story) return res.status(404).json({ error: "Story introuvable ou expirée" });

    const { data: rows, error } = await supabase
      .from("story_views")
      .select("viewer_id, viewed_at")
      .eq("story_id", story.id)
      .order("viewed_at", { ascending: false });
    if (error) return res.status(500).json({ error: translateError(error.message) });

    const viewerIds = [...new Set((rows || []).map(row => row.viewer_id))];
    const { data: profiles } = viewerIds.length
      ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", viewerIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map(profile => [profile.id, profile]));
    res.json({ views: (rows || []).map(row => ({
      viewer_id: row.viewer_id,
      viewed_at: row.viewed_at,
      name: profileMap.get(row.viewer_id)?.display_name || "Ami",
      avatar: profileMap.get(row.viewer_id)?.avatar_url || "🌸",
    })) });
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
    const { coupleId, audience = "couple", mediaPath, mediaDataUrl, caption, mimeType: clientMime } = req.body || {};
    if (!["couple", "friends"].includes(audience)) {
      return res.status(400).json({ error: "Audience de story invalide" });
    }
    const couple = audience === "couple" ? await getCoupleFor(coupleId, req.user.id) : null;
    if (audience === "couple" && !couple) return res.status(403).json({ error: "Accès refusé" });
    if (!mediaDataUrl && !mediaPath) return res.status(400).json({ error: "Média requis" });

    const storyFolder = audience === "friends" ? `${req.user.id}/stories/` : `${couple.id}/stories/`;
    let finalPath = null;
    let mimeType = null;
    if (mediaPath) {
      if (!isValidMediaPath(mediaPath, storyFolder)) {
        return res.status(403).json({ error: "Chemin de média invalide" });
      }
      finalPath = mediaPath;
      mimeType = clientMime || null;
    } else {
      const decoded = decodeDataUrl(mediaDataUrl);
      mimeType = decoded.mimeType;
      finalPath = `${storyFolder}${Date.now()}-${req.user.id}.${extFromMime(mimeType)}`;
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
      couple_id: couple?.id || null,
      audience,
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
