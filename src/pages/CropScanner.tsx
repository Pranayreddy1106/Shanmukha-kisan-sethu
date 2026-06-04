import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, SwitchCamera, Upload, X, Loader2, Zap, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { HomeButton } from '@/components/HomeButton';
import { analyzeCropImage, getMockScanResult } from '@/services/geminiService';
import { toast } from 'sonner';

const CropScanner = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [activeCapturedImage, setActiveCapturedImage] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [shutterFlash, setShutterFlash] = useState(false);

  // Labels for the UI in all three languages
  const labels = {
    scanning: { en: 'Analyzing your crop...', te: 'మీ పంటను విశ్లేషిస్తోంది...', hi: 'आपकी फसल का विश्लेषण हो रहा है...' },
    cameraPermission: { en: 'Camera access is needed to scan crops', te: 'పంటలను స్కాన్ చేయడానికి కెమెరా ప్రాప్యత అవసరం', hi: 'फसल स्कैन करने के लिए कैमरा एक्सेस आवश्यक है' },
    uploadInstead: { en: 'Upload a photo instead', te: 'బదులుగా ఫోటో అప్‌లోడ్ చేయండి', hi: 'इसके बजाय एक फोटो अपलोड करें' },
    gallery: { en: 'Gallery', te: 'గ్యాలరీ', hi: 'गैलरी' },
    capture: { en: 'Capture', te: 'క్యాప్చర్', hi: 'कैप्चर' },
    switchCam: { en: 'Switch', te: 'మార్చు', hi: 'बदलें' },
    scanTitle: { en: 'Crop Scanner', te: 'పంట స్కానర్', hi: 'फसल स्कैनर' },
    aiPowered: { en: 'AI-Powered Analysis', te: 'AI-ఆధారిత విశ్లేషణ', hi: 'AI-संचालित विश्लेषण' },
    errorAnalysis: { en: 'Failed to analyze image. Please try again.', te: 'చిత్రాన్ని విశ్లేషించడం విఫలమైంది. దయచేసి మళ్ళీ ప్రయత్నించండి.', hi: 'छवि विश्लेषण विफल. कृपया पुन: प्रयास करें.' },
    errorCamera: { en: 'Unable to access camera', te: 'కెమెరాను యాక్సెస్ చేయలేము', hi: 'कैमरा एक्सेस करने में असमर्थ' },
  };

  const l = (key: keyof typeof labels) => labels[key][language] || labels[key].en;

  // ─── Camera Lifecycle ──────────────────────────────────────
  const startCamera = useCallback(async () => {
    // Stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
        setCameraError(false);
      }
    } catch (err) {
      console.error('Camera access denied or unavailable:', err);
      setCameraError(true);
      setCameraReady(false);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();

    return () => {
      // Cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [startCamera]);

  // ─── Switch Camera ─────────────────────────────────────────
  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // ─── Capture Image ─────────────────────────────────────────
  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current || isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    // Shutter animation
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 150);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const base64Data = dataUrl.split(',')[1];

    await runAnalysis(base64Data, dataUrl);
  };

  // ─── Gallery Upload ────────────────────────────────────────
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isScanning) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const base64Data = dataUrl.split(',')[1];
      await runAnalysis(base64Data, dataUrl);
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be selected again
    event.target.value = '';
  };

  // ─── Shared Analysis Logic ─────────────────────────────────
  const runAnalysis = async (base64Data: string, capturedImage: string) => {
    setIsScanning(true);
    setScanError(null);
    setActiveCapturedImage(capturedImage);

    try {
      const scanResult = await analyzeCropImage(base64Data);
      navigate('/scan-results', { state: { scanResult, capturedImage } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : l('errorAnalysis');
      console.error('AI Analysis failed:', msg);
      setScanError(msg);
      setIsScanning(false);
    }
  };

  const handleSimulatedDemo = async () => {
    if (!activeCapturedImage) return;
    setIsScanning(true);
    setScanError(null);
    try {
      const scanResult = await getMockScanResult();
      navigate('/scan-results', { state: { scanResult, capturedImage: activeCapturedImage } });
    } catch (error) {
      toast.error('Demo simulation failed');
      setIsScanning(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black relative overflow-hidden select-none">
      {/* Home Button */}
      <HomeButton className="bg-black/40 text-white border-white/20 hover:bg-black/60 hover:text-white" />

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input for gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Camera preview or fallback */}
      {cameraError ? (
        /* ── Camera Denied State ─────────────────────────── */
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#1B4332] to-black px-6">
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col items-center gap-6 max-w-sm w-full animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
              <Camera className="w-10 h-10 text-red-400" />
            </div>
            <p className="text-white/90 text-center text-lg font-medium leading-relaxed">
              {l('cameraPermission')}
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-14 rounded-2xl bg-[#4ADE80] hover:bg-[#3BC96F] text-[#1B4332] font-bold text-lg gap-2"
            >
              <Upload className="w-5 h-5" />
              {l('uploadInstead')}
            </Button>
          </div>
        </div>
      ) : (
        /* ── Live Camera Feed ────────────────────────────── */
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Shutter flash overlay */}
      {shutterFlash && (
        <div className="absolute inset-0 bg-white z-40 pointer-events-none animate-pulse" />
      )}

      {/* ── Scanning Overlay ───────────────────────────────── */}
      {isScanning && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-6">
          {/* Animated scan line */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="w-full h-[2px] bg-[#4ADE80] shadow-[0_0_15px_#4ADE80,0_0_30px_#4ADE80]"
              style={{
                animation: 'scanLine 2s ease-in-out infinite',
              }}
            />
          </div>

          {/* Center content */}
          <div className="relative z-10 flex flex-col items-center gap-5 animate-fade-in">
            <div className="w-24 h-24 rounded-full bg-[#4ADE80]/20 flex items-center justify-center animate-pulse">
              <Zap className="w-12 h-12 text-[#4ADE80]" />
            </div>
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 text-[#4ADE80] animate-spin" />
              <p className="text-white text-xl font-display font-bold tracking-wide">
                {l('scanning')}
              </p>
            </div>
            <p className="text-white/50 text-sm">{l('aiPowered')}</p>
          </div>
        </div>
      )}

      {/* ── Top Bar Info ────────────────────────────────────── */}
      {cameraReady && !isScanning && (
        <div className="absolute top-0 left-0 right-0 z-20 pt-16 pb-4 px-6 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-4 h-4 text-[#4ADE80]" />
            <p className="text-white/90 text-sm font-medium">{l('scanTitle')}</p>
          </div>
        </div>
      )}

      {/* ── Camera Controls ────────────────────────────────── */}
      {!cameraError && (
        <div className="absolute bottom-0 left-0 right-0 z-20">
          {/* Gradient background */}
          <div className="bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-16 pb-10 px-6">
            <div className="flex items-center justify-around max-w-md mx-auto">
              {/* Gallery button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="flex flex-col items-center gap-2 group disabled:opacity-40"
              >
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all group-hover:bg-white/30 group-active:scale-95">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <span className="text-white/70 text-xs font-medium">{l('gallery')}</span>
              </button>

              {/* Capture button */}
              <button
                onClick={captureImage}
                disabled={isScanning || !cameraReady}
                className="group disabled:opacity-40"
              >
                <div className="w-20 h-20 rounded-full border-[4px] border-white flex items-center justify-center transition-all group-active:scale-90">
                  <div className="w-16 h-16 rounded-full bg-white transition-all group-hover:bg-white/90 group-active:bg-[#4ADE80]" />
                </div>
              </button>

              {/* Switch camera button */}
              <button
                onClick={handleSwitchCamera}
                disabled={isScanning}
                className="flex flex-col items-center gap-2 group disabled:opacity-40"
              >
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all group-hover:bg-white/30 group-active:scale-95">
                  <SwitchCamera className="w-6 h-6 text-white" />
                </div>
                <span className="text-white/70 text-xs font-medium">{l('switchCam')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Error Overlay ─────────────────────────────────── */}
      {scanError && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 select-text">
          <Card className="bg-[#1B4332] rounded-[2.5rem] border-2 border-red-500/30 p-8 max-w-md w-full text-center animate-fade-in shadow-2xl relative">
            <div className="bg-red-500/25 border border-red-500/35 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            
            <h2 className="text-2xl font-display font-black text-red-400 mb-3">
              AI Scan Unsuccessful
            </h2>
            
            <p className="text-sm text-white/70 mb-6 leading-relaxed bg-[#0D1F16] border border-white/5 rounded-xl p-4 font-mono text-left max-h-40 overflow-y-auto">
              {scanError}
            </p>

            <div className="flex flex-col gap-3">
              <Button
                onClick={() => setScanError(null)}
                className="w-full h-14 rounded-xl bg-white text-[#1B4332] hover:bg-white/90 text-lg font-bold transition-all"
              >
                Try Scanning Again
              </Button>
              <Button
                onClick={handleSimulatedDemo}
                variant="outline"
                className="w-full h-14 rounded-xl border-2 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white text-lg font-bold transition-all"
              >
                Use Simulated Diagnosis (Demo)
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Scan line keyframes — injected via style tag */}
      <style>{`
        @keyframes scanLine {
          0% { transform: translateY(0); }
          50% { transform: translateY(100vh); }
          100% { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default CropScanner;
