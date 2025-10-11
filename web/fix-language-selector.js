// Script de correction pour le sélecteur de langue
console.log('🔧 Correction du sélecteur de langue');

// Attendre que tout soit chargé
window.addEventListener('load', function() {
    console.log('📄 Page complètement chargée, correction du sélecteur...');
    
    // Attendre un peu plus pour s'assurer que tous les scripts sont chargés
    setTimeout(function() {
        const languageSelector = document.getElementById('language-selector');
        
        if (languageSelector) {
            console.log('✅ Sélecteur trouvé, application des corrections...');
            
            // S'assurer que le sélecteur est cliquable
            languageSelector.style.pointerEvents = 'auto';
            languageSelector.style.cursor = 'pointer';
            languageSelector.disabled = false;
            
            // Vérifier que le gestionnaire de traduction est disponible
            if (typeof window.translationManager !== 'undefined') {
                console.log('✅ TranslationManager disponible');
                
                // Reconfigurer le sélecteur
                languageSelector.value = window.translationManager.currentLanguage;
                
                // Supprimer les anciens événements
                languageSelector.onchange = null;
                
                // Ajouter le nouvel événement
                languageSelector.addEventListener('change', function(e) {
                    console.log('🔄 Changement de langue détecté:', e.target.value);
                    if (window.translationManager) {
                        window.translationManager.setLanguage(e.target.value);
                    }
                });
                
                console.log('✅ Sélecteur de langue corrigé et configuré');
                
                // Tester la cliquabilité
                languageSelector.addEventListener('click', function() {
                    console.log('🖱️ Clic sur le sélecteur détecté');
                });
                
                languageSelector.addEventListener('focus', function() {
                    console.log('🎯 Focus sur le sélecteur');
                });
                
            } else {
                console.error('❌ TranslationManager non disponible');
            }
            
        } else {
            console.error('❌ Sélecteur de langue non trouvé');
        }
    }, 500);
});

// Fonction pour forcer la réinitialisation
window.resetLanguageSelector = function() {
    console.log('🔄 Réinitialisation du sélecteur de langue...');
    
    const languageSelector = document.getElementById('language-selector');
    if (languageSelector && window.translationManager) {
        // Supprimer tous les événements
        const newSelector = languageSelector.cloneNode(true);
        languageSelector.parentNode.replaceChild(newSelector, languageSelector);
        
        // Reconfigurer
        newSelector.value = window.translationManager.currentLanguage;
        newSelector.addEventListener('change', function(e) {
            console.log('🔄 Changement de langue:', e.target.value);
            window.translationManager.setLanguage(e.target.value);
        });
        
        console.log('✅ Sélecteur réinitialisé');
    }
};
