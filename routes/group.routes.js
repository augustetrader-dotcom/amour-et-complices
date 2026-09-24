// ============================================================
// [PHASE 2] Routes GROUPES réelles (Supabase) — remplace les
// simples tableaux JavaScript en mémoire (perte au redémarrage).
//
// Un groupe = une conversation de type "group" + ses membres
// (conversation_members) + ses messages (group_messages).
// ============================================================
const express = require("express");
const supabase = require("../supabaseClient");
const { requireAuth } = require("./auth.middleware");
const { translateError } = require("../utils/error-handler");
const {
  assertConversationMember,
  findProfileByPhone,
  uploadConversationMedia,
  signMediaPath,
  decodeDataUrl,   // [ALBUM] décodage des photos souvenirs
  extFromMime,     // [ALBUM] extension de fichier pour le Storage
  isValidMediaPath, // [CLOUDINARY] validation des chemins de médias
} = require("../services/conversation.service");
// [PUSH] Notifications natives vers les appareils des membres
const { sendPushToUser } = require("../services/push.service");

const router = express.Router();

// ------------------------------------------------------------
// GET /api/groups
// Liste mes groupes avec : nb de membres, dernier message (aperçu
// style WhatsApp) et horodatage de la dernière activité.
// ------------------------------------------------------------
router.get("/", requireAuth, async (req, res) => {
  try {
    const myId = req.user.id;

    // 1. Mes conversations de type "group"
    const { data: memberships, error } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", myId);
    if (error) return res.status(500).json({ error: translateError(error.message) });

    const convIds = (memberships || []).map((m) => m.conversation_id);
    if (convIds.length === 0) return res.json({ groups: [] });

    const { data: conversations, error: convError } = await supabase
      .from("conversations")
      .select("*")
      .eq("type", "group")
      .in("id", convIds)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (convError) return res.status(500).json({ error: translateError(convError.message) });

    // 2. Pour chaque groupe : nb de membres + dernier message
    const groups = await Promise.all(
      (conversations || []).map(async (conv) => {
        const { count } = await supabase
          .from("conversation_members")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conv.id);

        const { data: lastMsg } = await supabase
          .from("group_messages")
          .select("type, text, from_user, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Aperçu du dernier message (préfixé par l'expéditeur, style WhatsApp)
        let preview = "Nouvelle discussion — lance-toi !";
        if (lastMsg) {
          const { data: sender } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", lastMsg.from_user)
            .maybeSingle();
          const senderName = lastMsg.from_user === myId ? "Toi" : sender?.display_name || "…";
          const content =
            lastMsg.type === "text" ? lastMsg.text
            : lastMsg.type === "photo" ? "📷 Photo"
            : lastMsg.type === "video" ? "🎥 Vidéo"
            : "🎙️ Message vocal";
          preview = `${senderName} : ${content || "…"}`;
        }

        return {
          id: conv.id,
          name: conv.title || "Groupe",
          icon: conv.icon || "👥",
          membersCount: count || 1,
          lastMessage: preview,
          lastActivity: lastMsg?.created_at || conv.created_at,
        };
      })
    );

    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// ------------------------------------------------------------
// POST /api/groups   body: { name, icon }
// Crée un groupe dont le créateur est le premier membre.
// ------------------------------------------------------------
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, icon } = req.body || {};
    if (!name) return res.status(400).json({ error: "Nom de groupe requis" });

    const { data: conv, error } = await supabase
      .from("conversations")
      .insert({ type: "group", title: name.trim(), icon: icon || "✨", created_by: req.user.id })
      .select()
      .single();
    if (error) return res.status(500).json({ error: translateError(error.message) });

    await supabase.from("conversation_members").insert({ conversation_id: conv.id, user_id: req.user.id });

    res.json({ group: { id: conv.id, name: conv.title, icon: conv.icon, membersCount: 1, lastMessage: "Groupe créé 🎉", lastActivity: conv.created_at } });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// ------------------------------------------------------------
// POST /api/groups/:id/members   body: { phone }
// Ajoute un membre par numéro de téléphone (il doit avoir l'app).
// ------------------------------------------------------------
router.post("/:id/members", requireAuth, async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone) return res.status(400).json({ error: "Numéro de téléphone requis" });

    const conv = await assertConversationMember(req.params.id, req.user.id);
    if (!conv || conv.type !== "group") return res.status(403).json({ error: "Groupe introuvable ou accès refusé" });

    const profile = await findProfileByPhone(phone);
    if (!profile) {
      return res.status(404).json({ error: "Ce numéro n'est pas sur Amour & Complices." });
    }

    // Idempotent : l'ajouter une seconde fois ne crée pas de doublon
    const { error } = await supabase
      .from("conversation_members")
      .upsert({ conversation_id: conv.id, user_id: profile.id }, { onConflict: "conversation_id,user_id" });
    if (error) return res.status(500).json({ error: translateError(error.message) });

    res.json({ ok: true, member: { id: profile.id, display_name: profile.display_name, avatar_url: profile.avatar_url } });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// ------------------------------------------------------------
// GET /api/groups/:id/members
// Liste des membres avec leur profil (pour l'en-tête du groupe).
// ------------------------------------------------------------
router.get("/:id/members", requireAuth, async (req, res) => {
  try {
    const conv = await assertConversationMember(req.params.id, req.user.id);
    if (!conv) return res.status(403).json({ error: "Accès refusé" });

    const { data: memberRows } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conv.id);

    const members = [];
    for (const m of memberRows || []) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", m.user_id)
        .maybeSingle();
      members.push({
        id: m.user_id,
        display_name: p?.display_name || "Membre",
        avatar_url: p?.avatar_url || "💫",
      });
    }

    res.json({ members });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// ------------------------------------------------------------
// GET /api/groups/:id/messages?since=ISO
// Historique de la conversation. [FLUIDITÉ] `since` = uniquement les
// messages plus récents (polling de secours toutes les 4s).
// [CONFIRMATIONS] Marque aussi les messages reçus comme "distribués".
// ------------------------------------------------------------
router.get("/:id/messages", requireAuth, async (req, res) => {
  try {
    const conv = await assertConversationMember(req.params.id, req.user.id);
    if (!conv) return res.status(403).json({ error: "Accès refusé" });

    let query = supabase
      .from("group_messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });
    if (req.query.since) query = query.gt("created_at", req.query.since);

    const { data: messages, error } = await query;
    if (error) return res.status(500).json({ error: translateError(error.message) });

    // [CONFIRMATIONS] Le destinataire charge la conversation :
    // les messages qui lui sont adressés passent en "distribué" (✓✓)
    await supabase
      .from("group_messages")
      .update({ delivered_at: new Date().toISOString() })
      .eq("conversation_id", conv.id)
      .neq("from_user", req.user.id)
      .is("delivered_at", null);

    // Enrichit chaque message : profil de l'expéditeur + URL signée du média
    const enriched = await Promise.all(
      (messages || []).map(async (m) => {
        let media_url = null;
        if (m.media_path) media_url = await signMediaPath(m.media_path);

        const { data: sender } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", m.from_user)
          .maybeSingle();

        return {
          ...m,
          from: m.from_user, // compatibilité avec le rendu frontend
          user_name: sender?.display_name || "Membre",
          user_avatar: sender?.avatar_url || "💫",
          media_url,
          media_path: undefined,
        };
      })
    );

    res.json({ messages: enriched });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// ------------------------------------------------------------
// POST /api/groups/:id/messages
// body: { type, text?, mediaDataUrl?, mediaPath?, mimeType? }
// Envoie un message dans le groupe.
// [UPLOAD DIRECT] mediaPath = fichier déjà envoyé par le navigateur
// directement dans Storage (rapide, gros fichiers) ; mediaDataUrl =
// ancien mode base64 conservé pour compatibilité.
// ------------------------------------------------------------
router.post("/:id/messages", requireAuth, async (req, res) => {
  try {
    const { type = "text", text, mediaDataUrl, mediaPath, mimeType: clientMime, replyToId, replyPreview, replyIsMine } = req.body || {};
    if (!text && !mediaDataUrl && !mediaPath) return res.status(400).json({ error: "Contenu requis" });

    const conv = await assertConversationMember(req.params.id, req.user.id);
    if (!conv) return res.status(403).json({ error: "Accès refusé" });

    if (!["text", "photo", "video", "voice"].includes(type)) {
      return res.status(400).json({ error: "Type de message invalide" });
    }

    // Média éventuel
    let mediaPathFinal = null;
    let mimeType = null;
    if (mediaPath) {
      // Sécurité : chemin Storage de CETTE conversation OU URL Cloudinary
      if (!isValidMediaPath(mediaPath, `conv/${conv.id}/`)) {
        return res.status(403).json({ error: "Chemin de média invalide" });
      }
      mediaPathFinal = mediaPath;
      mimeType = clientMime || null;
    } else if (mediaDataUrl) {
      const uploaded = await uploadConversationMedia(conv.id, mediaDataUrl);
      mediaPathFinal = uploaded.path;
      mimeType = uploaded.mimeType;
    }

    let insertPayload = {
      conversation_id: conv.id,
      from_user: req.user.id,
      type,
      text: text || null,
      media_path: mediaPathFinal,
    };
    if (mimeType) insertPayload.mime_type = mimeType;
    if (replyToId) {
      insertPayload.reply_to_id = replyToId;
      insertPayload.reply_preview = replyPreview || null;
      insertPayload.reply_is_mine = !!replyIsMine;
    }

    let { data: message, error } = await supabase
      .from("group_messages")
      .insert(insertPayload)
      .select()
      .single();

    // Si erreur de schéma ou colonne mime_type inexistante, on réessaye sans mime_type
    if (error && (error.message?.includes("mime_type") || error.code === "PGRST204" || error.message?.toLowerCase().includes("schema"))) {
      console.warn("Retrying group message insert without mime_type due to DB schema error:", error.message);
      delete insertPayload.mime_type;
      const retry = await supabase.from("group_messages").insert(insertPayload).select().single();
      message = retry.data;
      error = retry.error;
    }
    // Si erreur sur reply_to_id (colonne absente), réessayer sans reply
    if (error && (error.message?.includes("reply_to_id") || error.message?.includes("reply_preview") || error.message?.includes("reply"))) {
      console.warn("Retrying without reply columns:", error.message);
      delete insertPayload.reply_to_id;
      delete insertPayload.reply_preview;
      delete insertPayload.reply_is_mine;
      const retry2 = await supabase.from("group_messages").insert(insertPayload).select().single();
      message = retry2.data;
      error = retry2.error;
    }

    if (error) return res.status(500).json({ error: translateError(error.message) });

    // Met à jour l'horodatage d'activité du groupe (tri de la liste)
    await supabase
      .from("conversations")
      .update({ last_message_at: message.created_at })
      .eq("id", conv.id);

    // [PUSH] Notifie tous les AUTRES membres du groupe (fire-and-forget)
    try {
      const { data: memberRows } = await supabase
        .from("conversation_members")
        .select("user_id")
        .eq("conversation_id", conv.id);
      const senderName2 = req.user.user_metadata?.nickname || "Un membre";
      const preview = type === "text" ? (text || "Nouveau message") : type === "voice" ? "🎙️ Message vocal" : "📷 Photo";
      for (const m of memberRows || []) {
        if (m.user_id === req.user.id) continue;
        sendPushToUser(m.user_id, {
          title: `👥 ${conv.title || "Groupe"} — ${senderName2}`,
          body: preview,
          url: "/",
          tag: `conv-${conv.id}`,
        }).catch(() => {});
      }
    } catch (e) {}

    // Réponse sécurisée (jamais de chemin brut exposé)
    const { data: sender } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", req.user.id)
      .maybeSingle();

    res.json({
      message: {
        ...message,
        from: req.user.id,
        user_name: sender?.display_name || "Moi",
        user_avatar: sender?.avatar_url || "💫",
        media_url: mediaDataUrl || null,
        media_path: undefined,
      },
    });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// ============================================================
// [ALBUM] Souvenirs PERSISTANTS du groupe (table group_memories).
// L'ancien album était stocké en mémoire : tout disparaissait au
// redémarrage. Désormais persistant + URLs signées + suppression.
// ============================================================

// GET /api/groups/:id/memories — album du groupe
router.get("/:id/memories", requireAuth, async (req, res) => {
  try {
    const conv = await assertConversationMember(req.params.id, req.user.id);
    if (!conv) return res.status(403).json({ error: "Accès refusé" });

    const { data: memories, error } = await supabase
      .from("group_memories")
      .select("*")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: translateError(error.message) });

    const enriched = await Promise.all(
      (memories || []).map(async (mem) => {
        const { data: author } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", mem.user_id)
          .maybeSingle();
        return {
          ...mem,
          image_url: await signMediaPath(mem.image_path),
          image_path: undefined,
          author: author?.display_name || "Membre",
          is_mine: mem.user_id === req.user.id,
        };
      })
    );

    res.json({ memories: enriched });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// POST /api/groups/:id/memories — body: { title?, caption?, mediaDataUrl }
router.post("/:id/memories", requireAuth, async (req, res) => {
  try {
    const { title, caption, mediaDataUrl } = req.body || {};
    const conv = await assertConversationMember(req.params.id, req.user.id);
    if (!conv) return res.status(403).json({ error: "Accès refusé" });
    if (!mediaDataUrl) return res.status(400).json({ error: "Photo requise" });

    // Upload dans un sous-dossier dédié aux souvenirs
    const { mimeType, buffer } = decodeDataUrl(mediaDataUrl);
    const imagePath = `conv/${conv.id}/memories/${Date.now()}-${req.user.id}.${extFromMime(mimeType)}`;
    const { error: uploadError } = await supabase.storage
      .from("chat-media")
      .upload(imagePath, buffer, { contentType: mimeType });
    if (uploadError) return res.status(500).json({ error: translateError(uploadError.message) });

    const { data: memory, error } = await supabase
      .from("group_memories")
      .insert({
        conversation_id: conv.id,
        user_id: req.user.id,
        title: title || "Souvenir partagé",
        caption: caption || null,
        image_path: imagePath,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: translateError(error.message) });

    res.json({ memory: { ...memory, image_path: undefined } });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// GET /api/groups/:id/updates?since=
// [FLUIDITÉ] Rattrapage léger pour le polling client (4s) : nouveaux
// messages + derniers états (lu, distribué, supprimé, modifié).
router.get("/:id/updates", requireAuth, async (req, res) => {
  try {
    const conv = await assertConversationMember(req.params.id, req.user.id);
    if (!conv) return res.status(403).json({ error: "Accès refusé" });

    const since = req.query.since;
    const sinceIso = since ? new Date(since).toISOString() : new Date(Date.now() - 60000).toISOString();

    const { data: newMsgs } = await supabase
      .from("group_messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .gt("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .limit(50);

    const { data: statuses } = await supabase
      .from("group_messages")
      .select("id, read_at, delivered_at, deleted, edited, text, type, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(100);

    res.json({ new: newMsgs || [], statuses: statuses || [], now: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// ------------------------------------------------------------
// [CONFIRMATIONS] POST /:id/delivered — l'appareil d'un membre vient
// de recevoir les messages en temps réel -> ✓ devient ✓✓ pour l'auteur
// ------------------------------------------------------------
router.post("/:id/delivered", requireAuth, async (req, res) => {
  try {
    const conv = await assertConversationMember(req.params.id, req.user.id);
    if (!conv) return res.status(403).json({ error: "Accès refusé" });

    await supabase
      .from("group_messages")
      .update({ delivered_at: new Date().toISOString() })
      .eq("conversation_id", conv.id)
      .neq("from_user", req.user.id)
      .is("delivered_at", null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// ------------------------------------------------------------
// [CONFIRMATIONS] POST /:id/seen — la conversation est OUVERTE à
// l'écran : les messages reçus sont LUS -> ✓✓ bleus chez les auteurs
// ------------------------------------------------------------
router.post("/:id/seen", requireAuth, async (req, res) => {
  try {
    const conv = await assertConversationMember(req.params.id, req.user.id);
    if (!conv) return res.status(403).json({ error: "Accès refusé" });

    const now = new Date().toISOString();
    await supabase
      .from("group_messages")
      .update({ read_at: now, delivered_at: now })
      .eq("conversation_id", conv.id)
      .neq("from_user", req.user.id)
      .is("read_at", null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// ------------------------------------------------------------
// [CRUD — UPDATE] POST /:id/messages/update  body: { messageId, text }
// Modifie SON propre message texte (temps réel met à jour les écrans)
// ------------------------------------------------------------
router.post("/:id/messages/update", requireAuth, async (req, res) => {
  try {
    const { messageId, text } = req.body || {};
    if (!text || !String(text).trim()) return res.status(400).json({ error: "Nouveau texte requis" });

    const conv = await assertConversationMember(req.params.id, req.user.id);
    if (!conv) return res.status(403).json({ error: "Accès refusé" });

    const { data: message } = await supabase
      .from("group_messages").select("*").eq("id", messageId).maybeSingle();
    if (!message || message.conversation_id !== conv.id) return res.status(404).json({ error: "Message introuvable" });
    if (message.from_user !== req.user.id) return res.status(403).json({ error: "Tu ne peux modifier que TES messages" });
    if (message.type !== "text") return res.status(400).json({ error: "Seuls les messages texte peuvent être modifiés" });
    if (message.deleted) return res.status(400).json({ error: "Ce message a été supprimé" });

    const { error } = await supabase
      .from("group_messages").update({ text: String(text).trim(), edited: true }).eq("id", messageId); // [CRUD] mention "modifié"
    if (error) return res.status(500).json({ error: translateError(error.message) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// ------------------------------------------------------------
// [CRUD — DELETE] POST /:id/messages/delete  body: { messageId }
// Supprime SON propre message pour tous (tombstone + média détruit)
// ------------------------------------------------------------
router.post("/:id/messages/delete", requireAuth, async (req, res) => {
  try {
    const { messageId } = req.body || {};
    const conv = await assertConversationMember(req.params.id, req.user.id);
    if (!conv) return res.status(403).json({ error: "Accès refusé" });

    const { data: message } = await supabase
      .from("group_messages").select("*").eq("id", messageId).maybeSingle();
    if (!message || message.conversation_id !== conv.id) return res.status(404).json({ error: "Message introuvable" });
    if (message.from_user !== req.user.id) return res.status(403).json({ error: "Tu ne peux supprimer que TES messages" });

    await supabase
      .from("group_messages").update({ deleted: true, text: null }).eq("id", messageId);

    if (message.media_path && !/^https?:\/\//i.test(message.media_path)) {
      await supabase.storage.from("chat-media").remove([message.media_path]).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// DELETE /api/groups/:id/memories/:memoryId — l'auteur peut supprimer son souvenir
router.delete("/:id/memories/:memoryId", requireAuth, async (req, res) => {
  try {
    const conv = await assertConversationMember(req.params.id, req.user.id);
    if (!conv) return res.status(403).json({ error: "Accès refusé" });

    const { data: memory } = await supabase
      .from("group_memories")
      .select("*")
      .eq("id", req.params.memoryId)
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (!memory) return res.status(404).json({ error: "Souvenir introuvable" });

    await supabase.from("group_memories").delete().eq("id", memory.id);
    await supabase.storage.from("chat-media").remove([memory.image_path].filter(Boolean));

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

module.exports = router;
