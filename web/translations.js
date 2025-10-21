// Système de traduction français/anglais pour Presence CCR-B
class TranslationManager {
    constructor() {
        this.currentLanguage = localStorage.getItem('language') || 'fr';
        this.translations = {
            fr: {
                // Navigation
                'nav.home': 'Accueil',
                'nav.presence': 'Présence',
                'nav.planning': 'Planification',
                'nav.profile': 'Mon Profil',
                'nav.dashboard': 'Tableau de bord',
                'nav.reports': 'Rapports',
                'nav.admin': 'Administration',
                'nav.agents': 'Gestion Agents',
                'nav.logout': 'Déconnexion',
                'nav.language': 'Langue',
                
                // Home page
                'home.title': 'Presence CCR-B',
                'home.subtitle': 'Plateforme de suivi de la présence des conseillers agricoles du CCR-B sur le terrain',
                'home.login': 'Se connecter',
                'home.register': 'S\'inscrire',
                'home.dashboard': 'Tableau de bord',
                'home.features.title': 'Fonctionnalités principales',
                'home.features.subtitle': 'Des outils puissants pour un suivi efficace de vos équipes terrain',
                'home.about.title': 'À propos de Presence CCR-B',
                'home.about.text1': 'Presence CCR-B est une plateforme interne conçue par l\'équipe technique du Conseil de Concertation des Riziculteurs du Bénin (CCR-B).',
                'home.about.text2': 'Notre mission est de faciliter le suivi sécurisé des conseillers et agents terrain, permettant une collecte de données géolocalisées, l\'automatisation des rapports et un pilotage efficace des activités.',
                'home.about.text3': 'Avec Presence CCR-B, optimisez votre efficacité opérationnelle, améliorez la redevabilité et facilitez la prise de décision basée sur des données réelles.',
                'home.contact.title': 'Contact',
                'home.contact.subtitle': 'Besoin d\'aide ou d\'informations ? Contactez notre équipe',
                'home.cta.title': 'Prêt à optimiser votre suivi terrain ?',
                'home.cta.subtitle': 'Rejoignez les équipes CCR-B qui utilisent déjà Presence pour améliorer leur efficacité opérationnelle.',
                
                // Features
                'feature.gps.title': '📍 Suivi GPS temps réel',
                'feature.gps.desc': 'Localisez vos conseillers en temps réel avec une précision GPS avancée et un suivi des trajectoires. La géolocalisation permet de vérifier la présence effective sur le terrain et d\'optimiser les déplacements.',
                'feature.dashboard.title': '📊 Tableaux de bord',
                'feature.dashboard.desc': 'Visualisez les données clés avec des graphiques interactifs et des rapports détaillés. Accédez aux statistiques de présence, aux performances des équipes et aux indicateurs de productivité.',
                'feature.photos.title': '📸 Notes & Photos',
                'feature.photos.desc': 'Capturez des preuves terrain avec photos géolocalisées et notes horodatées. Documentez les activités, les observations et les résultats directement depuis l\'application mobile.',
                'feature.mobile.title': '📱 Application mobile',
                'feature.mobile.desc': 'Application PWA optimisée pour le terrain, fonctionne même hors ligne. Synchronisation automatique dès le retour de connexion pour une continuité d\'activité parfaite.',
                'feature.security.title': '🔒 Sécurité avancée',
                'feature.security.desc': 'Données chiffrées et authentification sécurisée pour protéger vos informations. Conformité aux standards de sécurité avec accès contrôlé par rôles (agent, superviseur, administrateur).',
                'feature.export.title': '📄 Exports CSV',
                'feature.export.desc': 'Générez facilement des rapports d\'exportation pour vos analyses et présentations. Exports personnalisables par période, équipe ou zone géographique pour un reporting adapté.',
                
                // Planning page
                'planning.title': 'Planification hebdomadaire et mensuelle',
                'planning.week.from': 'Semaine du',
                'planning.load.week': 'Charger la semaine',
                'planning.agent': 'Agent',
                'planning.agent.all': 'Tous les agents',
                'planning.project': 'Projet',
                'planning.project.all': 'Tous les projets',
                'planning.month': 'Mois',
                'planning.load.month': 'Charger le mois',
                'planning.week': 'Semaine',
                'planning.prev.week': '← Préc.',
                'planning.next.week': 'Suiv. →',
                'planning.drag.info': 'Glisser la barre pour visualiser. Cliquez sur une ligne pour définir les heures.',
                'planning.month.view': 'Mois',
                'planning.month.info': 'Vue mensuelle en Gantt. Éditez les heures par jour puis validez.',
                'planning.weekly.summary': 'Récap des activités planifiées par semaine',
                'planning.refresh': 'Actualiser',
                'planning.summary.info': 'Résumé des activités planifiées regroupées par semaine avec possibilité d\'édition.',
                'planning.loading': 'Chargement du récap hebdomadaire...',
                'planning.alert': 'Les jours planifiés sans présence avant 18:30 seront marqués en rouge.',
                
                // Dashboard
                'dashboard.title': 'Système de Gestion de Présence',
                'dashboard.overview': 'Vue d\'ensemble',
                'dashboard.agents': 'Agents',
                'dashboard.presence': 'Présence',
                'dashboard.planning': 'Planification',
                'dashboard.reports': 'Rapports',
                
                // Profile
                'profile.title': 'Mon Profil',
                'profile.subtitle': 'Gérez vos informations personnelles et paramètres',
                'profile.personal.info': '👤 Informations Personnelles',
                'profile.change.photo': 'Changer la photo',
                'profile.full.name': 'Nom complet :',
                'profile.edit': 'Modifier',
                'profile.save': 'Enregistrer',
                'profile.cancel': 'Annuler',
                'profile.email': 'Email :',
                'profile.phone': 'Téléphone :',
                'profile.role': 'Rôle :',
                'profile.department': 'Département :',
                'profile.project': 'Projet :',
                'profile.work.info': '💼 Informations Professionnelles',
                'profile.settings': '⚙️ Paramètres',
                'profile.language': 'Langue de l\'interface :',
                'profile.notifications': 'Notifications :',
                'profile.email.notifications': 'Notifications par email',
                'profile.sms.notifications': 'Notifications par SMS',
                'profile.password': '🔒 Sécurité',
                'profile.change.password': 'Changer le mot de passe',
                'profile.current.password': 'Mot de passe actuel :',
                'profile.new.password': 'Nouveau mot de passe :',
                'profile.confirm.password': 'Confirmer le mot de passe :',
                
                // Reports
                'reports.title': 'Rapports et Analyses',
                'reports.subtitle': 'Générez et consultez les rapports de présence et d\'activité',
                'reports.parameters': '📅 Paramètres du Rapport',
                'reports.type': 'Type de rapport :',
                'reports.type.presence': 'Rapport de Présence',
                'reports.type.activity': 'Rapport d\'Activité',
                'reports.type.performance': 'Rapport de Performance',
                'reports.type.summary': 'Résumé Exécutif',
                'reports.period': 'Période :',
                'reports.period.today': 'Aujourd\'hui',
                'reports.period.week': 'Cette semaine',
                'reports.period.month': 'Ce mois',
                'reports.period.quarter': 'Ce trimestre',
                'reports.period.year': 'Cette année',
                'reports.period.custom': 'Période personnalisée',
                'reports.generate': 'Générer le rapport',
                'reports.export': 'Exporter',
                'reports.download': 'Télécharger',
                
                // Common
                'common.loading': 'Chargement...',
                'common.error': 'Erreur',
                'common.success': 'Succès',
                'common.save': 'Enregistrer',
                'common.cancel': 'Annuler',
                'common.edit': 'Modifier',
                'common.delete': 'Supprimer',
                'common.confirm': 'Confirmer',
                'common.yes': 'Oui',
                'common.no': 'Non',
                'common.close': 'Fermer',
                'common.back': 'Retour',
                'common.next': 'Suivant',
                'common.previous': 'Précédent',
                'common.search': 'Rechercher',
                'common.filter': 'Filtrer',
                'common.clear': 'Effacer',
                'common.refresh': 'Actualiser',
                'common.export': 'Exporter',
                'common.import': 'Importer',
                'common.download': 'Télécharger',
                'common.upload': 'Téléverser',
                'common.view': 'Voir',
                'common.details': 'Détails',
                'common.more': 'Plus',
                'common.less': 'Moins',
                'common.all': 'Tous',
                'common.none': 'Aucun',
                'common.select': 'Sélectionner',
                'common.selected': 'Sélectionné',
                'common.required': 'Requis',
                'common.optional': 'Optionnel',
                'common.help': 'Aide',
                'common.info': 'Information',
                'common.warning': 'Attention',
                'common.danger': 'Danger',
                'common.primary': 'Principal',
                'common.secondary': 'Secondaire',
                'common.success': 'Succès',
                'common.danger': 'Danger',
                'common.warning': 'Attention',
                'common.info': 'Information',
                'common.light': 'Clair',
                'common.dark': 'Sombre'
            },
            en: {
                // Navigation
                'nav.home': 'Home',
                'nav.presence': 'Presence',
                'nav.planning': 'Planning',
                'nav.profile': 'My Profile',
                'nav.dashboard': 'Dashboard',
                'nav.reports': 'Reports',
                'nav.admin': 'Administration',
                'nav.agents': 'Manage Agents',
                'nav.logout': 'Logout',
                'nav.language': 'Language',
                
                // Home page
                'home.title': 'Presence CCR-B',
                'home.subtitle': 'Platform for tracking CCR-B agricultural advisors in the field',
                'home.login': 'Sign In',
                'home.register': 'Sign Up',
                'home.dashboard': 'Dashboard',
                'home.features.title': 'Main Features',
                'home.features.subtitle': 'Powerful tools for effective field team monitoring',
                'home.about.title': 'About Presence CCR-B',
                'home.about.text1': 'Presence CCR-B is an internal platform designed by the technical team of the Council for Rice Farmers Consultation of Benin (CCR-B).',
                'home.about.text2': 'Our mission is to facilitate secure monitoring of field advisors and agents, enabling geolocated data collection, report automation, and effective activity management.',
                'home.about.text3': 'With Presence CCR-B, optimize your operational efficiency, improve accountability, and facilitate data-driven decision making.',
                'home.contact.title': 'Contact',
                'home.contact.subtitle': 'Need help or information? Contact our team',
                'home.cta.title': 'Ready to optimize your field monitoring?',
                'home.cta.subtitle': 'Join CCR-B teams already using Presence to improve their operational efficiency.',
                
                // Features
                'feature.gps.title': '📍 Real-time GPS tracking',
                'feature.gps.desc': 'Locate your advisors in real-time with advanced GPS precision and trajectory tracking. Geolocation allows verification of actual field presence and route optimization.',
                'feature.dashboard.title': '📊 Dashboards',
                'feature.dashboard.desc': 'Visualize key data with interactive charts and detailed reports. Access presence statistics, team performance, and productivity indicators.',
                'feature.photos.title': '📸 Notes & Photos',
                'feature.photos.desc': 'Capture field evidence with geolocated photos and timestamped notes. Document activities, observations, and results directly from the mobile app.',
                'feature.mobile.title': '📱 Mobile application',
                'feature.mobile.desc': 'PWA optimized for the field, works even offline. Automatic synchronization upon reconnection for perfect activity continuity.',
                'feature.security.title': '🔒 Advanced security',
                'feature.security.desc': 'Encrypted data and secure authentication to protect your information. Compliance with security standards with role-based access control (agent, supervisor, administrator).',
                'feature.export.title': '📄 CSV Exports',
                'feature.export.desc': 'Easily generate export reports for your analyses and presentations. Customizable exports by period, team, or geographic area for adapted reporting.',
                
                // Planning page
                'planning.title': 'Weekly and monthly planning',
                'planning.week.from': 'Week from',
                'planning.load.week': 'Load week',
                'planning.agent': 'Agent',
                'planning.agent.all': 'All agents',
                'planning.project': 'Project',
                'planning.project.all': 'All projects',
                'planning.month': 'Month',
                'planning.load.month': 'Load month',
                'planning.week': 'Week',
                'planning.prev.week': '← Prev',
                'planning.next.week': 'Next →',
                'planning.drag.info': 'Drag the bar to visualize. Click on a line to set hours.',
                'planning.month.view': 'Month',
                'planning.month.info': 'Monthly Gantt view. Edit hours per day then validate.',
                'planning.weekly.summary': 'Weekly planned activities summary',
                'planning.refresh': 'Refresh',
                'planning.summary.info': 'Summary of planned activities grouped by week with editing possibility.',
                'planning.loading': 'Loading weekly summary...',
                'planning.alert': 'Days planned without presence before 6:00 PM will be marked in red.',
                
                // Dashboard
                'dashboard.title': 'Presence Management System',
                'dashboard.overview': 'Overview',
                'dashboard.agents': 'Agents',
                'dashboard.presence': 'Presence',
                'dashboard.planning': 'Planning',
                'dashboard.reports': 'Reports',
                
                // Profile
                'profile.title': 'My Profile',
                'profile.subtitle': 'Manage your personal information and settings',
                'profile.personal.info': '👤 Personal Information',
                'profile.change.photo': 'Change photo',
                'profile.full.name': 'Full name:',
                'profile.edit': 'Edit',
                'profile.save': 'Save',
                'profile.cancel': 'Cancel',
                'profile.email': 'Email:',
                'profile.phone': 'Phone:',
                'profile.role': 'Role:',
                'profile.department': 'Department:',
                'profile.project': 'Project:',
                'profile.work.info': '💼 Professional Information',
                'profile.settings': '⚙️ Settings',
                'profile.language': 'Interface language:',
                'profile.notifications': 'Notifications:',
                'profile.email.notifications': 'Email notifications',
                'profile.sms.notifications': 'SMS notifications',
                'profile.password': '🔒 Security',
                'profile.change.password': 'Change password',
                'profile.current.password': 'Current password:',
                'profile.new.password': 'New password:',
                'profile.confirm.password': 'Confirm password:',
                
                // Reports
                'reports.title': 'Reports and Analysis',
                'reports.subtitle': 'Generate and consult presence and activity reports',
                'reports.parameters': '📅 Report Parameters',
                'reports.type': 'Report type:',
                'reports.type.presence': 'Presence Report',
                'reports.type.activity': 'Activity Report',
                'reports.type.performance': 'Performance Report',
                'reports.type.summary': 'Executive Summary',
                'reports.period': 'Period:',
                'reports.period.today': 'Today',
                'reports.period.week': 'This week',
                'reports.period.month': 'This month',
                'reports.period.quarter': 'This quarter',
                'reports.period.year': 'This year',
                'reports.period.custom': 'Custom period',
                'reports.generate': 'Generate report',
                'reports.export': 'Export',
                'reports.download': 'Download',
                
                // Common
                'common.loading': 'Loading...',
                'common.error': 'Error',
                'common.success': 'Success',
                'common.save': 'Save',
                'common.cancel': 'Cancel',
                'common.edit': 'Edit',
                'common.delete': 'Delete',
                'common.confirm': 'Confirm',
                'common.yes': 'Yes',
                'common.no': 'No',
                'common.close': 'Close',
                'common.back': 'Back',
                'common.next': 'Next',
                'common.previous': 'Previous',
                'common.search': 'Search',
                'common.filter': 'Filter',
                'common.clear': 'Clear',
                'common.refresh': 'Refresh',
                'common.export': 'Export',
                'common.import': 'Import',
                'common.download': 'Download',
                'common.upload': 'Upload',
                'common.view': 'View',
                'common.details': 'Details',
                'common.more': 'More',
                'common.less': 'Less',
                'common.all': 'All',
                'common.none': 'None',
                'common.select': 'Select',
                'common.selected': 'Selected',
                'common.required': 'Required',
                'common.optional': 'Optional',
                'common.help': 'Help',
                'common.info': 'Information',
                'common.warning': 'Warning',
                'common.danger': 'Danger',
                'common.primary': 'Primary',
                'common.secondary': 'Secondary',
                'common.success': 'Success',
                'common.danger': 'Danger',
                'common.warning': 'Warning',
                'common.info': 'Information',
                'common.light': 'Light',
                'common.dark': 'Dark'
            }
        };
    }

