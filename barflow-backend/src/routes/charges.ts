import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Récupérer toutes les charges
router.get('/', async (req, res) => {
  try {
    const charges = await prisma.charge.findMany();
    res.json(charges);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// Ajouter une charge
router.post('/', async (req, res) => {
  try {
    const charge = await prisma.charge.create({
      data: req.body
    });
    res.json(charge);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// Modifier une charge
router.put('/:id', async (req, res) => {
  try {
    const charge = await prisma.charge.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(charge);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// Supprimer une charge
router.delete('/:id', async (req, res) => {
  try {
    await prisma.charge.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Supprimé' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

export default router;