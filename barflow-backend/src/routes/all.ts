import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ============ PRODUITS ============
router.get('/produits', async (req, res) => {
  const data = await prisma.produit.findMany();
  res.json(data);
});

router.post('/produits', async (req, res) => {
  const data = await prisma.produit.create({ data: req.body });
  res.json(data);
});

router.put('/produits/:id', async (req, res) => {
  const data = await prisma.produit.update({
    where: { id: req.params.id },
    data: req.body
  });
  res.json(data);
});

router.delete('/produits/:id', async (req, res) => {
  await prisma.produit.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ============ COMMANDES ============
router.get('/commandes', async (req, res) => {
  const data = await prisma.commande.findMany();
  res.json(data);
});

router.post('/commandes', async (req, res) => {
  const data = await prisma.commande.create({ data: req.body });
  res.json(data);
});

// ============ CHARGES ============
router.get('/charges', async (req, res) => {
  const data = await prisma.charge.findMany();
  res.json(data);
});

router.post('/charges', async (req, res) => {
  const data = await prisma.charge.create({ data: req.body });
  res.json(data);
});

router.put('/charges/:id', async (req, res) => {
  const data = await prisma.charge.update({
    where: { id: req.params.id },
    data: req.body
  });
  res.json(data);
});

router.delete('/charges/:id', async (req, res) => {
  await prisma.charge.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ============ EMPLOYÉS ============
router.get('/employes', async (req, res) => {
  const data = await prisma.employe.findMany();
  res.json(data);
});

router.post('/employes', async (req, res) => {
  const data = await prisma.employe.create({ data: req.body });
  res.json(data);
});

// ============ INVESTISSEMENTS ============
router.get('/investissements', async (req, res) => {
  const data = await prisma.investissement.findMany();
  res.json(data);
});

router.post('/investissements', async (req, res) => {
  const data = await prisma.investissement.create({ data: req.body });
  res.json(data);
});

// ============ STATS ============
router.get('/dailyStats', async (req, res) => {
  const data = await prisma.dailyStat.findMany();
  res.json(data);
});

router.post('/dailyStats', async (req, res) => {
  const { date, ca } = req.body;
  const existing = await prisma.dailyStat.findUnique({ where: { date } });
  if (existing) {
    const data = await prisma.dailyStat.update({ where: { date }, data: { ca } });
    res.json(data);
  } else {
    const data = await prisma.dailyStat.create({ data: { date, ca } });
    res.json(data);
  }
});

export default router;