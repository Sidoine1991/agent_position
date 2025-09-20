module.exports = (req, res) => {
  res.json({ 
    message: 'API Test fonctionne !',
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });
};
