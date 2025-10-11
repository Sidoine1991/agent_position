// Script de synchronisation du sélecteur de langue entre toutes les pages
document.addEventListener('DOMContentLoaded', function() {
    // Initialiser le sélecteur de langue s'il existe
    const languageSelector = document.getElementById('language-selector');
    if (languageSelector) {
        // Récupérer la langue sauvegardée
        const savedLanguage = localStorage.getItem('language') || 'fr';
        languageSelector.value = savedLanguage;
        
        // Écouter les changements de langue
        languageSelector.addEventListener('change', function(e) {
            const selectedLanguage = e.target.value;
            localStorage.setItem('language', selectedLanguage);
            
            // Mettre à jour l'attribut lang du HTML
            document.documentElement.lang = selectedLanguage;
            
            // Recharger la page pour appliquer les traductions
            window.location.reload();
        });
    }
    
    // Appliquer la langue sauvegardée au chargement
    const savedLanguage = localStorage.getItem('language') || 'fr';
    document.documentElement.lang = savedLanguage;
});
