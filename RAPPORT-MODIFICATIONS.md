# 📋 RAPPORT COMPLET DES MODIFICATIONS
### Amour & Complices — Développement Phases 0 → 4

---

## 🔴 PHASE 0 — Réparation & Stabilité (URGENCE)

### 1. Frontend complètement cassé → RÉPARÉ
`public/index.html` contenait **deux blocs CSS/HTML collés par erreur au milieu du code JavaScript** (styles `.notification-badge`, `.loading-animation`, un `<div>` orphelin, des appels vers une fonction `initChat()` inexistante).
- **Conséquence : une `SyntaxError` tuait TOUT le JavaScript** — l'authentification, le chat, le quiz, le jeu : rien ne fonctionnait.
- **Corrigé** : les deux blocs invalides ont été supprimés, l'accolade fermante de `loadChat()` restaurée. Le fichier est maintenant validé syntaxiquement (`node --check`).

### 2. Routes amis jamais montées → CORRIGÉ
`routes/friends.routes.js` existait mais n'était **jamais importé dans `server.js`** : toutes les routes `/api/friends` répondaient 404. → Montées.

### 3. Pairage aléatoire neutralisé
`POST /api/couple/instant-connect` : l'ancien risque de pairage accidentel est définitivement neutralisé. L'endpoint ne fait **que** vérifier si l'utilisateur possède déjà un couple. Aucune association à un compte inconnu n'est possible.

### 4. Code mort supprimé
Les anciennes routes `POST/GET /api/couple/messages` (simulation de messages dans un tableau JavaScript, jamais utilisées par le vrai chat) ont été supprimées de `couple.routes.js`.

### 5. Route heartbeat manquante → CRÉÉE
Le frontend appelait `/api/couple/heartbeat` (toutes les 60 s) mais la route n'existait pas → 404 silencieux. **Créée** : elle met à jour `profiles.last_seen`.

---

## 👤 PHASE 1 — Profil & Présence réelle

| Élément | Détail |
|---|---|
| Colonne `profiles.last_seen` | Ajoutée au schéma (migration sécurisée `add column if not exists`) |
| Indicateur "En ligne" | Calculé côté serveur : en ligne = signal de vie < 90 secondes |
| `GET /api/couple/mine` | Retourne maintenant `is_online` + `last_seen` du partenaire |
| Mode solo | Le heartbeat fonctionne aussi sans partenaire lié |
| (Déjà en place) | Table `profiles`, édition nom/photo/numéro/bio, recherche par numéro |

---

## 💬 PHASE 2 — Amis & Groupes RÉELS (style WhatsApp)

### Nouvelles tables Supabase (avec RLS complète)
- **`friend_requests`** — demandes d'ami (pending / accepted / declined)
- **`friends`** — amitiés acceptées (stockées dans les deux sens)
- **`conversations`** — conversations unifiées : type `couple` / `friend` / `group`
- **`conversation_members`** — membres de chaque conversation
- **`group_messages`** — messages des conversations amis/groupes (texte, photo, vidéo, vocal)
- **Trigger SQL** : à la création d'un couple, la conversation "couple" s'ouvre automatiquement (rattrapage aussi fait côté serveur pour les couples existants)
- **Realtime** activé sur `group_messages` (messages instantanés, comme le chat couple)

