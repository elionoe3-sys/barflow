import { useState, useEffect } from 'react';
import {
  FileText, Plus, X, Trash2, Edit3, Download, TrendingUp, TrendingDown,
  DollarSign, Users, Building2, Target, Crown, Activity, LayoutGrid,
  RefreshCw, Calendar, AlertCircle, Check, BarChart3, PieChart as PieChartIcon,
  Wifi, WifiOff
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '@/utils/cn';
import { dailyStats } from '@/data';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Charge, type Employe, type Investissement, type Prevision } from '@/db';
import { initializeDefaultData } from '@/db';

const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');

const gradientMap: Record<string, string> = {
  emerald: 'from-emerald-500 to-teal-600',
  violet: 'from-violet-500 to-purple-600',
  blue: 'from-blue-500 to-cyan-600',
  amber: 'from-amber-500 to-orange-600',
  rose: 'from-rose-500 to-pink-600',
};

const emptyCharge = { nom: '', categorie: 'electricite', montantMensuel: 0, periodicite: 'mensuel' };
const emptyEmploye = { nom: '', poste: '', salaireBrut: 0, prime: 0, avantages: 0 };
const emptyInvest = { nom: '', type: 'materiel', montant: 0, amortissementAnnees: 5 };

const TABS = [
  { id: 'apercu', label: 'Aperçu', icon: LayoutGrid, color: 'violet' },
  { id: 'charges', label: 'Charges fixes', icon: TrendingDown, color: 'rose' },
  { id: 'salaires', label: 'Salaires', icon: Users, color: 'blue' },
  { id: 'investissements', label: 'Investissements', icon: Building2, color: 'amber' },
  { id: 'previsions', label: 'Prévisions 5 ans', icon: Target, color: 'emerald' },
] as const;

