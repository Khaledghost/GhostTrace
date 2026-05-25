const express = require('express');
const router = express.Router();
const policyService = require('../services/policyService');

router.get('/', async (req, res, next) => {
  try {
    const policies = await policyService.list();
    res.json({ success: true, data: policies });
  } catch (err) { next(err); }
});

router.get('/active', async (req, res, next) => {
  try {
    const policy = await policyService.getActive();
    res.json({ success: true, data: policy });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const policy = await policyService.upsert(req.body, req.user?.username || 'admin');
    res.json({ success: true, data: policy });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const policy = await policyService.upsert({ ...req.body, id: req.params.id }, req.user?.username || 'admin');
    res.json({ success: true, data: policy });
  } catch (err) { next(err); }
});

module.exports = router;
