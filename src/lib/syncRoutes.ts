import express from 'express';
const router = express.Router();
router.get('/drive', (req, res) => res.json({ status: "Sync skeletal" }));
export default router;
