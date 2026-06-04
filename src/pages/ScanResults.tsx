import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CheckCircle,
  AlertTriangle,
  Camera,
  ShieldCheck,
  Bug,
  Leaf,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { HomeButton } from '@/components/HomeButton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Crop, Problem } from '@/types/app';

interface ScanResult {
  cropName: { en: string; te: string; hi: string };
  problemName: { en: string; te: string; hi: string };
  problemType: 'pest' | 'disease' | 'deficiency' | 'healthy';
  confidence: number;
  description: { en: string; te: string; hi: string };
  symptoms: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  referenceImageKeywords: string[];
  isDemoFallback?: boolean;
}

const severityConfig = {
  low: { label: 'Low', color: 'bg-green-500', width: 'w-1/4' },
  medium: { label: 'Medium', color: 'bg-yellow-500', width: 'w-2/4' },
  high: { label: 'High', color: 'bg-orange-500', width: 'w-3/4' },
  critical: { label: 'Critical', color: 'bg-red-500', width: 'w-full' },
};

const problemTypeConfig = {
  pest: {
    icon: Bug,
    label: 'Pest',
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    border: 'border-orange-500/40',
  },
  disease: {
    icon: AlertTriangle,
    label: 'Disease',
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/40',
  },
  deficiency: {
    icon: Leaf,
    label: 'Deficiency',
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/40',
  },
  healthy: {
    icon: ShieldCheck,
    label: 'Healthy',
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    border: 'border-green-500/40',
  },
};

