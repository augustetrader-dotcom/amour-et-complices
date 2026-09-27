const express = require("express");
const supabase = require("../supabaseClient");
const { requireAuth } = require("./auth.middleware");
// [PUSH] Notifications natives vers l'appareil du/de la partenaire
const { sendPushToUser } = require("../services/push.service");
// [CLOUDINARY] Validation des chemins de médias (Storage OU URL CDN)
const { isValidMediaPath } = require("../services/conversation.service");
const { translateError } = require("../utils/error-handler");

const router = express.Router();
const BUCKET = "chat-media";

async function assertCoupleMember(coupleId, userId) {
  const { data: couple } = await supabase.from("couples").select("*").eq("id", coupleId).single();
  if (!couple) return null;
  if (couple.user_a !== userId && couple.user_b !== userId) return null;
  return couple;
}

function decodeDataUrl(dataUrl) {
  // dataUrl du type "data:image/png;base64,XXXXX"
  const match = /^data:(.+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Format de média invalide");
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

function extFromMime(mime) {
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("quicktime")) return "mov";
  return "bin";
}

// GET /api/chat/history?coupleId=...&since=ISO
// [FLUIDITÉ] `since` = ne renvoyer QUE les messages plus récents
// (utilisé par le polling de secours toutes les 4s : requêtes minuscules)
router.get("/history", requireAuth, async (req, res) => {
  const { coupleId, since, before } = req.query;
  const couple = await assertCoupleMember(coupleId, req.user.id);
  if (!couple) return res.status(403).json({ error: "Accès refusé" });

  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 50;
  const requestedOffset = Number.parseInt(req.query.offset, 10);
  const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;

  let query = supabase
    .from("messages")
    .select("*")
    .eq("couple_id", coupleId);
  if (since) {
    query = query.gt("created_at", since).order("created_at", { ascending: true }).limit(limit);
  } else {
    if (before) query = query.lt("created_at", before);
    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  }

  const { data: fetched, error } = await query;

  if (error) return res.status(500).json({ error: translateError(error.message) });
  const data = since ? (fetched || []) : (fetched || []).reverse();

  // La confirmation ne doit pas retarder l'affichage de l'historique.
  const receivedIds = data.filter(message => message.from_user !== req.user.id && !message.delivered_at).map(message => message.id);
  if (receivedIds.length) {
    supabase.from("messages")
      .update({ delivered_at: new Date().toISOString() })
      .in("id", receivedIds)
      .then(() => {})
      .catch(() => {});
  }

  const storagePaths = [...new Set(data
    .filter(message => message.media_path && message.type !== "once" && !/^(https?:|data:)/i.test(message.media_path))
    .map(message => message.media_path))];
  let signedUrls = new Map();
  if (storagePaths.length) {
    const { data: signed, error: signingError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(storagePaths, 3600);
    if (!signingError) {
      signedUrls = new Map((signed || []).map(item => [item.path, item.signedUrl]));
    }
  }

  const enriched = data.map((m) => {
      const base = {
        ...m,
        from: m.from_user, // Garantit la compatibilité avec le frontend
        from_user: m.from_user,
      };

      if (m.media_path && m.type !== "once") {
        if (/^(https?:|data:)/i.test(m.media_path)) {
          return { ...base, media_url: m.media_path, media_path: undefined };
        }
        return { ...base, media_url: signedUrls.get(m.media_path) || null, media_path: undefined };
      }
      const { media_path, ...rest } = base; // Ne jamais exposer le chemin brut d'un "once"
      return rest;
  });

  res.json({ messages: enriched, hasMore: !since && data.length === limit });
});

// POST /api/chat/send
// body: { coupleId, type, text?, mediaDataUrl?, mediaPath?, mimeType? }
// [UPLOAD DIRECT] Deux modes d'envoi des médias :
//   - mediaPath  : le fichier a DÉJÀ été envoyé par le navigateur
//                  directement dans Storage (mode rapide, recommandé)
//   - mediaDataUrl : ancien mode base64 via le serveur (rétrocompatible)
router.post("/send", requireAuth, async (req, res) => {
  const { coupleId, type, text, mediaDataUrl, mediaPath, mimeType: clientMime, replyToId, replyPreview, replyIsMine } = req.body;
  const couple = await assertCoupleMember(coupleId, req.user.id);
  if (!couple) return res.status(403).json({ error: "Accès refusé" });
  if (!["text", "photo", "video", "voice", "once"].includes(type)) {
    return res.status(400).json({ error: "Type de message invalide" });
  }

  let mediaPathFinal = null;
  let mimeType = null;

  if (mediaPath) {
    // Sécurité : chemin Storage de CE couple OU URL Cloudinary légitime
    if (!isValidMediaPath(mediaPath, `${coupleId}/`)) {
      return res.status(403).json({ error: "Chemin de média invalide" });
    }
    mediaPathFinal = mediaPath;
    mimeType = clientMime || null;
  } else if (mediaDataUrl) {
    // Ancien mode (base64 via le serveur) — conservé pour compatibilité
    const { mimeType: mime, buffer } = decodeDataUrl(mediaDataUrl);
    mimeType = mime;
    const folder = type === "once" ? "once" : "media";
    mediaPathFinal = `${coupleId}/${folder}/${Date.now()}-${req.user.id}.${extFromMime(mime)}`;
    try {
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(mediaPathFinal, buffer, { contentType: mime });
      if (uploadError) {
        console.warn("[CHAT] Storage upload failed, falling back to data URL:", uploadError.message);
        mediaPathFinal = mediaDataUrl;
      }
    } catch (storageErr) {
      console.warn("[CHAT] Storage exception, falling back to data URL:", storageErr.message);
      mediaPathFinal = mediaDataUrl;
    }
  }

  let insertPayload = {
    couple_id: coupleId,
    from_user: req.user.id,
    type,
    text: text || null,
    media_path: mediaPathFinal,
    consumed: false,
  };
  if (mimeType) insertPayload.mime_type = mimeType;
  // [REPLY] Lien vers le message d'origine si c'est une réponse
  if (replyToId) {
    insertPayload.reply_to_id = replyToId;
    insertPayload.reply_preview = replyPreview || null;
    insertPayload.reply_is_mine = !!replyIsMine;
  }

  let { data: message, error } = await supabase
    .from("messages")
    .insert(insertPayload)
    .select()
    .single();

  // Si erreur de schéma ou colonne mime_type inexistante, on réessaye sans mime_type
  if (error && (error.message?.includes("mime_type") || error.code === "PGRST204" || error.message?.toLowerCase().includes("schema"))) {
    console.warn("Retrying message insert without mime_type due to DB schema error:", error.message);
    delete insertPayload.mime_type;
    const retry = await supabase.from("messages").insert(insertPayload).select().single();
    message = retry.data;
    error = retry.error;
  }
  // Si erreur sur reply_to_id (colonne absente), réessayer sans reply
  if (error && (error.message?.includes("reply_to_id") || error.message?.includes("reply_preview"))) {
    console.warn("Retrying without reply columns:", error.message);
    delete insertPayload.reply_to_id;
    delete insertPayload.reply_preview;
    delete insertPayload.reply_is_mine;
    const retry2 = await supabase.from("messages").insert(insertPayload).select().single();
    message = retry2.data;
    error = retry2.error;
  }

  if (error) return res.status(500).json({ error: translateError(error.message) });

  const safeMessage = {
    ...message,
    from: req.user.id,
    from_user: req.user.id,
    media_url: mediaDataUrl || null,
  };
  delete safeMessage.media_path;

  // [PUSH] Notification système sur le téléphone du/de la partenaire,
  // même app fermée. Fire-and-forget : n'attend pas la réponse.
  const partnerId = couple.user_a === req.user.id ? couple.user_b : couple.user_a;
  const senderName = req.user.user_metadata?.nickname || "Ton/ta moitié";
  sendPushToUser(partnerId, {
    title: `💌 ${senderName}`,
    body: type === "text" ? (text || "Nouveau message") : type === "voice" ? "🎙️ Message vocal" : type === "once" ? "🔒 Photo vue unique" : "📷 Nouveau média",
    url: "/",
    tag: `couple-${coupleId}`,
  }).catch(() => {});

  res.json({ message: safeMessage });
});

// POST /api/chat/view-once   body: { messageId }
router.post("/view-once", requireAuth, async (req, res) => {
  const { messageId } = req.body;

  const { data: message } = await supabase.from("messages").select("*").eq("id", messageId).single();
  if (!message || message.type !== "once") return res.status(404).json({ error: "Message introuvable" });

  const couple = await assertCoupleMember(message.couple_id, req.user.id);
  if (!couple) return res.status(403).json({ error: "Accès refusé" });

  // Règle : l'expéditeur ne peut PAS ouvrir sa propre photo éphémère !
  if (message.from_user === req.user.id) {
    return res.status(403).json({ error: "Seul ton/ta partenaire peut ouvrir ce média en vue unique" });
  }

  if (message.consumed) {
    return res.status(410).json({ error: "Ce contenu a déjà été vu et n'existe plus" });
  }

  try {
    /* [VUE UNIQUE — SANS COMPTE À REBOURS]
       Comme WhatsApp : le média reste consultable TANT QUE la
       visionneuse est ouverte. Ce n'est qu'à la FERMETURE que le
       frontend appelle /consume-once, qui marque le message comme
       vu et supprime définitivement le fichier du stockage. */
    // [CLOUDINARY] Média hébergé sur un CDN : on renvoie l'URL telle quelle
    if (/^https?:\/\//i.test(message.media_path || "")) {
      return res.json({ mediaUrl: message.media_path, dataUrl: message.media_path, mimeType: message.mime_type });
    }
    
    // Try signed URL first (more reliable for large files)
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(message.media_path, 600);
    if (signed?.signedUrl) {
      return res.json({ mediaUrl: signed.signedUrl, dataUrl: signed.signedUrl, mimeType: message.mime_type });
    }
    
    // Fallback to direct download if signed URL fails
    const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(message.media_path);
    if (downloadError) {
      return res.status(500).json({ error: "Le média n'est plus disponible ou a été supprimé." });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const mime = message.mime_type || "image/jpeg";
    const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;

    // NOTE VOLONTAIRE : on ne consomme PAS ici (supprimé) —
    // la destruction se fait à la fermeture via /consume-once.
    res.json({ mediaUrl: dataUrl, dataUrl, mimeType: mime });
  } catch (err) {
    console.error("Erreur view-once:", err);
    res.status(500).json({ error: "Impossible de charger le média éphémère. Veuillez réessayer." });
  }
});

// POST /api/chat/message/update   body: { messageId, text }
// [CRUD — UPDATE] Modifie le TEXTE d'un de ses propres messages.
router.post("/message/update", requireAuth, async (req, res) => {
  const { messageId, text } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: "Nouveau texte requis" });

  const { data: message } = await supabase.from("messages").select("*").eq("id", messageId).maybeSingle();
  if (!message) return res.status(404).json({ error: "Message introuvable" });
  if (message.from_user !== req.user.id) return res.status(403).json({ error: "Tu ne peux modifier que TES messages" });
  if (message.type !== "text") return res.status(400).json({ error: "Seuls les messages texte peuvent être modifiés" });
  if (message.deleted) return res.status(400).json({ error: "Ce message a été supprimé" });

  const { data: updated, error } = await supabase
    .from("messages")
    .update({ text: String(text).trim(), edited: true }) // [CRUD] mention "modifié"
    .eq("id", messageId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: translateError(error.message) });
  res.json({ message: updated });
});

