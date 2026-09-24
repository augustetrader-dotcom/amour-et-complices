# Guide de Tests - Amour & Complices

## 🚀 Commandes de Test

### Exécuter tous les tests (recommandé)
```bash
npm test
```
Cette commande exécute tous les tests sauf les tests E2E (qui nécessitent un serveur en cours d'exécution).

### Suites de tests individuelles

#### Tests unitaires
```bash
npm run test:unit
```
Tests l'authentification, le chat et la validation.

#### Tests de sécurité (OWASP)
```bash
npm run test:security
```
Exécute l'audit npm et les tests de sécurité OWASP.

#### Tests de production
```bash
npm run test:production
```
Tests les fonctionnalités de production:
- Email et validation
- Connexion temps réel et chat
- Fonctionnalités audio
- Plateformes mobiles (iOS/Android)

#### Tests E2E (avec serveur)
```bash
npm run test:e2e:with-server
```
Démarre le serveur et exécute les tests E2E. Nécessite le package `start-server-and-test`.

### Tests avec couverture
```bash
npm run test:all
```
Exécute tous les tests avec rapport de couverture.

### Mode watch (développement)
```bash
npm run test:watch
```
Exécute les tests en mode surveillance (relance automatiquement lors des modifications).

## 📱 Tests Mobiles

### Tests iOS
Les tests iOS sont inclus dans la suite de production:
- Détection de plateforme iOS
- Manifest PWA compatible
- Meta tags Apple
- Safe Areas (notch, home indicator)
- Permissions iOS
- Notifications push

### Tests Android
Les tests Android sont inclus dans la suite de production:
- Détection de plateforme Android
- Manifest PWA avec maskable icons
- Permissions Android
- Notifications push avec channels
- Optimisation connexions mobiles

## 🔧 Configuration Requise

### Variables d'environnement
Créez un fichier `.env` basé sur `.env.example`:
```bash
cp .env.example .env
```

Configurez vos clés Supabase:
```
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre-clé-service-role
PORT=3000
```

### Dépendances
Les tests nécessitent les dépendances suivantes:
```bash
npm install
```

## 🌐 Configuration Supabase

### Activer Realtime
1. Allez dans votre dashboard Supabase
2. Navigation: Database > Replication
3. Activez la replication pour les tables:
   - `messages`
   - `group_messages`

### Exécuter le schéma
```bash
# Exécutez le contenu de schema.sql dans l'éditeur SQL Supabase
```

## 🐛 Résolution de Problèmes

### Tests E2E échouent
**Problème**: Les tests E2E nécessitent que le serveur soit en cours d'exécution.

**Solution**:
```bash
# Terminal 1: Démarrer le serveur
npm start

# Terminal 2: Exécuter les tests E2E
npm run test:e2e
```

### Timeout des tests
**Problème**: Certains tests prennent trop de temps.

**Solution**: Augmentez le timeout dans `jest.config.js`:
```javascript
module.exports = {
  testTimeout: 10000, // 10 secondes
};
```

### Erreurs de connexion Supabase
**Problème**: Les tests ne peuvent pas se connecter à Supabase.

**Solution**: Vérifiez vos variables d'environnement dans `.env`.

## 📊 Rapports de Tests

### Rapport de couverture
Après avoir exécuté `npm run test:all`, un rapport de couverture est généré dans le dossier `coverage/`.

### Rapport de production
Un rapport détaillé des tests de production est disponible dans `RAPPORT-TESTS-PRODUCTION.md`.

## 🔒 Sécurité

### Audit des dépendances
```bash
npm audit
```

### Corriger les vulnérabilités
```bash
npm audit fix
```

Pour les corrections automatiques avec breaking changes:
```bash
npm audit fix --force
```

## 📝 Développement de Tests

### Ajouter un nouveau test unitaire
Créez un fichier dans `tests/unit/`:
```javascript
describe('Ma fonctionnalité', () => {
  test('doit faire quelque chose', () => {
    // Votre test ici
    expect(result).toBe(expected);
  });
});
```

### Ajouter un test de production
Créez un fichier dans `tests/production/`:
```javascript
describe('Tests de production - Ma fonctionnalité', () => {
  test('doit fonctionner en production', () => {
    // Votre test ici
  });
});
```

## 🎯 Bonnes Pratiques

1. **Exécutez les tests avant chaque commit**
   ```bash
   npm test
   ```

2. **Maintenez une couverture de tests élevée**
   - Visez > 80% de couverture
   - Testez les chemins critiques

3. **Testez sur de vrais appareils**
   - iPhone (iOS 14+)
   - Android (10+)
   - Différentes tailles d'écran

4. **Surveillez les performances**
   - Les tests doivent s'exécuter rapidement
   - Identifiez les tests lents

## 🚀 Déploiement

### Avant déploiement
1. ✅ Exécuter tous les tests: `npm test`
2. ✅ Audit de sécurité: `npm audit`
3. ✅ Tests sur appareils réels
4. ✅ Configuration HTTPS

### Checklist de déploiement
- [ ] Tous les tests passent
- [ ] Audit de sécurité propre
- [ ] Variables d'environnement configurées
- [ ] Base de données Supabase configurée
- [ ] HTTPS activé
- [ ] Tests sur appareils mobiles réussis

## 📞 Support

Pour toute question sur les tests:
- Consultez `RAPPORT-TESTS-PRODUCTION.md` pour les résultats détaillés
- Vérifiez les logs dans le terminal pour les erreurs spécifiques
- Consultez la documentation Jest: https://jestjs.io/