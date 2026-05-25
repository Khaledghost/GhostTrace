const express = require('express');
const router = express.Router();
const auditService = require('../services/auditService');

router.get('/', async (req, res, next) => {
  try {
    const result = await auditService.list(req.query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

module.exports = router;
