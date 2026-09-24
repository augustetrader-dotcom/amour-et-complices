/**
 * Script pour générer les icônes nécessaires pour iOS et Android
 * Ce script utilise sharp pour redimensionner les icônes
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration des tailles d'icônes requises
const iconSizes = {
  android: [
    { size: 512, name: 'playstore-icon.png' },
    { size: 192, name: 'android-icon-192.png' },
    { size: 144, name: 'android-icon-144.png' },
    { size: 96, name: 'android-icon-96.png' },
    { size: 72, name: 'android-icon-72.png' },
    { size: 48, name: 'android-icon-48.png' }
  ],
  ios: [
    { size: 1024, name: 'appstore-icon.png' },
    { size: 180, name: 'ios-icon-180.png' },
    { size: 167, name: 'ios-icon-167.png' },
    { size: 152, name: 'ios-icon-152.png' },
    { size: 144, name: 'ios-icon-144.png' },
    { size: 128, name: 'ios-icon-128.png' },
    { size: 120, name: 'ios-icon-120.png' },
    { size: 76, name: 'ios-icon-76.png' }
  ]
};

// Configuration des splash screens
const splashSizes = [
  { width: 1242, height: 2688, name: 'ios-splash-iphone-xr.png' },
  { width: 1242, height: 2208, name: 'ios-splash-iphone-8.png' },
  { width: 1125, height: 2436, name: 'ios-splash-iphone-x.png' },
  { width: 1080, height: 1920, name: 'android-splash-hdpi.png' },
  { width: 1440, height: 2560, name: 'android-splash-xxhdpi.png' }
];

async function generateIcons(sourcePath, outputPath) {
  console.log('🎨 Génération des icônes...');
  
  // Créer les dossiers de sortie
  const androidPath = path.join(outputPath, 'android');
  const iosPath = path.join(outputPath, 'ios');
  
  if (!fs.existsSync(androidPath)) fs.mkdirSync(androidPath, { recursive: true });
  if (!fs.existsSync(iosPath)) fs.mkdirSync(iosPath, { recursive: true });
  
  try {
    // Générer les icônes Android
    for (const icon of iconSizes.android) {
      await sharp(sourcePath)
        .resize(icon.size, icon.size, { fit: 'cover' })
        .toFile(path.join(androidPath, icon.name));
      console.log(`✅ Android: ${icon.name} (${icon.size}x${icon.size})`);
    }
    
    // Générer les icônes iOS
    for (const icon of iconSizes.ios) {
      await sharp(sourcePath)
        .resize(icon.size, icon.size, { fit: 'cover' })
        .toFile(path.join(iosPath, icon.name));
      console.log(`✅ iOS: ${icon.name} (${icon.size}x${icon.size})`);
    }
    
    console.log('🎉 Icônes générées avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de la génération des icônes:', error);
  }
}

async function generateSplashScreens(sourcePath, outputPath, backgroundColor = '#181324') {
  console.log('🎨 Génération des splash screens...');
  
  const splashPath = path.join(outputPath, 'splash');
  if (!fs.existsSync(splashPath)) fs.mkdirSync(splashPath, { recursive: true });
  
  try {
    for (const splash of splashSizes) {
      // Créer un splash screen avec le fond et centrer l'icône
      const iconSize = Math.floor(Math.min(splash.width, splash.height) * 0.3); // 30% de la taille, arrondi
      
      await sharp({
        create: {
          width: splash.width,
          height: splash.height,
          channels: 4,
          background: backgroundColor
        }
      })
      .composite([
        {
          input: await sharp(sourcePath).resize(iconSize, iconSize).toBuffer(),
          gravity: 'center'
        }
      ])
      .toFile(path.join(splashPath, splash.name));
      
      console.log(`✅ Splash: ${splash.name} (${splash.width}x${splash.height})`);
    }
    
    console.log('🎉 Splash screens générés avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de la génération des splash screens:', error);
  }
}

// Exécution
const sourceIcon = path.join(__dirname, '../public/icons/icon-512.png');
const outputDir = path.join(__dirname, '../public/assets');

if (fs.existsSync(sourceIcon)) {
  console.log('🎨 Utilisation de icon-512.png comme source...');
  generateIcons(sourceIcon, outputDir);
  generateSplashScreens(sourceIcon, outputDir);
} else {
  console.error('❌ Icône source non trouvée:', sourceIcon);
  console.log('💡 Placez votre icône source dans public/icons/icon-512.png');
}