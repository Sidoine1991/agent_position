module.exports = (req, res) => {
  res.json({ 
    ok: true, 
    message: 'Backend CCRB opérationnel',
    timestamp: new Date().toISOString()
  });
};
