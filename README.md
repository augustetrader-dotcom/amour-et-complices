# Amour & Complices 🌸

Application de couple et d'amis avec chat temps réel, quiz de compatibilité, jeux interactifs et stories éphémères. Disponible comme PWA et application native mobile.

## 🎯 Fonctionnalités Principales

### 💝 Mode Couple
- **Chat temps réel** : messages texte, photos, vidéos, messages vocaux
- **Messages vue unique** : médias qui disparaissent après lecture
- **Quiz de compatibilité** : analyse des langages de l'amour (mots, temps de qualité, cadeaux, services, toucher)
- **Jeu de couple** : cartes de défis et questions pour renforcer la complicité
- **Mots doux** : banque de 1000+ messages romantiques
- **Présence en temps réel** : voir quand votre partenaire est en ligne
- **Thèmes personnalisables** : plusieurs ambiances (nuit étoilée, rose passion, émeraude, etc.)
- **Photo de profil synchronisée** : changements en temps réel

### 👥 Mode Amis & Groupes
- **Ajout d'amis par numéro de téléphone** : recherchez vos amis qui utilisent l'app
- **Chat individuel** : conversations privées avec vos amis
- **Groupes de discussion** : créez des groupes pour vos cercles d'amis
- **Médias partagés** : photos et vidéos dans toutes les conversations
- **Confirmations de lecture** : ticks de livraison et lecture (style WhatsApp)
- **Réponses aux messages** : glisser pour répondre (style WhatsApp)
- **Édition et suppression** : modifiez ou supprimez vos messages

### 📱 Stories (24h)
- **Photos et vidéos éphémères** : partages qui disparaissent après 24h
- **Légendes personnalisées** : ajoutez du texte à vos stories
- **Style WhatsApp Status** : interface familière et intuitive

### 🔔 Notifications
- **Notifications push** : alertes même quand l'app est fermée
- **Toast notifications** : alertes intégrées dans l'app
- **Badges** : compteurs de messages non lus

### 🎨 Personnalisation
- **Avatars emoji** : choisissez parmi des dizaines d'emojis
- **Thèmes dynamiques** : changez l'ambiance de l'interface
- **Arrière-plan personnalisé** : utilisez vos photos de couple
- **Surnoms** : personnalisez les noms affichés

## 🏗️ Architecture Technique

### Backend
- **Node.js + Express** : serveur API REST
- **Supabase** : base de données PostgreSQL, authentification, stockage, temps réel
- **Rate limiting** : protection anti-DDoS et anti-flood
- **Sécurité** : RLS (Row Level Security), validation des inputs, timeouts

### Frontend
- **Vanilla JavaScript** : pas de framework lourd
- **PWA** : installation possible sur iOS et Android
- **Capacitor** : conversion en app native (Android/iOS)
- **Responsive design** : optimisé pour mobile

### Base de données
- **PostgreSQL via Supabase** :
  - `profiles` : profils utilisateurs
  - `couples` : relations de couple
  - `messages` : chat couple
  - `friends` / `friend_requests` : système d'amis
  - `conversations` / `group_messages` : chats amis/groupes
  - `quiz_questions` / `quiz_results` : quiz compatibilité
  - `game_cards` : cartes de jeu
  - `sweet_messages` : mots doux
  - `truth_dare_cards` : action ou vérité

## 📋 Prérequis

- **Node.js** (v18 ou supérieur)
- **npm** ou **yarn**
- **Compte Supabase** (gratuit)
- **Git**

## 🚀 Installation

### 1. Cloner le projet

```bash
git clone https://github.com/votre-username/couple-app.git
cd couple-app
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer Supabase

1. Créez un projet sur [Supabase](https://supabase.com/)
2. Allez dans **Project Settings > API**
3. Copiez votre `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`

### 4. Configuration de l'environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer .env avec vos informations
```

**Contenu du fichier `.env` :**
```env
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ votre_clé_service_role
PORT=3000
```

### 5. Initialiser la base de données

1. Allez dans le **SQL Editor** de votre projet Supabase
2. Exécutez le contenu du fichier `schema.sql`
3. Cela créera toutes les tables nécessaires et les politiques de sécurité

### 6. Seed du contenu (optionnel)

```bash
# Remplir les tables de contenu (quiz, jeu, mots doux)
npm run seed
```

## ▶️ Lancement

### Développement

```bash
npm start
```

L'application sera accessible sur `http://localhost:3000`

### Tests

```bash
# Tests unitaires
npm run test:unit

# Tests E2E
npm run test:e2e

# Tests de sécurité
npm run test:security

# Tests de production
npm run test:production

# Tous les tests avec couverture
npm run test:all
```

## 📁 Structure du Projet