### Backend réécrit de zéro
- **`services/conversation.service.js` (NOUVEAU)** — moteur partagé : vérification des membres, création de conversations 1:1, upload de médias dans Storage privé, URLs signées.
- **`routes/friends.routes.js` (RÉÉCRIT)** — était un faux stockage en mémoire (tout perdu au redémarrage) :
  - `POST /api/friends/request` : ajout par **numéro de téléphone** → si le numéro existe dans l'app, demande envoyée ; acceptation automatique si demande mutuelle ; messages d'erreur clairs (numéro absent de l'app, déjà amis…)
  - `POST /api/friends/accept` / `decline` : traite les demandes (crée l'amitié + la conversation 1:1)
  - `GET /api/friends` : amis + demandes reçues + demandes envoyées, avec présence en ligne
- **`routes/group.routes.js` (RÉÉCRIT)** — était aussi 100 % en mémoire :
  - Création de groupe réel, ajout de membres **par numéro de téléphone**
  - Historique et envoi de messages avec **photos, vidéos et vocaux** stockés dans Supabase Storage (URLs signées)
  - Aperçu du dernier message + compteur de membres (style WhatsApp)
  - Suppression de l'album "souvenirs" factice (jamais persisté)

### Frontend : nouvel onglet Amis style WhatsApp
- **Liste de discussions unifiée** : conversation du couple ❤️ en tête, puis amis, puis groupes (triés par dernière activité), avec aperçu du dernier message
- **Onglet "Amis"** : ajout par numéro, demandes reçues à accepter/refuser ✓✕, demandes en attente
- **Onglet "Groupes"** : création, ajout de membres par numéro
- **Moteur de conversation unifié** : chat 1:1 ami et chat de groupe avec en-tête WhatsApp (avatar, statut, retour), texte + photo + **vocal** (le bouton 🎤 envoie maintenant dans la bonne conversation), temps réel instantané
- **Supprimé** : les faux contacts codés en dur (Lucas, Camille, Thomas) et toutes les fonctions factices associées

---

## 🔥 PHASE 4 — Contenu : Quiz Complice + Action ou Vérité

### Quiz épicé
- **30 nouvelles questions "Complice"** ajoutées à `content/quiz_questions.json` (130 questions au total) : intimes, suggestives et pertinentes pour un couple, dans le format existant (langages de l'amour)
- **Nouveau sélecteur dans l'app** : 🌸 *Classique* (les 100 douces) / 🔥 *Complice 18+* (les 30 épicées)
- Le scoring de compatibilité fonctionne identiquement dans les deux modes

### Action ou Vérité (nouveau jeu)
- **90 cartes** dans `content/action_verite.json` : 45 Vérités + 45 Actions
- **3 niveaux d'intensité** : 🌙 Doux / 🔥 Complice / 💋 Osé — respectueux, consentement rappelé dans l'interface
- Nouvelle table **`truth_dare_cards`** + route `GET /api/content/truth-dare` + seed
- **Interface intégrée à l'onglet Jeu** avec sélecteur de mode : 🎴 Défi complice / 🔥 Action ou Vérité — choix du type (💭 Vérité / 🎯 Action), choix du niveau, pioche aléatoire, et envoi de la carte dans le chat du couple
- **`scripts/seed_content.js` réécrit** : chaque table est vérifiée indépendamment → tu peux relancer `npm run seed` sans doublons, il n'ajoute que le contenu manquant

---

## 📱 PHASE 3 — PWA installable

| Élément | Détail |
|---|---|
| `public/manifest.json` | Créé (nom, couleurs, mode standalone, portrait) |
| Icônes | `public/icons/icon-192.png` et `icon-512.png` générées (cœur rose sur fond nuit) |
| Balises PWA | `theme-color`, `apple-mobile-web-app-capable`, `apple-touch-icon`, favicon |
| Mode mobile plein écran | Sur téléphone (< 520 px), le cadre "smartphone" décoratif disparaît : l'app occupe tout l'écran comme une vraie app native, avec zones sûres iOS (`safe-area`) |
| Installation | iOS : Safari → Partager → "Sur l'écran d'accueil" · Android : Chrome → "Installer" — **nécessite HTTPS** (tunnel cloudflared/ngrok) |

> ⚠️ **Pour tester sur téléphone** : `public/config.js` doit pointer `API_BASE` vers une adresse joignable depuis le mobile (IP locale sur le même Wi-Fi, ou tunnel HTTPS).

---

## ✅ Vérifications effectuées

- Syntaxe validée (`node --check`) sur : `server.js`, les 8 fichiers de routes, les 3 services, les 2 scripts
- JSON validés : quiz (130), action_vérité (90), cartes (150), mots doux (1000)
- JavaScript du frontend extrait et validé (`node --check`) : **plus aucune erreur de syntaxe**
- Aucune référence orpheline aux anciennes fonctions supprimées

## 🚀 À faire de ton côté (une seule fois)

1. **Supabase → éditeur SQL** : ré-exécuter tout `schema.sql` (ré-exécutable, sans danger)
2. **Database > Replication** : activer `group_messages` pour le temps réel
3. `npm run seed` (ajoute les nouveaux contenus uniquement)
4. `npm start` et tester à deux en navigation privée

## 💡 Pistes pour la suite (non inclus)

- Stories éphémères 24 h (Phase 4 du plan initial)
- Notifications push (Web Push / Firebase)
- Album souvenirs de groupe **persistant** (l'ancien était factice, il a été retiré)
- Invitations par SMS (nécessite Twilio connecté à Supabase Auth)
- Compression vidéo côté client
