// Configuration pour le développement local
module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || '3fc6fb0fdb066cfc829a6ff25b05c14c2fd491c3c2b64762363dc23604153285ef8eb3d4afa70bdfae3e506cd26b9b9ebf44be7c8d7871f685b73b66e157551a',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://dbccrb_user:THMWBv1Ur2hP1XyNJExmemPodp0pzeV6@dpg-d37s6vmmcj7s73fs2chg-a.oregon-postgres.render.com/dbccrb',
  PORT: process.env.PORT || 3000
};
