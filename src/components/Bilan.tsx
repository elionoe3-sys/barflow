// Bilan.tsx - Version CORRIGÉE et AMÉLIORÉE
import { useState, useEffect } from 'react';
import {
  FileText, Plus, X, Trash2, Edit3, Download, TrendingUp, TrendingDown,
  DollarSign, Users, Building2, Target, Crown, Activity, LayoutGrid,
  RefreshCw, AlertCircle, Check, BarChart3, PieChart as PieChartIcon,
  ShoppingCart, Wifi, WifiOff, CheckCircle, Landmark, Receipt, Scale,
  Banknote, CreditCard, ShieldCheck, Info, Save, BookOpen, Percent,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/utils/cn';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Charge, type Employe, type Investissement, type Prevision } from '@/db';
import { initializeDefaultData } from '@/db';
import { useRealDailyStats } from '@/utils/orderStore';
import { useAchatStats } from '@/utils/reapproStore';

// ── Fonctions de formatage (2 décimales + signes +/–) ──────────
const fmtMoney = (n: number) => 
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, '\u00a0');

const fmtSigned = (n: number) => {
  const abs = Math.abs(n);
  const sign = n >= 0 ? '+' : '-';
  return `${sign} ${fmtMoney(abs)}`;
};

const periodiciteMonths: Record<string, number> = {
  mensuel: 1,
  bimestriel: 2,
  trimestriel: 3,
  semestriel: 6,
  annuel: 12,
};

const getMonthlyAmount = (c: Charge) => c.montantMensuel / (periodiciteMonths[c.periodicite] || 1);

const gradientMap: Record<string, string> = {
  emerald: 'from-emerald-500 to-teal-600',
  violet: 'from-violet-500 to-purple-600',
  blue: 'from-blue-500 to-cyan-600',
  amber: 'from-amber-500 to-orange-600',
  rose: 'from-rose-500 to-pink-600',
};

const emptyCharge = { nom: '', categorie: 'electricite', montantMensuel: 0, periodicite: 'mensuel' as const };
const emptyEmploye = { nom: '', poste: '', salaireBrut: 0, prime: 0, avantages: 0 };
const emptyInvest = { nom: '', type: 'materiel', montant: 0, amortissementAnnees: 5 };

const TABS = [
  { id: 'apercu',          label: 'Aperçu',            icon: LayoutGrid,   color: 'violet'  },
  { id: 'charges',         label: 'Charges',           icon: TrendingDown, color: 'rose'    },
  { id: 'salaires',        label: 'Salaires',          icon: Users,        color: 'blue'    },
  { id: 'investissements', label: 'Investissements',   icon: Building2,    color: 'amber'   },
  { id: 'achats',          label: 'Achats fournisseurs', icon: ShoppingCart, color: 'emerald'},
  { id: 'previsions',      label: 'Prévisions 5 ans',  icon: Target,       color: 'emerald' },
  { id: 'donnees_bilan',   label: 'Données Bilan',     icon: Landmark,     color: 'violet'  },
] as const;

type TabId = typeof TABS[number]['id'];

