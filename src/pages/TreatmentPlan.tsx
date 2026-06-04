import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Home, Download, Share2, FileCheck, Package, Loader2, Calculator } from 'lucide-react';
import { TreatmentData } from '@/types/app';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { useEffect, useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { HomeButton } from '@/components/HomeButton';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from '@/contexts/AuthContext';

// --- FONT IMPORTS ---
import teluguFont from '@/assets/fonts/NotoSansTelugu-Regular.base64?raw';
import hindiFont from '@/assets/fonts/NotoSansDevanagari-Regular.base64?raw';

// --- HELPER FUNCTIONS ---

const LOGO_URL = '/logo.png';

// Regex to check if text is purely English/Numbers/Symbols (ASCII)
const isAscii = (str: string) => /^[\x00-\x7F]*$/.test(String(str));

const fetchImageAsBase64 = async (url: string): Promise<{ base64: string; format: string; width: number; height: number } | null> => {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('image')) return null;

    let format = 'JPEG';
    if (contentType.includes('png') || url.toLowerCase().endsWith('.png')) {
      format = 'PNG';
    }

    const blob = await res.blob();

    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (result && result.startsWith('data:image')) {
          const img = new Image();
          img.onload = () => {
             resolve({ base64: result, format, width: img.width, height: img.height });
          };
          img.onerror = () => resolve(null);
          img.src = result;
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Image fetch failed safely:', error);
    return null;
  }
};

