import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/integrations/supabase/client';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export interface ScanResult {
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

export async function getMockScanResult(): Promise<ScanResult> {
  try {
    // 1. Fetch crops from supabase
    const { data: crops, error: cropsError } = await supabase
      .from('crops')
      .select('*');
    
    if (cropsError || !crops || crops.length === 0) {
      throw new Error('No crops found in DB');
    }
    
    // Pick a random crop
    const crop = crops[Math.floor(Math.random() * crops.length)];
    
    // 2. Fetch problems for this crop
    const { data: problems, error: problemsError } = await supabase
      .from('problems')
      .select('*')
      .eq('crop_id', crop.id);
      
    // Determine problem type and info
    if (problems && problems.length > 0) {
      const problem = problems[Math.floor(Math.random() * problems.length)];
      return {
        cropName: {
          en: crop.name_en || 'Unknown Crop',
          te: crop.name_te || crop.name_en || 'తెలియని పంట',
          hi: crop.name_hi || crop.name_en || 'अज्ञात फसल',
        },
        problemName: {
          en: problem.title_en || 'Disease/Pest',
          te: problem.title_te || problem.title_en || 'తెగులు',
          hi: problem.title_hi || problem.title_en || 'रोग/कीट',
        },
        problemType: (problem.problem_type as any) || 'disease',
        confidence: Math.round(75 + Math.random() * 20),
        description: {
          en: problem.description || `AI detected ${problem.title_en} affecting the crop.`,
          te: problem.description || `పంటను ప్రభావితం చేసే ${problem.title_en} ఉన్నట్లు గుర్తించబడింది.`,
          hi: problem.description || `फसल को प्रभावित करने वाले ${problem.title_en} का पता चला है।`,
        },
        symptoms: ['Yellowing leaves', 'Leaf spots', 'Reduced crop vigor'],
        severity: 'medium',
        referenceImageKeywords: [problem.title_en || 'crop disease', crop.name_en || 'plant'],
        isDemoFallback: true,
      };
    }
  } catch (dbError) {
    console.error('Failed to generate DB fallback mock:', dbError);
  }
  
  // High-fidelity hardcoded fallback if DB query fails completely
  return {
    cropName: { en: 'Tomato', te: 'టమోటా', hi: 'टमाटर' },
    problemName: { en: 'Early Blight', te: 'ఆకు మచ్చ తెగులు', hi: 'అగేతీ అంగమారీ' },
    problemType: 'disease',
    confidence: 85,
    description: {
      en: 'Tomato Early Blight is caused by the fungus Alternaria solani. It produces target-like spots on leaves and causes yellowing and leaf drop.',
      te: 'టమోటా ఆకు మచ్చ తెగులు ఆల్టర్నేరియా సోలాని అనే శిలీంద్రం వల్ల వస్తుంది. ఇది ఆకులపై మచ్చలను ఏర్పరుస్తుంది.',
      hi: 'टमाटर अगेती अंगमारी अल्टरनेरिया सोलानी नामक कवक के कारण होता है। यह पत्तियों पर लक्ष्य जैसे धब्बे बनाता है।'
    },
    symptoms: ['Dark brown concentric spots on older leaves', 'Yellowing surrounding spots', 'Premature leaf drop starting from base'],
    severity: 'medium',
    referenceImageKeywords: ['tomato early blight', 'alternaria solani', 'tomato leaf disease'],
    isDemoFallback: true,
  };
}

export async function analyzeCropImage(base64Image: string): Promise<ScanResult> {
  if (!API_KEY) {
    throw new Error(
      'Gemini API key is not configured. Please add VITE_GEMINI_API_KEY in your .env file and restart your Vite server (npm run dev).'
    );
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are an expert agricultural scientist and plant pathologist. Analyze the provided crop/plant image carefully and identify:

1. The crop or plant species shown in the image.
2. Any visible diseases, pest damage, or nutrient deficiencies.
3. If the plant appears healthy, indicate that.

You MUST respond with ONLY a valid JSON object (no markdown, no explanation, no extra text). The JSON must strictly follow this schema:

{
  "cropName": {
    "en": "<crop name in English>",
    "te": "<crop name in Telugu>",
    "hi": "<crop name in Hindi>"
  },
  "problemName": {
    "en": "<problem name in English, or 'Healthy' if no issues>",
    "te": "<problem name in Telugu, or 'ఆరోగ్యకరమైన' if no issues>",
    "hi": "<problem name in Hindi, or 'स्वस्थ' if no issues>"
  },
  "problemType": "<one of: 'pest', 'disease', 'deficiency', 'healthy'>",
  "confidence": <number from 0 to 100 indicating your confidence in the diagnosis>,
  "description": {
    "en": "<detailed description of the problem and its impact on the crop in English, 2-3 sentences>",
    "te": "<same description translated to Telugu>",
    "hi": "<same description translated to Hindi>"
  },
  "symptoms": [
    "<symptom 1 in English>",
    "<symptom 2 in English>",
    "<symptom 3 in English>"
  ],
  "severity": "<one of: 'low', 'medium', 'high', 'critical'>",
  "referenceImageKeywords": [
    "<search keyword 1 for finding similar reference images>",
    "<search keyword 2>",
    "<search keyword 3>",
    "<search keyword 4>",
    "<search keyword 5>"
  ]
}

IMPORTANT RULES:
- Respond with ONLY the JSON object. No markdown code fences, no backticks, no additional text.
- The "symptoms" array should contain 3-5 visible symptoms described in English.
- The "referenceImageKeywords" array should contain 3-5 keywords useful for image searching to find similar disease/pest references.
- If the crop appears healthy with no visible problems, set "problemType" to "healthy", "severity" to "low", and "confidence" to your confidence that the plant is healthy.
- The "confidence" value should reflect how certain you are about your diagnosis (0 = not sure at all, 100 = completely certain).
- Telugu and Hindi translations must be accurate and natural-sounding.
- Be specific about the disease/pest species when possible.`;

  try {
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: 'image/jpeg',
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    if (!text || text.trim().length === 0) {
      throw new Error(
        'Gemini returned an empty response. The image may not contain a recognizable crop.'
      );
    }

    // Strip markdown code blocks if present (```json ... ``` or ``` ... ```)
    let jsonString = text.trim();
    const codeBlockMatch = jsonString.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1].trim();
    }

    let scanResult: ScanResult;
    try {
      scanResult = JSON.parse(jsonString) as ScanResult;
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', text);
      throw new Error(
        'Failed to parse the analysis result. The AI response was not in the expected format.'
      );
    }

    // Validate essential fields
    if (!scanResult.cropName || !scanResult.problemType || !scanResult.description) {
      console.error('Incomplete scan result:', scanResult);
      throw new Error(
        'The analysis result is incomplete. Please try again with a clearer image.'
      );
    }

    // Clamp confidence to 0-100
    scanResult.confidence = Math.max(0, Math.min(100, scanResult.confidence ?? 50));

    // Ensure severity is valid
    const validSeverities = ['low', 'medium', 'high', 'critical'] as const;
    if (!validSeverities.includes(scanResult.severity)) {
      scanResult.severity = 'medium';
    }

    // Ensure problemType is valid
    const validTypes = ['pest', 'disease', 'deficiency', 'healthy'] as const;
    if (!validTypes.includes(scanResult.problemType)) {
      scanResult.problemType = 'disease';
    }

    return scanResult;
  } catch (error) {
    console.error('Gemini analysis failed:', error);
    let errorMsg = 'An unexpected error occurred during image analysis.';
    if (error instanceof Error) {
      errorMsg = error.message;
    }
    throw new Error(errorMsg);
  }
}
