# Plan de refonte — Amour & Complices (PWA → App Store)

> ## 📊 ÉTAT D'AVANCEMENT (mise à jour)
> - ✅ **Phase 0 — Stabilité** : terminée (frontend réparé, routes montées, pairage neutralisé, heartbeat créé)
> - ✅ **Phase 1 — Profil + téléphone** : terminée (présence `last_seen` + "En ligne" réel)
> - ✅ **Phase 2 — Amis & groupes réels** : terminée (tables Supabase + RLS, ajout par numéro, chats ami/groupe avec médias et temps réel)
> - ✅ **Phase 3 — PWA** : terminée (manifest, icônes, plein écran mobile)
> - ✅ **Phase 4 — Polish (partiel)** : quiz Complice 18+, jeu Action ou Vérité (3 niveaux) · *restent : stories, push, onboarding guidé*
> - 📄 Détail complet : `RAPPORT-MODIFICATIONS.md`

Objectif : transformer le prototype en une vraie application de couple & amis
(chat type WhatsApp, stories, vue unique, vocaux, amis par numéro de téléphone,
groupes) installable comme PWA sur iOS/Android, puis évoluer vers le store.

Cahier des charges global (briefing) :
- Jeu de couple + esprit "conversation de couple"
- Chat partenaire/partenaire : texte, photo, vidéo, vocal, vue unique
- Amis ajoutés par numéro de téléphone (vérifie si l'utilisateur a l'app)
- Groupes de discussion + albums souvenirs
- Chaque utilisateur peut changer son nom de profil + photo + numéro de téléphone
- Numéro visible dans le profil (suivi & communication)

---

## Phase 0 — Stabilité : corriger les bugs critiques

But : l'app doit fonctionner sans casser avant d'ajouter des features.

1. **Supprimer le "pairing accidentel"** (`couple.routes.js` / instant-connect)
   - Supprimer le fallback `allUsers.find(u => u.id !== req.user.id)` qui associe
     l'utilisateur à un compte RANDOM d'un vrai utilisateur (fuite de données).
   - Supprimer/neutraliser la création des faux comptes `compagnon.*@couple.local`
     (source du pseudo "Mon Amour ❤️" codé en dur).
   - Pas de partenaire → écran de liaison propre ; l'utilisateur reste en mode solo
     sans partenaire factice.
2. **Helper d'upload fiable** (`public/index.html`)
   - Nouvelle fonction `fileToDataUrl()` → `file.arrayBuffer()` + base64.
   - Remplacer les 4 usages de `FileReader` / `readAsDataURL` (photo, média, avatar,
     arrière-plan) qui ne fonctionnent plus dans les navigateurs modernes.
   - Déplacer ensuite ce helper dans son propre fichier (`public/js/utils.js`).
3. **Enregistrement vocal — fallback** (`public/index.html`)
   - `navigator.mediaDevices.getUserMedia` + `MediaRecorder` = APIs très récentes.
   - Si indisponibles → fallback `<input type="file" accept="audio/*">`.
4. **Sécurité XSS**
   - Helper `escapeAttr()` pour toutes les URLs injectées dans `onclick="...`"` et `src="..."`.
5. **Séparer "vu" / "vue unique"** (`schema.sql` + `chat.routes.js`)
   - Ajouter `read_at timestamptz` sur `messages`.
   - `consumed` ne sert plus qu'à la vue unique.

## Phase 1 — Profil réel + numéro de téléphone

1. **Schéma** : table `profiles` (user_id PK FK, display_name, phone unique, avatar_url,
   bio, theme, created_at, updated_at) + index sur `phone`.
2. **Register** : champ téléphone (optionnel au début, encouragé).
3. **Routes API** : GET/PUT `/api/user/profile` (nom, téléphone, photo, bio).
4. **Frontend** : écran "Mon Profil" éditable ; afficher pseudo + numéro du partenaire
   dans les détails du partenaire.
5. **Supprimer "Mon Amour" en dur** et les overrides `localStorage`
   (`my_nickname`, `partner_nickname`) → le serveur = source de vérité.
6. Migration des anciennes métadonnées (`user_metadata`) vers `profiles`.

## Phase 2 — Amis & Groupes réels (Supabase)

1. **Schéma** : `friends` (paires acceptées), `group_chats`, `group_members`,
   `group_messages`, `group_albums` (+ RLS, Realtime).
2. **Ajout ami par numéro** : recherche téléphone → si compte existe → demande
   d'ami/invitation ; sinon invitation (SMS si un fournisseur est connecté).
3. **Chat 1:1 ami** : migrer `messages` vers un modèle conversation
   (conversation_type: couple|friend|group) ou table dédiée `conversations`.
4. **Groupes** : création groupe, ajout membres par numéro, messages texte/média
   temps réel via Realtime, albums photos.
5. **Supprimer la logique en mémoire** de `group.routes.js` → Supabase.

## Phase 3 — PWA installable

1. **manifest.json** : name, short_name, display: standalone, theme_color,
   icons 192/512 (créées dans `/public/icons/`).
2. **Meta PWA** : `apple-touch-icon`, favicon, `mobile-web-app-capable`.
3. **Layout responsive** : plein écran sur mobile (on garde le cadre téléphone sur
   desktop uniquement en mode démo), safe-area iOS.
4. **HTTPS** obligatoire pour l'installation (tunnel type cloudflared / ngrok).
5. **Tests device** : iPhone (Safari → "Ajouter à l'écran d'accueil") et Android
   (Chrome → "Installer").

## Phase 4 — Polish qualité "magasin"

1. **Onboarding guidé** à la première connexion : photo, pseudo, numéro.
2. **Notifications push** pour nouveaux messages.
3. **Présence temps réel** partenaire (Supabase Presence / heartbeat).
4. **Stories** (médias éphémères 24h) — au programme plus tard.
5. **UI/UX** : animations, transitions, haptiques, splash screen, empty states.

---

## Ordre de priorité (à chaque phase)

1. Le fix de stabilité d'abord (Phase 0) → on débloque tout le reste.
2. Le profil + téléphone ensuite (bloque l'ajout d'amis).
3. Les amis/groupes réels (cœur du produit).
4. La PWA (distribution).
5. Le polish (qualité perçue).