const TreatmentPlan = () => {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [farmerName, setFarmerName] = useState('');
  const [farmerMobile, setFarmerMobile] = useState('');
  const [farmerLocation, setFarmerLocation] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const pdfTemplateRef = useRef<HTMLDivElement>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [cropBase64, setCropBase64] = useState<string | null>(null);
  const [problemBase64, setProblemBase64] = useState<string | null>(null);
  const [productBase64, setProductBase64] = useState<string | null>(null);

  useEffect(() => {
    if (!location.state) navigate('/');
  }, [location.state, navigate]);

  if (!location.state) return null;

  const { crop, problems, product, acres } = location.state as TreatmentData;
  const problem = problems[0]; // For legacy compatibility in some helpers if needed
  const productInfo = product.products; 
  const mappingInfo = product;

  const getCropName = (c: any) =>
    language === 'te' ? c.name_te : language === 'hi' ? c.name_hi : c.name_en;

  const getProblemTitle = (p: any) =>
    language === 'te' ? p.title_te : language === 'hi' ? p.title_hi : p.title_en;

  const getProductName = (p?: any) =>
    !p ? '—' : language === 'te' ? (p.name_te || p.name) : language === 'hi' ? (p.name_hi || p.name) : p.name;

  const totalDosageMin = (mappingInfo.dosage_min || 0) * acres;
  const totalDosageMax = (mappingInfo.dosage_max || 0) * acres;

  const handlePdfClick = () => {
    setShowPdfDialog(true);
  };

  const handleConfirmGenerate = async () => {
    if (!farmerName.trim() || !farmerMobile.trim() || !farmerLocation.trim()) {
      toast.error(t('fillAllFields') || 'Please fill all details');
      return;
    }

    if (farmerMobile.length < 10) {
      toast.error('Please enter a valid mobile number');
      return;
    }

    setIsGenerating(true);

    try {
      const [logoData, cropImg, problemImg, productImg] = await Promise.all([
        fetchImageAsBase64(LOGO_URL),
        crop.image_url ? fetchImageAsBase64(crop.image_url) : Promise.resolve(null),
        problems[0]?.image_url ? fetchImageAsBase64(problems[0].image_url) : Promise.resolve(null),
        productInfo.image_url ? fetchImageAsBase64(productInfo.image_url) : Promise.resolve(null)
      ]);

      const inserts = problems.map(p => ({
        crop_id: crop.id,      
        problem_id: p.id,
        product_id: productInfo.id, 
        acres: acres,
        language: language,
        farmer_name: farmerName,
        farmer_mobile: farmerMobile,
        farmer_location: farmerLocation
      }));

      const { error: dbError } = await supabase.from('analytics').insert(inserts);

      if (dbError) console.error('DB Log Error:', dbError);

      // Set base64 states for the hidden PDF template rendering
      setLogoBase64(logoData?.base64 || null);
      setCropBase64(cropImg?.base64 || null);
      setProblemBase64(problemImg?.base64 || null);
      setProductBase64(productImg?.base64 || null);

      // Wait a moment for React to flush the updates to the DOM
      await new Promise((resolve) => setTimeout(resolve, 300));

      const element = pdfTemplateRef.current;
      if (!element) {
        throw new Error('PDF template element not found');
      }

      const canvas = await html2canvas(element, {
        scale: 2, // High resolution crisp text rendering
        useCORS: true,
        logging: false,
        backgroundColor: '#FDFBF7'
      });

      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = doc.internal.pageSize.getHeight();
      doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

      doc.save(`treatment-${farmerName.replace(/\s+/g, '-')}-${Date.now()}.pdf`);
      toast.success('PDF generated and logged!');

      // Reset base64 states
      setLogoBase64(null);
      setCropBase64(null);
      setProblemBase64(null);
      setProductBase64(null);
      
      setShowPdfDialog(false);
      setFarmerName('');
      setFarmerMobile('');
      setFarmerLocation('');
    } catch (error) {
      console.error('Process Error:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareWhatsApp = () => {
    const problemsText = problems.map(p => getProblemTitle(p)).join(', ');
    const msg = `Treatment Plan\nCrop: ${getCropName(crop)}\nProblems: ${problemsText}\nProduct: ${getProductName(productInfo)}\nAcres: ${acres}\nDosage: ${mappingInfo.dosage_recommendation}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-treatment-plan flex flex-col relative text-white">
      <HomeButton />
      <div className="absolute inset-0 bg-black/40 z-0"></div>

      <div className="container mx-auto px-4 py-12 pt-16 flex-1 relative z-10 flex flex-col items-center">
        <div className="text-center mb-10 animate-fade-in">
          <div className="bg-[#4ADE80] p-4 rounded-full inline-block mb-4 shadow-xl">
            <FileCheck className="w-12 h-12 text-[#1B4332]" />
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-bold text-white drop-shadow-lg">
            {t('treatmentPlan')}
          </h1>
          <p className="text-[#4ADE80] font-bold text-xl mt-2 tracking-wide uppercase italic">
            Certified Recommendation
          </p>
        </div>

        <Card className="p-8 md:p-12 w-full max-w-5xl border-none bg-[#1B4332] rounded-[3rem] shadow-2xl animate-fade-in flex flex-col lg:flex-row gap-12 overflow-hidden relative">
          <div className="flex-shrink-0 w-full lg:w-1/3 flex flex-col items-center lg:items-start gap-6">
            <div className="w-64 h-64 rounded-[2rem] overflow-hidden shadow-2xl border-4 border-[#4ADE80]/30 bg-black/20">
              {productInfo.image_url ? (
                <img src={productInfo.image_url} alt={getProductName(productInfo)} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Package className="w-24 h-24 text-[#4ADE80]" /></div>
              )}
            </div>
            <div className="text-center lg:text-left">
              <h2 className="text-4xl font-display font-bold text-[#4ADE80] mb-2">{getProductName(productInfo)}</h2>
              {productInfo.scientific_formula && (
                <p className="text-lg text-white/80 italic font-medium">{productInfo.scientific_formula}</p>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-6 bg-black/40 rounded-2xl border border-white/10 shadow-inner">
                <p className="text-xs uppercase text-[#4ADE80] font-black tracking-widest mb-2">{t('crop')}</p>
                <p className="text-2xl font-black font-display text-white">{getCropName(crop)}</p>
              </div>
              <div className="p-6 bg-black/40 rounded-2xl border border-white/10 shadow-inner">
                <p className="text-xs uppercase text-[#4ADE80] font-black tracking-widest mb-2">{t('problem')}</p>
                <p className="text-2xl font-black font-display text-white">{problems.map(p => getProblemTitle(p)).join(', ')}</p>
              </div>
              <div className="p-6 bg-black/40 rounded-2xl border border-white/10 shadow-inner">
                <p className="text-xs uppercase text-[#4ADE80] font-black tracking-widest mb-2">{t('dosagePerAcre')}</p>
                <p className="text-2xl font-black font-display text-white">{mappingInfo.dosage_recommendation}</p>
              </div>
              <div className="p-6 bg-black/40 rounded-2xl border border-white/10 shadow-inner">
                <p className="text-xs uppercase text-[#4ADE80] font-black tracking-widest mb-2">{t('acres')}</p>
                <p className="text-2xl font-black font-display text-white">{acres}</p>
              </div>
            </div>

            <div className="p-10 bg-gradient-to-br from-[#1B4332] to-[#2E7D32] rounded-[2.5rem] border-4 border-[#4ADE80]/30 relative overflow-hidden group shadow-2xl">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Calculator className="w-24 h-24 text-white" />
              </div>
              <h3 className="font-black text-[#4ADE80] mb-3 text-2xl tracking-widest uppercase italic">{t('totalDosage')}</h3>
              <p className="text-6xl md:text-8xl font-black font-display text-white drop-shadow-lg">
                {totalDosageMin === totalDosageMax ? `${totalDosageMin.toFixed(2)}` : `${totalDosageMin.toFixed(2)} – ${totalDosageMax.toFixed(2)}`}
                <span className="text-3xl ml-3 text-[#4ADE80] uppercase opacity-80">{mappingInfo.dosage_unit}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
              <Button onClick={handlePdfClick} className="h-20 rounded-[1.5rem] text-2xl font-black bg-[#4ADE80] text-[#1B4332] hover:bg-white hover:text-[#1B4332] transition-all transform hover:scale-[1.05] shadow-2xl shadow-[#4ADE80]/20 flex-1">
                <Download className="mr-3 h-8 w-8" /> PDF
              </Button>
              <Button variant="outline" onClick={handleShareWhatsApp} className="h-20 rounded-[1.5rem] text-2xl font-black text-white bg-black/20 hover:bg-[#25D366] hover:text-white border-none shadow-xl transition-all transform hover:scale-[1.05] flex-1">
                <Share2 className="mr-3 h-8 w-8" /> {language === 'en' ? 'WhatsApp' : 'వాట్సాప్'}
              </Button>
              <Button variant="ghost" onClick={() => navigate('/')} className="h-20 rounded-[1.5rem] text-xl font-bold text-white/50 hover:text-white hover:bg-white/5 transition-all flex-1">
                <Home className="mr-3 h-6 w-6" /> Home
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Dialog open={showPdfDialog} onOpenChange={setShowPdfDialog}>
        <DialogContent className="sm:max-w-md bg-[#FDFBF7] border-none rounded-[3rem] p-10 overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-2 bg-[#4ADE80]"></div>
          <DialogHeader className="mb-8">
            <DialogTitle className="text-3xl font-display font-bold text-[#1B4332] flex items-center gap-3">
              <div className="bg-[#4ADE80]/10 p-2 rounded-xl">
                <FileCheck className="h-8 w-8 text-[#2E7D32]" />
              </div>
              {t('farmerDetails')}
            </DialogTitle>
            <DialogDescription className="text-lg text-[#405D4E] mt-2">
              {t('farmerDetailsDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-sm font-bold text-[#1B4332] uppercase tracking-widest pl-2">{t('farmerNameLabel')}</Label>
              <Input
                id="name"
                placeholder="Rama Rao"
                value={farmerName}
                onChange={(e) => setFarmerName(e.target.value)}
                className="h-14 rounded-2xl border-none bg-[#E8F5E9] text-lg font-medium px-6 focus-visible:ring-4 focus-visible:ring-[#4ADE80] transition-all"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mobile" className="text-sm font-bold text-[#1B4332] uppercase tracking-widest pl-2">{t('farmerMobileLabel')}</Label>
              <Input
                id="mobile"
                placeholder="9876543210"
                type="tel"
                value={farmerMobile}
                step="1"
                onChange={(e) => setFarmerMobile(e.target.value)}
                className="h-14 rounded-2xl border-none bg-[#E8F5E9] text-lg font-medium px-6 focus-visible:ring-4 focus-visible:ring-[#4ADE80] transition-all"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location" className="text-sm font-bold text-[#1B4332] uppercase tracking-widest pl-2">{t('farmerLocationLabel')}</Label>
              <Input
                id="location"
                placeholder="Village / Town"
                value={farmerLocation}
                onChange={(e) => setFarmerLocation(e.target.value)}
                className="h-14 rounded-2xl border-none bg-[#E8F5E9] text-lg font-medium px-6 focus-visible:ring-4 focus-visible:ring-[#4ADE80] transition-all"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-4 mt-8">
            <Button variant="ghost" onClick={() => setShowPdfDialog(false)} className="h-14 rounded-2xl w-full sm:w-auto text-[#405D4E] font-bold">
              {t('cancel')}
            </Button>
            <Button onClick={handleConfirmGenerate} disabled={isGenerating} className="h-14 rounded-2xl w-full sm:w-auto font-bold bg-[#1B4332] hover:bg-[#2E7D32] text-white px-10 shadow-xl shadow-[#1B4332]/20 transition-all transform active:scale-95">
              {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
              {t('generatePDF')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Off-screen PDF Template for html2canvas generation */}
      <div
        ref={pdfTemplateRef}
        className="bg-[#FDFBF7] text-[#1B4332] p-10 flex flex-col justify-between"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          width: '794px', // A4 width at 96 DPI
          minHeight: '1123px', // A4 height at 96 DPI
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#4ADE80]/30 pb-6 mb-6">
          <div className="flex items-center gap-4">
            {logoBase64 ? (
              <img src={logoBase64} alt="Logo" className="w-16 h-16 object-contain" />
            ) : (
              <div className="w-16 h-16 bg-[#4ADE80]/20 rounded-full" />
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1B4332]">Shanmukha Agritech</h1>
              <p className="text-xs text-[#405D4E] uppercase tracking-wider font-semibold">
                {t('treatmentPlan')}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-[#405D4E]">
            <p className="font-bold">Date: {new Date().toLocaleDateString()}</p>
            <p>ID: {Date.now().toString().slice(-6)}</p>
          </div>
        </div>

        {/* Farmer Details */}
        <div className="bg-[#E8F5E9]/50 rounded-2xl p-6 mb-6 border border-[#4ADE80]/20 grid grid-cols-3 gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#405D4E] block tracking-wider">
              {language === 'te' ? 'రైతు పేరు' : language === 'hi' ? 'किसान का नाम' : 'Farmer Name'}
            </span>
            <span className="text-sm font-bold text-[#1B4332]">{farmerName || '-'}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#405D4E] block tracking-wider">
              {language === 'te' ? 'మొబైల్' : language === 'hi' ? 'मोबाइल नंबर' : 'Mobile Number'}
            </span>
            <span className="text-sm font-bold text-[#1B4332]">{farmerMobile || '-'}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-[#405D4E] block tracking-wider">
              {language === 'te' ? 'నివాసం' : language === 'hi' ? 'स्थान' : 'Location'}
            </span>
            <span className="text-sm font-bold text-[#1B4332]">{farmerLocation || '-'}</span>
          </div>
        </div>

        {/* Main Images Grid */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Crop */}
          <div className="bg-white rounded-2xl p-4 border border-[#4ADE80]/10 flex flex-col items-center shadow-sm">
            <div className="w-full h-32 rounded-xl overflow-hidden mb-3 bg-black/5 flex items-center justify-center">
              {cropBase64 ? (
                <img src={cropBase64} alt="Crop" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-[#405D4E]">No image</span>
              )}
            </div>
            <span className="text-xs font-bold text-[#405D4E] uppercase tracking-wider">{t('crop')}</span>
            <span className="text-sm font-bold text-[#1B4332] text-center mt-1">{getCropName(crop)}</span>
          </div>

          {/* Problem */}
          <div className="bg-white rounded-2xl p-4 border border-[#4ADE80]/10 flex flex-col items-center shadow-sm">
            <div className="w-full h-32 rounded-xl overflow-hidden mb-3 bg-black/5 flex items-center justify-center">
              {problemBase64 ? (
                <img src={problemBase64} alt="Problem" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-[#405D4E]">No image</span>
              )}
            </div>
            <span className="text-xs font-bold text-[#405D4E] uppercase tracking-wider">{t('problem')}</span>
            <span className="text-sm font-bold text-[#1B4332] text-center mt-1">
              {problems.map(p => getProblemTitle(p)).join(', ')}
            </span>
          </div>

          {/* Product */}
          <div className="bg-white rounded-2xl p-4 border border-[#4ADE80]/10 flex flex-col items-center shadow-sm">
            <div className="w-full h-32 rounded-xl overflow-hidden mb-3 bg-black/5 flex items-center justify-center">
              {productBase64 ? (
                <img src={productBase64} alt="Product" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-[#405D4E]">No image</span>
              )}
            </div>
            <span className="text-xs font-bold text-[#405D4E] uppercase tracking-wider">{t('product')}</span>
            <span className="text-sm font-bold text-[#1B4332] text-center mt-1">{getProductName(productInfo)}</span>
          </div>
        </div>

        {/* Dosage & Recommendation Details Table */}
        <div className="flex-1 bg-white rounded-2xl border border-[#4ADE80]/20 overflow-hidden mb-6 shadow-sm flex flex-col">
          <div className="bg-[#1B4332] text-white px-6 py-4 flex justify-between items-center">
            <h3 className="font-bold text-base">
              {language === 'te' ? 'సిఫార్సు వివరాలు' : language === 'hi' ? 'सिफारिश विवरण' : 'Recommendation Details'}
            </h3>
            <span className="text-[10px] font-semibold px-3 py-1 bg-[#4ADE80]/20 text-[#4ADE80] rounded-full uppercase tracking-wider">Certified</span>
          </div>
          <div className="divide-y divide-[#4ADE80]/10 flex-1 flex flex-col justify-around">
            <div className="grid grid-cols-3 px-6 py-3">
              <span className="text-xs font-semibold text-[#405D4E]">{t('crop')}</span>
              <span className="col-span-2 text-xs font-bold text-[#1B4332]">{getCropName(crop)}</span>
            </div>
            <div className="grid grid-cols-3 px-6 py-3">
              <span className="text-xs font-semibold text-[#405D4E]">{t('problem')}</span>
              <span className="col-span-2 text-xs font-bold text-[#1B4332]">{problems.map(p => getProblemTitle(p)).join(', ')}</span>
            </div>
            <div className="grid grid-cols-3 px-6 py-3">
              <span className="text-xs font-semibold text-[#405D4E]">{t('product')}</span>
              <span className="col-span-2 text-xs font-bold text-[#1B4332]">{getProductName(productInfo)}</span>
            </div>
            {productInfo.scientific_formula && (
              <div className="grid grid-cols-3 px-6 py-3">
                <span className="text-xs font-semibold text-[#405D4E]">{t('scientificFormula')}</span>
                <span className="col-span-2 text-xs font-bold text-[#1B4332] italic">{productInfo.scientific_formula}</span>
              </div>
            )}
            <div className="grid grid-cols-3 px-6 py-3">
              <span className="text-xs font-semibold text-[#405D4E]">{t('acres')}</span>
              <span className="col-span-2 text-xs font-bold text-[#1B4332]">{acres}</span>
            </div>
            <div className="grid grid-cols-3 px-6 py-3">
              <span className="text-xs font-semibold text-[#405D4E]">{t('dosagePerAcre')}</span>
              <span className="col-span-2 text-xs font-bold text-[#1B4332]">{mappingInfo.dosage_recommendation}</span>
            </div>
            <div className="grid grid-cols-3 px-6 py-3 bg-[#E8F5E9]/20">
              <span className="text-xs font-bold text-[#1B4332]">{t('totalDosage')}</span>
              <span className="col-span-2 text-sm font-black text-[#2E7D32]">
                {totalDosageMin === totalDosageMax ? `${totalDosageMin.toFixed(2)}` : `${totalDosageMin.toFixed(2)} – ${totalDosageMax.toFixed(2)}`} {mappingInfo.dosage_unit}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#4ADE80]/30 pt-4 text-center text-[10px] text-[#405D4E] flex flex-col gap-1">
          <p className="font-bold">
            {language === 'te' ? 'షణ్ముఖ అగ్రిటెక్ ద్వారా ఆధారితం' : language === 'hi' ? 'शनमुख एग्रीटेक द्वारा संचालित' : 'Powered by Shanmukha Agritech'}
          </p>
          <p>Address: Shanmukha Agro Industries, Telangana</p>
          <p className="text-[8px] text-[#405D4E]/60 mt-1">This treatment plan is a system generated recommendation based on diagnosed symptoms.</p>
        </div>
      </div>
    </div>
  );
};

export default TreatmentPlan;