// Minimal configuration module for server runtime
// Expose JWT secret from environment with a reasonable default for development
module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'change-this-secret-in-production'
};


