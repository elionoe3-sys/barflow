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
  try {
    const d = req.body;
    const cleanData: any = {
      nom:       String(d.nom || d.name || ''),
      prix:      (!isNaN(Number(d.prix)) ? Number(d.prix) : (!isNaN(Number(d.price)) ? Number(d.price) : 0)),
      categorie: String(d.categorie || d.category || 'autre'),
      stock:     (!isNaN(Number(d.stock)) ? Number(d.stock) : 0),
    };
    if (d.stockUnit)            cleanData.stockUnit = String(d.stockUnit);
    if (d.seuilAlerte != null)  cleanData.seuilAlerte = !isNaN(Number(d.seuilAlerte)) ? Number(d.seuilAlerte) : undefined;
    if (d.seuilCritique != null) cleanData.seuilCritique = !isNaN(Number(d.seuilCritique)) ? Number(d.seuilCritique) : undefined;
    if (d.image)                cleanData.image = String(d.image);
    if (d.color)                cleanData.color = String(d.color);
    if (d.popularite != null)   cleanData.popularite = !isNaN(Number(d.popularite)) ? Number(d.popularite) : undefined;
    if (d.activePriceFormats)   cleanData.activePriceFormats = d.activePriceFormats;
    if (d.prices)               cleanData.prices = d.prices;
    if (d.options)              cleanData.options = d.options;

    const data = await prisma.produit.upsert({
      where:  { id: d.id },
      update: cleanData,
      create: { id: d.id, ...cleanData },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/produits/:id', async (req, res) => {
  try {
    const d = req.body;
    const cleanData: any = {};
    if (d.nom !== undefined)               cleanData.nom = String(d.nom);
    if (d.prix !== undefined)              cleanData.prix = !isNaN(Number(d.prix)) ? Number(d.prix) : undefined;
    if (d.categorie !== undefined)         cleanData.categorie = String(d.categorie);
    if (d.stock !== undefined)             cleanData.stock = !isNaN(Number(d.stock)) ? Number(d.stock) : undefined;
    if (d.stockUnit !== undefined)         cleanData.stockUnit = String(d.stockUnit);
    if (d.seuilAlerte !== undefined)       cleanData.seuilAlerte = !isNaN(Number(d.seuilAlerte)) ? Number(d.seuilAlerte) : undefined;
    if (d.seuilCritique !== undefined)     cleanData.seuilCritique = !isNaN(Number(d.seuilCritique)) ? Number(d.seuilCritique) : undefined;
    if (d.image !== undefined)             cleanData.image = String(d.image);
    if (d.color !== undefined)             cleanData.color = String(d.color);
    if (d.popularite !== undefined)        cleanData.popularite = !isNaN(Number(d.popularite)) ? Number(d.popularite) : undefined;
    if (d.activePriceFormats !== undefined) cleanData.activePriceFormats = d.activePriceFormats;
    if (d.prices !== undefined)            cleanData.prices = d.prices;
    if (d.options !== undefined)           cleanData.options = d.options;

    const data = await prisma.produit.upsert({
      where:  { id: req.params.id },
      update: cleanData,
      create: { id: req.params.id, ...cleanData },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/produits/:id', async (req, res) => {
  try {
    await prisma.produit.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ COMMANDES ============
router.get('/commandes', async (req, res) => {
  const data = await prisma.commande.findMany();
  res.json(data);
});

router.post('/commandes', async (req, res) => {
  try {
    const d = req.body;
    const cleanData: any = {
      numero: String(d.numero || d.id || ''),
      date:   String(d.date || new Date().toISOString()),
      total:  !isNaN(Number(d.total)) ? Number(d.total) : 0,
      statut: String(d.statut || 'en_cours'),
      items:  d.items || [],
    };
    if (d.tableNumber != null)  cleanData.tableNumber = Number(d.tableNumber);
    if (d.server)               cleanData.server = String(d.server);
    if (d.paymentMethod)        cleanData.paymentMethod = String(d.paymentMethod);
    if (d.comment)              cleanData.comment = String(d.comment);

    const data = await prisma.commande.upsert({
      where:  { id: d.id },
      update: cleanData,
      create: { id: d.id, ...cleanData },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/commandes/:id', async (req, res) => {
  try {
    const d = req.body;
    const cleanData: any = {};
    if (d.numero !== undefined)        cleanData.numero = String(d.numero);
    if (d.date !== undefined)          cleanData.date = String(d.date);
    if (d.total !== undefined)         cleanData.total = !isNaN(Number(d.total)) ? Number(d.total) : undefined;
    if (d.statut !== undefined)        cleanData.statut = String(d.statut);
    if (d.items !== undefined)         cleanData.items = d.items;
    if (d.tableNumber !== undefined)   cleanData.tableNumber = !isNaN(Number(d.tableNumber)) ? Number(d.tableNumber) : undefined;
    if (d.server !== undefined)        cleanData.server = String(d.server);
    if (d.paymentMethod !== undefined) cleanData.paymentMethod = String(d.paymentMethod);
    if (d.comment !== undefined)       cleanData.comment = String(d.comment);

    const data = await prisma.commande.upsert({
      where:  { id: req.params.id },
      update: cleanData,
      create: { id: req.params.id, ...cleanData },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/commandes/:id', async (req, res) => {
  try {
    await prisma.commande.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ CHARGES ============
router.get('/charges', async (req, res) => {
  const data = await prisma.charge.findMany();
  res.json(data);
});

router.post('/charges', async (req, res) => {
  try {
    const d = req.body;
    const cleanData = {
      nom:            String(d.nom || ''),
      categorie:      String(d.categorie || ''),
      montantMensuel: !isNaN(Number(d.montantMensuel)) ? Number(d.montantMensuel) : 0,
      periodicite:    String(d.periodicite || 'mensuel'),
    };
    const data = await prisma.charge.upsert({
      where:  { id: d.id },
      update: cleanData,
      create: { id: d.id, ...cleanData },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/charges/:id', async (req, res) => {
  try {
    const d = req.body;
    const cleanData = {
      nom:            String(d.nom || ''),
      categorie:      String(d.categorie || ''),
      montantMensuel: !isNaN(Number(d.montantMensuel)) ? Number(d.montantMensuel) : 0,
      periodicite:    String(d.periodicite || 'mensuel'),
    };
    const data = await prisma.charge.upsert({
      where:  { id: req.params.id },
      update: cleanData,
      create: { id: req.params.id, ...cleanData },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/charges/:id', async (req, res) => {
  try {
    await prisma.charge.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ EMPLOYÉS ============
router.get('/employes', async (req, res) => {
  const data = await prisma.employe.findMany();
  res.json(data);
});

router.post('/employes', async (req, res) => {
  try {
    const d = req.body;
    const cleanData = {
      nom:         String(d.nom || ''),
      poste:       String(d.poste || ''),
      salaireBrut: Number(d.salaireBrut || 0),
      prime:       Number(d.prime || 0),
      avantages:   Number(d.avantages || 0),
    };
    const data = await prisma.employe.upsert({
      where:  { id: d.id },
      update: cleanData,
      create: { id: d.id, ...cleanData },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/employes/:id', async (req, res) => {
  try {
    const d = req.body;
    const cleanData = {
      nom:         String(d.nom || ''),
      poste:       String(d.poste || ''),
      salaireBrut: Number(d.salaireBrut || 0),
      prime:       Number(d.prime || 0),
      avantages:   Number(d.avantages || 0),
    };
    const data = await prisma.employe.upsert({
      where:  { id: req.params.id },
      update: cleanData,
      create: { id: req.params.id, ...cleanData },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/employes/:id', async (req, res) => {
  try {
    await prisma.employe.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ INVESTISSEMENTS ============
router.get('/investissements', async (req, res) => {
  const data = await prisma.investissement.findMany();
  res.json(data);
});

router.post('/investissements', async (req, res) => {
  try {
    const d = req.body;
    const cleanData = {
      nom:                String(d.nom || ''),
      type:               String(d.type || 'materiel'),
      montant:            Number(d.montant || 0),
      amortissementAnnees: Number(d.amortissementAnnees || 5),
    };
    const data = await prisma.investissement.upsert({
      where:  { id: d.id },
      update: cleanData,
      create: { id: d.id, ...cleanData },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/investissements/:id', async (req, res) => {
  try {
    const d = req.body;
    const cleanData = {
      nom:                String(d.nom || ''),
      type:               String(d.type || 'materiel'),
      montant:            Number(d.montant || 0),
      amortissementAnnees: Number(d.amortissementAnnees || 5),
    };
    const data = await prisma.investissement.upsert({
      where:  { id: req.params.id },
      update: cleanData,
      create: { id: req.params.id, ...cleanData },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/investissements/:id', async (req, res) => {
  try {
    await prisma.investissement.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ DAILY STATS ============
router.get('/dailyStats', async (req, res) => {
  const data = await prisma.dailyStat.findMany();
  res.json(data);
});

router.post('/dailyStats', async (req, res) => {
  try {
    const { date, ca, clients } = req.body;
    const data = await prisma.dailyStat.upsert({
      where:  { date: String(date) },
      update: { ca: Number(ca), clients: Number(clients || 0) },
      create: { date: String(date), ca: Number(ca), clients: Number(clients || 0) },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ FOURNISSEURS ============
router.get('/fournisseurs', async (req, res) => {
  const data = await prisma.fournisseur.findMany();
  res.json(data);
});

router.post('/fournisseurs', async (req, res) => {
  try {
    const d = req.body;
    const cleanData = {
      nom:       String(d.nom || d.name || ''),
      telephone: d.telephone || d.phone || null,
      notes:     d.notes || null,
      produits:  d.produits || d.products || [],
    };
    const data = await prisma.fournisseur.upsert({
      where:  { id: d.id },
      update: cleanData,
      create: { id: d.id, ...cleanData },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/fournisseurs/:id', async (req, res) => {
  try {
    const d = req.body;
    const cleanData: any = {};
    if (d.nom !== undefined)       cleanData.nom = String(d.nom);
    if (d.telephone !== undefined) cleanData.telephone = d.telephone;
    if (d.notes !== undefined)     cleanData.notes = d.notes;
    if (d.produits !== undefined)  cleanData.produits = d.produits;

    const data = await prisma.fournisseur.upsert({
      where:  { id: req.params.id },
      update: cleanData,
      create: { id: req.params.id, ...cleanData },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/fournisseurs/:id', async (req, res) => {
  try {
    await prisma.fournisseur.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ COMMANDES RÉAPPRO ============
router.get('/reapproCommandes', async (req, res) => {
  const data = await prisma.reapproCommande.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(data);
});

router.post('/reapproCommandes', async (req, res) => {
  try {
    const d = req.body;
    const cleanData = {
      fournisseurId:  d.fournisseurId || null,
      fournisseurNom: String(d.fournisseurNom || d.supplierName || ''),
      fournisseurTel: d.fournisseurTel || d.supplierPhone || null,
      items:          d.items || [],
      totalAmount:    Number(d.totalAmount || 0),
      statut:         String(d.statut || d.status || 'envoyée'),
      receivedAt:     d.receivedAt || null,
    };
    const data = await prisma.reapproCommande.upsert({
      where:  { id: d.id },
      update: cleanData,
      create: { id: d.id, ...cleanData },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/reapproCommandes/:id', async (req, res) => {
  try {
    const d = req.body;
    const cleanData: any = {};
    if (d.fournisseurId !== undefined)  cleanData.fournisseurId = d.fournisseurId;
    if (d.fournisseurNom !== undefined) cleanData.fournisseurNom = String(d.fournisseurNom);
    if (d.fournisseurTel !== undefined) cleanData.fournisseurTel = d.fournisseurTel;
    if (d.items !== undefined)          cleanData.items = d.items;
    if (d.totalAmount !== undefined)    cleanData.totalAmount = Number(d.totalAmount);
    if (d.statut !== undefined)         cleanData.statut = String(d.statut);
    if (d.status !== undefined)         cleanData.statut = String(d.status);
    if (d.receivedAt !== undefined)     cleanData.receivedAt = d.receivedAt;

    const data = await prisma.reapproCommande.upsert({
      where:  { id: req.params.id },
      update: cleanData,
      create: { id: req.params.id, ...cleanData },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/reapproCommandes/:id', async (req, res) => {
  try {
    await prisma.reapproCommande.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PERTES ============
router.get('/pertes', async (req, res) => {
  const data = await prisma.perte.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(data);
});

router.post('/pertes', async (req, res) => {
  try {
    const d = req.body;
    const cleanData = {
      productId:    String(d.productId || ''),
      productName:  String(d.productName || ''),
      productPrice: Number(d.productPrice || 0),
      quantity:     Number(d.quantity || 0),
      reason:       String(d.reason || ''),
      stockAvant:   Number(d.stockAvant || 0),
      stockReel:    d.stockReel != null ? Number(d.stockReel) : null,
      valeurPerdue: Number(d.valeurPerdue || 0),
      date:         String(d.date || new Date().toISOString()),
      note:         d.note || null,
    };
    const data = await prisma.perte.upsert({
      where:  { id: d.id },
      update: cleanData,
      create: { id: d.id, ...cleanData },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/pertes/:id', async (req, res) => {
  try {
    await prisma.perte.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ CATÉGORIES ============
router.get('/categories', async (req, res) => {
  const data = await prisma.categorie.findMany({ orderBy: { nom: 'asc' } });
  res.json(data);
});

router.post('/categories', async (req, res) => {
  try {
    const d = req.body;
    const cleanData = {
      nom:   String(d.nom || d.name || ''),
      emoji: String(d.emoji || '📦'),
      color: String(d.color || '#8B5CF6'),
    };
    const data = await prisma.categorie.upsert({
      where:  { id: d.id },
      update: cleanData,
      create: { id: d.id, ...cleanData },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const d = req.body;
    const cleanData: any = {};
    if (d.nom !== undefined)   cleanData.nom = String(d.nom);
    if (d.emoji !== undefined) cleanData.emoji = String(d.emoji);
    if (d.color !== undefined) cleanData.color = String(d.color);

    const data = await prisma.categorie.upsert({
      where:  { id: req.params.id },
      update: cleanData,
      create: { id: req.params.id, ...cleanData },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    await prisma.categorie.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ BAR SETTINGS ============
router.get('/settings', async (req, res) => {
  const data = await prisma.barSetting.findMany();
  res.json(data);
});

router.get('/settings/:key', async (req, res) => {
  try {
    const data = await prisma.barSetting.findUnique({ where: { key: req.params.key } });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const { key, value } = req.body;
    const data = await prisma.barSetting.upsert({
      where:  { key: String(key) },
      update: { value, updatedAt: new Date() },
      create: { key: String(key), value, updatedAt: new Date() },
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/settings/:key', async (req, res) => {
  try {
    await prisma.barSetting.delete({ where: { key: req.params.key } });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
