# 📱 Guide d'Installation APK - Résolution des Certificats

## 🚨 **Problème : Certificat non vérifié (0x800B010A)**

### **Solution 1: Autoriser les Sources Inconnues (Recommandée)**

#### **Sur Android :**
1. **Paramètres** → **Sécurité** → **Sources inconnues**
2. **Activer** "Autoriser l'installation d'applications provenant de sources inconnues"
3. **Autoriser votre navigateur** (Chrome, Firefox, etc.)
4. **Réessayer l'installation**

#### **Sur Android 8+ :**
1. **Paramètres** → **Applications** → **Accès spécial**
2. **Installer des applications inconnues**
3. **Sélectionner votre navigateur**
4. **Autoriser** "Installer des applications inconnues"

### **Solution 2: Installation via ADB (Android Debug Bridge)**

#### **Prérequis :**
- **USB Debugging** activé sur le téléphone
- **ADB** installé sur l'ordinateur
- **Câble USB** pour connecter le téléphone

#### **Étapes :**
1. **Connecter le téléphone** via USB
2. **Activer le débogage USB** sur le téléphone
3. **Ouvrir un terminal** sur l'ordinateur
4. **Exécuter :**
   ```bash
   adb install -r Presence_CCRB.apk
   ```

### **Solution 3: Signature de l'APK (Avancée)**

#### **Créer un certificat de test :**
```bash
keytool -genkey -v -keystore presence-ccrb-key.keystore -alias presence-ccrb -keyalg RSA -keysize 2048 -validity 10000
```

#### **Signer l'APK :**
```bash
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore presence-ccrb-key.keystore Presence_CCRB.apk presence-ccrb
```

#### **Optimiser l'APK :**
```bash
zipalign -v 4 Presence_CCRB.apk Presence_CCRB-signed.apk
```

### **Solution 4: Utiliser un Service de Signature**

#### **Services en ligne :**
- **APK Signer** : https://apksigner.com/
- **APK Easy Tool** : https://apkeasytool.com/
- **APK Signer Pro** : https://apksigner.pro/

#### **Étapes :**
1. **Télécharger l'APK** depuis PWA Builder
2. **Aller sur un service de signature**
3. **Uploader l'APK**
4. **Télécharger l'APK signé**

### **Solution 5: Installation Directe (Sans Signature)**

#### **Méthode la plus simple :**
1. **Télécharger l'APK** depuis PWA Builder
2. **Transférer sur le téléphone** (USB, email, cloud)
3. **Ouvrir le fichier** sur le téléphone
4. **Autoriser l'installation** quand demandé
5. **Installer** malgré l'avertissement

## 🔍 **Vérifications à Faire**

### **Sur le Téléphone :**
- ✅ **USB Debugging** activé
- ✅ **Sources inconnues** autorisées
- ✅ **Espace de stockage** suffisant
- ✅ **Version Android** compatible (5.0+)

### **Sur l'Ordinateur :**
- ✅ **ADB** installé (si utilisation)
- ✅ **Pilotes USB** installés
- ✅ **Câble USB** fonctionnel

## 🚀 **Recommandation**

**Pour un test rapide :**
1. **Autorisez les sources inconnues** sur Android
2. **Installez directement** l'APK téléchargé
3. **Ignorez l'avertissement** de certificat

**Pour la production :**
1. **Signez l'APK** avec un certificat valide
2. **Distribuez** via Google Play Store
3. **Ou utilisez** un service de signature

## 📞 **Support**

Si le problème persiste :
1. **Vérifiez la version Android** (minimum 5.0)
2. **Essayez un autre téléphone**
3. **Utilisez un émulateur Android**
4. **Contactez-moi** pour plus d'aide

---

**L'APK fonctionnera parfaitement une fois installé !** 📱✨
