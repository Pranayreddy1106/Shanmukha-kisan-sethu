import { supabase } from '@/integrations/supabase/client';

export interface TriageQuestion {
  id: string;
  text: { en: string; te: string; hi: string };
  options: {
    label: { en: string; te: string; hi: string };
    value: string;
  }[];
}

export interface TriagePhase1Result {
  matchedCropId: string;
  cropName: { en: string; te: string; hi: string };
  potentialProblems: {
    title: string;
    reason: string;
  }[];
  questions: TriageQuestion[];
  isDemoFallback?: boolean;
}

export interface TriagePhase2Result {
  matchedProblemId: string;
  problemName: { en: string; te: string; hi: string };
  problemType: 'pest' | 'disease' | 'deficiency' | 'healthy';
  confidence: number;
  description: { en: string; te: string; hi: string };
  symptoms: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  referenceImageKeywords: string[];
  isDemoFallback?: boolean;
}

// ─── Phase 1 Fallback (Demo) ──────────────────────────────────
export async function getMockTriagePhase1(
  knownCrops: { id: string; name_en: string; name_te: string; name_hi: string }[]
): Promise<TriagePhase1Result> {
  const crop = knownCrops.length > 0
    ? knownCrops[Math.floor(Math.random() * knownCrops.length)]
    : { id: 'rice-id', name_en: 'Rice', name_te: 'వరి', name_hi: 'चावल' };

  const questions: TriageQuestion[] = [
    {
      id: 'q1',
      text: {
        en: 'Are the spots dry and papery, or do they look slimy/water-soaked?',
        te: 'మచ్చలు ఎండిపోయి కాగితంలా ఉన్నాయా, లేదా జిగటగా/నీటితో తడిసినట్లు ఉన్నాయా?',
        hi: 'क्या धब्बे सूखे और कागजी हैं, या वे चिपचिपे/पानी से भीगे हुए दिखते हैं?',
      },
      options: [
        {
          label: { en: 'Dry & Papery', te: 'ఎండిపోయి కాగితంలా', hi: 'सूखे और कागजी' },
          value: 'dry',
        },
        {
          label: { en: 'Slimy / Water-soaked', te: 'నీటితో తడిసినట్లు', hi: 'चिपचिपे / पानी से भीगे' },
          value: 'slimy',
        },
        {
          label: { en: 'Not sure / Normal', te: 'తెలియదు / సాధారణం', hi: 'पता नहीं / सामान्य' },
          value: 'unknown',
        },
      ],
    },
    {
      id: 'q2',
      text: {
        en: 'Where did the yellowing start on the crop?',
        te: 'పంటపై పసుపు రంగు ఎక్కడ ప్రారంభమైంది?',
        hi: 'फसल पर पीलापन कहाँ से शुरू हुआ?',
      },
      options: [
        {
          label: { en: 'Lower older leaves first', te: 'కింది పాత ఆకులపై మొదట', hi: 'पहले निचली पुरानी पत्तियों पर' },
          value: 'lower',
        },
        {
          label: { en: 'Upper new leaves first', te: 'పై కొత్త ఆకులపై మొదట', hi: 'पहले ऊपरी नई पत्तियों पर' },
          value: 'upper',
        },
        {
          label: { en: 'Spread uniformly across plant', te: 'మొక్క అంతటా సమానంగా వ్యాపించింది', hi: 'पूरे पौधे पर समान रूप से फैला है' },
          value: 'uniform',
        },
      ],
    },
  ];

  return {
    matchedCropId: crop.id,
    cropName: {
      en: crop.name_en,
      te: crop.name_te || crop.name_en,
      hi: crop.name_hi || crop.name_en,
    },
    potentialProblems: [
      { title: 'Blast / Leaf Spot', reason: 'Visual patterns suggest fungal infection.' },
      { title: 'Nutrient Deficiency', reason: 'Chlorosis observed in veins.' },
    ],
    questions,
    isDemoFallback: true,
  };
}

