# Configuration HTTPS Gratuite pour Amour & Complices

## 🚀 Options HTTPS 100% Gratuites

### Option 1: Netlify (Recommandée - Le plus simple)

**Avantages:**
- ✅ 100% gratuit
- ✅ HTTPS automatique
- ✅ Déploiement en 1 commande
- ✅ Certificat SSL automatique
- ✅ Domaine gratuit: votre-app.netlify.app

**Installation:**
```bash
# Installer Netlify CLI
npm install -g netlify-cli

# Se connecter
netlify login

# Déployer
netlify deploy --prod
```

### Option 2: Vercel (Excellent aussi)

**Avantages:**
- ✅ 100% gratuit
- ✅ HTTPS automatique
- ✅ Très rapide
- ✅ Domaine gratuit: votre-app.vercel.app

**Installation:**
```bash
# Installer Vercel CLI
npm install -g vercel

# Déployer
vercel --prod
```

### Option 3: Cloudflare Pages

**Avantages:**
- ✅ 100% gratuit
- ✅ HTTPS automatique
- ✅ CDN mondial très rapide
- ✅ Intégration Git

### Option 4: GitHub Pages (Gratuit mais limité)

**Avantages:**
- ✅ 100% gratuit
- ✅ HTTPS automatique
- ✅ Intégration GitHub directe

**Inconvénients:**
- ❌ Pas de backend Node.js (votre app ne fonctionnera pas)
- ❌ Frontend uniquement

### Pour notre application: Netlify ou Vercel

Comme votre application a un backend Node.js (server.js), **Netlify** ou **Vercel** sont les meilleures options.

## 📝 Configuration Netlify pour votre application

### 1. Préparer le déploiement

Créez un fichier `netlify.toml` à la racine:

```toml
[build]
  command = "npm install"
  publish = "."

[functions]
  directory = "."

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
```

### 2. Déployer sur Netlify

```bash
# Installer Netlify CLI
npm install -g netlify-cli

# Initialiser Netlify
netlify init

# Déployer en production
netlify deploy --prod
```

### 3. Variables d'environnement

Dans le dashboard Netlify:
- Site settings > Environment variables
- Ajoutez vos variables Supabase:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_ANON_KEY`

## 🌐 Personnaliser le domaine

Après déploiement, vous aurez:
- Domaine par défaut: `amour-complices.netlify.app`
- Vous pouvez ajouter votre propre domaine gratuitement

## 🔒 Certificat SSL

Netlify fournit automatiquement:
- Certificat SSL Let's Encrypt
- Renouvellement automatique
- Aucune configuration nécessaire

## ⚡ Performance

Netlify offre:
- CDN mondial
- Compression automatique
- Cache intelligent
- HTTP/2

## 💰 Coût

**Totalement GRATUIT** pour:
- Sites personnels
- Projets open source
- Petites applications

Limites du plan gratuit:
- 100GB bande passante/mois
- 300 minutes de build/mois
- Suffisant pour votre application !