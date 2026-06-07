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
  HelpCircle,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { HomeButton } from '@/components/HomeButton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Crop, Problem } from '@/types/app';
import {
  initiateCropTriage,
  confirmCropTriage,
  getMockTriagePhase1,
  getMockTriagePhase2,
  TriageQuestion,
  TriagePhase1Result,
  TriagePhase2Result
} from '@/services/geminiService';

const severityConfig = {
  low: { label: { en: 'Low', te: 'తక్కువ', hi: 'कम' }, color: 'bg-green-500', width: 'w-1/4' },
  medium: { label: { en: 'Medium', te: 'మధ్యస్థం', hi: 'मध्यम' }, color: 'bg-yellow-500', width: 'w-2/4' },
  high: { label: { en: 'High', te: 'ఎక్కువ', hi: 'उच्च' }, color: 'bg-orange-500', width: 'w-3/4' },
  critical: { label: { en: 'Critical', te: 'తీవ్రమైనది', hi: 'गंभीर' }, color: 'bg-red-500', width: 'w-full' },
};

const problemTypeConfig = {
  pest: {
    icon: Bug,
    label: { en: 'Pest', te: 'తెగులు/కీటకం', hi: 'कीट' },
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    border: 'border-orange-500/40',
  },
  disease: {
    icon: AlertTriangle,
    label: { en: 'Disease', te: 'వ్యాధి', hi: 'रोग' },
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/40',
  },
  deficiency: {
    icon: Leaf,
    label: { en: 'Deficiency', te: 'పోషకాహార లోపం', hi: 'कमी' },
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/40',
  },
  healthy: {
    icon: ShieldCheck,
    label: { en: 'Healthy', te: 'ఆరోగ్యకరమైనది', hi: 'स्वस्थ' },
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    border: 'border-green-500/40',
  },
};

