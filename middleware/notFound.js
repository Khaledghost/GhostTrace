function apiNotFound(req, res) {
  res.status(404).json({
    success: false,
    error: 'API route not found',
    path: req.originalUrl,
  });
}

module.exports = { apiNotFound };
