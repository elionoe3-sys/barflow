import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const employes = await prisma.employe.findMany();
    res.json(employes);
  } catch (error) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.post('/', async (req, res) => {
  try {
    const employe = await prisma.employe.create({ data: req.body });
    res.json(employe);
  } catch (error) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const employe = await prisma.employe.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(employe);
  } catch (error) {
    res.status(500).json({ error: 'Erreur' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.employe.delete({ where: { id: req.params.id } });
    res.json({ message: 'Supprimé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur' });
  }
});

export default router;