export function Bilan() {
  const [activeTab, setActiveTab] = useState<'apercu' | 'charges' | 'salaires' | 'investissements' | 'previsions'>('apercu');
  const [showChargeForm, setShowChargeForm] = useState(false);
  const [showEmployeForm, setShowEmployeForm] = useState(false);
  const [showInvestForm, setShowInvestForm] = useState(false);
  const [editingCharge, setEditingCharge] = useState<Charge | null>(null);
  const [editingEmploye, setEditingEmploye] = useState<Employe | null>(null);
  const [editingInvest, setEditingInvest] = useState<Investissement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);

  const [chargeForm, setChargeForm] = useState(emptyCharge);
  const [employeForm, setEmployeForm] = useState(emptyEmploye);
  const [investForm, setInvestForm] = useState(emptyInvest);

  const charges = useLiveQuery(() => db.getActiveCharges(), []);
  const employes = useLiveQuery(() => db.getActiveEmployes(), []);
  const investissements = useLiveQuery(() => db.getActiveInvestissements(), []);

  const [previsions, setPrevisions] = useState<Prevision[]>([]);

  useEffect(() => {
    const updateSyncCount = async () => {
      const count = await db.syncQueue.count();
      setPendingSync(count);
    };
    updateSyncCount();
    const interval = setInterval(updateSyncCount, 5000);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      await initializeDefaultData();
      setIsInitializing(false);
    };
    init();
  }, []);

  const last30DaysStats = dailyStats.slice(-30);
  const caReel = last30DaysStats.reduce((s, d) => s + d.ca, 0);
  const caMoyenMensuel = Math.round(caReel);
  const caAnnuel = Math.round(caMoyenMensuel * 12);

  const totalChargesMensuelles = (charges || []).reduce((sum, c) => sum + c.montantMensuel, 0);
  const totalSalairesMensuels = (employes || []).reduce((sum, e) => sum + e.salaireBrut + e.prime + e.avantages, 0);
  const totalChargesSociales = totalSalairesMensuels * 0.15;
  const totalMasseSalariale = totalSalairesMensuels + totalChargesSociales;
  const totalChargesFixes = totalChargesMensuelles + totalMasseSalariale;
  const beneficeMensuel = caMoyenMensuel - totalChargesFixes;
  const margeBeneficiaire = caMoyenMensuel > 0 ? (beneficeMensuel / caMoyenMensuel) * 100 : 0;

  const amortissementMensuel = (investissements || []).reduce((sum, inv) => {
    const amortissementAnnuel = inv.amortissementAnnees > 0 ? inv.montant / inv.amortissementAnnees : 0;
    return sum + amortissementAnnuel / 12;
  }, 0);
  const beneficeNet = beneficeMensuel - amortissementMensuel;

  const genererPrevisions = () => {
    setIsGenerating(true);
    const newPrevisions: Prevision[] = [];
    const croissancePrevue = 0.08;
    let caActuel = caAnnuel;
    let chargesActuelles = totalChargesFixes * 12;
    let salairesActuels = totalMasseSalariale * 12;

    for (let i = 0; i < 5; i++) {
      const annee = new Date().getFullYear() + i;
      if (i > 0) {
        caActuel = caActuel * (1 + croissancePrevue);
        chargesActuelles = chargesActuelles * 1.03;
        salairesActuels = salairesActuels * 1.05;
      }
      const benefice = caActuel - chargesActuelles - salairesActuels;
      newPrevisions.push({
        annee, ca: Math.round(caActuel), charges: Math.round(chargesActuelles),
        salaires: Math.round(salairesActuels), benefice: Math.round(benefice),
        croissance: i === 0 ? 0 : Math.round(croissancePrevue * 100)
      });
    }
    setPrevisions(newPrevisions);
    setTimeout(() => setIsGenerating(false), 500);
  };

  useEffect(() => {
    if (!isInitializing) {
      genererPrevisions();
    }
  }, [charges, employes, investissements, caAnnuel, totalChargesFixes, totalMasseSalariale, isInitializing]);

  const openChargeForm = (charge?: Charge) => {
    if (charge) {
      setEditingCharge(charge);
      setChargeForm({
        nom: charge.nom,
        categorie: charge.categorie,
        montantMensuel: charge.montantMensuel,
        periodicite: charge.periodicite,
      });
    } else {
      setEditingCharge(null);
      setChargeForm(emptyCharge);
    }
    setShowChargeForm(true);
  };

  const saveCharge = async () => {
    if (!chargeForm.nom || chargeForm.montantMensuel <= 0) return;
    if (editingCharge) {
      await db.updateCharge(editingCharge.id, chargeForm);
    } else {
      await db.addCharge(chargeForm);
    }
    setShowChargeForm(false);
  };

  const handleDeleteCharge = async (id: string) => {
    if (window.confirm('Supprimer cette charge ?')) {
      await db.deleteCharge(id);
    }
  };

  const openEmployeForm = (employe?: Employe) => {
    if (employe) {
      setEditingEmploye(employe);
      setEmployeForm({
        nom: employe.nom,
        poste: employe.poste,
        salaireBrut: employe.salaireBrut,
        prime: employe.prime,
        avantages: employe.avantages,
      });
    } else {
      setEditingEmploye(null);
      setEmployeForm(emptyEmploye);
    }
    setShowEmployeForm(true);
  };

  const saveEmploye = async () => {
    if (!employeForm.nom || employeForm.salaireBrut <= 0) return;
    if (editingEmploye) {
      await db.updateEmploye(editingEmploye.id, employeForm);
    } else {
      await db.addEmploye(employeForm);
    }
    setShowEmployeForm(false);
  };

  const handleDeleteEmploye = async (id: string) => {
    if (window.confirm('Supprimer cet employé ?')) {
      await db.deleteEmploye(id);
    }
  };

  const openInvestForm = (invest?: Investissement) => {
    if (invest) {
      setEditingInvest(invest);
      setInvestForm({
        nom: invest.nom,
        type: invest.type,
        montant: invest.montant,
        amortissementAnnees: invest.amortissementAnnees,
      });
    } else {
      setEditingInvest(null);
      setInvestForm(emptyInvest);
    }
    setShowInvestForm(true);
  };

  const saveInvest = async () => {
    if (!investForm.nom || investForm.montant <= 0) return;
    if (editingInvest) {
      await db.updateInvestissement(editingInvest.id, investForm);
    } else {
      await db.addInvestissement(investForm);
    }
    setShowInvestForm(false);
  };

  const handleDeleteInvestissement = async (id: string) => {
    if (window.confirm('Supprimer cet investissement ?')) {
      await db.deleteInvestissement(id);
    }
  };

  const chargesParCategorie = Object.entries(
    (charges || []).reduce((acc, c) => {
      acc[c.categorie] = (acc[c.categorie] || 0) + c.montantMensuel;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6'];

  const getNavGradient = (color: string) => {
    return gradientMap[color] || gradientMap.violet;
  };

  // Export PDF
  const exportPDF = () => {
    if (caMoyenMensuel === 0) {
      alert("Les données ne sont pas encore disponibles pour générer le PDF");
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const MARGIN = 14;
    const PAGE_W = 297;
    const PAGE_H = 210;
    let y = MARGIN;

    const checkNewPage = (neededSpace: number) => {
      if (y + neededSpace > PAGE_H - MARGIN) {
        doc.addPage();
        y = MARGIN;
        return true;
      }
      return false;
    };

    // PAGE DE GARDE
    doc.setFillColor(15, 30, 60);
    doc.rect(0, 0, PAGE_W, 55, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.setFont('helvetica', 'bold');
    doc.text('BARFLOW', MARGIN, 25);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text('Rapport Financier & Bilan Comptable', MARGIN, 38);
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.text('Document établi le ' + new Date().toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric'
    }), MARGIN, 48);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, 52, PAGE_W - MARGIN, 52);

    y = 70;
    doc.setTextColor(50, 50, 80);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Informations Générales', MARGIN, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const today = new Date();
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    doc.text(`• Période d'analyse : ${monthNames[today.getMonth()]} ${today.getFullYear()}`, MARGIN, y);
    y += 5;
    doc.text(`• Devise : Francs CFA (FCFA)`, MARGIN, y);
    y += 5;
    doc.text(`• Méthode comptable : Comptabilité d'engagement`, MARGIN, y);
    y += 5;
    doc.text(`• Base de calcul : 30 jours glissants`, MARGIN, y);
    y += 8;
    doc.setDrawColor(100, 100, 150);
    doc.setLineWidth(0.3);
    doc.roundedRect(PAGE_W - 60, 65, 50, 30, 2, 2);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 150);
    doc.text('Document certifié', PAGE_W - 55, 75);
    doc.text('conforme aux normes', PAGE_W - 55, 82);
    doc.text('OHADA', PAGE_W - 55, 89);

    // SYNTHÈSE EXÉCUTIVE
    y = 110;
    checkNewPage(80);
    doc.setTextColor(15, 30, 60);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Synthèse Exécutive', MARGIN, y);
    y += 6;
    doc.setDrawColor(15, 30, 60);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, MARGIN + 50, y);
    y += 8;

    const kpis = [
      { label: 'Chiffre d\'Affaires Mensuel', value: caMoyenMensuel, highlight: false },
      { label: 'Charges Fixes Totales', value: totalChargesFixes, highlight: false },
      { label: 'Masse Salariale', value: totalMasseSalariale, highlight: false },
      { label: 'Bénéfice Mensuel', value: beneficeMensuel, highlight: true },
      { label: 'Marge Bénéficiaire', value: margeBeneficiaire, unit: '%', highlight: true },
      { label: 'Rentabilité Nette', value: beneficeNet, highlight: true },
    ];

    let col1 = MARGIN;
    let col2 = MARGIN + 85;
    let rowKpi = y;

    kpis.forEach((kpi, idx) => {
      const col = idx < 3 ? col1 : col2;
      const row = idx < 3 ? rowKpi + (idx * 12) : rowKpi + ((idx - 3) * 12);
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 100);
      doc.text(kpi.label, col, row);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      if (kpi.highlight && beneficeMensuel < 0) {
        doc.setTextColor(239, 68, 68);
      } else if (kpi.highlight) {
        doc.setTextColor(34, 197, 94);
      } else {
        doc.setTextColor(15, 30, 60);
      }
      let displayValue = '';
      if (kpi.unit === '%') {
        displayValue = (kpi.value as number).toFixed(1) + '%';
      } else {
        displayValue = fmt(kpi.value as number) + ' F';
      }
      doc.text(displayValue, col, row + 6);
      doc.setFont('helvetica', 'normal');
    });

    y = rowKpi + 45;

    // COMPTE DE RÉSULTAT
    checkNewPage(100);
    doc.setTextColor(15, 30, 60);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Compte de Résultat Simplifié', MARGIN, y);
    y += 6;
    doc.line(MARGIN, y, MARGIN + 60, y);
    y += 8;

    const resultData = [
      ['Produits d\'exploitation', 'Montant (FCFA)', '% CA'],
      ['Chiffre d\'Affaires', fmt(caMoyenMensuel), '100%'],
      ['', '', ''],
      ['Charges d\'exploitation', '', ''],
      [`  • Charges fixes (${charges?.length || 0} postes)`, fmt(totalChargesMensuelles), ((totalChargesMensuelles / caMoyenMensuel) * 100).toFixed(1) + '%'],
      [`  • Masse salariale brute`, fmt(totalSalairesMensuels), ((totalSalairesMensuels / caMoyenMensuel) * 100).toFixed(1) + '%'],
      [`  • Charges sociales (15%)`, fmt(totalChargesSociales), ((totalChargesSociales / caMoyenMensuel) * 100).toFixed(1) + '%'],
      [`  • Dotation aux amortissements`, fmt(amortissementMensuel), ((amortissementMensuel / caMoyenMensuel) * 100).toFixed(1) + '%'],
      ['', '', ''],
      ['Résultat d\'exploitation', fmt(beneficeMensuel), ((beneficeMensuel / caMoyenMensuel) * 100).toFixed(1) + '%'],
    ];

    autoTable(doc, {
      startY: y,
      head: [resultData[0]],
      body: resultData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [15, 30, 60], textColor: 255, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 50, halign: 'right' }, 2: { cellWidth: 40, halign: 'right' } },
      margin: { left: MARGIN, right: MARGIN },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === 3) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [245, 245, 250];
        }
        if (data.section === 'body' && data.row.index === 8) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 248, 240];
          data.cell.styles.textColor = [34, 197, 94];
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // DÉTAIL DES CHARGES
    if ((charges || []).length > 0) {
      checkNewPage(80);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 30, 60);
      doc.text('Détail des Charges Fixes', MARGIN, y);
      y += 6;
      doc.setDrawColor(15, 30, 60);
      doc.line(MARGIN, y, MARGIN + 55, y);
      y += 8;

      const chargesData = [['Catégorie', 'Désignation', 'Montant Mensuel (FCFA)']];
      (charges || []).forEach(charge => {
        chargesData.push([charge.categorie.toUpperCase(), charge.nom, fmt(charge.montantMensuel)]);
      });
      chargesData.push(['', 'TOTAL CHARGES FIXES', fmt(totalChargesMensuelles)]);

      autoTable(doc, {
        startY: y,
        head: [chargesData[0]],
        body: chargesData.slice(1),
        theme: 'grid',
        headStyles: { fillColor: [236, 72, 153], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 100 }, 2: { cellWidth: 50, halign: 'right' } },
        margin: { left: MARGIN, right: MARGIN },
      });

      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // DÉTAIL DES SALAIRES
    if ((employes || []).length > 0) {
      checkNewPage(80);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 30, 60);
      doc.text('Détail de la Masse Salariale', MARGIN, y);
      y += 6;
      doc.line(MARGIN, y, MARGIN + 65, y);
      y += 8;

      const salaryData = [['Employé', 'Poste', 'Salaire Brut', 'Prime', 'Avantages', 'Total Mensuel']];
      let totalBrut = 0;
      (employes || []).forEach(emp => {
        const total = emp.salaireBrut + emp.prime + emp.avantages;
        totalBrut += total;
        salaryData.push([emp.nom, emp.poste, fmt(emp.salaireBrut), fmt(emp.prime), fmt(emp.avantages), fmt(total)]);
      });
      salaryData.push(['', '', '', '', 'Sous-total salaires', fmt(totalBrut)]);
      salaryData.push(['', '', '', '', 'Charges sociales (15%)', fmt(totalChargesSociales)]);
      salaryData.push(['', '', '', '', 'TOTAL MASSE SALARIALE', fmt(totalMasseSalariale)]);

      autoTable(doc, {
        startY: y,
        head: [salaryData[0]],
        body: salaryData.slice(1),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 35 }, 2: { cellWidth: 35, halign: 'right' }, 3: { cellWidth: 30, halign: 'right' }, 4: { cellWidth: 30, halign: 'right' }, 5: { cellWidth: 40, halign: 'right' } },
        margin: { left: MARGIN, right: MARGIN },
      });

      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // INVESTISSEMENTS
    if ((investissements || []).length > 0) {
      checkNewPage(60);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 30, 60);
      doc.text('Plan d\'Investissement & Amortissement', MARGIN, y);
      y += 6;
      doc.line(MARGIN, y, MARGIN + 75, y);
      y += 8;

      const investData = [['Actif', 'Type', 'Montant Total', 'Durée', 'Amortissement Mensuel']];
      (investissements || []).forEach(inv => {
        const amortMens = inv.amortissementAnnees > 0 ? (inv.montant / inv.amortissementAnnees / 12) : 0;
        investData.push([inv.nom, inv.type, fmt(inv.montant), inv.amortissementAnnees + ' ans', fmt(amortMens)]);
      });
      investData.push(['', '', '', 'Amortissement Mensuel Total', fmt(amortissementMensuel)]);
      investData.push(['', '', '', 'Amortissement Annuel Total', fmt(amortissementMensuel * 12)]);

      autoTable(doc, {
        startY: y,
        head: [investData[0]],
        body: investData.slice(1),
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 35 }, 2: { cellWidth: 45, halign: 'right' }, 3: { cellWidth: 35, halign: 'center' }, 4: { cellWidth: 50, halign: 'right' } },
        margin: { left: MARGIN, right: MARGIN },
      });

      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // PRÉVISIONS 5 ANS
    if (previsions.length > 0) {
      checkNewPage(80);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 30, 60);
      doc.text('Prévisions Financières 5 Ans', MARGIN, y);
      y += 6;
      doc.line(MARGIN, y, MARGIN + 65, y);
      y += 8;

      const forecastData = [['Année', 'CA (FCFA)', 'Charges (FCFA)', 'Salaires (FCFA)', 'Bénéfice (FCFA)', 'Croissance']];
      previsions.forEach(p => {
        forecastData.push([p.annee.toString(), fmt(p.ca), fmt(p.charges), fmt(p.salaires), fmt(p.benefice), (p.croissance >= 0 ? '+' : '') + p.croissance + '%']);
      });

      autoTable(doc, {
        startY: y,
        head: [forecastData[0]],
        body: forecastData.slice(1),
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 55, halign: 'right' }, 2: { cellWidth: 55, halign: 'right' }, 3: { cellWidth: 55, halign: 'right' }, 4: { cellWidth: 55, halign: 'right' }, 5: { cellWidth: 35, halign: 'center' } },
        margin: { left: MARGIN, right: MARGIN },
      });

      y = (doc as any).lastAutoTable.finalY + 15;
    }

    // RATIOS FINANCIERS
    checkNewPage(60);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 30, 60);
    doc.text('Analyse des Ratios Financiers', MARGIN, y);
    y += 6;
    doc.setDrawColor(15, 30, 60);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, MARGIN + 65, y);
    y += 8;

    const rentaNette = (beneficeNet / caMoyenMensuel) * 100;
    const efficacite = (totalChargesFixes / caMoyenMensuel) * 100;
    const poidsSalarial = (totalMasseSalariale / caMoyenMensuel) * 100;

    const ratios = [
      { name: 'Rentabilité nette', value: rentaNette.toFixed(1) + '%', benchmark: '> 10%', ok: rentaNette > 10 },
      { name: 'Efficacité opérationnelle', value: efficacite.toFixed(1) + '%', benchmark: '< 80%', ok: efficacite < 80 },
      { name: 'Poids de la masse salariale', value: poidsSalarial.toFixed(1) + '%', benchmark: '20-40%', ok: poidsSalarial >= 20 && poidsSalarial <= 40 },
      { name: 'Capacité d\'autofinancement', value: fmt(beneficeNet + amortissementMensuel) + ' F', benchmark: 'Positif', ok: (beneficeNet + amortissementMensuel) > 0 },
      { name: 'Seuil de rentabilité mensuel', value: fmt(totalChargesFixes) + ' F', benchmark: '< CA actuel', ok: totalChargesFixes < caMoyenMensuel },
    ];

    let ratioY = y;
    ratios.forEach((ratio, idx) => {
      const col = idx < 3 ? MARGIN : MARGIN + 100;
      const row = ratioY + (idx < 3 ? idx * 12 : (idx - 3) * 12);
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 100);
      doc.text(ratio.name, col, row);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      if (ratio.ok) {
        doc.setTextColor(34, 197, 94);
      } else {
        doc.setTextColor(239, 68, 68);
      }
      doc.text(ratio.value, col, row + 6);
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 140);
      doc.text('Benchmark: ' + ratio.benchmark, col, row + 10);
      doc.setFont('helvetica', 'normal');
    });

    y = ratioY + 55;

    // NOTES
    if (y + 40 > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 30, 60);
    doc.text('Notes et Annexes', MARGIN, y);
    y += 6;
    doc.line(MARGIN, y, MARGIN + 40, y);
    y += 8;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 100);
    doc.text('1. Méthodologie de calcul : Les données sont basées sur les 30 derniers jours d\'activité.', MARGIN, y);
    y += 5;
    doc.text('2. Charges sociales : Calculées à 15% de la masse salariale brute (taux standard).', MARGIN, y);
    y += 5;
    doc.text('3. Amortissements : Linéaire sur la durée indiquée pour chaque investissement.', MARGIN, y);
    y += 5;
    doc.text('4. Prévisions : Hypothèse de croissance CA : 8%/an, inflation charges : 3%/an, augmentation salaires : 5%/an.', MARGIN, y);
    y += 5;
    doc.text('5. Document généré automatiquement - Pour tout audit, se référer aux pièces justificatives.', MARGIN, y);

    // PIED DE PAGE
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 170);
      doc.text(`BarFlow - Rapport Financier - Page ${i} sur ${pageCount}`, PAGE_W / 2, PAGE_H - 8, { align: 'center' });
      doc.text(new Date().toLocaleDateString('fr-FR'), PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
    }

    doc.save(`BarFlow_Bilan_Professionnel_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 bg-gradient-to-br from-slate-50 via-white to-slate-100 min-h-screen">
      {/* Indicateur de connexion */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg",
          isOnline ? "bg-green-500 text-white" : "bg-orange-500 text-white"
        )}>
          {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
          <span className="text-sm">{isOnline ? "En ligne" : "Hors-ligne"}</span>
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
            <p className="text-emerald-100 mt-1 flex items-center gap-2"><Activity size={14} /> Pilotage financier complet</p>
          </div>
          <button onClick={exportPDF} className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all flex items-center gap-2">
            <Download size={16} /> Exporter PDF
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap gap-1 p-1 bg-white rounded-xl shadow-sm border border-slate-200">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                activeTab === tab.id
                  ? cn('bg-gradient-to-r text-white shadow-md', getNavGradient(tab.color))
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Aperçu */}
      {activeTab === 'apercu' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <DollarSign className="text-emerald-500 mb-2" size={24} />
              <p className="text-xs text-slate-500">CA mensuel</p>
              <p className="text-2xl font-bold">{fmt(caMoyenMensuel)} F</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <TrendingDown className="text-red-500 mb-2" size={24} />
              <p className="text-xs text-slate-500">Charges fixes</p>
              <p className="text-2xl font-bold">{fmt(totalChargesFixes)} F</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-200">
              <Users className="text-blue-500 mb-2" size={24} />
              <p className="text-xs text-slate-500">Masse salariale</p>
              <p className="text-2xl font-bold">{fmt(totalMasseSalariale)} F</p>
            </div>
            <div className={cn("bg-white rounded-2xl p-5 border", beneficeMensuel >= 0 ? "border-emerald-200" : "border-red-200")}>
              <TrendingUp className={beneficeMensuel >= 0 ? "text-emerald-500" : "text-red-500"} size={24} />
              <p className="text-xs text-slate-500">Bénéfice mensuel</p>
              <p className={cn("text-2xl font-bold", beneficeMensuel >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt(Math.abs(beneficeMensuel))} F</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2">
                <PieChartIcon size={20} className="text-violet-500" />
                Répartition des charges
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chargesParCategorie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {chargesParCategorie.map((item, idx) => (
                        <Cell key={idx} fill={colors[idx % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2">
                <BarChart3 size={20} className="text-emerald-500" />
                Évolution CA vs Bénéfice
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={previsions}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="annee" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="ca" stroke="#10B981" strokeWidth={2} name="CA" dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="benefice" stroke="#8B5CF6" strokeWidth={2} name="Bénéfice" dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-200">
              <h3 className="font-semibold text-emerald-800 flex items-center gap-2"><Crown size={18} className="text-amber-500" /> Synthèse mensuelle</h3>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between"><span className="text-slate-600">CA moyen</span><span className="font-bold text-slate-900">{fmt(caMoyenMensuel)} F</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Charges fixes</span><span className="font-bold text-slate-900">{fmt(totalChargesFixes)} F</span></div>
                <div className="flex justify-between pt-2 border-t border-emerald-200"><span className="text-slate-600">Bénéfice net</span><span className={cn("font-bold text-lg", beneficeNet >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt(beneficeNet)} F</span></div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-200">
              <h3 className="font-semibold text-violet-800 flex items-center gap-2"><Target size={18} className="text-violet-500" /> Indicateurs clés</h3>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between"><span className="text-slate-600">Marge bénéficiaire</span><span className={cn("font-bold", margeBeneficiaire >= 0 ? "text-emerald-600" : "text-red-600")}>{margeBeneficiaire.toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Charges / CA</span><span className="font-bold text-amber-600">{(totalChargesFixes / caMoyenMensuel * 100).toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Masse salariale / CA</span><span className="font-bold text-blue-600">{(totalMasseSalariale / caMoyenMensuel * 100).toFixed(1)}%</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charges fixes */}
      {activeTab === 'charges' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-gradient-to-r from-rose-50 to-white flex justify-between items-center">
            <h2 className="font-semibold text-rose-700 flex items-center gap-2"><TrendingDown size={18} /> Charges fixes</h2>
            <button onClick={() => openChargeForm()} className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition">+ Ajouter</button>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr><th className="p-3 text-left">Nom</th><th className="p-3 text-left">Catégorie</th><th className="p-3 text-right">Montant mensuel</th><th className="p-3 text-center">Actions</th></tr>
            </thead>
            <tbody>
              {(charges || []).map(c => (
                <tr key={c.id} className="border-t hover:bg-slate-50">
                  <td className="p-3">{c.nom}</td><td className="p-3 capitalize">{c.categorie}</td><td className="p-3 text-right font-bold">{fmt(c.montantMensuel)} F</td>
                  <td className="p-3 text-center">
                    <button onClick={() => openChargeForm(c)} className="text-blue-500 mr-2 hover:text-blue-700"><Edit3 size={16} /></button>
                    <button onClick={() => handleDeleteCharge(c.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {(charges || []).length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-slate-400">Aucune charge enregistrée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Salaires - VERSION CORRIGÉE */}
      {activeTab === 'salaires' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-white flex justify-between items-center">
              <h2 className="font-semibold text-blue-700 flex items-center gap-2"><Users size={18} /> Employés</h2>
              <button onClick={() => openEmployeForm()} className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition">+ Ajouter</button>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr><th className="p-3 text-left">Employé</th><th className="p-3 text-left">Poste</th><th className="p-3 text-right">Total mensuel</th><th className="p-3 text-center">Actions</th></tr>
              </thead>
              <tbody>
                {(employes || []).map(e => {
                  const total = e.salaireBrut + e.prime + e.avantages;
                  return (
                    <tr key={e.id} className="border-t hover:bg-slate-50">
                      <td className="p-3">{e.nom}</td>
                      <td className="p-3">{e.poste}</td>
                      <td className="p-3 text-right font-bold text-blue-600">{fmt(total)} F</td>
                      <td className="p-3 text-center">
                        <button onClick={() => openEmployeForm(e)} className="text-blue-500 mr-2"><Edit3 size={16} /></button>
                        <button onClick={() => handleDeleteEmploye(e.id)} className="text-red-500"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  );
                })}
                {(employes || []).length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400">Aucun employé enregistré</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-200">
            <div className="flex justify-between"><span className="font-semibold text-blue-800">Total masse salariale mensuelle</span><span className="text-xl font-bold text-blue-700">{fmt(totalMasseSalariale)} F</span></div>
            <div className="flex justify-between mt-1"><span className="text-sm text-slate-600">Dont charges patronales (15%)</span><span className="font-semibold text-slate-700">{fmt(totalChargesSociales)} F</span></div>
          </div>
        </div>
      )}

      {/* Investissements */}
      {activeTab === 'investissements' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-gradient-to-r from-amber-50 to-white flex justify-between items-center">
            <h2 className="font-semibold text-amber-700 flex items-center gap-2"><Building2 size={18} /> Investissements</h2>
            <button onClick={() => openInvestForm()} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition">+ Ajouter</button>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr><th className="p-3 text-left">Nom</th><th className="p-3 text-left">Type</th><th className="p-3 text-right">Montant</th><th className="p-3 text-center">Amortissement</th><th className="p-3 text-center">Actions</th></tr>
            </thead>
            <tbody>
              {(investissements || []).map(i => (
                <tr key={i.id} className="border-t hover:bg-slate-50">
                  <td className="p-3">{i.nom}</td>
                  <td className="p-3 capitalize">{i.type}</td>
                  <td className="p-3 text-right font-bold">{fmt(i.montant)} F</td>
                  <td className="p-3 text-center">{i.amortissementAnnees} ans</td>
                  <td className="p-3 text-center">
                    <button onClick={() => openInvestForm(i)} className="text-blue-500 mr-2"><Edit3 size={16} /></button>
                    <button onClick={() => handleDeleteInvestissement(i.id)} className="text-red-500"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {(investissements || []).length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Aucun investissement enregistré</td></tr>
              )}
            </tbody>
          </table>
          {(investissements || []).length > 0 && (
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-t border-amber-200">
              <div className="flex justify-between"><span className="font-semibold text-amber-800">Amortissement mensuel total</span><span className="text-xl font-bold text-amber-700">{fmt(amortissementMensuel)} F</span></div>
            </div>
          )}
        </div>
      )}

      {/* Prévisions 5 ans */}
      {activeTab === 'previsions' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-emerald-700 text-lg flex items-center gap-2"><Target size={20} /> Prévisions sur 5 ans</h2>
            <button onClick={genererPrevisions} disabled={isGenerating} className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold flex items-center gap-2 hover:bg-emerald-600 transition shadow-md">
              <RefreshCw size={16} className={isGenerating ? "animate-spin" : ""} />
              {isGenerating ? "Recalcul..." : "Recalculer"}
            </button>
          </div>
          {previsions.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr><th className="p-3 text-left">Année</th><th className="p-3 text-right">CA (FCFA)</th><th className="p-3 text-right">Bénéfice (FCFA)</th><th className="p-3 text-center">Croissance</th></tr>
                </thead>
                <tbody>
                  {previsions.map(p => (
                    <tr key={p.annee} className="border-t hover:bg-slate-50">
                      <td className="p-3 font-bold">{p.annee}</td>
                      <td className="p-3 text-right">{fmt(p.ca)} F</td>
                      <td className={cn("p-3 text-right font-bold", p.benefice >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt(Math.abs(p.benefice))} F</td>
                      <td className="p-3 text-center">
                        <span className={cn("px-2 py-1 rounded-full text-xs font-bold", p.croissance >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                          {p.croissance >= 0 ? "+" : ""}{p.croissance}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2"><BarChart3 size={20} className="text-emerald-500" /> Projection sur 5 ans</h2>
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
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="ca" stroke="#10B981" strokeWidth={2} fill="url(#caGrad)" name="CA (FCFA)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHARGE */}
      {showChargeForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowChargeForm(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">{editingCharge ? 'Modifier' : 'Ajouter'} une charge</h3><button onClick={() => setShowChargeForm(false)} className="text-slate-400"><X size={20} /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-semibold block mb-1">Nom</label><input type="text" value={chargeForm.nom} onChange={e => setChargeForm({...chargeForm, nom: e.target.value})} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" placeholder="Ex: Électricité" /></div>
              <div><label className="text-xs font-semibold block mb-1">Catégorie</label><select value={chargeForm.categorie} onChange={e => setChargeForm({...chargeForm, categorie: e.target.value})} className="w-full p-2 border rounded-lg"><option value="electricite">Électricité</option><option value="eau">Eau</option><option value="internet">Internet</option><option value="loyer">Loyer</option><option value="assurance">Assurance</option><option value="autre">Autre</option></select></div>
              <div><label className="text-xs font-semibold block mb-1">Montant mensuel (FCFA)</label><input type="number" value={chargeForm.montantMensuel} onChange={e => setChargeForm({...chargeForm, montantMensuel: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded-lg" /></div>
              <button onClick={saveCharge} className="w-full py-2 mt-2 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600 transition">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EMPLOYÉ */}
      {showEmployeForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowEmployeForm(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">{editingEmploye ? 'Modifier' : 'Ajouter'} un employé</h3><button onClick={() => setShowEmployeForm(false)} className="text-slate-400"><X size={20} /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-semibold block mb-1">Nom</label><input type="text" value={employeForm.nom} onChange={e => setEmployeForm({...employeForm, nom: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="Ex: Jean Diop" /></div>
              <div><label className="text-xs font-semibold block mb-1">Poste</label><input type="text" value={employeForm.poste} onChange={e => setEmployeForm({...employeForm, poste: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="Ex: Gérant" /></div>
              <div><label className="text-xs font-semibold block mb-1">Salaire brut (FCFA)</label><input type="number" value={employeForm.salaireBrut} onChange={e => setEmployeForm({...employeForm, salaireBrut: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded-lg" /></div>
              <div><label className="text-xs font-semibold block mb-1">Prime (FCFA)</label><input type="number" value={employeForm.prime} onChange={e => setEmployeForm({...employeForm, prime: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded-lg" /></div>
              <div><label className="text-xs font-semibold block mb-1">Avantages (FCFA)</label><input type="number" value={employeForm.avantages} onChange={e => setEmployeForm({...employeForm, avantages: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded-lg" /></div>
              <button onClick={saveEmploye} className="w-full py-2 mt-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INVESTISSEMENT */}
      {showInvestForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex-items-center justify-center" onClick={() => setShowInvestForm(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">{editingInvest ? 'Modifier' : 'Ajouter'} un investissement</h3><button onClick={() => setShowInvestForm(false)} className="text-slate-400"><X size={20} /></button></div>
            <div className="space-y-3">
              <div><label className="text-xs font-semibold block mb-1">Nom</label><input type="text" value={investForm.nom} onChange={e => setInvestForm({...investForm, nom: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="Ex: Matériel de cuisine" /></div>
              <div><label className="text-xs font-semibold block mb-1">Type</label><select value={investForm.type} onChange={e => setInvestForm({...investForm, type: e.target.value})} className="w-full p-2 border rounded-lg"><option value="materiel">Matériel</option><option value="travaux">Travaux</option><option value="vehicule">Véhicule</option><option value="autre">Autre</option></select></div>
              <div><label className="text-xs font-semibold block mb-1">Montant (FCFA)</label><input type="number" value={investForm.montant} onChange={e => setInvestForm({...investForm, montant: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded-lg" /></div>
              <div><label className="text-xs font-semibold block mb-1">Durée d'amortissement (années)</label><input type="number" value={investForm.amortissementAnnees} onChange={e => setInvestForm({...investForm, amortissementAnnees: parseInt(e.target.value) || 1})} className="w-full p-2 border rounded-lg" /></div>
              <button onClick={saveInvest} className="w-full py-2 mt-2 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 transition">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}