export function Bilan() {
  const [activeTab, setActiveTab] = useState<TabId>('apercu');
  const [showChargeForm, setShowChargeForm]   = useState(false);
  const [showEmployeForm, setShowEmployeForm] = useState(false);
  const [showInvestForm, setShowInvestForm]   = useState(false);
  const [editingCharge, setEditingCharge]     = useState<Charge | null>(null);
  const [editingEmploye, setEditingEmploye]   = useState<Employe | null>(null);
  const [editingInvest, setEditingInvest]     = useState<Investissement | null>(null);
  const [isGenerating, setIsGenerating]       = useState(false);
  const [isInitializing, setIsInitializing]   = useState(true);
  const [isOnline, setIsOnline]               = useState(navigator.onLine);
  const [pendingSync, setPendingSync]         = useState(0);
  
  const [chargeForm, setChargeForm]   = useState(emptyCharge);
  const [employeForm, setEmployeForm] = useState(emptyEmploye);
  const [investForm, setInvestForm]   = useState(emptyInvest);
  const [previsions, setPrevisions]   = useState<Prevision[]>([]);
  const [bilanSaved, setBilanSaved]   = useState(false);

  // ── Données Bilan manuelles (persistées localStorage) ─────────
  const defaultDonneesBilan = {
    // Identification
    raisonSociale: '', formeJuridique: '', adresse: '', telephone: '', email: '',
    ninea: '', registreCommerce: '', gerant: '', dateCreation: '', capitalSocial: '',
    // Banque
    nomBanque: '', numeroCpte: '', iban: '', swift: '',
    // Emprunts & dettes financières
    emprunts: [{ libelle: '', banque: '', montantInitial: '', soldeRestant: '', echeanceMensuelle: '', dateDebut: '', dateFin: '' }],
    // TVA
    regimeTVA: 'reel_normal', numeroDGID: '', centreImpots: '', periodeDeclaration: 'mensuelle',
    tvaCollecteeManuelle: '', tvaDeductibleManuelle: '',
    // IS et autres impôts
    regimeIS: 'normal', taxePatente: '', cfce: '', tcs: '', autresImpots: '',
    // IPRES / CSS
    numAffiliationIPRES: '', numAffiliationCSS: '', tauxIPRES: '8.4', tauxCSS: '5',
    // Trésorerie complémentaire
    soldeCaisse: '', soldeWave: '', soldeOrangeMoney: '', soldeBanque: '', decouvertAutorise: '',
    // Capital & associés
    associes: [{ nom: '', apport: '', pourcentage: '' }],
    dividendesVerses: '', reserveLegale: '', reportANouveau: '',
    // Créances & dettes
    creancesClients: '', creancesFournisseurs: '', avancesPersonnel: '',
    dettesFournisseurs: '', autresDettes: '',
    // Stocks
    valeurStockBrut: '', depreciationStock: '',
    // Caution & garanties
    cautionBailCommercial: '', autresGaranties: '',
    // Informations complémentaires
    expertComptable: '', commissaireComptes: '', conseillerJuridique: '',
    observations: '',
  };

  const [donneesBilan, setDonneesBilan] = useState(() => {
    try {
      const saved = localStorage.getItem('barflow_donnees_bilan');
      return saved ? { ...defaultDonneesBilan, ...JSON.parse(saved) } : defaultDonneesBilan;
    } catch { return defaultDonneesBilan; }
  });

  const saveDonneesBilan = (data: typeof defaultDonneesBilan) => {
    setDonneesBilan(data);
    localStorage.setItem('barflow_donnees_bilan', JSON.stringify(data));
    setBilanSaved(true);
    setTimeout(() => setBilanSaved(false), 2500);
  };

  const updateDB = (field: string, value: string) => {
    const updated = { ...donneesBilan, [field]: value };
    saveDonneesBilan(updated);
  };

  const updateEmprunt = (idx: number, field: string, value: string) => {
    const emprunts = [...donneesBilan.emprunts];
    emprunts[idx] = { ...emprunts[idx], [field]: value };
    saveDonneesBilan({ ...donneesBilan, emprunts });
  };

  const addEmprunt = () => {
    saveDonneesBilan({
      ...donneesBilan,
      emprunts: [...donneesBilan.emprunts, { libelle: '', banque: '', montantInitial: '', soldeRestant: '', echeanceMensuelle: '', dateDebut: '', dateFin: '' }],
    });
  };

  const removeEmprunt = (idx: number) => {
    saveDonneesBilan({ ...donneesBilan, emprunts: donneesBilan.emprunts.filter((_, i) => i !== idx) });
  };

  const updateAssocie = (idx: number, field: string, value: string) => {
    const associes = [...donneesBilan.associes];
    associes[idx] = { ...associes[idx], [field]: value };
    saveDonneesBilan({ ...donneesBilan, associes });
  };

  const addAssocie = () => {
    saveDonneesBilan({
      ...donneesBilan,
      associes: [...donneesBilan.associes, { nom: '', apport: '', pourcentage: '' }],
    });
  };

  const removeAssocie = (idx: number) => {
    saveDonneesBilan({ ...donneesBilan, associes: donneesBilan.associes.filter((_, i) => i !== idx) });
  };

  // ── Données Dexie ──────────────────────────────────────────────
  const charges         = useLiveQuery(() => db.getActiveCharges(), []);
  const employes        = useLiveQuery(() => db.getActiveEmployes(), []);
  const investissements = useLiveQuery(() => db.getActiveInvestissements(), []);

  // ── CA réel et Achats ──────────────────────────────────────────
  const realDailyStats = useRealDailyStats(30);
  const hasRealCA = (realDailyStats?.length ?? 0) > 0;
  const caMensuelReel = hasRealCA ? realDailyStats!.reduce((s, d) => s + d.ca, 0) : 0;

  const achatStats = useAchatStats(365);
  const hasAchats = achatStats && achatStats.totalAchats > 0;
  const totalAchatsMensuel = achatStats?.totalAchatsParMois ?? 0;
  const totalAchatsAnnuel  = achatStats?.totalAchatsAnnuel  ?? 0;

  // ── Sync status ────────────────────────────────────────────────
  useEffect(() => {
    const updateSync = async () => setPendingSync(await db.syncQueue.count());
    updateSync();
    const interval = setInterval(updateSync, 5000);
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { clearInterval(interval); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  useEffect(() => {
    initializeDefaultData().then(() => setIsInitializing(false));
  }, []);

  // ── Calculs financiers (Conversion périodicité -> mensuel) ───
  const totalChargesMensuelles = (charges || []).reduce((s, c) => s + getMonthlyAmount(c), 0);
  
  // Calcul salaire clarifié pour éviter l'impression de doublon
  const totalSalairesBruts     = (employes || []).reduce((s, e) => s + e.salaireBrut + e.prime + e.avantages, 0);
  const totalChargesSociales   = totalSalairesBruts * 0.15;
  const totalMasseSalariale    = totalSalairesBruts + totalChargesSociales;
  
  const totalChargesGlobales   = totalChargesMensuelles + totalMasseSalariale;
  const coutMarchandisesMensuel = totalAchatsMensuel;
  
  const beneficeMensuel        = caMensuelReel - totalChargesGlobales - coutMarchandisesMensuel;
  const margeBeneficiaire      = caMensuelReel > 0 ? (beneficeMensuel / caMensuelReel) * 100 : 0;
  const margeBrute             = caMensuelReel - coutMarchandisesMensuel;
  const tauxMargeBrute         = caMensuelReel > 0 ? (margeBrute / caMensuelReel) * 100 : 0;
  
  const amortissementMensuel   = (investissements || []).reduce((s, inv) => {
    return s + (inv.amortissementAnnees > 0 ? inv.montant / inv.amortissementAnnees / 12 : 0);
  }, 0);
  
  const beneficeNet            = beneficeMensuel - amortissementMensuel;
  const caAnnuel               = caMensuelReel * 12;

  // ── Prévisions 5 ans ───────────────────────────────────────────
  const genererPrevisions = () => {
    setIsGenerating(true);
    const croissance = 0.08;
    let ca = caAnnuel;
    let charges_ = totalChargesGlobales * 12;
    let achats_ = totalAchatsAnnuel;
    
    const newPrev: Prevision[] = Array.from({ length: 5 }, (_, i) => {
      const annee = new Date().getFullYear() + i;
      if (i > 0) { ca *= (1 + croissance); charges_ *= 1.03; achats_ *= 1.06; }
      const benefice = Math.round(ca) - Math.round(charges_) - Math.round(achats_);
      return { annee, ca: Math.round(ca), charges: Math.round(charges_), salaires: 0, benefice, croissance: i === 0 ? 0 : Math.round(croissance * 100) };
    });
    setPrevisions(newPrev);
    setTimeout(() => setIsGenerating(false), 400);
  };

  useEffect(() => {
    if (!isInitializing) genererPrevisions();
  }, [charges, employes, investissements, caAnnuel, totalChargesGlobales, isInitializing, totalAchatsAnnuel]);

  // ── Formulaires CRUD ───────────────────────────────────────────
  const openChargeForm = (c?: Charge) => {
    setEditingCharge(c || null);
    setChargeForm(c ? { nom: c.nom, categorie: c.categorie, montantMensuel: c.montantMensuel, periodicite: (c.periodicite as any) || 'mensuel' } : emptyCharge);
    setShowChargeForm(true);
  };
  const saveCharge = async () => {
    if (!chargeForm.nom || chargeForm.montantMensuel <= 0) return;
    editingCharge ? await db.updateCharge(editingCharge.id, chargeForm) : await db.addCharge(chargeForm);
    setShowChargeForm(false);
  };
  const deleteCharge = async (id: string) => { if (window.confirm('Supprimer ?')) await db.deleteCharge(id); };

  const openEmployeForm = (e?: Employe) => {
    setEditingEmploye(e || null);
    setEmployeForm(e ? { nom: e.nom, poste: e.poste, salaireBrut: e.salaireBrut, prime: e.prime, avantages: e.avantages } : emptyEmploye);
    setShowEmployeForm(true);
  };
  const saveEmploye = async () => {
    if (!employeForm.nom || employeForm.salaireBrut <= 0) return;
    editingEmploye ? await db.updateEmploye(editingEmploye.id, employeForm) : await db.addEmploye(employeForm);
    setShowEmployeForm(false);
  };
  const deleteEmploye = async (id: string) => { if (window.confirm('Supprimer ?')) await db.deleteEmploye(id); };

  const openInvestForm = (inv?: Investissement) => {
    setEditingInvest(inv || null);
    setInvestForm(inv ? { nom: inv.nom, type: inv.type, montant: inv.montant, amortissementAnnees: inv.amortissementAnnees } : emptyInvest);
    setShowInvestForm(true);
  };
  const saveInvest = async () => {
    if (!investForm.nom || investForm.montant <= 0) return;
    editingInvest ? await db.updateInvestissement(editingInvest.id, investForm) : await db.addInvestissement(investForm);
    setShowInvestForm(false);
  };
  const deleteInvest = async (id: string) => { if (window.confirm('Supprimer ?')) await db.deleteInvestissement(id); };

  // ── Chart pie charges ──────────────────────────────────────────
  const chargesParCategorie = Object.entries(
    (charges || []).reduce((acc, c) => { 
      acc[c.categorie] = (acc[c.categorie] || 0) + getMonthlyAmount(c); 
      return acc; 
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));
  
  const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6'];
  const getNavGradient = (color: string) => gradientMap[color] || gradientMap.violet;

  // ── Export PDF — Bilan Financier Complet (format bancaire / fiscal) ─────
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const M = 15; // margin
    const PW = 210; // page width A4 portrait
    const PH = 297; // page height
    const CW = PW - M * 2; // content width
    let y = M;
    let pageNum = 1;

    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const exerciceAnnee = now.getFullYear();

    // Données annualisées
    const caAnnuel_      = caMensuelReel * 12;
    const achatsAnnuel   = totalAchatsMensuel * 12;
    const chargesAnnuel  = totalChargesMensuelles * 12;
    const salairesAnnuel = totalSalairesBruts * 12;
    const csAnnuel       = totalChargesSociales * 12;
    const amortAnnuel    = amortissementMensuel * 12;
    const margeBruteAnn  = caAnnuel_ - achatsAnnuel;
    const ebeAnnuel      = margeBruteAnn - chargesAnnuel - salairesAnnuel - csAnnuel;
    const resultatAnnuel = ebeAnnuel - amortAnnuel;
    const totalActifBrut = (investissements || []).reduce((s, inv) => s + inv.montant, 0);
    const totalAmortCumul = amortAnnuel; // simplifié
    const totalActifNet   = totalActifBrut - totalAmortCumul;
    const capitauxPropres = Math.max(0, resultatAnnuel);
    const totalPassif     = totalActifNet;
    // TVA estimée (18% sur CA au Sénégal)
    const tvaCollectee  = caAnnuel_ * 0.18;
    const tvaDeductible = achatsAnnuel * 0.18;
    const tvaNette      = tvaCollectee - tvaDeductible;
    // IS estimé (30% bénéfice imposable au Sénégal)
    const beneficeImposable = Math.max(0, resultatAnnuel);
    const isEstime = beneficeImposable * 0.30;
    const resultatApresIS = resultatAnnuel - isEstime;
    // Ratios
    const tauxMargeBruteAnn = caAnnuel_ > 0 ? (margeBruteAnn / caAnnuel_ * 100) : 0;
    const tauxEBE           = caAnnuel_ > 0 ? (ebeAnnuel / caAnnuel_ * 100) : 0;
    const tauxResultat      = caAnnuel_ > 0 ? (resultatAnnuel / caAnnuel_ * 100) : 0;
    const roe               = capitauxPropres > 0 ? (resultatApresIS / capitauxPropres * 100) : 0;

    // ── Helpers ────────────────────────────────────────────────────
    const addPage = () => {
      addFooter();
      doc.addPage();
      pageNum++;
      y = M;
    };

    const addFooter = () => {
      const pg = pageNum;
      doc.setPage(pg);
      doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3);
      doc.line(M, PH - 12, PW - M, PH - 12);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 150);
      doc.text(`BarFlow — Bilan Financier Annuel ${exerciceAnnee} — Document confidentiel`, M, PH - 7);
      doc.text(`Page ${pg}`, PW - M, PH - 7, { align: 'right' });
      doc.text(`Généré le ${dateStr}`, PW / 2, PH - 7, { align: 'center' });
    };

    const checkY = (needed: number) => {
      if (y + needed > PH - 20) addPage();
    };

    const sectionTitle = (title: string, subtitle?: string) => {
      checkY(16);
      doc.setFillColor(10, 40, 80);
      doc.rect(M, y, CW, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text(title.toUpperCase(), M + 4, y + 7);
      if (subtitle) {
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 220, 255);
        doc.text(subtitle, PW - M - 4, y + 7, { align: 'right' });
      }
      y += 13;
      doc.setTextColor(30, 30, 50);
    };

    const subTitle = (title: string) => {
      checkY(10);
      doc.setFillColor(230, 235, 245);
      doc.rect(M, y, CW, 7, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(10, 40, 80);
      doc.text(title, M + 3, y + 5);
      y += 9;
      doc.setTextColor(30, 30, 50);
    };

    const twoCol = (label: string, value: string, bold = false, color?: [number,number,number]) => {
      checkY(7);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(color ? color[0] : 40, color ? color[1] : 40, color ? color[2] : 60);
      doc.text(label, M + 3, y);
      doc.text(value, PW - M - 3, y, { align: 'right' });
      y += 6;
    };

    const separator = () => {
      doc.setDrawColor(200, 205, 215); doc.setLineWidth(0.2);
      doc.line(M, y - 1, PW - M, y - 1);
    };

    const totalRow = (label: string, value: string, positive?: boolean) => {
      checkY(9);
      doc.setFillColor(240, 244, 252);
      doc.rect(M, y - 4, CW, 8, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold');
      if (positive === undefined) doc.setTextColor(10, 40, 80);
      else if (positive) doc.setTextColor(5, 120, 70);
      else doc.setTextColor(180, 30, 30);
      doc.text(label, M + 3, y + 1);
      doc.text(value, PW - M - 3, y + 1, { align: 'right' });
      y += 9;
      doc.setTextColor(40, 40, 60);
    };

    // Raccourcis données bilan
    const db = donneesBilan;
    const f = (v: string, fallback: string) => v?.trim() || fallback;
    const totalEmpruntsSoldes = db.emprunts.reduce((s, e) => s + (parseFloat(e.soldeRestant?.replace(/\s/g,'') || '0') || 0), 0);
    const totalEcheancesMens  = db.emprunts.reduce((s, e) => s + (parseFloat(e.echeanceMensuelle?.replace(/\s/g,'') || '0') || 0), 0);
    const totalTresorerie     = [db.soldeCaisse, db.soldeBanque, db.soldeWave, db.soldeOrangeMoney]
                                  .reduce((s, v) => s + (parseFloat(v || '0') || 0), 0);
    const totalCapitalSocial  = db.associes.reduce((s, a) => s + (parseFloat(a.apport?.replace(/\s/g,'') || '0') || 0), 0)
                                || (parseFloat(db.capitalSocial?.replace(/\s/g,'') || '0') || 0);
    const tvaCollecteeFinale  = db.tvaCollecteeManuelle
                                  ? (parseFloat(db.tvaCollecteeManuelle.replace(/\s/g,'')) || 0)
                                  : caAnnuel_ * 0.18;
    const tvaDeductibleFinale = db.tvaDeductibleManuelle
                                  ? (parseFloat(db.tvaDeductibleManuelle.replace(/\s/g,'')) || 0)
                                  : achatsAnnuel * 0.18;
    const tvaNetteFinale      = tvaCollecteeFinale - tvaDeductibleFinale;
    const tauxIS              = db.regimeIS === 'pme' ? 0.15 : db.regimeIS === 'exonere' ? 0 : 0.30;
    const isEstimeFinale      = Math.max(0, resultatAnnuel) * tauxIS;
    const resultatApresISFinal = resultatAnnuel - isEstimeFinale;
    const autresImpotsMontant = (parseFloat(db.taxePatente?.replace(/\s/g,'') || '0') || 0)
                              + (parseFloat(db.cfce?.replace(/\s/g,'') || '0') || 0)
                              + (parseFloat(db.tcs?.replace(/\s/g,'') || '0') || 0)
                              + (parseFloat(db.autresImpots?.replace(/\s/g,'') || '0') || 0);
    const stockNet            = (parseFloat(db.valeurStockBrut?.replace(/\s/g,'') || '0') || 0)
                              - (parseFloat(db.depreciationStock?.replace(/\s/g,'') || '0') || 0);
    const creancesTotal       = (parseFloat(db.creancesClients?.replace(/\s/g,'') || '0') || 0)
                              + (parseFloat(db.creancesFournisseurs?.replace(/\s/g,'') || '0') || 0)
                              + (parseFloat(db.avancesPersonnel?.replace(/\s/g,'') || '0') || 0);
    const dettesExplTotal     = (parseFloat(db.dettesFournisseurs?.replace(/\s/g,'') || '0') || 0)
                              + (parseFloat(db.autresDettes?.replace(/\s/g,'') || '0') || 0);
    const cautionsTotal       = (parseFloat(db.cautionBailCommercial?.replace(/\s/g,'') || '0') || 0)
                              + (parseFloat(db.autresGaranties?.replace(/\s/g,'') || '0') || 0);

    // ════════════════════════════════════════════════════════════
    // PAGE 1 — COUVERTURE
    // ════════════════════════════════════════════════════════════
    // Bandeau drapeau Sénégal
    doc.setFillColor(0, 168, 89);  doc.rect(0, 0, PW / 3, 8, 'F');
    doc.setFillColor(255, 210, 0); doc.rect(PW / 3, 0, PW / 3, 8, 'F');
    doc.setFillColor(227, 27, 35); doc.rect((PW / 3) * 2, 0, PW / 3, 8, 'F');

    doc.setFillColor(10, 40, 80);
    doc.rect(0, 8, PW, 58, 'F');
    doc.setFillColor(0, 120, 60); doc.rect(0, 63, PW, 3, 'F');

    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('RÉPUBLIQUE DU SÉNÉGAL  ·  BarFlow — Gestion Financière Digitale', PW / 2, 15, { align: 'center' });
    doc.setFontSize(24); doc.setFont('helvetica', 'bold');
    doc.text('BILAN FINANCIER ANNUEL', PW / 2, 30, { align: 'center' });
    doc.setFontSize(13); doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 225, 255);
    doc.text(`Exercice ${exerciceAnnee}  ·  Document Officiel`, PW / 2, 41, { align: 'center' });
    doc.setFontSize(8.5); doc.setTextColor(150, 190, 240);
    doc.text('Usage bancaire · Déclaration fiscale DGID · Audit · Partenaires financiers', PW / 2, 52, { align: 'center' });

    y = 76;

    // Bloc identité — données réelles si disponibles
    doc.setFillColor(248, 250, 255);
    doc.setDrawColor(160, 180, 220); doc.setLineWidth(0.5);
    doc.roundedRect(M, y, CW, 68, 3, 3, 'FD');

    doc.setTextColor(10, 40, 80); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('IDENTIFICATION DE L\'ÉTABLISSEMENT', M + 6, y + 9);
    doc.setDrawColor(0, 160, 100); doc.setLineWidth(1);
    doc.line(M + 6, y + 11, M + 105, y + 11);

    const infoLines = [
      ['Raison sociale :', f(db.raisonSociale, '[À compléter — Onglet Données Bilan]')],
      ['Forme juridique :', f(db.formeJuridique, '[SARL / SAS / EI]')],
      ['Adresse :', f(db.adresse, '[Adresse complète]')],
      ['Tél. / Email :', `${f(db.telephone, '[Téléphone]')}  ·  ${f(db.email, '[Email]')}`],
      ['NINEA / RC :', `${f(db.ninea, '[N° NINEA]')}  ·  ${f(db.registreCommerce, '[N° RC]')}`],
      ['Gérant / Responsable :', f(db.gerant, '[Nom du responsable légal]')],
      ['Date création :', f(db.dateCreation, '[JJ/MM/AAAA]')],
    ];
    let iy = y + 19;
    infoLines.forEach(([label, val]) => {
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 70, 120);
      doc.text(label, M + 6, iy);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 60);
      doc.text(val.length > 55 ? val.slice(0, 55) + '…' : val, M + 52, iy);
      iy += 8;
    });

    // Badge banque
    if (db.nomBanque) {
      doc.setFillColor(230, 240, 255); doc.setDrawColor(120, 150, 220); doc.setLineWidth(0.3);
      doc.roundedRect(M + CW - 58, y + 14, 55, 20, 2, 2, 'FD');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 60, 130);
      doc.text('BANQUE', M + CW - 56, y + 22);
      doc.setFont('helvetica', 'normal');
      doc.text(db.nomBanque, M + CW - 56, y + 28);
      if (db.numeroCpte) doc.text('N° ' + db.numeroCpte.slice(0, 18), M + CW - 56, y + 33);
    }

    y += 75;

    // Bloc statut données
    const hasEmprunt = totalEmpruntsSoldes > 0;
    doc.setFillColor(hasRealCA ? 232 : 255, hasRealCA ? 248 : 244, hasRealCA ? 238 : 215);
    doc.setDrawColor(hasRealCA ? 0 : 200, hasRealCA ? 150 : 140, hasRealCA ? 90 : 0);
    doc.setLineWidth(0.4); doc.roundedRect(M, y, CW, 20, 2, 2, 'FD');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.setTextColor(hasRealCA ? 0 : 150, hasRealCA ? 100 : 80, hasRealCA ? 40 : 0);
    const statusMsg = hasRealCA
      ? `✅ Données comptables réelles — ${realDailyStats?.length || 0} jour(s) enregistrés — CA mensuel : ${fmtMoney(caMensuelReel)} FCFA`
      : '⚠️ CA non encore enregistré — Complétez les ventes pour un bilan chiffré complet.';
    doc.text(statusMsg, M + 5, y + 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(80, 80, 100);
    doc.text(
      `Période : 01/01/${exerciceAnnee} — 31/12/${exerciceAnnee}  ·  Capital déclaré : ${fmtMoney(totalCapitalSocial)} FCFA  ·  Emprunts : ${fmtMoney(totalEmpruntsSoldes)} FCFA  ·  Trésorerie : ${fmtMoney(totalTresorerie)} FCFA`,
      M + 5, y + 15
    );
    y += 26;

    // Table des matières
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(10, 40, 80);
    doc.text('TABLE DES MATIÈRES', M, y); y += 7;
    const toc = [
      ['1.', 'Compte de Résultat Annuel (PCG / OHADA)'],
      ['2.', 'Bilan Comptable — Actif & Passif (données réelles)'],
      ['3.', 'Détail des Charges Fixes'],
      ['4.', 'Masse Salariale Détaillée (IPRES / CSS inclus)'],
      ['5.', 'Plan d\'Amortissements'],
      ['6.', 'Achats Fournisseurs'],
      ['7.', 'Indicateurs Fiscaux (TVA, IS, Patente, CFCE)'],
      ['8.', 'Ratios & Indicateurs de Performance Financière'],
      ['9.', 'Tableau de Flux de Trésorerie (méthode indirecte)'],
      ['10.', 'Prévisions & Plan de Développement 5 ans'],
      ['11.', 'Annexes — Emprunts, Capital, Créances & Dettes'],
    ];
    toc.forEach(([num, title]) => {
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 80);
      doc.text(num, M + 3, y);
      doc.text(title, M + 12, y);
      doc.setDrawColor(180, 185, 205); doc.setLineWidth(0.2);
      doc.text('·····················································', M + 80, y);
      y += 6;
    });

    addFooter();

    // ════════════════════════════════════════════════════════════
    // PAGE 2 — COMPTE DE RÉSULTAT ANNUEL (norme PCG/OHADA)
    // ════════════════════════════════════════════════════════════
    addPage();

    sectionTitle('1. Compte de Résultat Annuel', `Exercice clos le 31/12/${exerciceAnnee}`);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(100, 100, 130);
    doc.text('Présentation selon le Plan Comptable Général OHADA — Valeurs en FCFA', M, y); y += 7;

    subTitle('I. PRODUITS D\'EXPLOITATION');
    twoCol('70 — Ventes de marchandises / Chiffre d\'Affaires', fmtMoney(caAnnuel_));
    twoCol('  dont CA mensuel moyen', fmtMoney(caMensuelReel));
    twoCol('71 — Production stockée', fmtMoney(0));
    twoCol('74 — Subventions d\'exploitation', fmtMoney(0));
    twoCol('75 — Autres produits d\'exploitation', fmtMoney(0));
    separator();
    totalRow('TOTAL PRODUITS D\'EXPLOITATION (I)', fmtMoney(caAnnuel_), true);

    y += 3;
    subTitle('II. CHARGES D\'EXPLOITATION');
    twoCol('60 — Achats de marchandises / matières', fmtMoney(achatsAnnuel));
    twoCol('  Variation de stocks', fmtMoney(0));
    twoCol('  Coût d\'achat des marchandises vendues', fmtMoney(achatsAnnuel));
    separator();
    twoCol('MARGE COMMERCIALE BRUTE', fmtMoney(margeBruteAnn), true, tauxMargeBruteAnn >= 0 ? [5,120,70] : [180,30,30]);
    twoCol(`  Taux de marge brute : ${tauxMargeBruteAnn.toFixed(2)}%`, '', false, [80,80,120]);
    separator();
    twoCol('61 — Services extérieurs (loyer, énergie, eau, internet)', fmtMoney(chargesAnnuel));
    (charges || []).forEach(c => {
      twoCol(`   ${c.nom} (${c.periodicite})`, fmtMoney(getMonthlyAmount(c) * 12));
    });
    twoCol('62 — Autres services extérieurs (assurance, entretien)', fmtMoney(0));
    twoCol('63 — Impôts et taxes (hors IS)', fmtMoney(0));
    twoCol('64 — Charges de personnel — Salaires bruts', fmtMoney(salairesAnnuel));
    twoCol('64 — Charges de personnel — Charges patronales (15%)', fmtMoney(csAnnuel));
    twoCol('  Masse salariale totale (coût employeur)', fmtMoney(salairesAnnuel + csAnnuel));
    twoCol('65 — Autres charges de gestion courante', fmtMoney(0));
    separator();
    totalRow('TOTAL CHARGES D\'EXPLOITATION (II)', fmtMoney(achatsAnnuel + chargesAnnuel + salairesAnnuel + csAnnuel), false);

    y += 3;
    subTitle('III. RÉSULTATS INTERMÉDIAIRES');
    totalRow('EXCÉDENT BRUT D\'EXPLOITATION (EBE / EBITDA)', fmtMoney(ebeAnnuel), ebeAnnuel >= 0);
    twoCol(`  Taux d\'EBE : ${tauxEBE.toFixed(2)}% du CA`, '', false, [80,80,130]);

    twoCol('68 — Dotations aux amortissements', fmtMoney(-amortAnnuel));
    twoCol('68 — Dotations aux provisions', fmtMoney(0));
    separator();
    totalRow('RÉSULTAT D\'EXPLOITATION (REX / EBIT)', fmtMoney(resultatAnnuel), resultatAnnuel >= 0);
    twoCol(`  Taux de résultat d\'exploitation : ${tauxResultat.toFixed(2)}%`, '', false, [80,80,130]);

    y += 3;
    subTitle('IV. RÉSULTAT FINANCIER & EXCEPTIONNEL');
    twoCol('76 — Produits financiers (intérêts perçus)', fmtMoney(0));
    twoCol('66 — Charges financières (intérêts emprunt)', fmtMoney(0));
    totalRow('RÉSULTAT FINANCIER NET', fmtMoney(0), true);
    twoCol('77 — Produits exceptionnels', fmtMoney(0));
    twoCol('67 — Charges exceptionnelles', fmtMoney(0));
    totalRow('RÉSULTAT EXCEPTIONNEL', fmtMoney(0), true);

    y += 3;
    twoCol('69 — Participation des salariés aux bénéfices', fmtMoney(0));
    twoCol('69 — Impôt sur les sociétés (IS estimé 30%)', fmtMoney(-isEstime));
    separator();
    totalRow('RÉSULTAT NET DE L\'EXERCICE', fmtMoney(resultatApresIS), resultatApresIS >= 0);

    // ════════════════════════════════════════════════════════════
    // PAGE 3 — BILAN ACTIF / PASSIF
    // ════════════════════════════════════════════════════════════
    addPage();
    sectionTitle('2. Bilan Comptable au 31/12/' + exerciceAnnee, 'Normes OHADA / SYSCOHADA');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(100, 100, 130);
    doc.text('Les valeurs brutes sont issues des immobilisations déclarées. Les créances et stocks sont estimatifs.', M, y); y += 7;

    // ACTIF
    subTitle('ACTIF — EMPLOIS');
    twoCol('ACTIF IMMOBILISÉ (non courant)', '', true, [10,40,80]);
    twoCol('21 — Immobilisations corporelles (matériel, agencements)', fmtMoney(totalActifBrut));
    twoCol('21 — Immobilisations incorporelles (licences, logiciels)', fmtMoney(0));
    twoCol('26 — Participations financières', fmtMoney(0));
    twoCol('28 — Amortissements cumulés', fmtMoney(-totalAmortCumul));
    separator();
    totalRow('TOTAL ACTIF IMMOBILISÉ NET', fmtMoney(totalActifNet));

    y += 3;
    twoCol('ACTIF CIRCULANT (courant)', '', true, [10,40,80]);
    twoCol('31 — Stocks de marchandises (valeur estimée)', fmtMoney(caMensuelReel * 0.15));
    twoCol('41 — Créances clients (ardoises en cours)', fmtMoney(0));
    twoCol('44 — État — TVA déductible en attente', fmtMoney(tvaDeductible / 12));
    twoCol('45 — Avances et acomptes versés', fmtMoney(0));
    separator();
    totalRow('TOTAL ACTIF CIRCULANT', fmtMoney(caMensuelReel * 0.15 + tvaDeductible / 12));

    y += 3;
    twoCol('TRÉSORERIE ACTIVE', '', true, [10,40,80]);
    twoCol('53 — Caisse (estimation)', fmtMoney(caMensuelReel * 0.5));
    twoCol('51 — Banque (estimation)', fmtMoney(caMensuelReel * 0.3));
    twoCol('54 — Régies (Wave, Orange Money)', fmtMoney(caMensuelReel * 0.1));
    separator();
    const tresorerie = caMensuelReel * 0.9;
    totalRow('TOTAL TRÉSORERIE ACTIVE', fmtMoney(tresorerie));

    separator();
    totalRow('TOTAL GÉNÉRAL ACTIF', fmtMoney(totalActifNet + caMensuelReel * 0.15 + tvaDeductible / 12 + tresorerie), true);

    y += 6;

    // PASSIF
    subTitle('PASSIF — RESSOURCES');
    twoCol('CAPITAUX PROPRES', '', true, [10,40,80]);
    twoCol('10 — Capital social', fmtMoney(0));
    twoCol('11 — Réserves légales et statutaires', fmtMoney(0));
    twoCol('12 — Report à nouveau', fmtMoney(0));
    twoCol('12 — Résultat net de l\'exercice', fmtMoney(resultatApresIS));
    separator();
    totalRow('TOTAL CAPITAUX PROPRES', fmtMoney(resultatApresIS), resultatApresIS >= 0);

    y += 3;
    twoCol('DETTES FINANCIÈRES (non courantes)', '', true, [10,40,80]);
    twoCol('16 — Emprunts bancaires à long terme', fmtMoney(0));
    twoCol('17 — Dettes de crédit-bail', fmtMoney(0));
    separator();
    totalRow('TOTAL DETTES FINANCIÈRES', fmtMoney(0));

    y += 3;
    twoCol('DETTES D\'EXPLOITATION (courantes)', '', true, [10,40,80]);
    twoCol('40 — Dettes fournisseurs', fmtMoney(totalAchatsMensuel));
    twoCol('42 — Dettes sociales (salaires à payer)', fmtMoney(totalSalairesBruts));
    twoCol('43 — Dettes organismes sociaux (IPRES, CSS)', fmtMoney(totalChargesSociales));
    twoCol('44 — Dettes fiscales (TVA à décaisser)', fmtMoney(tvaNette / 12));
    twoCol('44 — Dettes IS à décaisser', fmtMoney(isEstime / 12));
    twoCol('45 — Avances reçues clients', fmtMoney(0));
    separator();
    totalRow('TOTAL DETTES D\'EXPLOITATION', fmtMoney(totalAchatsMensuel + totalSalairesBruts + totalChargesSociales + tvaNette / 12 + isEstime / 12));

    separator();
    const totalPassifVal = Math.max(0, resultatApresIS) + totalAchatsMensuel + totalSalairesBruts + totalChargesSociales + tvaNette / 12 + isEstime / 12;
    totalRow('TOTAL GÉNÉRAL PASSIF', fmtMoney(totalPassifVal), true);

    // ════════════════════════════════════════════════════════════
    // PAGE 4 — DÉTAIL CHARGES + MASSE SALARIALE + AMORTISSEMENTS
    // ════════════════════════════════════════════════════════════
    addPage();
    sectionTitle('3. Détail des Charges Fixes', `${(charges || []).length} poste(s) enregistré(s)`);

    if ((charges || []).length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['N°', 'Désignation de la charge', 'Catégorie', 'Périodicité', 'Montant saisi (FCFA)', 'Équiv. mensuel (FCFA)', 'Équiv. annuel (FCFA)']],
        body: (charges || []).map((c, i) => [
          String(i + 1),
          c.nom,
          c.categorie.charAt(0).toUpperCase() + c.categorie.slice(1),
          c.periodicite.charAt(0).toUpperCase() + c.periodicite.slice(1),
          fmtMoney(c.montantMensuel),
          fmtMoney(getMonthlyAmount(c)),
          fmtMoney(getMonthlyAmount(c) * 12),
        ]).concat([
          ['', 'TOTAL', '', '', '', fmtMoney(totalChargesMensuelles), fmtMoney(chargesAnnuel)],
        ]),
        theme: 'striped',
        headStyles: { fillColor: [10, 40, 80], textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5 },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' },
        },
        margin: { left: M, right: M },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    } else {
      doc.setFontSize(8); doc.setTextColor(150, 150, 170);
      doc.text('Aucune charge enregistrée.', M, y); y += 10;
    }

    sectionTitle('4. Masse Salariale Détaillée', `${(employes || []).length} employé(s)`);

    if ((employes || []).length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Employé', 'Poste', 'Salaire brut/mois', 'Primes & Av./mois', 'Total brut/mois', 'Ch. pat. (15%)', 'Coût total/mois', 'Coût annuel']],
        body: (employes || []).map(e => {
          const total = e.salaireBrut + e.prime + e.avantages;
          const cp = total * 0.15;
          return [
            e.nom, e.poste,
            fmtMoney(e.salaireBrut), fmtMoney(e.prime + e.avantages),
            fmtMoney(total), fmtMoney(cp),
            fmtMoney(total + cp), fmtMoney((total + cp) * 12),
          ];
        }).concat([[
          'TOTAL', '',
          fmtMoney((employes||[]).reduce((s,e)=>s+e.salaireBrut,0)),
          fmtMoney((employes||[]).reduce((s,e)=>s+e.prime+e.avantages,0)),
          fmtMoney(totalSalairesBruts),
          fmtMoney(totalChargesSociales),
          fmtMoney(totalMasseSalariale),
          fmtMoney(totalMasseSalariale * 12),
        ]]),
        theme: 'striped',
        headStyles: { fillColor: [10, 80, 140], textColor: 255, fontSize: 6.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
          5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' },
        },
        margin: { left: M, right: M },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    } else {
      doc.setFontSize(8); doc.setTextColor(150, 150, 170);
      doc.text('Aucun employé enregistré.', M, y); y += 10;
    }

    // Plan amortissements
    checkY(20);
    sectionTitle('5. Plan d\'Amortissements des Immobilisations');
    if ((investissements || []).length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Désignation', 'Type', 'Valeur brute (FCFA)', 'Durée (ans)', 'Amort./mois (FCFA)', 'Amort./an (FCFA)', 'VNC estimée']],
        body: (investissements || []).map(inv => {
          const amMois = inv.amortissementAnnees > 0 ? inv.montant / inv.amortissementAnnees / 12 : 0;
          const amAn = amMois * 12;
          const vnc = Math.max(0, inv.montant - amAn);
          return [inv.nom, inv.type, fmtMoney(inv.montant), String(inv.amortissementAnnees),
            fmtMoney(amMois), fmtMoney(amAn), fmtMoney(vnc)];
        }).concat([[
          'TOTAL', '', fmtMoney(totalActifBrut), '',
          fmtMoney(amortissementMensuel), fmtMoney(amortAnnuel), fmtMoney(totalActifBrut - amortAnnuel),
        ]]),
        theme: 'striped',
        headStyles: { fillColor: [100, 70, 10], textColor: 255, fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5 },
        columnStyles: {
          2: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' },
        },
        margin: { left: M, right: M },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    } else {
      doc.setFontSize(8); doc.setTextColor(150, 150, 170);
      doc.text('Aucun investissement enregistré.', M, y); y += 10;
    }

    // ════════════════════════════════════════════════════════════
    // PAGE 5 — ACHATS + FISCAL + RATIOS
    // ════════════════════════════════════════════════════════════
    addPage();
    sectionTitle('6. Achats Fournisseurs', `Exercice ${exerciceAnnee}`);
    if (hasAchats && achatStats?.achatsParFournisseur && Object.keys(achatStats.achatsParFournisseur).length > 0) {
      const fournRows = Object.entries(achatStats.achatsParFournisseur)
        .sort(([,a],[,b]) => (b as number) - (a as number))
        .map(([name, amt], i) => {
          const pct = totalAchatsAnnuel > 0 ? ((amt as number) / totalAchatsAnnuel * 100).toFixed(2) : '—';
          return [String(i+1), name, fmtMoney(amt as number), pct + ' %', fmtMoney((amt as number) / 12)];
        });
      fournRows.push(['', 'TOTAL ACHATS ANNUELS', fmtMoney(totalAchatsAnnuel), '100,00 %', fmtMoney(totalAchatsMensuel)]);
      autoTable(doc, {
        startY: y,
        head: [['N°', 'Fournisseur', 'Total annuel (FCFA)', '% du total', 'Moy. mensuelle (FCFA)']],
        body: fournRows,
        theme: 'striped',
        headStyles: { fillColor: [0, 120, 80], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
        margin: { left: M, right: M },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    } else {
      doc.setFontSize(8); doc.setTextColor(150, 150, 170);
      doc.text('Aucun achat fournisseur enregistré pour cet exercice.', M, y); y += 10;
    }

    // Indicateurs fiscaux
    sectionTitle('7. Indicateurs Fiscaux — Obligations Déclaratives DGID');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(100, 100, 130);
    const centreText = db.centreImpots ? `Centre des Impôts : ${db.centreImpots}` : 'Centre des Impôts : [À compléter]';
    const dgidText   = db.numeroDGID   ? `  ·  N° DGID : ${db.numeroDGID}`         : '  ·  N° DGID : [À compléter]';
    doc.text(centreText + dgidText, M, y); y += 5;
    doc.text(`Régime TVA : ${db.regimeTVA === 'reel_normal' ? 'Réel Normal' : db.regimeTVA === 'reel_simplifie' ? 'Réel Simplifié' : db.regimeTVA}  ·  Périodicité : ${db.periodeDeclaration}  ·  Régime IS : ${db.regimeIS === 'normal' ? '30% normal' : db.regimeIS === 'pme' ? '15% PME' : db.regimeIS}`, M, y); y += 7;

    subTitle('TVA (Taxe sur la Valeur Ajoutée) — Taux standard 18% Sénégal');
    twoCol('Base imposable CA HT', fmtMoney(caAnnuel_));
    twoCol(`TVA collectée ${db.tvaCollecteeManuelle ? '(saisie manuelle)' : '(calculée 18%)'}`, fmtMoney(tvaCollecteeFinale));
    twoCol(`TVA déductible ${db.tvaDeductibleManuelle ? '(saisie manuelle)' : '(calculée 18%)'}`, fmtMoney(-tvaDeductibleFinale));
    separator();
    totalRow('TVA NETTE À REVERSER', fmtMoney(tvaNetteFinale), tvaNetteFinale <= 0);
    twoCol('TVA mensuelle moyenne à décaisser', fmtMoney(tvaNetteFinale / 12));
    y += 4;

    subTitle(`IS (Impôt sur les Sociétés) — Taux ${(tauxIS * 100).toFixed(0)}% (${db.regimeIS === 'pme' ? 'PME' : db.regimeIS === 'exonere' ? 'exonéré' : 'normal'})`);
    twoCol('Résultat comptable avant IS', fmtMoney(resultatAnnuel));
    twoCol('Résultat fiscal imposable', fmtMoney(Math.max(0, resultatAnnuel)));
    twoCol(`IS calculé (${(tauxIS * 100).toFixed(0)}%)`, fmtMoney(-isEstimeFinale));
    separator();
    totalRow('RÉSULTAT NET APRÈS IS', fmtMoney(resultatApresISFinal), resultatApresISFinal >= 0);
    y += 4;

    subTitle('AUTRES IMPÔTS & TAXES LOCALES');
    if (db.taxePatente) twoCol('Taxe de Patente', fmtMoney(parseFloat(db.taxePatente.replace(/\s/g,'')) || 0));
    if (db.cfce)        twoCol('CFCE (Contribution Foncière)', fmtMoney(parseFloat(db.cfce.replace(/\s/g,'')) || 0));
    if (db.tcs)         twoCol('TCS (Taxe sur Contrats Sous-traitance)', fmtMoney(parseFloat(db.tcs.replace(/\s/g,'')) || 0));
    if (db.autresImpots) twoCol('Autres impôts & taxes', fmtMoney(parseFloat(db.autresImpots.replace(/\s/g,'')) || 0));
    if (autresImpotsMontant > 0) {
      separator();
      totalRow('TOTAL AUTRES IMPÔTS & TAXES', fmtMoney(autresImpotsMontant), false);
    } else {
      twoCol('Aucun autre impôt déclaré', '0 FCFA');
    }
    y += 4;

    subTitle('COTISATIONS SOCIALES (IPRES / CSS)');
    if (db.numAffiliationIPRES) twoCol('N° Affiliation IPRES', db.numAffiliationIPRES);
    if (db.numAffiliationCSS)   twoCol('N° Affiliation CSS', db.numAffiliationCSS);
    const tauxIPRESVal = parseFloat(db.tauxIPRES || '8.4') / 100;
    const tauxCSSVal   = parseFloat(db.tauxCSS   || '5')   / 100;
    twoCol(`Cotisations IPRES retraite (${(tauxIPRESVal * 100).toFixed(1)}%)`, fmtMoney(salairesAnnuel * tauxIPRESVal));
    twoCol(`Cotisations CSS AT/MP (${(tauxCSSVal * 100).toFixed(1)}%)`, fmtMoney(salairesAnnuel * tauxCSSVal));
    twoCol('Charges patronales totales (15% brut)', fmtMoney(csAnnuel));
    separator();
    totalRow('TOTAL OBLIGATIONS SOCIALES ANNUELLES', fmtMoney(csAnnuel), false);
    y += 4;

    // Ratios
    sectionTitle('8. Ratios & Indicateurs de Performance');
    const ratios = [
      ['RENTABILITÉ', '', ''],
      ['Taux de marge brute (Marge brute / CA)', `${tauxMargeBruteAnn.toFixed(2)} %`, tauxMargeBruteAnn > 40 ? '✅ Bon' : tauxMargeBruteAnn > 20 ? '⚠️ Moyen' : '❌ Faible'],
      ['Taux d\'EBE / EBITDA (EBE / CA)', `${tauxEBE.toFixed(2)} %`, tauxEBE > 20 ? '✅ Excellent' : tauxEBE > 10 ? '✅ Bon' : tauxEBE > 0 ? '⚠️ Attention' : '❌ Déficitaire'],
      ['Taux de résultat net (Résultat / CA)', `${tauxResultat.toFixed(2)} %`, tauxResultat > 15 ? '✅ Excellent' : tauxResultat > 5 ? '✅ Bon' : tauxResultat >= 0 ? '⚠️ Faible' : '❌ Perte'],
      ['ROE — Retour sur capitaux propres', `${roe.toFixed(2)} %`, roe > 15 ? '✅ Bon' : '⚠️ À améliorer'],
      ['STRUCTURE', '', ''],
      ['Part masse salariale / CA', caAnnuel_ > 0 ? `${((salairesAnnuel + csAnnuel) / caAnnuel_ * 100).toFixed(2)} %` : '—', ''],
      ['Part achats / CA (taux appro)', caAnnuel_ > 0 ? `${(achatsAnnuel / caAnnuel_ * 100).toFixed(2)} %` : '—', ''],
      ['Part charges fixes / CA', caAnnuel_ > 0 ? `${(chargesAnnuel / caAnnuel_ * 100).toFixed(2)} %` : '—', ''],
      ['TRÉSORERIE', '', ''],
      ['CA mensuel moyen', fmtMoney(caMensuelReel), ''],
      ['Charges mensuelles totales (fixes + salaires)', fmtMoney(totalChargesGlobales + coutMarchandisesMensuel), ''],
      ['Point mort mensuel (charges / taux marge brute)', tauxMargeBruteAnn > 0 ? fmtMoney((totalChargesGlobales) / (tauxMargeBruteAnn / 100)) : '—', ''],
    ];
    autoTable(doc, {
      startY: y,
      head: [['Indicateur', 'Valeur', 'Appréciation']],
      body: ratios,
      theme: 'striped',
      headStyles: { fillColor: [80, 20, 120], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: { 1: { halign: 'right', cellWidth: 40 }, 2: { cellWidth: 35 } },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // ════════════════════════════════════════════════════════════
    // PAGE 6 — FLUX DE TRÉSORERIE + PRÉVISIONS
    // ════════════════════════════════════════════════════════════
    addPage();
    sectionTitle('9. Tableau de Flux de Trésorerie (Méthode Indirecte)');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(100, 100, 130);
    doc.text('Basé sur les données comptables et les informations saisies dans Données Bilan.', M, y); y += 7;

    subTitle('A. FLUX LIÉS À L\'EXPLOITATION');
    twoCol('Résultat net de l\'exercice', fmtMoney(resultatApresISFinal));
    twoCol('+ Dotations aux amortissements (non cash)', fmtMoney(amortAnnuel));
    const variationStocks = -(parseFloat(db.valeurStockBrut?.replace(/\s/g,'') || '0') || 0);
    twoCol('± Variation des stocks', fmtMoney(variationStocks));
    const variationCreances = -(parseFloat(db.creancesClients?.replace(/\s/g,'') || '0') || 0);
    twoCol('± Variation des créances clients', fmtMoney(variationCreances));
    const variationDettes = parseFloat(db.dettesFournisseurs?.replace(/\s/g,'') || '0') || 0;
    twoCol('± Variation des dettes fournisseurs', fmtMoney(variationDettes));
    twoCol('± Variation TVA nette', fmtMoney(-tvaNetteFinale / 12));
    separator();
    const cafVal = resultatApresISFinal + amortAnnuel + variationStocks + variationCreances + variationDettes;
    totalRow('CAPACITÉ D\'AUTOFINANCEMENT (CAF)', fmtMoney(cafVal), cafVal >= 0);
    y += 4;

    subTitle('B. FLUX LIÉS AUX INVESTISSEMENTS');
    twoCol('Acquisitions d\'immobilisations', fmtMoney(-totalActifBrut));
    const cautionVal = parseFloat(db.cautionBailCommercial?.replace(/\s/g,'') || '0') || 0;
    twoCol('Dépôts de garantie & cautions versés', fmtMoney(-cautionVal));
    twoCol('Cessions d\'immobilisations', fmtMoney(0));
    separator();
    totalRow('FLUX NET D\'INVESTISSEMENT', fmtMoney(-totalActifBrut - cautionVal), false);
    y += 4;

    subTitle('C. FLUX LIÉS AU FINANCEMENT');
    const capSocVal = parseFloat(db.capitalSocial?.replace(/\s/g,'') || '0') || 0;
    twoCol('Apports en capital', fmtMoney(capSocVal));
    const empruntsTotal = db.emprunts.reduce((s, e) => s + (parseFloat(e.montantInitial?.replace(/\s/g,'') || '0') || 0), 0);
    twoCol('Nouveaux emprunts bancaires', fmtMoney(empruntsTotal));
    twoCol('Remboursements d\'emprunts (annuel)', fmtMoney(-totalEcheancesMens * 12));
    const dividendesVal = parseFloat(db.dividendesVerses?.replace(/\s/g,'') || '0') || 0;
    twoCol('Dividendes versés aux associés', fmtMoney(-dividendesVal));
    separator();
    const fluxFinancement = capSocVal + empruntsTotal - totalEcheancesMens * 12 - dividendesVal;
    totalRow('FLUX NET DE FINANCEMENT', fmtMoney(fluxFinancement), fluxFinancement >= 0);
    y += 4;

    const variationTresorerie = cafVal + (-totalActifBrut - cautionVal) + fluxFinancement;
    doc.setDrawColor(10, 40, 80); doc.setLineWidth(0.6);
    doc.line(M, y, PW - M, y); y += 3;
    totalRow('VARIATION NETTE DE TRÉSORERIE (A+B+C)', fmtMoney(variationTresorerie), variationTresorerie >= 0);
    twoCol('Trésorerie d\'ouverture (soldes saisis)', fmtMoney(totalTresorerie));
    totalRow('TRÉSORERIE DE CLÔTURE ESTIMÉE', fmtMoney(totalTresorerie + variationTresorerie), (totalTresorerie + variationTresorerie) >= 0);
    y += 8;

    // Prévisions 5 ans
    sectionTitle('10. Prévisions & Plan de Développement 5 Ans', 'Hypothèses : CA +8%/an · Charges +3%/an · Achats +6%/an · Emprunts inclus');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(100, 100, 130);
    doc.text(`Base : CA annuel ${fmtMoney(caAnnuel_)} FCFA · Taux IS ${(tauxIS*100).toFixed(0)}% · Échéances mensuelles emprunts : ${fmtMoney(totalEcheancesMens)} FCFA/mois`, M, y); y += 6;
    doc.text('Projections à valider avec votre Expert-Comptable ONECCA-SN avant toute présentation bancaire.', M, y); y += 7;

    const prevRows = previsions.map((p, i) => {
      const achatsPrev   = Math.round(achatsAnnuel * Math.pow(1.06, i));
      const chargesPrev  = Math.round(chargesAnnuel * Math.pow(1.03, i));
      const salPrev      = Math.round((salairesAnnuel + csAnnuel) * Math.pow(1.03, i));
      const empRembPrev  = Math.round(totalEcheancesMens * 12 * Math.max(0, 1 - i * 0.2)); // emprunts diminuent
      const ebeP         = p.ca - achatsPrev - chargesPrev - salPrev;
      const resP         = ebeP - amortAnnuel;
      const isP          = Math.max(0, resP * tauxIS);
      const resNet       = resP - isP - empRembPrev;
      return [
        String(p.annee),
        fmtMoney(p.ca),
        fmtMoney(achatsPrev),
        fmtMoney(chargesPrev + salPrev),
        fmtMoney(ebeP),
        fmtMoney(resP),
        fmtMoney(isP),
        fmtMoney(empRembPrev),
        fmtMoney(resNet),
        i > 0 ? `+${p.croissance}%` : 'Base',
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Année', 'CA', 'Achats', 'Ch.+Sal.', 'EBE', 'Résultat', `IS ${(tauxIS*100).toFixed(0)}%`, 'Rembours.', 'Net final', 'Croiss.']],
      body: prevRows.length > 0 ? prevRows : [['—', '—', '—', '—', '—', '—', '—', '—', '—', '—']],
      theme: 'striped',
      headStyles: { fillColor: [10, 40, 80], textColor: 255, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 13, halign: 'center' },
        1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
        4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' },
        7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'center', cellWidth: 12 },
      },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // ════════════════════════════════════════════════════════════
    // PAGE 7 — ANNEXES : EMPRUNTS, CAPITAL, CRÉANCES, TRÉSORERIE
    // ════════════════════════════════════════════════════════════
    addPage();
    sectionTitle('11. Annexes Financières', 'Données saisies dans l\'onglet Données Bilan');

    // Tableau emprunts
    subTitle('ANNEXE A — Détail des Emprunts & Dettes Financières');
    if (donneesBilan.emprunts.some(e => e.libelle || e.soldeRestant)) {
      autoTable(doc, {
        startY: y,
        head: [['Objet', 'Banque', 'Montant initial', 'Solde restant', 'Échéance/mois', 'Début', 'Fin']],
        body: donneesBilan.emprunts.map(e => [
          e.libelle || '—', e.banque || '—',
          e.montantInitial ? fmtMoney(parseFloat(e.montantInitial.replace(/\s/g,'')) || 0) : '—',
          e.soldeRestant   ? fmtMoney(parseFloat(e.soldeRestant.replace(/\s/g,''))   || 0) : '—',
          e.echeanceMensuelle ? fmtMoney(parseFloat(e.echeanceMensuelle.replace(/\s/g,'')) || 0) : '—',
          e.dateDebut || '—', e.dateFin || '—',
        ]).concat([[
          'TOTAUX', '',
          fmtMoney(donneesBilan.emprunts.reduce((s,e) => s+(parseFloat(e.montantInitial?.replace(/\s/g,'')||'0')||0),0)),
          fmtMoney(totalEmpruntsSoldes),
          fmtMoney(totalEcheancesMens),
          '', '',
        ]]),
        theme: 'striped',
        headStyles: { fillColor: [180, 30, 50], textColor: 255, fontSize: 7, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5 },
        columnStyles: {
          2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
        },
        margin: { left: M, right: M },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    } else {
      twoCol('Aucun emprunt déclaré', '—'); y += 4;
    }

    // Capital & associés
    checkY(30);
    subTitle('ANNEXE B — Capital Social & Répartition entre Associés');
    if (donneesBilan.associes.some(a => a.nom)) {
      autoTable(doc, {
        startY: y,
        head: [['Associé / Actionnaire', 'Apport (FCFA)', '% Parts', 'Dividendes estimés (FCFA)']],
        body: donneesBilan.associes.map(a => {
          const apport = parseFloat(a.apport?.replace(/\s/g,'') || '0') || 0;
          const pct    = parseFloat(a.pourcentage || '0') || 0;
          const div    = dividendesVal * pct / 100;
          return [a.nom || '—', fmtMoney(apport), pct.toFixed(2) + ' %', fmtMoney(div)];
        }).concat([[
          'TOTAL', fmtMoney(totalCapitalSocial), '100,00 %', fmtMoney(dividendesVal),
        ]]),
        theme: 'striped',
        headStyles: { fillColor: [80, 20, 120], textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
        margin: { left: M, right: M },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    } else {
      twoCol('Aucun associé déclaré', '—'); y += 4;
    }

    if (db.reserveLegale || db.reportANouveau || db.dividendesVerses) {
      twoCol('Réserve légale constituée', db.reserveLegale ? fmtMoney(parseFloat(db.reserveLegale.replace(/\s/g,''))||0) + ' FCFA' : '—');
      twoCol('Report à nouveau', db.reportANouveau ? fmtMoney(parseFloat(db.reportANouveau.replace(/\s/g,''))||0) + ' FCFA' : '—');
      twoCol('Dividendes versés (exercice)', db.dividendesVerses ? fmtMoney(parseFloat(db.dividendesVerses.replace(/\s/g,''))||0) + ' FCFA' : '—');
      y += 4;
    }

    // Trésorerie détaillée
    checkY(40);
    subTitle('ANNEXE C — Trésorerie Disponible à la Date du Bilan');
    autoTable(doc, {
      startY: y,
      head: [['Support / Compte', 'Solde (FCFA)', 'Observation']],
      body: [
        ['Caisse (espèces)', db.soldeCaisse ? fmtMoney(parseFloat(db.soldeCaisse)||0) : '—', 'Numéraire disponible'],
        [`Compte bancaire — ${db.nomBanque || '[Banque]'}`, db.soldeBanque ? fmtMoney(parseFloat(db.soldeBanque)||0) : '—', db.numeroCpte ? 'N° ' + db.numeroCpte.slice(0,15) : ''],
        ['Wave Business', db.soldeWave ? fmtMoney(parseFloat(db.soldeWave)||0) : '—', 'Monnaie électronique'],
        ['Orange Money Business', db.soldeOrangeMoney ? fmtMoney(parseFloat(db.soldeOrangeMoney)||0) : '—', 'Monnaie électronique'],
        ['TOTAL TRÉSORERIE', fmtMoney(totalTresorerie), ''],
        ['Découvert autorisé (ligne de crédit)', db.decouvertAutorise ? fmtMoney(parseFloat(db.decouvertAutorise)||0) : '—', 'Capacité supplémentaire'],
      ],
      theme: 'striped',
      headStyles: { fillColor: [0, 120, 80], textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: 'right', cellWidth: 50 }, 2: { cellWidth: 60 } },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Créances & dettes
    checkY(40);
    subTitle('ANNEXE D — Créances & Dettes d\'Exploitation');
    autoTable(doc, {
      startY: y,
      head: [['Poste', 'Montant (FCFA)', 'Nature']],
      body: [
        ['CRÉANCES', '', ''],
        ['Créances clients — ardoises & impayés', db.creancesClients ? fmtMoney(parseFloat(db.creancesClients.replace(/\s/g,''))||0) : '0', 'À recouvrer'],
        ['Avances fournisseurs', db.creancesFournisseurs ? fmtMoney(parseFloat(db.creancesFournisseurs.replace(/\s/g,''))||0) : '0', ''],
        ['Avances personnel', db.avancesPersonnel ? fmtMoney(parseFloat(db.avancesPersonnel.replace(/\s/g,''))||0) : '0', ''],
        ['TOTAL CRÉANCES', fmtMoney(creancesTotal), ''],
        ['DETTES', '', ''],
        ['Dettes fournisseurs non réglées', db.dettesFournisseurs ? fmtMoney(parseFloat(db.dettesFournisseurs.replace(/\s/g,''))||0) : '0', 'À régler'],
        ['Autres dettes d\'exploitation', db.autresDettes ? fmtMoney(parseFloat(db.autresDettes.replace(/\s/g,''))||0) : '0', ''],
        ['TOTAL DETTES D\'EXPLOITATION', fmtMoney(dettesExplTotal), ''],
        ['POSITION NETTE (Créances - Dettes)', fmtMoney(creancesTotal - dettesExplTotal), creancesTotal >= dettesExplTotal ? '✅ Positive' : '⚠️ Négative'],
      ],
      theme: 'striped',
      headStyles: { fillColor: [20, 80, 150], textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: 'right', cellWidth: 50 } },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Stocks & garanties
    checkY(30);
    subTitle('ANNEXE E — Stocks & Garanties');
    const stockBrut = parseFloat(db.valeurStockBrut?.replace(/\s/g,'') || '0') || 0;
    const stockDep  = parseFloat(db.depreciationStock?.replace(/\s/g,'') || '0') || 0;
    twoCol('Valeur brute du stock (inventaire)', fmtMoney(stockBrut) + ' FCFA');
    twoCol('Dépréciation (provisions)', fmtMoney(-stockDep) + ' FCFA');
    separator();
    totalRow('VALEUR NETTE DES STOCKS', fmtMoney(stockNet) + ' FCFA', true);
    y += 4;
    twoCol('Caution bail commercial', fmtMoney(cautionVal) + ' FCFA');
    twoCol('Autres garanties', fmtMoney(parseFloat(db.autresGaranties?.replace(/\s/g,'')||'0')||0) + ' FCFA');
    totalRow('TOTAL DÉPÔTS & GARANTIES', fmtMoney(cautionsTotal) + ' FCFA', true);
    y += 8;

    // Conseillers
    checkY(30);
    subTitle('ANNEXE F — Intervenants & Conseillers');
    const conseillers = [
      ['Expert-Comptable ONECCA-SN', db.expertComptable || '[Non renseigné]'],
      ['Commissaire aux Comptes', db.commissaireComptes || '[Non renseigné]'],
      ['Conseiller Juridique', db.conseillerJuridique || '[Non renseigné]'],
      ['Centre des Impôts', db.centreImpots || '[Non renseigné]'],
      ['N° IPRES', db.numAffiliationIPRES || '[Non renseigné]'],
      ['N° CSS', db.numAffiliationCSS || '[Non renseigné]'],
    ];
    autoTable(doc, {
      startY: y,
      head: [['Intervenant', 'Coordonnées / Références']],
      body: conseillers,
      theme: 'plain',
      headStyles: { fillColor: [60, 60, 80], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' } },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Observations
    if (db.observations) {
      checkY(25);
      subTitle('ANNEXE G — Observations & Événements Exceptionnels');
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 70);
      const obsLines = doc.splitTextToSize(db.observations, CW - 10);
      checkY(obsLines.length * 5 + 8);
      doc.text(obsLines, M + 5, y);
      y += obsLines.length * 5 + 8;
    }

    // Note légale finale
    checkY(35);
    doc.setFillColor(245, 247, 255);
    doc.setDrawColor(150, 170, 220); doc.setLineWidth(0.4);
    doc.roundedRect(M, y, CW, 32, 2, 2, 'FD');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(10, 40, 80);
    doc.text('NOTE LÉGALE — AVERTISSEMENT', M + 5, y + 8);
    doc.setFillColor(0, 140, 80); doc.rect(M, y + 10, CW, 0.5, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(50, 50, 80);
    const noteLines = [
      'Ce document est produit par le logiciel BarFlow (gestion numérique des bars au Sénégal) à titre de bilan de gestion interne.',
      'Il est basé sur les données saisies par l\'utilisateur et ne constitue pas un bilan comptable légalement certifié.',
      'Pour toute présentation officielle (banque, DGID, IPRES, CSS, investisseurs, tribunal de commerce), ce document doit',
      'être validé, visé et certifié par un Expert-Comptable agréé membre de l\'ONECCA-SN — Ordre National des Experts',
      'Comptables et Comptables Agréés du Sénégal. BarFlow décline toute responsabilité en cas d\'usage non conforme.',
    ];
    noteLines.forEach((line, i) => { doc.text(line, M + 5, y + 15 + i * 4); });

    // Footers sur toutes les pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      // Mini drapeau SN en pied
      doc.setFillColor(0, 168, 89);  doc.rect(M, PH - 10, 8, 3, 'F');
      doc.setFillColor(255, 210, 0); doc.rect(M + 8, PH - 10, 8, 3, 'F');
      doc.setFillColor(227, 27, 35); doc.rect(M + 16, PH - 10, 8, 3, 'F');
      doc.setDrawColor(200, 200, 210); doc.setLineWidth(0.2);
      doc.line(M + 28, PH - 10, PW - M, PH - 10);
      doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 130, 150);
      doc.text(`BarFlow — ${f(db.raisonSociale, 'Établissement')} — Bilan Annuel ${exerciceAnnee} — Confidentiel`, M + 30, PH - 6.5);
      doc.text(`Page ${i} / ${totalPages}`, PW - M, PH - 6.5, { align: 'right' });
    }

    doc.save(`BarFlow_Bilan_Officiel_${exerciceAnnee}_${f(db.raisonSociale, 'etablissement').replace(/\s+/g,'_').slice(0,20)}.pdf`);
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center"> 
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4" /> 
          <p className="text-slate-600">Chargement...</p> 
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 bg-gradient-to-br from-slate-50 via-white to-slate-100 min-h-screen">
      {/* Indicateur sync */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg', isOnline ? 'bg-green-500 text-white' : 'bg-orange-500 text-white')}>
          {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
          <span className="text-sm">{isOnline ? 'En ligne' : 'Hors-ligne'}</span>
          {pendingSync > 0 && (
            <div className="flex items-center gap-1 ml-2"> 
              <RefreshCw size={12} className="animate-spin" /> 
              <span className="text-xs">{pendingSync}</span> 
            </div>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 lg:p-8 shadow-xl">
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">Bilan Financier</h1>
            <p className="text-emerald-100 mt-1 flex items-center gap-2"> <Activity size={14} /> Pilotage financier complet</p>
          </div>
          <button onClick={exportPDF} className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all flex items-center gap-2">
            <Download size={16} /> Exporter PDF
          </button>
        </div>
      </div>

      {/* Bandeaux état données */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {hasRealCA ? (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            <CheckCircle size={15} className="text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800 font-medium">CA réel — {realDailyStats!.length} jour(s) de ventes · <strong>{fmtMoney(caMensuelReel)} FCFA</strong></p>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
            <AlertCircle size={15} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 font-medium">Aucune vente enregistrée — CA = 0,00 FCFA</p>
          </div>
        )}
        {hasAchats ? (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            <CheckCircle size={15} className="text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800 font-medium">Achats réels — <strong>{fmtMoney(totalAchatsMensuel)} FCFA</strong>/mois · <strong>{fmtMoney(totalAchatsAnnuel)} FCFA</strong>/an</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
            <AlertCircle size={15} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 font-medium">Aucun achat fournisseur — allez dans Réapprovisionnement</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap gap-1 p-1 bg-white rounded-xl shadow-sm border border-slate-200">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn('flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                activeTab === tab.id
                  ? cn('bg-gradient-to-r text-white shadow-md', getNavGradient(tab.color))
                  : 'text-slate-600 hover:bg-slate-100')}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── APERÇU ─────────────────────────────────────────────── */}
      {activeTab === 'apercu' && (
        <div className="space-y-6">
          {/* KPIs principaux */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <DollarSign className="text-emerald-500 mb-2" size={24} />
              <p className="text-xs text-slate-500">CA mensuel {hasRealCA ? '✅' : '⚠️'}</p>
              <p className="text-2xl font-bold">{fmtMoney(caMensuelReel)} F</p>
              {!hasRealCA && <p className="text-[10px] text-amber-500 mt-1">Aucune vente enregistrée</p>}
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <ShoppingCart className="text-blue-500 mb-2" size={24} />
              <p className="text-xs text-slate-500">Achats/mois {hasAchats ? '✅' : '⚠️'}</p>
              <p className="text-2xl font-bold">{fmtMoney(coutMarchandisesMensuel)} F</p>
              {!hasAchats && <p className="text-[10px] text-amber-500 mt-1">Aucun achat enregistré</p>}
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <TrendingDown className="text-red-500 mb-2" size={24} />
              <p className="text-xs text-slate-500">Charges totales ✅</p>
              <p className="text-2xl font-bold">{fmtMoney(totalChargesGlobales)} F</p>
            </div>
            <div className={cn('bg-white rounded-2xl p-5 border', beneficeNet >= 0 ? 'border-emerald-200' : 'border-red-200')}>
              <TrendingUp className={beneficeNet >= 0 ? 'text-emerald-500' : 'text-red-500'} size={24} />
              <p className="text-xs text-slate-500">Résultat net</p>
              <p className={cn('text-2xl font-bold', beneficeNet >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {fmtSigned(beneficeNet)} F
              </p>
            </div>
          </div>

          {/* Compte de résultat synthétique */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2">
              <BarChart3 size={20} className="text-violet-500" /> Compte de résultat mensuel
            </h2>
            <div className="space-y-2">
              {[
                { label: 'Chiffre d\'Affaires', value: caMensuelReel, color: 'text-emerald-700', bg: 'bg-emerald-50', badge: hasRealCA ? '✅ réel' : '⚠️ vide', positive: true },
                { label: 'Achats fournisseurs', value: -coutMarchandisesMensuel, color: 'text-blue-700', bg: 'bg-blue-50', badge: hasAchats ? '✅ réel' : '⚠️ vide', positive: false },
                { label: 'Marge brute', value: margeBrute, color: margeBrute >= 0 ? 'text-emerald-700' : 'text-red-700', bg: margeBrute >= 0 ? 'bg-emerald-100' : 'bg-red-100', badge: `${tauxMargeBrute.toFixed(2)}%`, positive: margeBrute >= 0 },
                { label: 'Charges diverses', value: -totalChargesMensuelles, color: 'text-red-700', bg: 'bg-red-50', badge: '✅ réel', positive: false },
                { label: 'Salaires et primes (Brut)', value: -totalSalairesBruts, color: 'text-red-700', bg: 'bg-red-50', badge: '✅ réel', positive: false },
                { label: 'Charges sociales (15%)', value: -totalChargesSociales, color: 'text-red-700', bg: 'bg-red-50', badge: '✅ estimé', positive: false },
                { label: 'Amortissements', value: -amortissementMensuel, color: 'text-amber-700', bg: 'bg-amber-50', badge: '', positive: false },
                { label: 'Résultat net', value: beneficeNet, color: beneficeNet >= 0 ? 'text-emerald-700 font-bold text-xl' : 'text-red-700 font-bold text-xl', bg: beneficeNet >= 0 ? 'bg-emerald-100' : 'bg-red-100', badge: `${margeBeneficiaire.toFixed(2)}%`, positive: beneficeNet >= 0 },
              ].map((row, i) => (
                <div key={i} className={cn('flex items-center justify-between p-3 rounded-xl', row.bg)}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-700">{row.label}</span>
                    {row.badge && <span className="text-[10px] bg-white/70 px-2 py-0.5 rounded-full text-slate-600">{row.badge}</span>}
                  </div>
                  <span className={cn('font-semibold', row.color)}>
                    {fmtSigned(row.value)} F
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2">
                <PieChartIcon size={20} className="text-violet-500" /> Répartition des charges
              </h2>
              {chargesParCategorie.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-slate-400"> <p className="text-sm">Aucune charge enregistrée</p> </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chargesParCategorie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {chargesParCategorie.map((_, idx) => (<Cell key={idx} fill={colors[idx % colors.length]} />))}
                      </Pie>
                      <Tooltip formatter={(value: number) => fmtMoney(value) + ' F'} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2">
                <BarChart3 size={20} className="text-emerald-500" /> Évolution CA vs Bénéfice (prévisions)
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={previsions}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="annee" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v: number) => (v/1000).toFixed(0) + 'k'} />
                    <Tooltip formatter={(value: number) => fmtMoney(value) + ' F'} />
                    <Line type="monotone" dataKey="ca" stroke="#10B981" strokeWidth={2} name="CA" dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="benefice" stroke="#8B5CF6" strokeWidth={2} name="Bénéfice" dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CHARGES ────────────────────────────────────────────── */}
      {activeTab === 'charges' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-gradient-to-r from-rose-50 to-white flex justify-between items-center">
            <h2 className="font-semibold text-rose-700 flex items-center gap-2"> <TrendingDown size={18} /> Charges </h2>
            <button onClick={() => openChargeForm()} className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-bold hover:bg-rose-600">+ Ajouter</button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50"> 
              <tr> 
                <th className="p-3 text-left">Nom</th> 
                <th className="p-3 text-left">Catégorie</th> 
                <th className="p-3 text-center">Périodicité</th> 
                <th className="p-3 text-right">Montant saisi</th> 
                <th className="p-3 text-right">Équiv. Mensuel</th> 
                <th className="p-3 text-center">Actions</th> 
              </tr> 
            </thead>
            <tbody>
              {(charges || []).map(c => (
                <tr key={c.id} className="border-t hover:bg-slate-50">
                  <td className="p-3">{c.nom}</td> 
                  <td className="p-3 capitalize">{c.categorie}</td>
                  <td className="p-3 text-center capitalize text-slate-600">{c.periodicite || 'mensuel'}</td>
                  <td className="p-3 text-right">{fmtMoney(c.montantMensuel)} F</td>
                  <td className="p-3 text-right font-bold text-rose-600">{fmtMoney(getMonthlyAmount(c))} F</td>
                  <td className="p-3 text-center"> 
                    <button onClick={() => openChargeForm(c)} className="text-blue-500 mr-2"> <Edit3 size={16} /> </button> 
                    <button onClick={() => deleteCharge(c.id)} className="text-red-500"> <Trash2 size={16} /> </button> 
                  </td>
                </tr>
              ))}
              {(charges || []).length === 0 && <tr> <td colSpan={6} className="p-8 text-center text-slate-400">Aucune charge enregistrée</td> </tr>}
              {(charges || []).length > 0 && (
                <tr className="border-t bg-rose-50 font-bold"> 
                  <td className="p-3" colSpan={4}>Total Mensuel Équivalent</td> 
                  <td className="p-3 text-right text-rose-600">{fmtMoney(totalChargesMensuelles)} F</td> 
                  <td /> 
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── SALAIRES ───────────────────────────────────────────── */}
      {activeTab === 'salaires' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-white flex justify-between items-center">
              <h2 className="font-semibold text-blue-700 flex items-center gap-2"> <Users size={18} /> Employés </h2>
              <button onClick={() => openEmployeForm()} className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold hover:bg-blue-600">+ Ajouter</button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50"> 
                <tr> 
                  <th className="p-3 text-left">Employé</th> 
                  <th className="p-3 text-left">Poste</th> 
                  <th className="p-3 text-right">Salaire Brut</th> 
                  <th className="p-3 text-right">Primes & Av.</th> 
                  <th className="p-3 text-right">Total</th> 
                  <th className="p-3 text-center">Actions</th> 
                </tr> 
              </thead>
              <tbody>
                {(employes || []).map(e => {
                  const total = e.salaireBrut + e.prime + e.avantages;
                  return (
                    <tr key={e.id} className="border-t hover:bg-slate-50">
                      <td className="p-3 font-medium">{e.nom}</td> 
                      <td className="p-3 text-slate-600">{e.poste}</td>
                      <td className="p-3 text-right">{fmtMoney(e.salaireBrut)} F</td>
                      <td className="p-3 text-right text-slate-600">{fmtMoney(e.prime + e.avantages)} F</td>
                      <td className="p-3 text-right font-bold text-blue-600">{fmtMoney(total)} F</td>
                      <td className="p-3 text-center"> 
                        <button onClick={() => openEmployeForm(e)} className="text-blue-500 mr-2"> <Edit3 size={16} /> </button> 
                        <button onClick={() => deleteEmploye(e.id)} className="text-red-500"> <Trash2 size={16} /> </button> 
                      </td>
                    </tr>
                  );
                })}
                {(employes || []).length === 0 && <tr> <td colSpan={6} className="p-8 text-center text-slate-400">Aucun employé enregistré</td> </tr>}
              </tbody>
            </table>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-200 text-sm">
            <div className="flex justify-between mb-1"> 
              <span className="font-semibold text-blue-800">Total Salaires et Primes (Brut)</span> 
              <span className="text-xl font-bold text-blue-700">{fmtMoney(totalSalairesBruts)} F</span> 
            </div>
            <div className="flex justify-between mb-1"> 
              <span className="text-slate-600">Charges sociales patronales estimées (15%)</span> 
              <span className="font-semibold text-slate-700">{fmtMoney(totalChargesSociales)} F</span> 
            </div>
            <div className="flex justify-between pt-2 border-t border-blue-200 mt-2"> 
              <span className="font-bold text-blue-900">Masse Salariale Totale (Coût employeur)</span> 
              <span className="text-xl font-bold text-blue-900">{fmtMoney(totalMasseSalariale)} F</span> 
            </div>
          </div>
        </div>
      )}

      {/* ── INVESTISSEMENTS ────────────────────────────────────── */}
      {activeTab === 'investissements' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-gradient-to-r from-amber-50 to-white flex justify-between items-center">
            <h2 className="font-semibold text-amber-700 flex items-center gap-2"> <Building2 size={18} /> Investissements </h2>
            <button onClick={() => openInvestForm()} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600">+ Ajouter</button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50"> 
              <tr> 
                <th className="p-3 text-left">Nom</th> 
                <th className="p-3 text-left">Type</th> 
                <th className="p-3 text-right">Montant</th> 
                <th className="p-3 text-center">Amort.</th> 
                <th className="p-3 text-center">Actions</th> 
              </tr> 
            </thead>
            <tbody>
              {(investissements || []).map(inv => (
                <tr key={inv.id} className="border-t hover:bg-slate-50">
                  <td className="p-3">{inv.nom}</td> 
                  <td className="p-3 capitalize">{inv.type}</td>
                  <td className="p-3 text-right font-bold">{fmtMoney(inv.montant)} F</td>
                  <td className="p-3 text-center">{inv.amortissementAnnees} ans</td>
                  <td className="p-3 text-center"> 
                    <button onClick={() => openInvestForm(inv)} className="text-blue-500 mr-2"> <Edit3 size={16} /> </button> 
                    <button onClick={() => deleteInvest(inv.id)} className="text-red-500"> <Trash2 size={16} /> </button> 
                  </td>
                </tr>
              ))}
              {(investissements || []).length === 0 && <tr> <td colSpan={5} className="p-8 text-center text-slate-400">Aucun investissement</td> </tr>}
            </tbody>
          </table>
          {(investissements || []).length > 0 && (
            <div className="p-4 bg-amber-50 border-t border-amber-200 text-sm">
              <div className="flex justify-between"> 
                <span className="font-semibold text-amber-800">Amortissement mensuel total (impact résultat)</span> 
                <span className="text-xl font-bold text-amber-700">{fmtMoney(amortissementMensuel)} F</span> 
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ACHATS FOURNISSEURS ────────────────────────────────── */}
      {activeTab === 'achats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <ShoppingCart className="text-emerald-500 mb-2" size={24} />
              <p className="text-xs text-slate-500">Achats ce mois</p>
              <p className="text-2xl font-bold">{fmtMoney(totalAchatsMensuel)} F</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <ShoppingCart className="text-blue-500 mb-2" size={24} />
              <p className="text-xs text-slate-500">Achats cette année</p>
              <p className="text-2xl font-bold">{fmtMoney(totalAchatsAnnuel)} F</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <TrendingUp className="text-violet-500 mb-2" size={24} />
              <p className="text-xs text-slate-500">Taux coût marchandise</p>
              <p className="text-2xl font-bold">{caMensuelReel > 0 ? (coutMarchandisesMensuel / caMensuelReel * 100).toFixed(2) : '—'}%</p>
            </div>
          </div>

          {hasAchats && achatStats?.achatsParMois && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2"> <BarChart3 size={20} className="text-emerald-500" /> Achats mensuels (12 mois) </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={achatStats.achatsParMois}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [fmtMoney(v) + ' FCFA', 'Achats']} />
                    <Bar dataKey="montant" fill="#10B981" radius={[6, 6, 0, 0]} name="Achats (FCFA)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {hasAchats && achatStats?.achatsParFournisseur && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b bg-gradient-to-r from-emerald-50 to-white">
                <h2 className="font-semibold text-emerald-700 flex items-center gap-2"> <Building2 size={18} /> Achats par fournisseur (année en cours) </h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50"> 
                  <tr> 
                    <th className="p-3 text-left">Fournisseur</th> 
                    <th className="p-3 text-right">Total achats</th> 
                    <th className="p-3 text-right">% des achats</th> 
                  </tr> 
                </thead>
                <tbody>
                  {Object.entries(achatStats.achatsParFournisseur).sort(([,a],[,b]) => (b as number) - (a as number)).map(([name, amount], i) => (
                    <tr key={i} className="border-t hover:bg-slate-50">
                      <td className="p-3 font-medium">{name}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">{fmtMoney(amount as number)} F</td>
                      <td className="p-3 text-right text-slate-500">{totalAchatsAnnuel > 0 ? ((amount as number) / totalAchatsAnnuel * 100).toFixed(2) : '—'}%</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-emerald-50 font-bold">
                    <td className="p-3">Total</td>
                    <td className="p-3 text-right text-emerald-700">{fmtMoney(totalAchatsAnnuel)} F</td>
                    <td className="p-3 text-right">100,00%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {!hasAchats && (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200">
              <ShoppingCart size={48} className="mb-4 text-slate-200" />
              <p className="text-lg font-semibold text-slate-500">Aucun achat enregistré</p>
              <p className="text-sm text-slate-400 mt-2">Créez des commandes fournisseurs dans l'onglet Réapprovisionnement</p>
            </div>
          )}
        </div>
      )}

      {/* ── PRÉVISIONS ─────────────────────────────────────────── */}
      {activeTab === 'previsions' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-semibold text-emerald-700 text-lg flex items-center gap-2"> <Target size={20} /> Prévisions sur 5 ans </h2>
              {!hasRealCA && <p className="text-xs text-amber-600 mt-1">⚠️ Basées sur CA = 0,00 — enregistrez des ventes pour des prévisions réalistes</p>}
            </div>
            <button onClick={genererPrevisions} disabled={isGenerating} className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold flex items-center gap-2 hover:bg-emerald-600">
              <RefreshCw size={16} className={isGenerating ? 'animate-spin' : ''} />
              {isGenerating ? 'Recalcul...' : 'Recalculer'}
            </button>
          </div>
          {previsions.length > 0 && (
            <>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50"> 
                    <tr> 
                      <th className="p-3 text-left">Année</th> 
                      <th className="p-3 text-right">CA (FCFA)</th> 
                      <th className="p-3 text-right">Achats (FCFA)</th> 
                      <th className="p-3 text-right">Charges Tot.</th> 
                      <th className="p-3 text-right">Bénéfice</th> 
                      <th className="p-3 text-center">Croissance</th> 
                    </tr> 
                  </thead>
                  <tbody>
                    {previsions.map(p => (
                      <tr key={p.annee} className="border-t hover:bg-slate-50">
                        <td className="p-3 font-bold">{p.annee}</td>
                        <td className="p-3 text-right">{fmtMoney(p.ca)} F</td>
                        <td className="p-3 text-right text-blue-600">{fmtMoney(Math.round(totalAchatsAnnuel * Math.pow(1.06, p.annee - new Date().getFullYear())))} F</td>
                        <td className="p-3 text-right">{fmtMoney(p.charges)} F</td>
                        <td className={cn('p-3 text-right font-bold', p.benefice >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                          {fmtSigned(p.benefice)} F
                        </td>
                        <td className="p-3 text-center"> 
                          <span className={cn('px-2 py-1 rounded-full text-xs font-bold', p.croissance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                            {p.croissance >= 0 ? '+' : ''}{p.croissance}%
                          </span> 
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2"> <BarChart3 size={20} className="text-emerald-500" /> Projection CA 5 ans </h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={previsions}>
                      <defs>
                        <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="annee" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v: number) => (v/1000).toFixed(0) + 'k'} />
                      <Tooltip formatter={(value: number) => fmtMoney(value) + ' F'} />
                      <Area type="monotone" dataKey="ca" stroke="#10B981" strokeWidth={2} fill="url(#caGrad)" name="CA prévu (FCFA)" />
                      <Area type="monotone" dataKey="benefice" stroke="#8B5CF6" strokeWidth={2} fill="none" name="Bénéfice prévu (FCFA)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
                <p className="font-semibold">📊 Hypothèses de calcul :</p>
                <p>• CA : +8%/an · Achats fournisseurs : +6%/an · Charges totales : +3%/an</p>
                {!hasRealCA && <p className="text-amber-600 font-semibold">⚠️ CA de base = 0,00 — enregistrez des ventes pour des prévisions réalistes</p>}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── DONNÉES BILAN ──────────────────────────────────────── */}
      {activeTab === 'donnees_bilan' && (
        <div className="space-y-6 pb-10">

          {/* Bandeau sauvegarde */}
          {bilanSaved && (
            <div className="fixed top-20 right-4 z-50 flex items-center gap-2 bg-emerald-500 text-white px-4 py-2.5 rounded-xl shadow-xl animate-fade-in-up">
              <CheckCircle size={16} /> Données sauvegardées automatiquement
            </div>
          )}

          {/* Header section */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-3 mb-1">
              <Landmark size={22} />
              <h2 className="text-xl font-bold">Données Financières Complémentaires</h2>
            </div>
            <p className="text-violet-200 text-sm">Ces informations complètent votre bilan pour les banques, la DGID, l'IPRES, la CSS et vos partenaires financiers. Sauvegarde automatique à chaque saisie.</p>
          </div>

          {/* ── 1. IDENTIFICATION ─────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center"><FileText size={16} className="text-violet-600" /></div>
              <h3 className="font-bold text-slate-800">1. Identification Légale de l'Établissement</h3>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Raison sociale / Nom commercial *', field: 'raisonSociale', placeholder: 'Ex: Bar Le Teranga SARL' },
                { label: 'Forme juridique *', field: 'formeJuridique', placeholder: 'SARL, SAS, SA, EI, GIE...' },
                { label: 'Adresse complète *', field: 'adresse', placeholder: 'N° rue, quartier, commune, Dakar' },
                { label: 'Téléphone', field: 'telephone', placeholder: '+221 77 XXX XX XX' },
                { label: 'Email professionnel', field: 'email', placeholder: 'contact@votrebar.sn' },
                { label: 'N° NINEA (Identifiant Fiscal) *', field: 'ninea', placeholder: '0000000 0A 0000' },
                { label: 'Registre de Commerce (RC) *', field: 'registreCommerce', placeholder: 'SN DKR 2024 X XXX' },
                { label: 'Nom du Gérant / Responsable légal', field: 'gerant', placeholder: 'Prénom NOM' },
                { label: 'Date de création', field: 'dateCreation', placeholder: 'JJ/MM/AAAA' },
                { label: 'Capital social (FCFA)', field: 'capitalSocial', placeholder: '1 000 000' },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">{label}</label>
                  <input
                    type="text" value={(donneesBilan as any)[field]} placeholder={placeholder}
                    onChange={e => updateDB(field, e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── 2. BANQUE ─────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 bg-gradient-to-r from-blue-50 to-white border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><Banknote size={16} className="text-blue-600" /></div>
              <h3 className="font-bold text-slate-800">2. Coordonnées Bancaires</h3>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Nom de la banque', field: 'nomBanque', placeholder: 'SGBS, BIS, CBAO, Ecobank, UBA...' },
                { label: 'Numéro de compte', field: 'numeroCpte', placeholder: 'XXXXXXXXXXXXXXXXX' },
                { label: 'IBAN / RIB', field: 'iban', placeholder: 'SN XX XXXX XXXX XXXX XXXX XXXX XXX' },
                { label: 'Code SWIFT / BIC', field: 'swift', placeholder: 'XXXXXXXX' },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">{label}</label>
                  <input
                    type="text" value={(donneesBilan as any)[field]} placeholder={placeholder}
                    onChange={e => updateDB(field, e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── 3. EMPRUNTS & DETTES FINANCIÈRES ─────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-rose-50 to-white border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center"><CreditCard size={16} className="text-rose-600" /></div>
                <h3 className="font-bold text-slate-800">3. Emprunts & Dettes Financières</h3>
              </div>
              <button onClick={addEmprunt} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 text-white text-xs font-bold rounded-lg hover:bg-rose-600">
                <Plus size={14} /> Ajouter un emprunt
              </button>
            </div>
            <div className="p-5 space-y-4">
              {donneesBilan.emprunts.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">Aucun emprunt enregistré</p>
              )}
              {donneesBilan.emprunts.map((emp, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">Emprunt #{idx + 1}</span>
                    {donneesBilan.emprunts.length > 1 && (
                      <button onClick={() => removeEmprunt(idx)} className="text-red-400 hover:text-red-600"><X size={16} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { label: 'Objet / libellé', field: 'libelle', placeholder: 'Ex: Crédit équipement cuisine' },
                      { label: 'Banque prêteuse', field: 'banque', placeholder: 'SGBS, BIS...' },
                      { label: 'Montant initial (FCFA)', field: 'montantInitial', placeholder: '5 000 000' },
                      { label: 'Solde restant dû (FCFA)', field: 'soldeRestant', placeholder: '3 200 000' },
                      { label: 'Échéance mensuelle (FCFA)', field: 'echeanceMensuelle', placeholder: '85 000' },
                      { label: 'Date de début', field: 'dateDebut', placeholder: 'MM/AAAA' },
                      { label: 'Date de fin', field: 'dateFin', placeholder: 'MM/AAAA' },
                    ].map(({ label, field, placeholder }) => (
                      <div key={field}>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">{label}</label>
                        <input
                          type="text" value={(emp as any)[field]} placeholder={placeholder}
                          onChange={e => updateEmprunt(idx, field, e.target.value)}
                          className="w-full p-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300/40 focus:border-rose-400"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {/* Récapitulatif automatique */}
              {donneesBilan.emprunts.some(e => e.soldeRestant) && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex justify-between text-sm">
                  <span className="font-semibold text-rose-800">Total dettes financières (soldes restants)</span>
                  <span className="font-bold text-rose-700">
                    {fmtMoney(donneesBilan.emprunts.reduce((s, e) => s + (parseFloat(e.soldeRestant.replace(/\s/g,'')) || 0), 0))} FCFA
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── 4. FISCAL — TVA & IS ─────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 bg-gradient-to-r from-amber-50 to-white border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center"><Receipt size={16} className="text-amber-600" /></div>
              <h3 className="font-bold text-slate-800">4. Situation Fiscale — DGID Sénégal</h3>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Centre des Impôts compétent', field: 'centreImpots', placeholder: 'Centre des Grandes Entreprises / CDI...' },
                  { label: 'Numéro DGID / dossier fiscal', field: 'numeroDGID', placeholder: 'XXXXXXXXX' },
                ].map(({ label, field, placeholder }) => (
                  <div key={field}>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">{label}</label>
                    <input type="text" value={(donneesBilan as any)[field]} placeholder={placeholder}
                      onChange={e => updateDB(field, e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/40 focus:border-amber-400" />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">Régime TVA</label>
                  <select value={donneesBilan.regimeTVA} onChange={e => updateDB('regimeTVA', e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300/40">
                    <option value="reel_normal">Réel Normal (CA &gt; 50M)</option>
                    <option value="reel_simplifie">Réel Simplifié (CA 5–50M)</option>
                    <option value="non_assujetti">Non assujetti</option>
                    <option value="franchise">Franchise de base</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">Périodicité déclaration TVA</label>
                  <select value={donneesBilan.periodeDeclaration} onChange={e => updateDB('periodeDeclaration', e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300/40">
                    <option value="mensuelle">Mensuelle</option>
                    <option value="trimestrielle">Trimestrielle</option>
                    <option value="annuelle">Annuelle</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">Régime d'imposition IS</label>
                  <select value={donneesBilan.regimeIS} onChange={e => updateDB('regimeIS', e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300/40">
                    <option value="normal">Taux normal (30%)</option>
                    <option value="pme">PME réduit (15%)</option>
                    <option value="forfait">Forfait</option>
                    <option value="exonere">Exonéré</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">TVA collectée réelle (si connue, FCFA/an)</label>
                  <input type="text" value={donneesBilan.tvaCollecteeManuelle} placeholder="Laisser vide = calcul auto 18%"
                    onChange={e => updateDB('tvaCollecteeManuelle', e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/40" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">TVA déductible réelle (si connue, FCFA/an)</label>
                  <input type="text" value={donneesBilan.tvaDeductibleManuelle} placeholder="Laisser vide = calcul auto 18%"
                    onChange={e => updateDB('tvaDeductibleManuelle', e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/40" />
                </div>
              </div>

              {/* Autres impôts & taxes */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">Autres Impôts & Taxes</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: 'Taxe de Patente (FCFA/an)', field: 'taxePatente', placeholder: 'Selon activité et commune' },
                    { label: 'CFCE — Contribution Foncière des Propriétés Bâties (FCFA/an)', field: 'cfce', placeholder: 'Si propriétaire local' },
                    { label: 'TCS — Taxe sur les Contrats de Sous-traitance (FCFA)', field: 'tcs', placeholder: '' },
                    { label: 'Autres impôts & taxes (FCFA/an)', field: 'autresImpots', placeholder: 'Préciser' },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field}>
                      <label className="text-xs font-semibold text-slate-600 block mb-1.5">{label}</label>
                      <input type="text" value={(donneesBilan as any)[field]} placeholder={placeholder}
                        onChange={e => updateDB(field, e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/40" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── 5. IPRES / CSS ───────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 bg-gradient-to-r from-blue-50 to-white border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><ShieldCheck size={16} className="text-blue-600" /></div>
              <h3 className="font-bold text-slate-800">5. Organismes Sociaux — IPRES & CSS</h3>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'N° Affiliation IPRES', field: 'numAffiliationIPRES', placeholder: 'XX-XXXXXXX' },
                { label: 'N° Affiliation CSS', field: 'numAffiliationCSS', placeholder: 'XX-XXXXXXX' },
                { label: 'Taux cotisation IPRES (%)', field: 'tauxIPRES', placeholder: '8.4' },
                { label: 'Taux cotisation CSS — AT/MP (%)', field: 'tauxCSS', placeholder: '5' },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">{label}</label>
                  <input type="text" value={(donneesBilan as any)[field]} placeholder={placeholder}
                    onChange={e => updateDB(field, e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300/40 focus:border-blue-400" />
                </div>
              ))}
              <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                <p className="font-semibold mb-1">📌 Rappel obligations IPRES / CSS au Sénégal</p>
                <p>IPRES : cotisations retraite dues pour tout salarié permanent. CSS : assurance maladie, accidents du travail et maternité. Déclarations et versements mensuels avant le 15 du mois suivant.</p>
              </div>
            </div>
          </div>

          {/* ── 6. TRÉSORERIE COMPLÉMENTAIRE ─────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 bg-gradient-to-r from-emerald-50 to-white border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><Banknote size={16} className="text-emerald-600" /></div>
              <h3 className="font-bold text-slate-800">6. Trésorerie Réelle à la Date du Bilan</h3>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Solde caisse (espèces en caisse, FCFA)', field: 'soldeCaisse', placeholder: '0' },
                { label: 'Solde compte bancaire (FCFA)', field: 'soldeBanque', placeholder: '0' },
                { label: 'Solde Wave Business (FCFA)', field: 'soldeWave', placeholder: '0' },
                { label: 'Solde Orange Money (FCFA)', field: 'soldeOrangeMoney', placeholder: '0' },
                { label: 'Découvert autorisé par la banque (FCFA)', field: 'decouvertAutorise', placeholder: '0' },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">{label}</label>
                  <input type="number" value={(donneesBilan as any)[field]} placeholder={placeholder}
                    onChange={e => updateDB(field, e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300/40 focus:border-emerald-400" />
                </div>
              ))}
              {/* Total trésorerie */}
              {[donneesBilan.soldeCaisse, donneesBilan.soldeBanque, donneesBilan.soldeWave, donneesBilan.soldeOrangeMoney].some(v => v) && (
                <div className="md:col-span-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex justify-between text-sm">
                  <span className="font-semibold text-emerald-800">Total trésorerie disponible</span>
                  <span className="font-bold text-emerald-700 text-base">
                    {fmtMoney([donneesBilan.soldeCaisse, donneesBilan.soldeBanque, donneesBilan.soldeWave, donneesBilan.soldeOrangeMoney]
                      .reduce((s, v) => s + (parseFloat(v) || 0), 0))} FCFA
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── 7. CAPITAL & ASSOCIÉS ────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-50 to-white border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center"><Users size={16} className="text-violet-600" /></div>
                <h3 className="font-bold text-slate-800">7. Capital Social & Associés</h3>
              </div>
              <button onClick={addAssocie} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 text-white text-xs font-bold rounded-lg hover:bg-violet-600">
                <Plus size={14} /> Ajouter un associé
              </button>
            </div>
            <div className="p-5 space-y-4">
              {donneesBilan.associes.map((asso, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">Associé #{idx + 1}</span>
                    {donneesBilan.associes.length > 1 && (
                      <button onClick={() => removeAssocie(idx)} className="text-red-400 hover:text-red-600"><X size={16} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Nom complet', field: 'nom', placeholder: 'Prénom NOM' },
                      { label: 'Apport au capital (FCFA)', field: 'apport', placeholder: '500 000' },
                      { label: 'Pourcentage de parts (%)', field: 'pourcentage', placeholder: '50' },
                    ].map(({ label, field, placeholder }) => (
                      <div key={field}>
                        <label className="text-xs font-semibold text-slate-600 block mb-1">{label}</label>
                        <input type="text" value={(asso as any)[field]} placeholder={placeholder}
                          onChange={e => updateAssocie(idx, field, e.target.value)}
                          className="w-full p-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300/40" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {[
                  { label: 'Dividendes versés (FCFA/an)', field: 'dividendesVerses', placeholder: '0' },
                  { label: 'Réserve légale (FCFA)', field: 'reserveLegale', placeholder: '0' },
                  { label: 'Report à nouveau (FCFA)', field: 'reportANouveau', placeholder: '0' },
                ].map(({ label, field, placeholder }) => (
                  <div key={field}>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">{label}</label>
                    <input type="text" value={(donneesBilan as any)[field]} placeholder={placeholder}
                      onChange={e => updateDB(field, e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300/40" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── 8. CRÉANCES & DETTES D'EXPLOITATION ─────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 bg-gradient-to-r from-orange-50 to-white border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center"><Scale size={16} className="text-orange-600" /></div>
              <h3 className="font-bold text-slate-800">8. Créances & Dettes d'Exploitation</h3>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-3">CRÉANCES (ce qu'on vous doit)</p>
                {[
                  { label: 'Créances clients — ardoises & factures impayées (FCFA)', field: 'creancesClients', placeholder: '0' },
                  { label: 'Avances & acomptes versés aux fournisseurs (FCFA)', field: 'creancesFournisseurs', placeholder: '0' },
                  { label: 'Avances accordées au personnel (FCFA)', field: 'avancesPersonnel', placeholder: '0' },
                ].map(({ label, field, placeholder }) => (
                  <div key={field} className="mb-3">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">{label}</label>
                    <input type="text" value={(donneesBilan as any)[field]} placeholder={placeholder}
                      onChange={e => updateDB(field, e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300/40" />
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-3">DETTES (ce que vous devez)</p>
                {[
                  { label: 'Dettes fournisseurs non réglées (FCFA)', field: 'dettesFournisseurs', placeholder: '0' },
                  { label: 'Autres dettes d\'exploitation (FCFA)', field: 'autresDettes', placeholder: '0' },
                ].map(({ label, field, placeholder }) => (
                  <div key={field} className="mb-3">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">{label}</label>
                    <input type="text" value={(donneesBilan as any)[field]} placeholder={placeholder}
                      onChange={e => updateDB(field, e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-300/40" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── 9. STOCKS & GARANTIES ────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 bg-gradient-to-r from-teal-50 to-white border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center"><BookOpen size={16} className="text-teal-600" /></div>
              <h3 className="font-bold text-slate-800">9. Stocks & Garanties</h3>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Valeur brute du stock (inventaire physique, FCFA)', field: 'valeurStockBrut', placeholder: '0' },
                { label: 'Dépréciation du stock (provisions, FCFA)', field: 'depreciationStock', placeholder: '0' },
                { label: 'Caution versée pour le bail commercial (FCFA)', field: 'cautionBailCommercial', placeholder: '0' },
                { label: 'Autres garanties et cautions (FCFA)', field: 'autresGaranties', placeholder: '0' },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">{label}</label>
                  <input type="text" value={(donneesBilan as any)[field]} placeholder={placeholder}
                    onChange={e => updateDB(field, e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300/40" />
                </div>
              ))}
            </div>
          </div>

          {/* ── 10. CONSEILLERS & OBSERVATIONS ──────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><Info size={16} className="text-slate-600" /></div>
              <h3 className="font-bold text-slate-800">10. Conseillers & Observations</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Expert-Comptable (ONECCA-SN)', field: 'expertComptable', placeholder: 'Cabinet / Nom' },
                  { label: 'Commissaire aux Comptes', field: 'commissaireComptes', placeholder: 'Cabinet / Nom' },
                  { label: 'Conseiller Juridique', field: 'conseillerJuridique', placeholder: 'Cabinet / Maître...' },
                ].map(({ label, field, placeholder }) => (
                  <div key={field}>
                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">{label}</label>
                    <input type="text" value={(donneesBilan as any)[field]} placeholder={placeholder}
                      onChange={e => updateDB(field, e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300/40" />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Observations générales & événements exceptionnels de l'exercice</label>
                <textarea value={donneesBilan.observations} rows={4}
                  placeholder="Travaux, sinistre, changement d'activité, investissement majeur prévu, événements impactant les comptes..."
                  onChange={e => updateDB('observations', e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300/40 resize-none" />
              </div>
            </div>
          </div>

          {/* Bouton enregistrer manuel + message */}
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Info size={15} className="text-slate-400" />
              <p className="text-xs text-slate-500">Les données sont sauvegardées automatiquement à chaque saisie sur cet appareil.</p>
            </div>
            <button
              onClick={() => saveDonneesBilan(donneesBilan)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm rounded-xl hover:shadow-lg transition-all"
            >
              <Save size={16} /> Sauvegarder
            </button>
          </div>

        </div>
      )}

      {/* ── MODALS CRUD ────────────────────────────────────────── */}
      {showChargeForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowChargeForm(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4"> 
              <h3 className="text-lg font-bold">{editingCharge ? 'Modifier' : 'Ajouter'} une charge</h3> 
              <button onClick={() => setShowChargeForm(false)} className="text-slate-400"> <X size={20} /> </button> 
            </div>
            <div className="space-y-3">
              <div> 
                <label className="text-xs font-semibold block mb-1">Nom</label> 
                <input type="text" value={chargeForm.nom} onChange={e => setChargeForm({ ...chargeForm, nom: e.target.value })} className="w-full p-2 border rounded-lg" placeholder="Ex: Électricité" /> 
              </div>
              <div> 
                <label className="text-xs font-semibold block mb-1">Catégorie</label>
                <select value={chargeForm.categorie} onChange={e => setChargeForm({ ...chargeForm, categorie: e.target.value })} className="w-full p-2 border rounded-lg">
                  <option value="electricite">Électricité</option> 
                  <option value="eau">Eau</option> 
                  <option value="internet">Internet</option> 
                  <option value="loyer">Loyer</option> 
                  <option value="assurance">Assurance</option> 
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div> 
                <label className="text-xs font-semibold block mb-1">Périodicité</label>
                <select value={chargeForm.periodicite} onChange={e => setChargeForm({ ...chargeForm, periodicite: e.target.value as any })} className="w-full p-2 border rounded-lg">
                  <option value="mensuel">Mensuel (x1)</option>
                  <option value="bimestriel">Bimestriel (÷2 pour mensuel)</option>
                  <option value="trimestriel">Trimestriel (÷3 pour mensuel)</option>
                  <option value="semestriel">Semestriel (÷6 pour mensuel)</option>
                  <option value="annuel">Annuel (÷12 pour mensuel)</option>
                </select>
              </div>
              <div> 
                <label className="text-xs font-semibold block mb-1">Montant pour la période (FCFA)</label> 
                <input type="number" value={chargeForm.montantMensuel || ''} onChange={e => setChargeForm({ ...chargeForm, montantMensuel: parseFloat(e.target.value) || 0 })} className="w-full p-2 border rounded-lg" /> 
                <p className="text-[10px] text-slate-500 mt-1">
                  Équivalent mensuel calculé : {fmtMoney(getMonthlyAmount({...chargeForm, id: ''} as Charge))} F
                </p>
              </div>
              <button onClick={saveCharge} className="w-full py-2 mt-2 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {showEmployeForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowEmployeForm(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4"> 
              <h3 className="text-lg font-bold">{editingEmploye ? 'Modifier' : 'Ajouter'} un employé</h3> 
              <button onClick={() => setShowEmployeForm(false)} className="text-slate-400"> <X size={20} /> </button> 
            </div>
            <div className="space-y-3">
              <div> <label className="text-xs font-semibold block mb-1">Nom</label> <input type="text" value={employeForm.nom} onChange={e => setEmployeForm({ ...employeForm, nom: e.target.value })} className="w-full p-2 border rounded-lg" placeholder="Ex: Jean Diop" /> </div>
              <div> <label className="text-xs font-semibold block mb-1">Poste</label> <input type="text" value={employeForm.poste} onChange={e => setEmployeForm({ ...employeForm, poste: e.target.value })} className="w-full p-2 border rounded-lg" placeholder="Ex: Gérant" /> </div>
              <div> <label className="text-xs font-semibold block mb-1">Salaire brut (FCFA)</label> <input type="number" value={employeForm.salaireBrut || ''} onChange={e => setEmployeForm({ ...employeForm, salaireBrut: parseFloat(e.target.value) || 0 })} className="w-full p-2 border rounded-lg" /> </div>
              <div> <label className="text-xs font-semibold block mb-1">Prime (FCFA)</label> <input type="number" value={employeForm.prime || ''} onChange={e => setEmployeForm({ ...employeForm, prime: parseFloat(e.target.value) || 0 })} className="w-full p-2 border rounded-lg" /> </div>
              <div> <label className="text-xs font-semibold block mb-1">Avantages (FCFA)</label> <input type="number" value={employeForm.avantages || ''} onChange={e => setEmployeForm({ ...employeForm, avantages: parseFloat(e.target.value) || 0 })} className="w-full p-2 border rounded-lg" /> </div>
              <button onClick={saveEmploye} className="w-full py-2 mt-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {showInvestForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowInvestForm(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4"> 
              <h3 className="text-lg font-bold">{editingInvest ? 'Modifier' : 'Ajouter'} un investissement</h3> 
              <button onClick={() => setShowInvestForm(false)} className="text-slate-400"> <X size={20} /> </button> 
            </div>
            <div className="space-y-3">
              <div> <label className="text-xs font-semibold block mb-1">Nom</label> <input type="text" value={investForm.nom} onChange={e => setInvestForm({ ...investForm, nom: e.target.value })} className="w-full p-2 border rounded-lg" placeholder="Ex: Matériel de cuisine" /> </div>
              <div> <label className="text-xs font-semibold block mb-1">Type</label>
                <select value={investForm.type} onChange={e => setInvestForm({ ...investForm, type: e.target.value })} className="w-full p-2 border rounded-lg">
                  <option value="materiel">Matériel</option> <option value="travaux">Travaux</option> <option value="vehicule">Véhicule</option> <option value="autre">Autre</option>
                </select>
              </div>
              <div> <label className="text-xs font-semibold block mb-1">Montant (FCFA)</label> <input type="number" value={investForm.montant || ''} onChange={e => setInvestForm({ ...investForm, montant: parseFloat(e.target.value) || 0 })} className="w-full p-2 border rounded-lg" /> </div>
              <div> <label className="text-xs font-semibold block mb-1">Durée d'amortissement (années)</label> <input type="number" value={investForm.amortissementAnnees || ''} onChange={e => setInvestForm({ ...investForm, amortissementAnnees: parseFloat(e.target.value) || 1 })} className="w-full p-2 border rounded-lg" /> </div>
              <button onClick={saveInvest} className="w-full py-2 mt-2 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}