# Guide de Déploiement Mobile - Amour & Complices

## 🎯 Objectif: Transformer votre PWA en app native pour App Store et Google Play

## 📱 Solutions Disponibles

### Option 1: Capacitor (Recommandée) ⭐

**Pourquoi Capacitor?**
- Maintient votre code HTML/CSS/JS existant
- Accès complet aux APIs natives (caméra, microphone, notifications)
- Compatible App Store et Google Play
- Meilleure gestion de l'audio natif
- Support des fonctionnalités avancées

#### Installation

```bash
# Installer Capacitor
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios

# Initialiser Capacitor
npx cap init "Amour & Complices" "com.amourcomplices.app"
```

#### Configuration

Créez `capacitor.config.json`:
```json
{
  "appId": "com.amourcomplices.app",
  "appName": "Amour & Complices",
  "webDir": "public",
  "bundledWebRuntime": false,
  "server": {
    "androidScheme": "https"
  },
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000,
      "launchAutoHide": true,
      "backgroundColor": "#181324",
      "androidSplashResourceName": "splash",
      "androidScaleType": "CENTER_CROP",
      "iosSplashStyle": "fullscreen"
    },
    "LocalNotifications": {
      "presentationOptions": {
        "badge": true,
        "sound": true,
        "banner": true
      }
    },
    "PushNotifications": {
      "presentationOptions": {
        "badge": true,
        "sound": true,
        "alert": true
      }
    }
  }
}
```

#### Build Android

```bash
# Ajouter la plateforme Android
npx cap add android

# Build de l'application web
npm run build  # ou votre commande de build

# Synchroniser avec Capacitor
npx cap sync android

# Ouvrir Android Studio
npx cap open android
```

#### Build iOS

```bash
# Ajouter la plateforme iOS
npx cap add ios

# Build de l'application web
npm run build

# Synchroniser avec Capacitor
npx cap sync ios

# Ouvrir Xcode
npx cap open ios
```

### Option 2: PWA Builder (Plus simple)

**Avantages:**
- Automatique et gratuit
- Pas besoin de modifier le code
- Génération automatique des icônes
- Signature des applications

#### Processus

1. Allez sur https://www.pwabuilder.com/
2. Entrez l'URL de votre application HTTPS
3. L'outil analysera votre PWA
4. Téléchargez les packages pour:
   - Android (APK/AAB)
   - iOS (IPA)
   - Windows
   - macOS

### Option 3: React Native avec WebView

Plus complexe mais offre un contrôle total sur l'expérience native.

## 🔧 Prérequis pour les Stores

### Pour Google Play Store

1. **Compte développeur Google Play** ($25 une fois)
2. **Package APK/AAB signé**
3. **Icônes de différentes tailles**
4. **Captures d'écran** (au moins 2)
5. **Description de l'application**
6. **Politique de confidentialité**

### Pour Apple App Store

1. **Compte développeur Apple** ($99/an)
2. **Mac avec Xcode**
3. **Certificate de développement**
4. **Provisioning profile**
5. **Icônes et splash screens**
6. **Captures d'écran** (différentes tailles d'iPhone/iPad)
7. **Description et metadata**

## 🎨 Préparer les Assets

### Icônes requises

**Android:**
- 512x512 (Google Play Store)
- 192x192 (Android adaptive)
- 144x144, 96x96, 72x72, 48x48 (différents écrans)

**iOS:**
- 1024x1024 (App Store)
- 180x180, 167x167, 152x152, 144x144, 128x128, 120x120, etc.

### Splash Screens

**Android:**
- Différentes tailles selon les densités d'écran

**iOS:**
- Différentes tailles selon les devices (iPhone, iPad)

## 🔑 Gestion de l'Audio

### Capacitor Audio

Pour une meilleure gestion de l'audio avec Capacitor:

```bash
npm install @capacitor/media
```

```javascript
import { Media } from '@capacitor/media';

// Enregistrement audio
const { recorder } = await Media.createRecorder();
await recorder.start();

// Arrêt et récupération
const { audioFile } = await recorder.stop();
```

### Audio API Natif

Pour l'accès au microphone natif:

```bash
npm install @capacitor/permissions
```

