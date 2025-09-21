-- Migration pour ajouter la table des absences
-- À exécuter sur le serveur de production

-- Créer la table des absences si elle n'existe pas
CREATE TABLE IF NOT EXISTS absences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date DATE NOT NULL,
    reason VARCHAR(255) DEFAULT 'Non marquage de présence avant 18h',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_absences_user_date ON absences(user_id, date);
CREATE INDEX IF NOT EXISTS idx_absences_date ON absences(date);