```
couple-app/
├── public/                    # Frontend
│   ├── index.html            # Page principale
│   ├── css/
│   │   └── style.css         # Styles
│   ├── js/
│   │   ├── app.js            # Application principale
│   │   └── config.js        # Configuration Supabase
│   ├── icons/               # Icônes PWA
│   ├── manifest.json        # Manifest PWA
│   └── service-worker.js    # Service Worker
├── routes/                   # API Routes
│   ├── auth.routes.js       # Authentification
│   ├── chat.routes.js       # Chat couple
│   ├── friends.routes.js    # Amis
│   ├── group.routes.js      # Groupes
│   ├── quiz.routes.js       # Quiz compatibilité
│   ├── game.routes.js       # Jeu de couple
│   ├── content.routes.js    # Contenu (quiz, jeu, mots)
│   ├── stories.routes.js    # Stories
│   ├── push.routes.js       # Notifications push
│   └── user.routes.js       # Profils utilisateurs
├── services/                 # Services métier
│   ├── profile.service.js   # Gestion des profils
│   ├── compatibility.service.js  # Calcul compatibilité
│   ├── conversation.service.js   # Conversations
│   └── push.service.js      # Notifications push
├── content/                  # Contenu JSON
│   ├── quiz_questions.json  # Questions quiz
│   ├── game_cards.json      # Cartes de jeu
│   ├── sweet_messages.json  # Mots doux
│   └── action_verite.json   # Action ou vérité
├── scripts/                  # Scripts utilitaires
│   ├── seed_content.js      # Peuplement contenu
│   ├── migrate_profiles.js  # Migration profils
│   ├── generate-icons.js    # Génération icônes
│   └── clean_metadata.js   # Nettoyage métadonnées
├── tests/                    # Tests
│   ├── unit/               # Tests unitaires
│   ├── e2e/                # Tests E2E
│   ├── security/           # Tests sécurité
│   └── production/         # Tests production
├── android/                 # Platform Android (Capacitor)
├── ios/                     # Platform iOS (Capacitor)
├── server.js               # Point d'entrée serveur
├── package.json            # Dépendances
├── capacitor.config.json   # Configuration Capacitor
├── schema.sql              # Schéma base de données
└── .env.example            # Exemple configuration
```

## 🔌 API Routes

### Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `POST /api/auth/logout` - Déconnexion

### Utilisateurs
- `GET /api/user/profile` - Obtenir son profil
- `PUT /api/user/profile` - Mettre à jour son profil
- `GET /api/user/heartbeat` - Heartbeat présence

### Couples
- `POST /api/couple/invite` - Créer une invitation
- `POST /api/couple/join` - Rejoindre un couple
- `GET /api/couple/status` - Statut du couple
- `DELETE /api/couple/leave` - Quitter le couple

### Chat Couple
- `GET /api/chat/messages` - Obtenir les messages
- `POST /api/chat/send` - Envoyer un message
- `PUT /api/chat/read` - Marquer comme lu
- `DELETE /api/chat/:id` - Supprimer un message

### Amis
- `POST /api/friends/request` - Demande d'ami
- `POST /api/friends/accept` - Accepter demande
- `POST /api/friends/decline` - Refuser demande
- `GET /api/friends/list` - Liste d'amis
- `DELETE /api/friends/:id` - Supprimer ami

### Groupes
- `POST /api/groups/create` - Créer un groupe
- `POST /api/groups/:id/members` - Ajouter membre
- `GET /api/groups` - Liste des groupes
- `POST /api/groups/:id/messages` - Message groupe

### Quiz
- `GET /api/quiz/questions` - Questions du quiz
- `POST /api/quiz/submit` - Soumettre réponses
- `GET /api/quiz/result` - Résultat personnel
- `GET /api/quiz/compatibility` - Compatibilité couple

### Jeu
- `GET /api/game/cards` - Cartes de jeu
- `POST /api/game/sync` - Synchroniser état jeu

### Stories
- `POST /api/stories/create` - Créer une story
- `GET /api/stories` - Stories disponibles
- `DELETE /api/stories/:id` - Supprimer story

### Contenu
- `GET /api/content/sweet-messages` - Mots doux
- `GET /api/content/game-cards` - Cartes de jeu
- `GET /api/content/quiz-questions` - Questions quiz

## 🗄️ Base de Données Supabase

### Tables principales

**profiles** : Profils utilisateurs
- `id` (UUID) - Référence auth.users
- `display_name` - Nom d'affichage
- `phone` - Numéro de téléphone (unique)
- `avatar_url` - URL avatar
- `bio` - Biographie
- `theme` - Thème préféré
- `last_seen` - Dernière activité

**couples** : Relations de couple
- `id` (UUID)
- `user_a` - Premier partenaire
- `user_b` - Deuxième partenaire
- `created_at` - Date de création

**messages** : Messages couple
- `id` (UUID)
- `couple_id` - Référence couple
- `from_user` - Expéditeur
- `type` - text/photo/video/voice/once
- `text` - Contenu texte
- `media_path` - Chemin média
- `consumed` - Message vue unique consommé
- `delivered_at` - Date livraison
- `read_at` - Date lecture

