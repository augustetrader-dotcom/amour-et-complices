const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const rateLimit = require("express-rate-limit");

const coupleRoutes = require("./routes/couple.routes");
const quizRoutes = require("./routes/quiz.routes");
const contentRoutes = require("./routes/content.routes");
const chatRoutes = require("./routes/chat.routes");
const groupRoutes = require("./routes/group.routes");
// [PHASE 0] CORRECTION : friends.routes.js existait mais n'était jamais
// monté — les routes /api/friends répondaient 404. C'est maintenant réparé.
const friendsRoutes = require("./routes/friends.routes");
// [JEU SYNCHRONISÉ] État partagé du Défi complice (même carte pour les deux)
const gameRoutes = require("./routes/game.routes");
// [STORIES] Photos/vidéos éphémères 24h (comme WhatsApp Status)
const storiesRoutes = require("./routes/stories.routes");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");

const app = express();

// ------------------------------------------------------------
// [PROTECTION 0] Proxys de confiance
// Derrière un tunnel (cloudflared/ngrok/https) ou un reverse proxy,
// la vraie IP du client est dans X-Forwarded-For. Sans ça, le rate
// limiting croirait que toutes les requêtes viennent du proxy.
// ------------------------------------------------------------
app.set("trust proxy", 1);

app.use(cors());

// ------------------------------------------------------------
// [PROTECTION 1] RATE LIMITING (anti-flood / anti-DDoS)
// Chaque limite est indépendante, par adresse IP. Un attaquant qui
// envoie 10 000 requêtes reçoit des 429 (Trop de requêtes) au bout
// du quota — le serveur ne gonfle pas et ne crashe pas.
// Les réponses 429 utilisent des messages clairs pour le frontend.
// ------------------------------------------------------------
function makeLimiter(windowMs, max, message) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,   // renvoie Retry-After (le client sait quand réessayer)
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: message }),
  });

}

// 1a. Limite GLOBALE : 1200 requêtes / 15 min / IP.
// (Un utilisateur normal en consomme ~40-60 : heartbeat 1/min,
// chargements de pages, messages... 1200 laisse une large marge.)
app.use(makeLimiter(
  15 * 60 * 1000,
  1200,
  "Trop de requêtes envoyées. Fais une pause, réessaie dans quelques minutes."
));

// 1b. AUTH : 20 tentatives / 15 min / IP (anti brute-force des mots de passe)
app.use("/api/auth", makeLimiter(
  15 * 60 * 1000,
  20,
  "Trop de tentatives de connexion. Réessaie dans 15 minutes."
));

// 1c. UPLOADS (médias lourds en base64) : 120 envois / 15 min / IP
// Protège la mémoire du serveur : c'est LE point de gonflement possible.
const uploadLimiter = makeLimiter(
  15 * 60 * 1000,
  120,
  "Trop de médias envoyés d'un coup. Attends quelques minutes avant de renvoyer."
);
app.use("/api/chat/send", uploadLimiter);
app.use("/api/stories", uploadLimiter);
app.use(/^\/api\/groups\/[^/]+\/messages$/, uploadLimiter);

// ------------------------------------------------------------
// [PROTECTION 2] Rejet PRÉCOCE des corps de requête énormes
// On refuse (413) avant même de parser le JSON : aucun octet
// inutile ne charge la mémoire du serveur.
// ------------------------------------------------------------
const MAX_BODY_BYTES = 22 * 1024 * 1024; // ~22 Mo (les médias partent en base64)
app.use((req, res, next) => {
  const declared = Number(req.headers["content-length"] || 0);
  if (declared > MAX_BODY_BYTES) {
    return res.status(413).json({ error: "Fichier trop volumineux (maximum ~20 Mo)." });
  }
  next();
});

app.use(express.json({ limit: "20mb" })); // les photos/vidéos/vocaux arrivent en base64

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/couple", coupleRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/stories", storiesRoutes);
// [PUSH] Abonnements aux notifications push natives
const pushRoutes = require("./routes/push.routes");
app.use("/api/push", pushRoutes);
// [LOVE QUIZ] Questionnaire de personnalisation
const loveQuizRoutes = require("./routes/love-quiz.routes");
app.use("/api/love-quiz", loveQuizRoutes);

app.get("/api/public-config", (req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    cloudinaryUploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || "",
  });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

// ------------------------------------------------------------
// [PROTECTION 3] Route API inconnue -> réponse JSON propre (404)
// Au lieu de servir index.html par erreur, le frontend reçoit un
// message clair et compréhensible.
// ------------------------------------------------------------
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Cette fonction n'existe pas (route inconnue)." });
});

// Sert le frontend (public/index.html + config.js) sur la même origine que l'API
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------------------------------------
// [PROTECTION 4] Filet de sécurité GLOBAL des erreurs
// Une erreur imprévue dans une route ne fait PLUS planter le serveur :
// elle est loggée et le client reçoit une réponse propre.
// ------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error("[ERREUR SERVEUR]", err?.message || err);
  if (res.headersSent) return next(err);
  res.status(err?.status || 500).json({
    error: "Une erreur interne est survenue. Réessaie dans un instant.",
  });
});

// ------------------------------------------------------------
// [PROTECTION 5] Résilience du PROCESSUS
// Une erreur asynchrone non gérée (réseau Supabase, etc.) est loggée
// au lieu de tuer le serveur pour tous les utilisateurs.
// ------------------------------------------------------------
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException — serveur maintenu en vie]", err?.message || err);
});
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection — serveur maintenu en vie]", err?.message || err);
});

const PORT = process.env.PORT || 3000;

// [CORRECTION 431] Sécurité : on augmente la taille maximale des en-têtes HTTP
// (défaut Node = 16 Ko). Les anciennes sessions dont le token contenait une
// photo en base64 dépassaient cette limite -> erreur 431. Avec 1 Mo, aucune
// requête légitime ne peut plus être rejetée, même avec un ancien token.
const server = http.createServer({ maxHeaderSize: 1024 * 1024 }, app);

// ------------------------------------------------------------
// [PROTECTION 6] TIMEOUTS du serveur (anti slowloris & connexions zombies)
// - headersTimeout : rejette les clients qui ouvrent une connexion
//   sans jamais finir d'envoyer leurs en-têtes (attaque slowloris)
// - requestTimeout : termine les requêtes interminables
// - keepAliveTimeout : recycle les connexions inactives
// ------------------------------------------------------------
server.headersTimeout = 66000;   // doit rester > keepAliveTimeout
server.keepAliveTimeout = 65000;
server.requestTimeout = 180000;  // 3 min : assez pour un envoi mobile 4G d'une vidéo

server.listen(PORT, () => {
  console.log(`App démarrée sur http://localhost:${PORT}`);
  console.log("Le temps réel du chat passe par Supabase Realtime (postgres_changes), pas par ce serveur.");
  console.log("Protections actives : rate limiting global+auth+uploads, rejet des gros payloads, timeouts, filet anti-crash.");
});