// GET /api/chat/updates?coupleId=&since=
// [FLUIDITÉ] Rattrapage léger pour le polling client (4s) :
// - "new"      : messages créés depuis le dernier passage
// - "statuses" : derniers états (lu, distribué, supprimé, modifié, consommé)
//   des 100 derniers messages, pour synchroniser ticks et CRUD.
router.get("/updates", requireAuth, async (req, res) => {
  try {
    const { coupleId, since } = req.query;
    const couple = await assertCoupleMember(coupleId, req.user.id);
    if (!couple) return res.status(403).json({ error: "Accès refusé" });

    const sinceIso = since ? new Date(since).toISOString() : new Date(Date.now() - 60000).toISOString();

    const { data: newMsgs } = await supabase
      .from("messages")
      .select("*")
      .eq("couple_id", coupleId)
      .gt("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .limit(50);

    let statuses = [];
    try {
      const { data: st, error: stErr } = await supabase
        .from("messages")
        .select("id, read_at, consumed, delivered_at, deleted, edited, text, type, created_at")
        .eq("couple_id", coupleId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!stErr && st) {
        statuses = st;
      } else {
        // Fallback sans read_at / delivered_at si les colonnes ne sont pas encore créées
        const { data: fallbackSt } = await supabase
          .from("messages")
          .select("id, consumed, deleted, edited, text, type, created_at")
          .eq("couple_id", coupleId)
          .order("created_at", { ascending: false })
          .limit(100);
        statuses = fallbackSt || [];
      }
    } catch (e) {
      statuses = [];
    }

    res.json({ new: newMsgs || [], statuses, now: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: translateError(err.message) });
  }
});

// POST /api/chat/message/delete   body: { messageId }
// [CRUD — DELETE] Supprime un de ses propres messages "pour tous"
// (tombstone "Message supprimé" + fichier média détruit du stockage).
router.post("/message/delete", requireAuth, async (req, res) => {
  const { messageId } = req.body || {};

  const { data: message } = await supabase.from("messages").select("*").eq("id", messageId).maybeSingle();
  if (!message) return res.status(404).json({ error: "Message introuvable" });
  if (message.from_user !== req.user.id) return res.status(403).json({ error: "Tu ne peux supprimer que TES messages" });

  // Marque supprimé pour tous (le temps réel met à jour les écrans)
  await supabase.from("messages").update({ deleted: true, text: null }).eq("id", messageId);

  // Détruit le fichier média éventuel (sauf Cloudinary : CDN externe)
  if (message.media_path && !/^https?:\/\//i.test(message.media_path)) {
    await supabase.storage.from(BUCKET).remove([message.media_path]).catch(() => {});
  }

  res.json({ ok: true });
});

// POST /api/chat/consume-once   body: { messageId }
// [VUE UNIQUE] Appelé quand l'utilisateur FERME la visionneuse :
// marque le message comme vu + supprime définitivement le fichier.
router.post("/consume-once", requireAuth, async (req, res) => {
  const { messageId } = req.body;

  const { data: message } = await supabase.from("messages").select("*").eq("id", messageId).single();
  if (!message || message.type !== "once") return res.status(404).json({ error: "Message introuvable" });

  const couple = await assertCoupleMember(message.couple_id, req.user.id);
  if (!couple) return res.status(403).json({ error: "Accès refusé" });

  // Déjà consommé ? On confirme simplement (idempotent)
  if (message.consumed) return res.json({ ok: true });

  await supabase.from("messages").update({ consumed: true }).eq("id", messageId);
  // [CLOUDINARY] Un média CDN ne peut pas être supprimé sans clés API :
  // on marque juste le message comme consommé (l'app n'affichera plus rien)
  if (message.media_path && !/^https?:\/\//i.test(message.media_path)) {
    await supabase.storage.from(BUCKET).remove([message.media_path]);
  }
  res.json({ ok: true });
});

// POST /api/chat/mark-delivered   body: { coupleId }
// [CONFIRMATIONS DE LECTURE] Appelé par l'appareil du destinataire quand un
// message arrive en temps réel : prouve que son téléphone a bien reçu le
// message (l'expéditeur passe alors de ✓ à ✓✓). Ne touche pas à read_at :
// seul le message lu (mark-seen) rend les traits bleus.
router.post("/mark-delivered", requireAuth, async (req, res) => {
  const { coupleId } = req.body;
  const couple = await assertCoupleMember(coupleId, req.user.id);
  if (!couple) return res.status(403).json({ error: "Accès refusé" });

  try {
    const { error } = await supabase
      .from("messages")
      .update({ delivered_at: new Date().toISOString() })
      .eq("couple_id", coupleId)
      .neq("from_user", req.user.id)
      .is("delivered_at", null);

    if (error && error.code !== "42703") {
      console.warn("mark-delivered update warning:", error.message);
    }
  } catch (e) {}
  res.json({ ok: true });
});

// POST /api/chat/mark-seen   body: { coupleId }
router.post("/mark-seen", requireAuth, async (req, res) => {
  const { coupleId } = req.body;
  const couple = await assertCoupleMember(coupleId, req.user.id);
  if (!couple) return res.status(403).json({ error: "Accès refusé" });

  try {
    // Marque comme lu tous les messages reçus (texte/média), sans toucher aux "once"
    const { error } = await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("couple_id", coupleId)
      .neq("from_user", req.user.id)
      .is("read_at", null);

    if (error && error.code !== "42703") {
      console.warn("mark-seen update warning:", error.message);
    }
  } catch (e) {}
  res.json({ ok: true });
});

module.exports = router;