**friends** : Amitiés
- `user_id` - Utilisateur
- `friend_id` - Ami
- `created_at` - Date d'ajout

**conversations** : Conversations (ami/groupe)
- `id` (UUID)
- `type` - friend/group
- `title` - Titre conversation
- `icon` - Icône
- `created_by` - Créateur

### Sécurité RLS

Toutes les tables sont protégées par Row Level Security :
- Les utilisateurs ne voient que leurs propres données
- Les membres d'un couple voient uniquement leurs messages
- Les amis voient uniquement leurs conversations partagées

## 📱 Déploiement Mobile

### PWA (Progressive Web App)

L'application est déjà configurée comme PWA :

1. **Déployer sur HTTPS** (requis pour PWA)
2. **Tester sur mobile** :
   - Android : Chrome → Menu → "Installer l'application"
   - iOS : Safari → Partager → "Sur l'écran d'accueil"

### Application Native avec Capacitor

#### Prérequis
- Android Studio (pour Android)
- Xcode (pour iOS, Mac uniquement)
- Compte développeur ($25 Google Play, $99 Apple App Store)

#### Build Android

```bash
# Ajouter plateforme Android
npx cap add android

# Synchroniser
npx cap sync android

# Ouvrir Android Studio
npx cap open android
```

Dans Android Studio : Build > Generate Signed Bundle/APK

#### Build iOS

```bash
# Ajouter plateforme iOS
npx cap add ios

# Synchroniser
npx cap sync ios

# Ouvrir Xcode
npx cap open ios
```

Dans Xcode : Product > Archive

### Alternative : PWA Builder

Pour une conversion automatique :
1. Allez sur [pwabuilder.com](https://www.pwabuilder.com/)
2. Entrez l'URL de votre application HTTPS
3. Téléchargez les packages Android/iOS

## 🔒 Sécurité

### Protections implémentées
- **Rate limiting** : Limitation des requêtes par IP
- **RLS Supabase** : Politiques de sécurité au niveau base de données
- **Validation des inputs** : Vérification des données entrantes
- **Taille des payloads** : Limite de 20MB par requête
- **Timeouts** : Protection contre connexions lentes
- **Filet d'erreur** : Gestion des erreurs sans crash serveur

### Variables sensibles
- **Jamais** commiter de clés API ou tokens
- Utiliser `.env` pour les secrets
- `.gitignore` configuré pour ignorer les fichiers sensibles

## 🧪 Tests

### Tests Unitaires
```bash
npm run test:unit
```

### Tests E2E
```bash
npm run test:e2e
```

### Tests Sécurité
```bash
npm run test:security
```

### Tests Production
```bash
npm run test:production
```

### Couverture de code
```bash
npm run test:all
```

Les rapports de couverture sont générés dans le dossier `coverage/`.

## 🎨 Personnalisation

### Thèmes
Les thèmes sont définis dans `public/css/style.css` :
- `default` : Nuit étoilée (#181324)
- `blush` : Rose passion (#d65977)
- `sunset` : Ambre crépuscule (#ea580c)
- `emerald` : Émeraude sérénité (#10b981)
- `noir` : Noir minimaliste (#0a0a0c)

### Contenu
Le contenu est stocké dans `content/` :
- `quiz_questions.json` : Questions du quiz
- `game_cards.json` : Cartes de jeu
- `sweet_messages.json` : Mots doux
- `action_verite.json` : Action ou vérité

## 🐛 Dépannage

### Problèmes courants

**Erreur de connexion Supabase**
- Vérifiez vos variables d'environnement
- Assurez-vous que le schéma SQL a été exécuté
- Vérifiez les RLS policies dans Supabase

**Messages non synchronisés**
- Vérifiez la connexion Realtime Supabase
- Vérifiez les permissions de stockage

**Notifications push non fonctionnelles**
- Vérifiez la configuration VAPID
- Assurez-vous que l'app a les permissions nécessaires

## 📚 Documentation additionnelle

- [Guide de déploiement mobile](GUIDE-DEPLOIEMENT-MOBILE.md)
- [Guide PWA Builder](GUIDE-PWABUILDER.md)
- [Guide de tests](GUIDE-TESTS.md)
- [Plan de développement](PLAN.md)
- [Rapport de modifications](RAPPORT-MODIFICATIONS.md)

## 🤝 Contribution

Les contributions sont les bienvenues ! 

1. Fork le projet
2. Créez une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📄 Licence

Ce projet est sous licence MIT.

## 👨‍💻 Auteur

Développé avec ❤️ pour les couples et amis

## 🙏 Remerciements

- Supabase pour l'infrastructure backend
- Capacitor pour la conversion mobile
- La communauté open source

---

**Note** : Cette application est conçue pour être hébergée sur un serveur HTTPS. Le développement local fonctionne sur HTTP, mais les fonctionnalités PWA et certaines APIs nécessitent HTTPS en production.