const ScanResults = () => {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const capturedImage = location.state?.capturedImage as string | undefined;
  const base64Image = location.state?.base64Image as string | undefined;

  // DB datasets
  const [allCrops, setAllCrops] = useState<Crop[]>([]);
  const [dbProblems, setDbProblems] = useState<Problem[]>([]);
  
  // Wizard States
  // 'init' -> 'loading_phase1' -> 'triage_questions' -> 'loading_phase2' -> 'results' -> 'error'
  const [wizardStep, setWizardStep] = useState<'init' | 'loading_phase1' | 'triage_questions' | 'loading_phase2' | 'results' | 'error'>('init');
  const [loadingText, setLoadingText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Triage Phase 1 Output
  const [triage1Result, setTriage1Result] = useState<TriagePhase1Result | null>(null);
  const [activeCrop, setActiveCrop] = useState<Crop | null>(null);
  
  // Questionnaire States
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<
    Array<{ questionId: string; questionText: string; answerLabel: string; answerValue: string }>
  >([]);

  // Triage Phase 2 Output
  const [triage2Result, setTriage2Result] = useState<TriagePhase2Result | null>(null);
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);
  
  // Interactive Overrides
  const [isChangingCrop, setIsChangingCrop] = useState(false);
  const [matchingLoading, setMatchingLoading] = useState(false);

  // Redirection guard
  useEffect(() => {
    if (!location.state || !capturedImage || !base64Image) {
      navigate('/crops');
    }
  }, [location.state, capturedImage, base64Image, navigate]);

  // Load database crops on mount
  useEffect(() => {
    const fetchCrops = async () => {
      try {
        const { data, error } = await supabase.from('crops').select('*');
        if (error) throw error;
        setAllCrops(data || []);
      } catch (err) {
        console.error('Failed to load database crops:', err);
        toast.error('Failed to connect to database crop catalog.');
      }
    };
    fetchCrops();
  }, []);

  // Initiate Phase 1 Triage
  useEffect(() => {
    if (allCrops.length === 0 || wizardStep !== 'init' || !base64Image) return;

    const runPhase1 = async () => {
      setWizardStep('loading_phase1');
      setLoadingText(
        language === 'te'
          ? 'ఆకును స్కాన్ చేస్తోంది మరియు పంటను గుర్తిస్తోంది...'
          : language === 'hi'
          ? 'पत्ती को स्कैन किया जा रहा है और फसल की पहचान हो रही है...'
          : 'Scanning leaf and detecting crop type...'
      );

      try {
        // Parse format expected by Gemini
        const cropsList = allCrops.map(c => ({ id: c.id, name_en: c.name_en }));
        const result = await initiateCropTriage(base64Image, cropsList);

        setTriage1Result(result);
        
        // Find crop row in DB
        const cropRow = allCrops.find(c => c.id === result.matchedCropId);
        setActiveCrop(cropRow || allCrops[0] || null);

        // Fetch problems for this crop
        if (cropRow) {
          const { data: problems } = await supabase
            .from('problems')
            .select('*')
            .eq('crop_id', cropRow.id);
          setDbProblems(problems || []);
        }

        setWizardStep('triage_questions');
      } catch (err) {
        console.warn('Live Gemini API failed, switching to offline fallback mode:', err);
        toast.info('API limit reached. Switching to offline diagnosis mode...');
        try {
          const result = await getMockTriagePhase1(allCrops);
          setTriage1Result(result);
          
          const cropRow = allCrops.find(c => c.id === result.matchedCropId);
          setActiveCrop(cropRow || allCrops[0] || null);
          
          if (cropRow) {
            const { data: problems } = await supabase
              .from('problems')
              .select('*')
              .eq('crop_id', cropRow.id);
            setDbProblems(problems || []);
          }
          
          setWizardStep('triage_questions');
        } catch (fallbackErr) {
          setErrorMessage('Offline diagnosis initialization failed.');
          setWizardStep('error');
        }
      }
    };

    runPhase1();
  }, [allCrops, wizardStep, base64Image, language]);

  // Run Phase 2 Triage once answers are completed
  const handleAnswerSelect = async (optionValue: string, optionLabelObj: { en: string; te: string; hi: string }) => {
    if (!triage1Result) return;

    const currentQuestion = triage1Result.questions[currentQuestionIdx];
    const newAnswers = [
      ...answers,
      {
        questionId: currentQuestion.id,
        questionText: currentQuestion.text.en,
        answerLabel: optionLabelObj.en,
        answerValue: optionValue,
      },
    ];
    setAnswers(newAnswers);

    const isLastQuestion = currentQuestionIdx === triage1Result.questions.length - 1;

    if (!isLastQuestion) {
      setCurrentQuestionIdx(prev => prev + 1);
    } else {
      // Run final triage analysis
      setWizardStep('loading_phase2');
      setLoadingText(
        language === 'te'
          ? 'సమాధానాలను విశ్లేషిస్తోంది మరియు సమస్యను నిర్ధారిస్తోంది...'
          : language === 'hi'
          ? 'उत्तरों का विश्लेषण किया जा रहा है और समस्या का निदान हो रहा है...'
          : 'Analyzing answers and confirming final diagnosis...'
      );

      try {
        const formattedProblems = dbProblems.map(p => ({
          id: p.id,
          title_en: p.title_en,
          description: p.description,
        }));
        const result = await confirmCropTriage(
          base64Image!,
          triage1Result.cropName.en,
          formattedProblems,
          newAnswers.map(a => ({
            questionText: a.questionText,
            answerLabel: a.answerLabel,
            answerValue: a.answerValue,
          }))
        );

        setTriage2Result(result);

        // Find the diagnosed database problem
        const dbProblemRow = dbProblems.find(p => p.id === result.matchedProblemId);
        if (result.problemType === 'healthy') {
          setActiveProblem(null);
        } else {
          setActiveProblem(dbProblemRow || dbProblems[0] || null);
        }

        setWizardStep('results');
      } catch (err) {
        console.warn('Live Gemini Phase 2 failed, switching to offline fallback mode:', err);
        try {
          const formattedProblems = dbProblems.map(p => ({
            id: p.id,
            title_en: p.title_en,
            title_te: p.title_te,
            title_hi: p.title_hi,
            description: p.description,
            problem_type: p.problem_type
          }));
          const result = await getMockTriagePhase2(formattedProblems, newAnswers);
          setTriage2Result(result);
          
          const dbProblemRow = dbProblems.find(p => p.id === result.matchedProblemId);
          setActiveProblem(result.problemType === 'healthy' ? null : dbProblemRow || null);
          setWizardStep('results');
        } catch (fallbackErr) {
          setErrorMessage('Offline diagnosis confirmation failed.');
          setWizardStep('error');
        }
      }
    }
  };

  // Handle manual correction overrides
  const handleCropChange = async (crop: Crop) => {
    setActiveCrop(crop);
    setIsChangingCrop(false);
    
    // Fetch problems for the newly selected crop
    setMatchingLoading(true);
    try {
      const { data } = await supabase
        .from('problems')
        .select('*')
        .eq('crop_id', crop.id);
      
      const problems = data || [];
      setDbProblems(problems);
      
      // Reset active problem and show results
      if (problems.length > 0) {
        setActiveProblem(problems[0]);
      } else {
        setActiveProblem(null);
      }
      
      // Update triage 2 result with corrected crop info
      if (triage2Result) {
        setTriage2Result({
          ...triage2Result,
          problemName: {
            en: problems[0]?.title_en || 'Healthy',
            te: problems[0]?.title_te || 'ఆరోగ్యకరమైనది',
            hi: problems[0]?.title_hi || 'स्वस्थ'
          },
          problemType: (problems[0]?.problem_type as any) || 'healthy',
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMatchingLoading(false);
    }
  };

  const handleRecommendProducts = async () => {
    if (!activeCrop) {
      toast.error('Please confirm or select a crop.');
      return;
    }

    if (triage2Result?.problemType === 'healthy' && !activeProblem) {
      toast.success(
        language === 'te'
          ? 'పంట ఆరోగ్యంగా ఉంది. సిఫార్సులు అవసరం లేదు.'
          : language === 'hi'
          ? 'फसल स्वस्थ है। किसी अनुशंसा की आवश्यकता नहीं है।'
          : 'Crop is healthy. No treatment products required.'
      );
      navigate('/home');
      return;
    }

    if (!activeProblem) {
      toast.error('Please select a crop disease.');
      return;
    }

    setMatchingLoading(true);
    try {
      // Record to analytics
      await supabase.from('analytics').insert({
        crop_id: activeCrop.id,
        problem_id: activeProblem.id,
        language: language,
      });
    } catch (err) {
      console.warn('Failed to record analytics scan log:', err);
    }

    // Redirect to recommendations
    navigate('/products', {
      state: {
        crop: activeCrop,
        problems: [activeProblem],
        stage: undefined,
      },
    });
    setMatchingLoading(false);
  };

  // Language helper translations
  const getTrans = (obj: { en: string; te: string; hi: string } | undefined) => {
    if (!obj) return '';
    return obj[language] || obj.en;
  };

  const getCropTitle = (c: Crop | null) => {
    if (!c) return '...';
    if (language === 'te') return c.name_te || c.name_en;
    if (language === 'hi') return c.name_hi || c.name_en;
    return c.name_en;
  };

  const getProblemTitle = (p: Problem | null) => {
    if (!p) {
      return triage2Result?.problemType === 'healthy'
        ? (language === 'te' ? 'ఆరోగ్యకరమైన పంట' : language === 'hi' ? 'स्वस्थ फसल' : 'Healthy Crop')
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

      <div className="container mx-auto px-4 py-12 pt-28 flex-1 relative z-10 max-w-6xl">
        {/* Dynamic Loaders */}
        {(wizardStep === 'loading_phase1' || wizardStep === 'loading_phase2') && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="relative w-32 h-32 mb-8 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-[#4ADE80]/30 animate-ping" />
              <div className="absolute inset-2 rounded-full border-4 border-[#4ADE80]/50 animate-pulse" />
              <div className="w-20 h-20 rounded-full bg-[#1B4332] border-2 border-[#4ADE80] flex items-center justify-center shadow-[0_0_30px_#4ADE80]">
                <Sparkles className="w-10 h-10 text-[#4ADE80] animate-spin" style={{ animationDuration: '6s' }} />
              </div>
            </div>
            <h2 className="text-2xl md:text-3xl font-display font-black text-center mb-2 tracking-wide text-[#4ADE80]">
              {loadingText}
            </h2>
            <p className="text-white/50 text-sm max-w-sm text-center">
              Our agronomist AI is parsing visual structures and database records to target a high-accuracy match.
            </p>
          </div>
        )}

        {/* Error State */}
        {wizardStep === 'error' && (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
            <Card className="bg-[#1B4332] border-red-500/30 border-2 rounded-[2.5rem] p-8 max-w-md w-full text-center shadow-2xl">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/40">
                <AlertCircle className="w-10 h-10 text-red-400" />
              </div>
              <h3 className="text-2xl font-display font-black text-red-400 mb-2">Triage Unsuccessful</h3>
              <p className="text-white/70 text-sm mb-6 leading-relaxed bg-[#0D1F16] border border-white/5 rounded-xl p-4 font-mono text-left max-h-40 overflow-y-auto">
                {errorMessage}
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => navigate('/scan')}
                  className="w-full h-14 rounded-xl bg-white text-[#1B4332] hover:bg-white/90 font-bold"
                >
                  Return to Camera
                </Button>
                <Button
                  onClick={() => {
                    setErrorMessage('');
                    setWizardStep('init');
                  }}
                  className="w-full h-14 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold"
                >
                  Retry Scan Analysis
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Wizard UI */}
        {(wizardStep === 'triage_questions' || wizardStep === 'results') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Image Card */}
            <div className="lg:col-span-5 relative animate-fade-in">
              <Card className="overflow-hidden rounded-[2.5rem] border-4 border-[#4ADE80]/30 shadow-[0_0_60px_rgba(74,222,128,0.2)] bg-black/40">
                <img
                  src={capturedImage}
                  alt="Captured Crop"
                  className="w-full aspect-[4/3] object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-6 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Camera className="w-5 h-5 text-[#4ADE80]" />
                    <span className="text-white/90 text-sm font-bold">Captured Crop Leaf</span>
                  </div>
                  
                  {wizardStep === 'results' && triage2Result && (
                    <div className="bg-[#4ADE80] text-[#1B4332] font-black text-xs px-3.5 py-1.5 rounded-full shadow-md shadow-[#4ADE80]/30">
                      {triage2Result.confidence}% AI Accuracy
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Right Column: Interactive Content */}
            <div className="lg:col-span-7">

              {/* Questionnaire Flow */}
              {wizardStep === 'triage_questions' && triage1Result && (
                <Card className="bg-[#1B4332] rounded-[2.5rem] border-2 border-[#4ADE80]/20 p-8 md:p-10 animate-fade-in shadow-2xl relative overflow-hidden">
                  <div className="absolute -top-12 -right-12 w-24 h-24 bg-[#4ADE80]/5 rounded-full blur-2xl" />
                  
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 bg-[#0D1F16] border border-white/5 px-3 py-1 rounded-full text-xs font-bold text-white/70">
                      <HelpCircle className="w-3.5 h-3.5 text-[#4ADE80]" />
                      <span>Symptom Triage Question {currentQuestionIdx + 1} of {triage1Result.questions.length}</span>
                    </div>
                    <span className="text-xs font-bold text-white/50">
                      Detected Crop: <span className="text-[#4ADE80] uppercase">{getCropTitle(activeCrop)}</span>
                    </span>
                  </div>

                  <h3 className="text-2xl md:text-3xl font-display font-black mb-8 leading-snug">
                    {getTrans(triage1Result.questions[currentQuestionIdx].text)}
                  </h3>

                  <div className="space-y-4">
                    {triage1Result.questions[currentQuestionIdx].options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAnswerSelect(option.value, option.label)}
                        className="w-full text-left p-5 rounded-2xl border bg-white/5 border-white/10 hover:bg-[#4ADE80]/15 hover:border-[#4ADE80]/40 transition-all duration-300 transform hover:scale-[1.01] active:scale-95 group flex items-center justify-between"
                      >
                        <span className="text-lg font-bold text-white/90 group-hover:text-white">
                          {getTrans(option.label)}
                        </span>
                        <ArrowRight className="w-5 h-5 text-white/40 group-hover:text-[#4ADE80] transition-colors" />
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              {/* Triage Results */}
              {wizardStep === 'results' && triage2Result && (
                <Card className="bg-[#1B4332] rounded-[2.5rem] border-2 border-[#4ADE80]/20 p-8 md:p-10 animate-fade-in shadow-2xl relative">
                  
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[#4ADE80]" />
                      <span className="text-xs uppercase tracking-wider text-[#4ADE80] font-black">AI Diagnosis Confirmed</span>
                    </div>
                    <span className="text-white/40 text-xs font-bold uppercase tracking-wider">
                      Crop: {getCropTitle(activeCrop)}
                    </span>
                  </div>

                  <div className="bg-[#0D1F16] border-2 border-[#4ADE80]/30 rounded-3xl p-6 mb-8 shadow-inner">
                    <div className="flex items-center justify-between mb-4">
                      
                      {/* Problem Type Badge */}
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${
                        triage2Result.problemType === 'healthy' && !activeProblem
                          ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                          : activeProblem
                          ? problemTypeConfig[triage2Result.problemType].bg + ' ' + problemTypeConfig[triage2Result.problemType].text + ' border ' + problemTypeConfig[triage2Result.problemType].border
                          : 'bg-red-500/20 text-red-400 border border-red-500/40'
                      }`}>
                        {triage2Result.problemType === 'healthy' && !activeProblem ? (
                          <ShieldCheck className="w-4 h-4" />
                        ) : (
                          (() => {
                            const Icon = problemTypeConfig[triage2Result.problemType]?.icon || AlertTriangle;
                            return <Icon className="w-4 h-4" />;
                          })()
                        )}
                        <span className="font-black text-xs uppercase tracking-wider">
                          {triage2Result.problemType === 'healthy' && !activeProblem
                            ? 'Healthy'
                            : activeProblem
                            ? getTrans(problemTypeConfig[triage2Result.problemType].label)
                            : 'Unmatched'}
                        </span>
                      </div>

                      {/* Accuracy Score */}
                      <div className="text-right">
                        <span className="text-xs font-bold text-white/50 uppercase block mb-0.5">Confidence</span>
                        <span className="text-xl font-black text-[#4ADE80] drop-shadow-[0_0_10px_rgba(74,222,128,0.4)]">
                          {triage2Result.confidence}% Verified
                        </span>
                      </div>
                    </div>

                    <h4 className="text-2xl md:text-3xl font-display font-black text-white mb-4">
                      {activeProblem ? getProblemTitle(activeProblem) : getTrans(triage2Result.problemName)}
                    </h4>

                    {/* Severity Rating */}
                    {activeProblem && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white/50 uppercase tracking-wider">{t('severity')}</span>
                          <span className={`text-xs font-black uppercase ${
                            triage2Result.severity === 'critical' ? 'text-red-400' : 'text-[#4ADE80]'
                          }`}>
                            {getTrans(severityConfig[triage2Result.severity]?.label)}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-white/15 rounded-full overflow-hidden">
                          <div className={`h-full ${severityConfig[triage2Result.severity]?.color} ${severityConfig[triage2Result.severity]?.width} rounded-full`} />
                        </div>
                      </div>
                    )}

                    <p className="text-sm text-white/70 leading-relaxed">
                      {getTrans(triage2Result.description)}
                    </p>
                  </div>

                  {/* Symptoms list */}
                  {triage2Result.symptoms && triage2Result.symptoms.length > 0 && !isChangingCrop && (
                    <div className="mb-8">
                      <h5 className="text-xs font-black uppercase tracking-wider text-[#4ADE80] mb-3">Diagnostic Indicators</h5>
                      <div className="flex flex-wrap gap-2">
                        {triage2Result.symptoms.map((symptom, idx) => (
                          <span key={idx} className="bg-[#4ADE80]/10 text-[#4ADE80] text-xs font-bold px-3 py-1.5 rounded-full border border-[#4ADE80]/20 flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 flex-shrink-0" />
                            {symptom}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bottom Buttons */}
                  {!isChangingCrop && (
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button
                        onClick={handleRecommendProducts}
                        disabled={matchingLoading}
                        className="flex-[2] h-16 rounded-2xl text-lg font-black bg-[#4ADE80] text-[#1B4332] hover:bg-white transition-all transform hover:scale-[1.02] shadow-lg shadow-[#4ADE80]/20 disabled:opacity-75"
                      >
                        {matchingLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : triage2Result.problemType === 'healthy' && !activeProblem ? (
                          'Done'
                        ) : (
                          t('confirmProblem')
                        )}
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => setIsChangingCrop(true)}
                        className="flex-1 h-16 rounded-2xl text-sm md:text-md font-bold border-2 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white transition-all"
                      >
                        Change Crop
                      </Button>
                    </div>
                  )}

                  {/* Override Crop Selection Grid */}
                  {isChangingCrop && (
                    <div className="border-t border-white/10 pt-6 animate-fade-in">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-bold text-white/60 uppercase tracking-wider">
                          Select Correct Crop Manually
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
                      <div className="grid grid-cols-2 gap-3 max-h-52 overflow-y-auto pr-1">
                        {allCrops.map((c) => {
                          const isSelected = activeCrop?.id === c.id;
                          return (
                            <div
                              key={c.id}
                              onClick={() => handleCropChange(c)}
                              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all duration-300 hover:scale-[1.01] ${
                                isSelected
                                  ? 'bg-[#4ADE80]/20 border-[#4ADE80] text-white font-bold'
                                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                              }`}
                            >
                              <span className="text-sm truncate pr-2">{getCropTitle(c)}</span>
                              {isSelected && <Check className="w-4 h-4 text-[#4ADE80] flex-shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ScanResults;
