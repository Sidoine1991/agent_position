// Script de débogage pour le sélecteur de langue
console.log('🔍 Débogage du sélecteur de langue');

// Attendre que le DOM soit chargé
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM chargé, recherche du sélecteur de langue...');
    
    // Chercher le sélecteur de langue
    const languageSelector = document.getElementById('language-selector');
    
    if (languageSelector) {
        console.log('✅ Sélecteur de langue trouvé:', languageSelector);
        console.log('📋 Valeur actuelle:', languageSelector.value);
        console.log('🎯 Événements attachés:', languageSelector.onchange ? 'Oui' : 'Non');
        
        // Vérifier les styles
        const computedStyle = window.getComputedStyle(languageSelector);
        console.log('🎨 Styles appliqués:');
        console.log('- display:', computedStyle.display);
        console.log('- visibility:', computedStyle.visibility);
        console.log('- pointer-events:', computedStyle.pointerEvents);
        console.log('- z-index:', computedStyle.zIndex);
        
        // Tester la cliquabilité
        languageSelector.addEventListener('click', function() {
            console.log('🖱️ Clic détecté sur le sélecteur');
        });
        
        languageSelector.addEventListener('focus', function() {
            console.log('🎯 Focus sur le sélecteur');
        });
        
        languageSelector.addEventListener('change', function() {
            console.log('🔄 Changement détecté:', this.value);
        });
        
        // Vérifier si le sélecteur est dans un conteneur
        const container = languageSelector.closest('.language-selector-container');
        if (container) {
            console.log('📦 Conteneur trouvé:', container);
            const containerStyle = window.getComputedStyle(container);
            console.log('📦 Styles du conteneur:');
            console.log('- display:', containerStyle.display);
            console.log('- position:', containerStyle.position);
            console.log('- z-index:', containerStyle.zIndex);
        }
        
    } else {
        console.error('❌ Sélecteur de langue non trouvé');
        
        // Lister tous les éléments select
        const allSelects = document.querySelectorAll('select');
        console.log('📋 Tous les éléments select trouvés:', allSelects.length);
        allSelects.forEach((select, index) => {
            console.log(`  ${index + 1}. ID: ${select.id}, Classes: ${select.className}`);
        });
        
        // Lister tous les éléments avec l'ID language-selector
        const elementsWithId = document.querySelectorAll('[id*="language"]');
        console.log('🔍 Éléments avec "language" dans l\'ID:', elementsWithId.length);
        elementsWithId.forEach((element, index) => {
            console.log(`  ${index + 1}. Tag: ${element.tagName}, ID: ${element.id}`);
        });
    }
    
    // Vérifier le gestionnaire de traduction
    if (typeof window.translationManager !== 'undefined') {
        console.log('✅ TranslationManager disponible');
        console.log('🌐 Langue actuelle:', window.translationManager.currentLanguage);
    } else {
        console.error('❌ TranslationManager non disponible');
    }
});

// Fonction pour forcer le changement de langue (pour test)
window.forceLanguageChange = function(language) {
    console.log('🔧 Forçage du changement de langue vers:', language);
    if (typeof window.translationManager !== 'undefined') {
        window.translationManager.setLanguage(language);
    } else {
        console.error('❌ TranslationManager non disponible');
    }
};
