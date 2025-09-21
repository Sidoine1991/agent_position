# 📱 Guide de Création d'APK - Presence CCRB

## 🚀 Méthode 1: PWA Builder (Recommandé - Gratuit)

### Étapes :
1. **Aller sur** : https://www.pwabuilder.com/
2. **Entrer l'URL** de votre application Railway
3. **Cliquer sur "Start"**
4. **Vérifier les scores** PWA (doit être vert)
5. **Cliquer sur "Build My PWA"**
6. **Sélectionner "Android"**
7. **Télécharger l'APK**

### Avantages :
- ✅ Gratuit
- ✅ Simple et rapide
- ✅ Pas besoin de code natif
- ✅ Compatible avec votre PWA existante

---

## 🔧 Méthode 2: Capacitor (Plus avancé)

### Prérequis :
- Node.js installé
- Android Studio installé
- SDK Android configuré

### Installation :
```bash
npm install -g @capacitor/cli
npm install @capacitor/core @capacitor/android
npx cap init "Presence CCRB" "com.ccrb.presence"
npx cap add android
npx cap copy
npx cap open android
```

### Avantages :
- ✅ Plus de contrôle
- ✅ Accès aux APIs natives
- ✅ Performance optimisée
- ✅ Personnalisation avancée

---

## 📋 Configuration Actuelle

### ✅ Déjà configuré :
- Manifest PWA complet
- Service Worker
- Icônes d'application
- Configuration Capacitor

### 🔗 URLs à utiliser :
- **Railway** : `https://your-app.railway.app`
- **Vercel** : `https://your-app.vercel.app`

---

## 🎯 Recommandation

**Commencez par PWA Builder** car c'est :
- Plus simple
- Plus rapide
- Gratuit
- Parfait pour votre cas d'usage

Si vous avez besoin de fonctionnalités avancées plus tard, vous pourrez toujours utiliser Capacitor.

---

## 📞 Support

En cas de problème :
1. Vérifiez que votre app est accessible en ligne
2. Testez le manifest PWA
3. Vérifiez les scores PWA Builder
4. Contactez-moi pour assistance
