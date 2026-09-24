// Configuration Supabase & API dynamique (compatible PC, iPhone/iOS et tunnels distants)
window.APP_CONFIG = {
  SUPABASE_URL: "https://pqhnvekhayfpyquzlzgz.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxaG52ZWtoYXlmcHlxdXpsemd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MTA0NjgsImV4cCI6MjEwNDk4NjQ2OH0.4kdQkdXDQfuN-AGOHUYQa0i6_Wf4KaCGAx2-W1PBcWk",
  // Utilise automatiquement l'adresse du serveur d'où la page est ouverte (IP locale ou tunnel public HTTPS)
  API_BASE: (window.location.origin && window.location.origin !== "null") ? window.location.origin : "http://localhost:3000",

  // ============================================================
  // [CLOUDINARY — OPTIONNEL] Stockage des photos/vidéos sur le CDN
  // Cloudinary (25 Go gratuits, lecture ultra-rapide dans le monde).
  // Pour l'activer :
  //   1. Crée un compte gratuit sur cloudinary.com
  //   2. Dashboard → Settings → Upload → "Add upload preset"
  //      → Signing Mode : "Unsigned" → note son nom
  //   3. Remplis les 2 valeurs ci-dessous (nom du cloud + nom du preset)
  // Si laissé vide : les médias passent par Supabase Storage (par défaut).
  // ============================================================
  CLOUDINARY_CLOUD_NAME: "",
  CLOUDINARY_UPLOAD_PRESET: "",

  // ============================================================
  // [TENOR — OPTIONNEL] GIFs dans les chats.
  // Crée une clé API gratuite sur console.cloud.google.com (API Tenor)
  // et colle-la ci-dessous. Sinon, l'onglet GIF affiche un mode d'emploi
  // (les emojis et stickers fonctionnent déjà sans clé).
  // ============================================================
  TENOR_API_KEY: "",
};