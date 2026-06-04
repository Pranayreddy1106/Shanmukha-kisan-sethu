import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'te' | 'hi';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    appTitle: 'Shanmukha Agritech',
    appSubtitle: '',
    selectLanguage: 'Select Language',
    english: 'English',
    telugu: 'తెలుగు',
    hindi: 'हिंदी',
    startDiagnosis: 'Start Diagnosis',
    aboutUs: 'About Shanmukha Agro',
    loginManager: 'Login as Manager',
    loginAdmin: 'Login as Admin',
    selectCrop: 'Select Your Crop',
    selectProblem: 'Select Problem',
    recommendedProducts: 'Recommended Products',
    enterAcres: 'Enter Number of Acres',
    generatePlan: 'Generate Treatment Plan',
    treatmentPlan: 'Treatment Plan',
    crop: 'Crop',
    problem: 'Problem',
    product: 'Product',
    acres: 'Acres',
    dosagePerAcre: 'Dosage per Acre',
    totalDosage: 'Total Required Dosage',
    packSizes: 'Pack Sizes Available',
    recommendedPack: 'Recommended Pack Size',
    packsNeeded: 'packs needed',
    sprayInterval: 'Spray Interval',
    safetyNotes: 'Safety Notes',
    downloadPDF: 'Download PDF',
    shareWhatsApp: 'Share on WhatsApp',
    backToHome: 'Back to Home',
    select: 'Select',
    home: 'Home',
    scientificFormula: 'Scientific Formula',
    modeOfAction: 'Mode of Action',
    features: 'Features',
    targetPests: 'Target Pests',
    targetDiseases: 'Target Diseases',
    targetWeeds: 'Target Weeds',
    scanCrop: 'Scan Your Crop',
    scanCropDesc: 'Take a photo to detect crop problems instantly',
    scanning: 'Analyzing your crop...',
    scanComplete: 'Scan Complete',
    detectedProblem: 'Detected Problem',
    confidence: 'Confidence',
    severity: 'Severity',
    symptoms: 'Symptoms',
    similarCases: 'Similar Cases',
    confirmProblem: 'Yes, Get Products',
    scanAgain: 'Scan Again',
    cropHealthy: 'Your crop looks healthy!',
    noProblemDetected: 'No issues detected in this image',
    capturePhoto: 'Take Photo',
    uploadPhoto: 'Upload Photo',
    switchCamera: 'Switch Camera',
    cameraAccessDenied: 'Camera access denied. You can still upload a photo.',
    matchingProducts: 'Finding matching products...',
    noProductMatch: 'No exact product match found. Try manual diagnosis.',
    confirmCropQuestion: 'Is this your crop?',
    confirmProblemQuestion: 'Is this the problem?',
    yesCorrect: 'Yes, Correct',
    noChangeCrop: 'No, Select Crop',
    noChangeProblem: 'No, Select Problem',
    selectCorrectCrop: 'Select Correct Crop',
    selectCorrectProblem: 'Select Correct Problem',
    demoModeWarning: 'Demo Mode: API rate limit reached. Using simulated diagnosis.',
    aiScannerCardTitle: 'AI Scanner',
    aiScannerCardDesc: 'Scan crop with camera to identify problems',
  },
  te: {
    appTitle: 'షణ్ముఖ అగ్రిటెక్',
    appSubtitle: '',
    selectLanguage: 'భాషను ఎంచుకోండి',
    english: 'English',
    telugu: 'తెలుగు',
    hindi: 'हिंदी',
    startDiagnosis: 'రోగ నిర్ధారణ ప్రారంభించండి',
    aboutUs: 'షణ్ముఖ అగ్రో గురించి',
    loginManager: 'మేనేజర్‌గా లాగిన్',
    loginAdmin: 'అడ్మిన్‌గా లాగిన్',
    selectCrop: 'మీ పంటను ఎంచుకోండి',
    selectProblem: 'సమస్యను ఎంచుకోండి',
    recommendedProducts: 'సిఫార్సు చేయబడిన ఉత్పత్తులు',
    enterAcres: 'ఎకరాల సంఖ్యను నమోదు చేయండి',
    generatePlan: 'చికిత్స ప్రణాళిక రూపొందించండి',
    treatmentPlan: 'చికిత్స ప్రణాళిక',
    crop: 'పంట',
    problem: 'సమస్య',
    product: 'ఉత్పత్తి',
    acres: 'ఎకరాలు',
    dosagePerAcre: 'ఎకరానికి మోతాదు',
    totalDosage: 'మొత్తం అవసరమైన మోతాదు',
    packSizes: 'అందుబాటులో ఉన్న ప్యాక్ పరిమాణాలు',
    recommendedPack: 'సిఫార్సు చేయబడిన ప్యాక్ పరిమాణం',
    packsNeeded: 'ప్యాక్‌లు అవసరం',
    sprayInterval: 'స్ప్రే విరామం',
    safetyNotes: 'భద్రతా గమనికలు',
    downloadPDF: 'PDF డౌన్‌లోడ్',
    shareWhatsApp: 'వాట్సాప్‌లో షేర్ చేయండి',
    backToHome: 'హోమ్‌కు తిరిగి వెళ్లండి',
    select: 'ఎంచుకోండి',
    home: 'హోమ్',
    scientificFormula: 'శాస్త్రీయ సూత్రం',
    modeOfAction: 'పని విధానం',
    features: 'లక్షణాలు',
    targetPests: 'లక్ష్య తెగుళ్ళు',
    targetDiseases: 'లక్ష్య వ్యాధులు',
    targetWeeds: 'లక్ష్య కలుపు మొక్కలు',
    scanCrop: 'మీ పంటను స్కాన్ చేయండి',
    scanCropDesc: 'పంట సమస్యలను తెలుసుకోవడానికి ఫోటో తీయండి',
    scanning: 'మీ పంటను విశ్లేషిస్తోంది...',
    scanComplete: 'స్కాన్ పూర్తయింది',
    detectedProblem: 'గుర్తించిన సమస్య',
    confidence: 'నమ్మకం',
    severity: 'తీవ్రత',
    symptoms: 'లక్షణాలు',
    similarCases: 'సారూప్య కేసులు',
    confirmProblem: 'అవును, ఉత్పత్తులు చూపించు',
    scanAgain: 'మళ్ళీ స్కాన్ చేయండి',
    cropHealthy: 'మీ పంట ఆరోగ్యంగా ఉంది!',
    noProblemDetected: 'ఈ చిత్రంలో సమస్యలు కనుగొనబడలేదు',
    capturePhoto: 'ఫోటో తీయండి',
    uploadPhoto: 'ఫోటో అప్‌లోడ్ చేయండి',
    switchCamera: 'కెమెరా మార్చండి',
    cameraAccessDenied: 'కెమెరా యాక్సెస్ నిరాకరించబడింది. మీరు ఫోటో అప్‌లోడ్ చేయవచ్చు.',
    matchingProducts: 'సరిపోయే ఉత్పత్తులను కనుగొంటోంది...',
    noProductMatch: 'ఖచ్చితమైన ఉత్పత్తి సరిపోలిక కనుగొనబడలేదు. మాన్యువల్ డయాగ్నసిస్ ప్రయత్నించండి.',
    confirmCropQuestion: 'ఇది మీ పంటా?',
    confirmProblemQuestion: 'ఇది సమస్యనా?',
    yesCorrect: 'అవును, నిజమే',
    noChangeCrop: 'కాదు, పంటను ఎంచుకోండి',
    noChangeProblem: 'కాదు, సమస్యను ఎంచుకోండి',
    selectCorrectCrop: 'సరైన పంటను ఎంచుకోండి',
    selectCorrectProblem: 'సరైన సమస్యను ఎంచుకోండి',
    demoModeWarning: 'డెమో మోడ్: API పరిమితి పూర్తయింది. అనుకరణ నిర్ధారణ ఉపయోగించబడుతోంది.',
    aiScannerCardTitle: 'AI స్కానర్',
    aiScannerCardDesc: 'సమస్యలను గుర్తించడానికి కెమెరాతో మీ పంటను స్కాన్ చేయండి',
  },
  hi: {
    appTitle: 'शनमुख एग्रीटेक',
    appSubtitle: '',
    selectLanguage: 'भाषा चुनें',
    english: 'English',
    telugu: 'తెలుగు',
    hindi: 'हिंदी',
    startDiagnosis: 'निदान शुरू करें',
    aboutUs: 'शनमुख एग्रो के बारे में',
    loginManager: 'प्रबंधक के रूप में लॉगिन',
    loginAdmin: 'व्यवस्थापक के रूप में लॉगिन',
    selectCrop: 'अपनी फसल चुनें',
    selectProblem: 'समस्या चुनें',
    recommendedProducts: 'अनुशंसित उत्पाद',
    enterAcres: 'एकड़ की संख्या दर्ज करें',
    generatePlan: 'उपचार योजना बनाएं',
    treatmentPlan: 'उपचार योजना',
    crop: 'फसल',
    problem: 'समस्या',
    product: 'उत्पाद',
    acres: 'एकड़',
    dosagePerAcre: 'प्रति एकड़ खुराक',
    totalDosage: 'कुल आवश्यक खुराक',
    packSizes: 'उपलब्ध पैक आकार',
    recommendedPack: 'अनुशंसित पैक आकार',
    packsNeeded: 'पैक की आवश्यकता',
    sprayInterval: 'स्प्रे अंतराल',
    safetyNotes: 'सुरक्षा नोट्स',
    downloadPDF: 'PDF डाउनलोड करें',
    shareWhatsApp: 'व्हाट्सएप पर शेयर करें',
    backToHome: 'होम पर वापस',
    select: 'चुनें',
    home: 'होम',
    scientificFormula: 'वैज्ञानिक सूत्र',
    modeOfAction: 'क्रिया विधि',
    features: 'विशेषताएं',
    targetPests: 'लक्ष्य कीट',
    targetDiseases: 'लक्ष्य रोग',
    targetWeeds: 'लक्ष्य खरपतवार',
    scanCrop: 'अपनी फसल स्कैन करें',
    scanCropDesc: 'फसल समस्याओं का पता लगाने के लिए फोटो लें',
    scanning: 'आपकी फसल का विश्लेषण हो रहा है...',
    scanComplete: 'स्कैन पूरा हुआ',
    detectedProblem: 'पहचानी गई समस्या',
    confidence: 'विश्वास',
    severity: 'गंभीरता',
    symptoms: 'लक्षण',
    similarCases: 'समान मामले',
    confirmProblem: 'हाँ, उत्पाद दिखाएं',
    scanAgain: 'फिर से स्कैन करें',
    cropHealthy: 'आपकी फसल स्वस्थ है!',
    noProblemDetected: 'इस छवि में कोई समस्या नहीं मिली',
    capturePhoto: 'फोटो लें',
    uploadPhoto: 'फोटो अपलोड करें',
    switchCamera: 'कैमरा बदलें',
    cameraAccessDenied: 'कैमरा एक्सेस अस्वीकृत। आप फोटो अपलोड कर सकते हैं।',
    matchingProducts: 'मिलते-जुलते उत्पाद खोज रहे हैं...',
    noProductMatch: 'कोई सटीक उत्पाद मिलान नहीं मिला। मैनुअल निदान प्रयास करें।',
    confirmCropQuestion: 'क्या यह आपकी फसल है?',
    confirmProblemQuestion: 'क्या यह समस्या है?',
    yesCorrect: 'हाँ, सही है',
    noChangeCrop: 'नहीं, फसल चुनें',
    noChangeProblem: 'नहीं, समस्या चुनें',
    selectCorrectCrop: 'सही फसल चुनें',
    selectCorrectProblem: 'सही समस्या चुनें',
    demoModeWarning: 'डेमो मोड: एपीआई सीमा समाप्त। सिम्युलेटेड निदान का उपयोग किया जा रहा है।',
    aiScannerCardTitle: 'एआई स्कैनर',
    aiScannerCardDesc: 'समस्याओं की पहचान करने के लिए कैमरे से अपनी फसल को स्कैन करें',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // Initialize from localStorage if available
    const saved = localStorage.getItem('shanmukha-language');
    return (saved as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('shanmukha-language', lang);
  };

  // Sync with localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('shanmukha-language');
    if (saved && ['en', 'te', 'hi'].includes(saved)) {
      setLanguageState(saved as Language);
    }
  }, []);

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations.en] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