const ScanResults = () => {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const scanResult = location.state?.scanResult as ScanResult | undefined;
  const capturedImage = location.state?.capturedImage as string | undefined;

  // Database lists
  const [allCrops, setAllCrops] = useState<Crop[]>([]);
  const [cropsLoading, setCropsLoading] = useState(true);

  // Active Wizard States
  const [currentCrop, setCurrentCrop] = useState<Crop | null>(null);
  const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
  const [cropProblems, setCropProblems] = useState<Problem[]>([]);
  const [problemsLoading, setProblemsLoading] = useState(false);

  // Wizard Steps: 1 = Confirm Crop, 2 = Confirm Problem / Diagnosis
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [isChangingCrop, setIsChangingCrop] = useState(false);
  const [isChangingProblem, setIsChangingProblem] = useState(false);

  const [matchingLoading, setMatchingLoading] = useState(false);

  // Guard: redirect if no state
  useEffect(() => {
    if (!location.state) {
      navigate('/home');
    }
  }, [location.state, navigate]);

  // 1. Fetch all crops from DB on load
  useEffect(() => {
    const fetchCrops = async () => {
      try {
        const { data, error } = await supabase.from('crops').select('*');
        if (error) throw error;
        setAllCrops(data || []);
      } catch (err) {
        console.error('Error fetching crops:', err);
        toast.error('Failed to load crops data');
      } finally {
        setCropsLoading(false);
      }
    };
    fetchCrops();
  }, []);

  // 2. Resolve AI's cropName string to database Crop row
  useEffect(() => {
    if (cropsLoading || !scanResult || allCrops.length === 0 || currentCrop) return;

    const aiCropName = scanResult.cropName.en.toLowerCase();
    
    // Attempt match in database crops
    const matchedCrop = allCrops.find(
      (c) =>
        c.name_en.toLowerCase().includes(aiCropName) ||
        aiCropName.includes(c.name_en.toLowerCase())
    );

    if (matchedCrop) {
      setCurrentCrop(matchedCrop);
    } else {
      // Fallback: Default to first crop so the app doesn't break, but let user correct
      setCurrentCrop(allCrops[0] || null);
    }
  }, [cropsLoading, scanResult, allCrops, currentCrop]);

  // 3. Fetch crop problems and resolve AI's problemName
  useEffect(() => {
    if (!currentCrop || !scanResult) return;

    const fetchProblems = async () => {
      setProblemsLoading(true);
      try {
        const { data, error } = await supabase
          .from('problems')
          .select('*')
          .eq('crop_id', currentCrop.id);
        if (error) throw error;

        setCropProblems(data || []);

        // Resolve AI's problemName to database problem
        const aiProblemName = scanResult.problemName.en.toLowerCase();
        
        let matchedProblem = (data || []).find(
          (p) =>
            p.title_en.toLowerCase().includes(aiProblemName) ||
            aiProblemName.includes(p.title_en.toLowerCase())
        );

        if (!matchedProblem) {
          // Fuzzy word split match
          const words = aiProblemName.split(/\s+/).filter((w) => w.length > 2);
          for (const word of words) {
            const matched = (data || []).find((p) => p.title_en.toLowerCase().includes(word));
            if (matched) {
              matchedProblem = matched;
              break;
            }
          }
        }

        // Set matched problem, or first problem, or healthy placeholder
        if (scanResult.problemType === 'healthy') {
          setCurrentProblem(null);
        } else {
          setCurrentProblem(matchedProblem || (data && data[0]) || null);
        }
      } catch (err) {
        console.error('Error fetching crop problems:', err);
        toast.error('Failed to load crop problems');
      } finally {
        setProblemsLoading(false);
      }
    };

    fetchProblems();
  }, [currentCrop, scanResult]);

  if (!scanResult || !capturedImage) {
    return null;
  }

  const confidencePercent = Math.round(scanResult.confidence);
  const getConfidenceBg = () => {
    if (confidencePercent > 80) return 'bg-green-500';
    if (confidencePercent >= 60) return 'bg-[#F59E0B]';
    return 'bg-red-500';
  };

  const severity = severityConfig[scanResult.severity] || severityConfig.medium;
  const problemType = problemTypeConfig[scanResult.problemType] || problemTypeConfig.disease;
  const ProblemIcon = problemType.icon;

  // Handle final submission
  const handleRecommendProducts = async () => {
    if (!currentCrop) {
      toast.error('Please confirm or select a crop first.');
      return;
    }

    // Healthy crop path - no products needed
    if (scanResult.problemType === 'healthy' && !currentProblem) {
      toast.success(
        language === 'te'
          ? 'పంట ఆరోగ్యంగా ఉందని నిర్ధారించబడింది.'
          : language === 'hi'
          ? 'फसल के स्वस्थ होने की पुष्टि हुई है।'
          : 'Crop confirmed healthy. Returning home.'
      );
      navigate('/home');
      return;
    }

    if (!currentProblem) {
      toast.error('Please confirm or select a crop problem.');
      return;
    }

    setMatchingLoading(true);
    try {
      // Step 4: Record analytics scan log
      try {
        await supabase.from('analytics').insert({
          crop_id: currentCrop.id,
          problem_id: currentProblem.id,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Analytics logging failed:', err);
      }

      // Navigate to products recommendations
      navigate('/products', {
        state: {
          crop: currentCrop,
          problems: [currentProblem],
          stage: undefined,
        },
      });
    } catch (error) {
      console.error('Error in confirmation products flow:', error);
      toast.error('Error loading recommendations');
    } finally {
      setMatchingLoading(false);
    }
  };

  // Helper to format text/keys in chosen language
  const getCropName = (c: Crop | null) => {
    if (!c) return '...';
    if (language === 'te') return c.name_te || c.name_en;
    if (language === 'hi') return c.name_hi || c.name_en;
    return c.name_en;
  };

  const getProblemTitle = (p: Problem | null) => {
    if (!p) {
      return scanResult.problemType === 'healthy' 
        ? (language === 'te' ? 'ఆరోగ్యకరమైనది' : language === 'hi' ? 'स्वस्थ' : 'Healthy')
        : '...';
    }
    if (language === 'te') return p.title_te || p.title_en;
    if (language === 'hi') return p.title_hi || p.title_en;
    return p.title_en;
  };

  return (
    <div className="min-h-screen bg-scan-results flex flex-col relative text-white">
      <HomeButton />
      <div className="absolute inset-0 bg-black/60 z-0" />

      {/* Demo Warning Banner */}
      {scanResult.isDemoFallback && (
        <div className="absolute top-16 left-0 right-0 z-50 bg-[#F59E0B] text-black px-4 py-2 flex items-center justify-center gap-2 font-bold text-sm text-center shadow-lg animate-fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{t('demoModeWarning')}</span>
        </div>
      )}

      <div className="container mx-auto px-4 py-12 pt-28 flex-1 relative z-10 max-w-6xl">
        {/* Step-by-Step Title Indicator */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-3 mb-4">
            <Sparkles className="w-8 h-8 text-[#4ADE80]" />
            <h1 className="text-4xl md:text-5xl font-display font-black text-[#4ADE80] drop-shadow-lg">
              Confirm Diagnosis
            </h1>
          </div>
          
          {/* Progress Steps UI */}
          <div className="flex items-center justify-center gap-3 max-w-sm mx-auto mt-2">
            <div className="flex items-center gap-2">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm transition-all duration-300 ${
                wizardStep === 1 
                  ? 'bg-[#4ADE80] text-[#1B4332] ring-4 ring-[#4ADE80]/30' 
                  : 'bg-[#4ADE80]/20 text-[#4ADE80] border border-[#4ADE80]/40'
              }`}>
                1
              </span>
              <span className={`text-sm font-bold transition-all duration-300 ${wizardStep === 1 ? 'text-[#4ADE80]' : 'text-white/60'}`}>
                Crop
              </span>
            </div>
            <div className="w-12 h-0.5 bg-white/20 rounded-full" />
            <div className="flex items-center gap-2">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm transition-all duration-300 ${
                wizardStep === 2 
                  ? 'bg-[#4ADE80] text-[#1B4332] ring-4 ring-[#4ADE80]/30' 
                  : 'bg-white/10 text-white/40 border border-white/10'
              }`}>
                2
              </span>
              <span className={`text-sm font-bold transition-all duration-300 ${wizardStep === 2 ? 'text-[#4ADE80]' : 'text-white/40'}`}>
                Problem
              </span>
            </div>
          </div>
        </div>

        {/* Core Layout - Split Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Image Card */}
          <div className="lg:col-span-5 relative animate-fade-in">
            <Card className="overflow-hidden rounded-[2.5rem] border-4 border-[#4ADE80]/30 shadow-[0_0_60px_rgba(74,222,128,0.2)] bg-black/40">
              <img
                src={capturedImage}
                alt="Captured crop"
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-6 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[#4ADE80]" />
                  <span className="text-white/90 text-sm font-bold">Your Captured Photo</span>
                </div>
                <div className={`${getConfidenceBg()} text-white font-black text-xs px-3.5 py-1.5 rounded-full shadow-md`}>
                  {confidencePercent}% AI Match
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Wizard Steps Panels */}
          <div className="lg:col-span-7">
            
            {/* Step 1: Crop Confirmation */}
            {wizardStep === 1 && (
              <Card className="bg-[#1B4332] rounded-[2.5rem] border-2 border-[#4ADE80]/20 p-8 md:p-10 animate-fade-in shadow-2xl relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-24 h-24 bg-[#4ADE80]/5 rounded-full blur-2xl" />
                
                <h2 className="text-sm uppercase tracking-wider text-[#4ADE80] font-black mb-1">Step 1 of 2</h2>
                <h3 className="text-2xl md:text-3xl font-display font-black mb-6 text-white">
                  {t('confirmCropQuestion')}
                </h3>

                {cropsLoading ? (
                  <div className="flex items-center gap-3 py-6 justify-center">
                    <Loader2 className="w-6 h-6 text-[#4ADE80] animate-spin" />
                    <span>Resolving crop in database...</span>
                  </div>
                ) : (
                  <>
                    {/* Resolved Crop Badge */}
                    <div className={`bg-[#0D1F16] border-2 ${currentCrop ? 'border-[#4ADE80]/30' : 'border-red-500/30'} rounded-2xl p-5 mb-8 flex items-center justify-between shadow-inner`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center border ${currentCrop ? 'bg-[#4ADE80]/15 border-[#4ADE80]/25' : 'bg-red-500/15 border-red-500/25'}`}>
                          <Leaf className={`w-7 h-7 ${currentCrop ? 'text-[#4ADE80]' : 'text-red-500'}`} />
                        </div>
                        <div>
                          <p className="text-xs text-white/50 font-bold uppercase tracking-wider">Identified Crop</p>
                          <p className="text-2xl font-black text-white">
                            {currentCrop ? getCropName(currentCrop) : `Not Supported (${scanResult.cropName[language]})`}
                          </p>
                        </div>
                      </div>
                      {currentCrop ? (
                        <CheckCircle className="w-8 h-8 text-[#4ADE80] drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]" />
                      ) : (
                        <AlertTriangle className="w-8 h-8 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                      )}
                    </div>

                    {/* Step Actions */}
                    {!currentCrop ? (
                      <div className="space-y-6">
                        <div className="flex items-start gap-3 text-red-400 text-sm font-bold bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                          <span>We could not find this crop in our database catalog. Please select your crop manually from the list below, or capture a new photo.</span>
                        </div>
                        <div className="flex gap-4">
                          <Button
                            onClick={() => navigate('/scan')}
                            className="flex-1 h-14 rounded-xl text-md font-bold bg-white text-[#1B4332] hover:bg-white/90"
                          >
                            <Camera className="mr-2 w-5 h-5" />
                            Try Scanning Again
                          </Button>
                        </div>
                        <div className="border-t border-white/10 pt-6">
                          <p className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">
                            {t('selectCorrectCrop')}
                          </p>
                          <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                            {allCrops.map((c) => {
                              const cName = language === 'te' ? c.name_te : language === 'hi' ? c.name_hi : c.name_en;
                              return (
                                <div
                                  key={c.id}
                                  onClick={() => {
                                    setCurrentCrop(c);
                                    setIsChangingCrop(false);
                                    setWizardStep(2);
                                    toast.success(`Crop selected: ${cName}`);
                                  }}
                                  className="p-3 rounded-xl border bg-white/5 border-white/10 text-white/80 hover:bg-white/10 flex items-center gap-3 cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                                >
                                  <span className="text-sm font-bold truncate">{cName}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : !isChangingCrop ? (
                      <div className="flex flex-col sm:flex-row gap-4">
                        <Button
                          onClick={() => setWizardStep(2)}
                          className="flex-1 h-16 rounded-2xl text-lg font-black bg-[#4ADE80] text-[#1B4332] hover:bg-white transition-all transform hover:scale-[1.02] shadow-lg shadow-[#4ADE80]/20"
                        >
                          {t('yesCorrect')}
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setIsChangingCrop(true)}
                          className="flex-1 h-16 rounded-2xl text-lg font-black border-2 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white transition-all"
                        >
                          {t('noChangeCrop')}
                        </Button>
                      </div>
                    ) : (
                      /* Crop Selection Grid when crop is changing */
                      <div className="border-t border-white/10 pt-6 animate-fade-in">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm font-bold text-white/60 uppercase tracking-wider">
                            {t('selectCorrectCrop')}
                          </p>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setIsChangingCrop(false)}
                            className="text-[#4ADE80] hover:text-white"
                          >
                            Cancel
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                          {allCrops.map((c) => {
                            const cName = language === 'te' ? c.name_te : language === 'hi' ? c.name_hi : c.name_en;
                            const isSelected = currentCrop?.id === c.id;
                            return (
                              <div
                                key={c.id}
                                onClick={() => {
                                  setCurrentCrop(c);
                                  setIsChangingCrop(false);
                                  setWizardStep(2);
                                  toast.success(`Crop changed to ${cName}`);
                                }}
                                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                                  isSelected
                                    ? 'bg-[#4ADE80]/25 border-[#4ADE80] text-white shadow-md shadow-[#4ADE80]/10'
                                    : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                                }`}
                              >
                                <span className="text-sm font-bold truncate">{cName}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card>
            )}

            {/* Step 2: Problem Confirmation */}
            {wizardStep === 2 && (
              <Card className="bg-[#1B4332] rounded-[2.5rem] border-2 border-[#4ADE80]/20 p-8 md:p-10 animate-fade-in shadow-2xl relative">
                
                {/* Back Button to Step 1 */}
                <button
                  onClick={() => {
                    setWizardStep(1);
                    setIsChangingProblem(false);
                  }}
                  className="text-white/60 hover:text-white flex items-center gap-1.5 text-sm font-bold mb-4 transition-colors group"
                >
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  Back to Crop Confirmation ({getCropName(currentCrop)})
                </button>

                <h2 className="text-sm uppercase tracking-wider text-[#4ADE80] font-black mb-1">Step 2 of 2</h2>
                <h3 className="text-2xl md:text-3xl font-display font-black mb-6 text-white">
                  {scanResult.problemType === 'healthy' && !currentProblem
                    ? 'Confirm Crop Health'
                    : t('confirmProblemQuestion')}
                </h3>

                {problemsLoading ? (
                  <div className="flex items-center gap-3 py-6 justify-center">
                    <Loader2 className="w-6 h-6 text-[#4ADE80] animate-spin" />
                    <span>Loading problems database...</span>
                  </div>
                ) : (
                  <>
                    {/* Active problem type card */}
                    <div className={`bg-[#0D1F16] border-2 ${
                      scanResult.problemType === 'healthy' && !currentProblem 
                        ? 'border-[#4ADE80]/30' 
                        : currentProblem 
                        ? 'border-[#4ADE80]/30' 
                        : 'border-red-500/30'
                    } rounded-2xl p-6 mb-8 shadow-inner`}>
                      
                      {/* Badge / Metadata */}
                      <div className="flex items-center justify-between mb-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${
                          scanResult.problemType === 'healthy' && !currentProblem 
                            ? 'bg-green-500/20 text-green-400 border-green-500/40' 
                            : currentProblem 
                            ? problemType.bg + ' ' + problemType.text + ' border ' + problemType.border 
                            : 'bg-red-500/20 text-red-400 border-red-500/40'
                        }`}>
                          {scanResult.problemType === 'healthy' && !currentProblem ? (
                            <ShieldCheck className="w-4 h-4" />
                          ) : (
                            <ProblemIcon className="w-4 h-4" />
                          )}
                          <span className="font-black text-xs uppercase tracking-wider">
                            {scanResult.problemType === 'healthy' && !currentProblem ? 'HEALTHY' : currentProblem ? problemType.label : 'NOT MATCHED'}
                          </span>
                        </div>
                        <span className="text-white/40 text-xs font-bold uppercase tracking-wider">
                          Crop: {getCropName(currentCrop)}
                        </span>
                      </div>

                      {/* Display problem name */}
                      <h4 className="text-2xl md:text-3xl font-display font-black text-white mb-4">
                        {currentProblem 
                          ? getProblemTitle(currentProblem) 
                          : scanResult.problemType === 'healthy' 
                          ? 'Healthy / No Issues Detected' 
                          : `Not Matched (${scanResult.problemName[language]})`}
                      </h4>

                      {/* Severity if diseased */}
                      {currentProblem && (
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">{t('severity')}</span>
                            <span className={`text-xs font-black uppercase tracking-wider ${
                              scanResult.severity === 'critical' ? 'text-red-400' : 'text-[#4ADE80]'
                            }`}>{severity.label}</span>
                          </div>
                          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className={`h-full ${severity.color} ${severity.width} rounded-full`} />
                          </div>
                        </div>
                      )}

                      {/* Description / Healthy message */}
                      <p className="text-sm text-white/70 leading-relaxed">
                        {currentProblem 
                          ? (language === 'te' 
                              ? currentProblem.description || scanResult.description.te
                              : language === 'hi'
                              ? currentProblem.description || scanResult.description.hi
                              : currentProblem.description || scanResult.description.en)
                          : scanResult.description[language]
                        }
                      </p>
                    </div>

                    {/* Symptoms block (if any) */}
                    {currentProblem && scanResult.symptoms.length > 0 && !isChangingProblem && (
                      <div className="mb-8">
                        <h5 className="text-xs font-black uppercase tracking-wider text-[#4ADE80] mb-3">{t('symptoms')}</h5>
                        <div className="flex flex-wrap gap-2">
                          {scanResult.symptoms.map((sym, idx) => (
                            <span key={idx} className="bg-[#4ADE80]/15 text-[#4ADE80] text-xs font-bold px-3 py-1.5 rounded-full border border-[#4ADE80]/20 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              {sym}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Similar cases/reference photos */}
                    {currentProblem && scanResult.referenceImageKeywords.length > 0 && !isChangingProblem && (
                      <div className="mb-8">
                        <h5 className="text-xs font-black uppercase tracking-wider text-[#4ADE80] mb-3">{t('similarCases')}</h5>
                        <div className="flex gap-3 overflow-x-auto pb-1 max-w-full">
                          {scanResult.referenceImageKeywords.slice(0, 3).map((kw, idx) => (
                            <div key={idx} className="flex-shrink-0 w-32 border border-white/10 rounded-lg overflow-hidden bg-black/20">
                              <img
                                src={`https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?q=80&w=200&auto=format&fit=crop`}
                                alt={kw}
                                className="w-full h-20 object-cover opacity-60"
                              />
                              <p className="text-[10px] p-1.5 text-white/50 text-center capitalize truncate">{kw}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {!currentProblem && scanResult.problemType !== 'healthy' ? (
                      <div className="space-y-6 animate-fade-in">
                        <div className="flex items-start gap-3 text-red-400 text-sm font-bold bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                          <span>We could not match this problem in our catalog database. Please select the correct problem manually from the list below, or try scanning again.</span>
                        </div>
                        <div className="flex gap-4">
                          <Button
                            onClick={() => navigate('/scan')}
                            className="flex-1 h-14 rounded-xl text-md font-bold bg-white text-[#1B4332] hover:bg-white/90"
                          >
                            <Camera className="mr-2 w-5 h-5" />
                            Try Scanning Again
                          </Button>
                        </div>
                        <div className="border-t border-white/10 pt-6">
                          <p className="text-sm font-bold text-white/60 uppercase tracking-wider mb-4">
                            {t('selectCorrectProblem')}
                          </p>
                          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {cropProblems.map((p) => {
                              const pTitle = language === 'te' ? p.title_te : language === 'hi' ? p.title_hi : p.title_en;
                              return (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    setCurrentProblem(p);
                                    setIsChangingProblem(false);
                                    toast.success(`Problem selected: ${pTitle}`);
                                  }}
                                  className="p-3 rounded-xl border bg-white/5 border-white/10 text-white/80 hover:bg-white/10 flex items-center justify-between cursor-pointer transition-all duration-300 hover:translate-x-1"
                                >
                                  <span className="text-sm font-bold truncate pr-4">{pTitle}</span>
                                  <Check className="w-4 h-4 text-[#4ADE80] opacity-0 hover:opacity-100 transition-opacity" />
                                </div>
                              );
                            })}
                            <div
                              onClick={() => {
                                setCurrentProblem(null);
                                setIsChangingProblem(false);
                                toast.success('Marked crop as Healthy');
                              }}
                              className="p-3 rounded-xl border bg-white/5 border-white/10 text-white/80 hover:bg-white/10 flex items-center justify-between cursor-pointer transition-all duration-300 hover:translate-x-1"
                            >
                              <span className="text-sm font-bold truncate text-[#4ADE80]">Mark as Healthy / Healthy Crop</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : !isChangingProblem ? (
                      <div className="flex flex-col sm:flex-row gap-4">
                        <Button
                          onClick={handleRecommendProducts}
                          disabled={matchingLoading}
                          className="flex-[2] h-16 rounded-2xl text-lg font-black bg-[#4ADE80] text-[#1B4332] hover:bg-white transition-all transform hover:scale-[1.02] shadow-lg shadow-[#4ADE80]/20 disabled:opacity-75"
                        >
                          {matchingLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : scanResult.problemType === 'healthy' && !currentProblem ? (
                            'Confirm & Finish'
                          ) : (
                            t('confirmProblem')
                          )}
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setIsChangingProblem(true)}
                          className="flex-1 h-16 rounded-2xl text-lg font-black border-2 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white transition-all"
                        >
                          {t('noChangeProblem')}
                        </Button>
                      </div>
                    ) : (
                      /* Problem Selection List when changing problem */
                      <div className="border-t border-white/10 pt-6 animate-fade-in">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm font-bold text-white/60 uppercase tracking-wider">
                            {t('selectCorrectProblem')}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsChangingProblem(false)}
                            className="text-[#4ADE80] hover:text-white"
                          >
                            Cancel
                          </Button>
                        </div>
                        {cropProblems.length === 0 ? (
                          <p className="text-white/50 text-sm">No other problems found in database for this crop.</p>
                        ) : (
                          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {cropProblems.map((p) => {
                              const pTitle = language === 'te' ? p.title_te : language === 'hi' ? p.title_hi : p.title_en;
                              const isSelected = currentProblem?.id === p.id;
                              return (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    setCurrentProblem(p);
                                    setIsChangingProblem(false);
                                    toast.success(`Problem changed to ${pTitle}`);
                                  }}
                                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all duration-300 hover:translate-x-1 ${
                                    isSelected
                                      ? 'bg-[#4ADE80]/20 border-[#4ADE80] text-white font-bold'
                                      : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                                  }`}
                                >
                                  <span className="text-sm truncate pr-4">{pTitle}</span>
                                  {isSelected && <Check className="w-4 h-4 text-[#4ADE80] flex-shrink-0" />}
                                </div>
                              );
                            })}

                            {/* Option to diagnose as healthy */}
                            <div
                              onClick={() => {
                                setCurrentProblem(null);
                                setIsChangingProblem(false);
                                toast.success('Marked crop as Healthy');
                              }}
                              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all duration-300 hover:translate-x-1 ${
                                !currentProblem
                                  ? 'bg-[#4ADE80]/20 border-[#4ADE80] text-white font-bold'
                                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                              }`}
                            >
                              <span className="text-sm truncate text-[#4ADE80]">Mark as Healthy / Healthy Crop</span>
                              {!currentProblem && <Check className="w-4 h-4 text-[#4ADE80] flex-shrink-0" />}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </Card>
            )}

          </div>

        </div>

      </div>
    </div>
  );
};

export default ScanResults;