```javascript
import { Permissions } from '@capacitor/permissions';

// Demander permission microphone
const { status } = await Permissions.request({ name: 'microphone' });
```

## 📝 Configuration HTTPS

PWA et apps natives nécessitent HTTPS:

### Options gratuites:
- **Cloudflare** (SSL gratuit)
- **Let's Encrypt** (SSL gratuit)
- **Netlify** (HTTPS automatique)
- **Vercel** (HTTPS automatique)

### Pour développement:
- **ngrok** (tunnel HTTPS temporaire)
- **cloudflared** (tunnel Cloudflare)

## 🚀 Processus de Déploiement

### Étape 1: Préparer l'environnement

```bash
# Cloner le projet
git clone votre-repo
cd couple-app

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos clés Supabase
```

### Étape 2: Tester en local

```bash
# Démarrer le serveur
npm start

# Tester sur http://localhost:3000
```

### Étape 3: Déployer sur un serveur HTTPS

Exemple avec Netlify:
```bash
# Installer Netlify CLI
npm install -g netlify-cli

# Déployer
netlify deploy --prod
```

### Étape 4: Tester la PWA

1. Ouvrir l'application sur mobile
2. **Android**: Chrome → Menu → "Installer l'application"
3. **iOS**: Safari → Partager → "Sur l'écran d'accueil"

### Étape 5: Convertir en app native

**Avec Capacitor:**
```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios
npx cap init "Amour & Complices" "com.amourcomplices.app"
npx cap add android
npx cap add ios
npx cap sync
```

### Étape 6: Builder et signer

**Android:**
```bash
npx cap open android
# Dans Android Studio: Build > Generate Signed Bundle/APK
```

**iOS:**
```bash
npx cap open ios
# Dans Xcode: Product > Archive
```

### Étape 7: Soumettre aux stores

**Google Play:**
1. Créer un compte développeur
2. Créer une application dans Google Play Console
3. Uploader le bundle AAB
4. Remplir les informations de store
5. Soumettre pour review

**Apple App Store:**
1. Créer un compte développeur
2. Créer une application dans App Store Connect
3. Uploader l'archive via Xcode
4. Remplir les informations de store
5. Soumettre pour review

## ⚠️ Points d'Attention

### Restrictions Apple
- Apple peut rejeter les apps qui sont essentiellement des PWAs
- Assurez-vous d'avoir des fonctionnalités natives
- PWA Builder peut aider à contourner certaines restrictions

### Performance
- Optimisez les assets (images compressées)
- Minifiez le CSS/JS
- Utilisez le lazy loading

### Monétisation
- Google Play permet les apps gratuites et payantes
- Apple exige des achats intégrés pour certaines fonctionnalités

## 🎯 Checklist de Déploiement

### Avant déploiement:
- [ ] Application fonctionne parfaitement en local
- [ ] Service Worker installé et fonctionnel
- [ ] Manifest.json complet
- [ ] Icônes de toutes les tailles
- [ ] Splash screens préparés
- [ ] HTTPS configuré
- [ ] Tests sur appareils réels passés
- [ ] Politique de confidentialité rédigée

### Pour Android:
- [ ] Compte développeur Google Play actif
- [ ] Package AAB signé
- [ ] Captures d'écran préparées
- [ ] Description et metadata complètes
- [ ] Politique de confidentialité publiée

### Pour iOS:
- [ ] Compte développeur Apple actif
- [ ] Certificate et provisioning profile
- [ ] Package IPA signé
- [ ] Captures d'écran iPhone/iPad
- [ ] Description et metadata complètes
- [ ] Politique de confidentialité publiée

## 📚 Ressources Utiles

- **Capacitor Docs**: https://capacitorjs.com/docs
- **PWA Builder**: https://www.pwabuilder.com/
- **Google Play Console**: https://play.google.com/console
- **App Store Connect**: https://appstoreconnect.apple.com/
- **Progressive Web Apps**: https://web.dev/progressive-web-apps/

## 💡 Conseil Final

Commencez par **PWA Builder** pour une première version rapide et gratuite. Si vous avez besoin de fonctionnalités natives avancées (microphone, caméra, notifications push), passez ensuite à **Capacitor**.