    // Obtenir la traduction d'une clé
    translate(key, params = {}) {
        let translation = this.translations[this.currentLanguage][key] || key;
        
        // Remplacer les paramètres dans la traduction
        Object.keys(params).forEach(param => {
            translation = translation.replace(`{${param}}`, params[param]);
        });
        
        return translation;
    }

    // Changer la langue
    setLanguage(language) {
        if (this.translations[language]) {
            console.log('Changement de langue vers:', language);
            this.currentLanguage = language;
            localStorage.setItem('language', language);
            this.updatePageLanguage();
            this.translatePage();
            
            // Recharger la page pour appliquer toutes les traductions
            setTimeout(() => {
                window.location.reload();
            }, 100);
            
            return true;
        }
        return false;
    }

    // Mettre à jour l'attribut lang du HTML
    updatePageLanguage() {
        document.documentElement.lang = this.currentLanguage;
    }

    // Traduire tous les éléments de la page
    translatePage() {
        // Traduire les éléments avec l'attribut data-translate
        document.querySelectorAll('[data-translate]').forEach(element => {
            const key = element.getAttribute('data-translate');
            const translation = this.translate(key);
            
            if (element.tagName === 'INPUT' && element.type === 'text') {
                element.placeholder = translation;
            } else if (element.tagName === 'INPUT' && element.type === 'submit') {
                element.value = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Traduire les attributs title
        document.querySelectorAll('[data-translate-title]').forEach(element => {
            const key = element.getAttribute('data-translate-title');
            element.title = this.translate(key);
        });

        // Traduire les attributs placeholder
        document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
            const key = element.getAttribute('data-translate-placeholder');
            element.placeholder = this.translate(key);
        });

        // Mettre à jour le sélecteur de langue
        this.updateLanguageSelector();
    }

    // Mettre à jour le sélecteur de langue
    updateLanguageSelector() {
        const languageSelector = document.getElementById('language-selector');
        if (languageSelector) {
            languageSelector.value = this.currentLanguage;
        }
    }

    // Initialiser le système de traduction
    init() {
        this.updatePageLanguage();
        this.translatePage();
        this.setupLanguageSelector();
    }
    
    // Configurer le sélecteur de langue
    setupLanguageSelector() {
        const languageSelector = document.getElementById('language-selector');
        if (languageSelector) {
            // Définir la valeur actuelle
            languageSelector.value = this.currentLanguage;
            
            // Écouter les changements de langue
            languageSelector.addEventListener('change', (e) => {
                console.log('Changement de langue détecté:', e.target.value);
                this.setLanguage(e.target.value);
            });
            
            console.log('✅ Sélecteur de langue configuré');
        } else {
            console.log('⚠️ Sélecteur de langue non trouvé');
        }
    }
}

// Instance globale du gestionnaire de traduction
window.translationManager = new TranslationManager();

// Initialiser quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    window.translationManager.init();
});

// Fonction utilitaire pour traduire du JavaScript
function t(key, params = {}) {
    return window.translationManager.translate(key, params);
}
