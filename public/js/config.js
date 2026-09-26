// Configuration Supabase & API dynamique (compatible PC, iPhone/iOS et tunnels distants)
window.APP_CONFIG = {
  SUPABASE_URL: "https://pqhnvekhayfpyquzlzgz.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxaG52ZWtoYXlmcHlxdXpsemd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MTA0NjgsImV4cCI6MjEwNDk4NjQ2OH0.4kdQkdXDQfuN-AGOHUYQa0i6_Wf4KaCGAx2-W1PBcWk",
  // Utilise automatiquement l'adresse du serveur d'où la page est ouverte (IP locale ou tunnel public HTTPS)
  API_BASE: (window.location.origin && window.location.origin !== "null") ? window.location.origin : "http://localhost:3000",

  // ============================================================
  // [CLOUDINARY] Stockage direct des photos/vidéos sur le CDN.
  // Pour l'activer :
  //   1. Crée un compte gratuit sur cloudinary.com
  //   2. Dashboard → Settings → Upload → "Add upload preset"
  //      → Signing Mode : "Unsigned" → autorise images/vidéos → note son nom
  //   3. Renseigne le nom du cloud et du preset unsigned ci-dessous.
  // Les fichiers >100 Mo sont envoyés par blocs. La limite applicative est
  // 500 Mo ; le compte Cloudinary doit autoriser cette taille et avoir le quota.
  // Sans configuration, Supabase Storage reste limité à 50 Mo par fichier.
  // ============================================================
  CLOUDINARY_CLOUD_NAME: "",
  CLOUDINARY_UPLOAD_PRESET: "",

  // La clé Tenor est secrète : configure TENOR_API_KEY dans le .env du serveur.
};