// ─── Phase 2 Fallback (Demo) ──────────────────────────────────
export async function getMockTriagePhase2(
  problemsList: { id: string; title_en: string; title_te: string; title_hi: string; description: string | null; problem_type: string | null }[],
  answers: { questionId: string; questionText: string; answerLabel: string; answerValue: string }[]
): Promise<TriagePhase2Result> {
  if (problemsList.length === 0) {
    return {
      matchedProblemId: 'healthy-id',
      problemName: { en: 'Healthy Crop', te: 'ఆరోగ్యకరమైన పంట', hi: 'स्वस्थ फसल' },
      problemType: 'healthy',
      confidence: 95,
      description: {
        en: 'The crop appears to be healthy with optimal nutrients and no active pathogen indicators.',
        te: 'పంట సరైన పోషకాలతో ఆరోగ్యంగా ఉంది.',
        hi: 'फसल इष्टतम पोषक तत्वों के साथ स्वस्थ दिखाई दे रही है।',
      },
      symptoms: ['Green leaves', 'Strong stalk', 'Healthy growth'],
      severity: 'low',
      referenceImageKeywords: ['healthy plant'],
      isDemoFallback: true,
    };
  }

  const problem = problemsList[Math.floor(Math.random() * problemsList.length)];
  return {
    matchedProblemId: problem.id,
    problemName: {
      en: problem.title_en,
      te: problem.title_te || problem.title_en,
      hi: problem.title_hi || problem.title_en,
    },
    problemType: (problem.problem_type as any) || 'disease',
    confidence: Math.round(92 + Math.random() * 6),
    description: {
      en: problem.description || `AI confirmed ${problem.title_en} based on leaf spot shapes and dry margin symptoms.`,
      te: problem.description || `ఆకు మచ్చ ఆకారాలు మరియు పొడి అంచుల లక్షణాల ఆధారంగా AI ${problem.title_en}ను నిర్ధారించింది.`,
      hi: problem.description || `पत्ती के धब्बों और सूखे किनारों के लक्षणों के आधार पर AI ने ${problem.title_en} की पुष्टि की।`,
    },
    symptoms: [
      'Visual brown concentric rings on foliage',
      `Leaf triage responses matching '${answers[0]?.answerLabel || 'Dry'}'`,
      `Symptom initiation points matching '${answers[1]?.answerLabel || 'Lower leaves'}'`
    ],
    severity: 'medium',
    referenceImageKeywords: [problem.title_en, 'crop disease'],
    isDemoFallback: true,
  };
}

// ─── Live Phase 1 Secure Backend Call ───────────────────────
export async function initiateCropTriage(
  base64Image: string,
  knownCrops: { id: string; name_en: string }[]
): Promise<TriagePhase1Result> {
  try {
    const { data, error } = await supabase.functions.invoke('crop-triage', {
      body: {
        action: 'initiate',
        image: base64Image,
        knownCrops
      }
    });

    if (error) throw error;
    if (!data) {
      throw new Error('Received empty response from triage backend.');
    }
    if (data.error) {
      throw new Error(data.error);
    }

    return data as TriagePhase1Result;
  } catch (error) {
    console.error('Phase 1 Edge Function Triage failed:', error);
    throw new Error(error instanceof Error ? error.message : 'Triage initialization failed.');
  }
}

// ─── Live Phase 2 Secure Backend Call ───────────────────────
export async function confirmCropTriage(
  base64Image: string,
  cropNameEn: string,
  problemsList: { id: string; title_en: string; description: string | null }[],
  answers: { questionText: string; answerLabel: string; answerValue: string }[]
): Promise<TriagePhase2Result> {
  try {
    const { data, error } = await supabase.functions.invoke('crop-triage', {
      body: {
        action: 'confirm',
        image: base64Image,
        cropName: cropNameEn,
        problemsList,
        answers
      }
    });

    if (error) throw error;
    if (!data) {
      throw new Error('Received empty response from confirmation backend.');
    }
    if (data.error) {
      throw new Error(data.error);
    }

    return data as TriagePhase2Result;
  } catch (error) {
    console.error('Phase 2 Edge Function Triage failed:', error);
    throw new Error(error instanceof Error ? error.message : 'Triage confirmation failed.');
  }
}
