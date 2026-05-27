import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bug } from 'lucide-react';
import { Problem, Crop } from '@/types/app';
import { toast } from 'sonner';
import { HomeButton } from '@/components/HomeButton';

// Helper to get high-quality Unsplash images for common problems
const getProblemImage = (problem: Problem) => {
  if (problem.image_url && problem.image_url.startsWith('http')) return problem.image_url;
  
  const title = (problem.title_en || '').toLowerCase();
  
  if (title.includes('pest') || title.includes('insect') || title.includes('bug') || title.includes('borer')) {
    return 'https://images.unsplash.com/photo-1543997385-322199f116a4?q=80&w=800&auto=format&fit=crop';
  }
  if (title.includes('disease') || title.includes('blast') || title.includes('blight') || title.includes('leaf spot') || title.includes('rot')) {
    return 'https://images.unsplash.com/photo-1599307734063-81f687a05bab?q=80&w=800&auto=format&fit=crop';
  }
  if (title.includes('nutri') || title.includes('deficiency') || title.includes('yellow')) {
    return 'https://images.unsplash.com/photo-1615485500704-8e990f3900f7?q=80&w=800&auto=format&fit=crop';
  }
  if (title.includes('healthy')) {
    return 'https://images.unsplash.com/photo-1530836361253-efad5cb2feee?q=80&w=800&auto=format&fit=crop';
  }

  return 'https://images.unsplash.com/photo-1560493676-04071c5f467b?q=80&w=800&auto=format&fit=crop';
};

const ProblemSelection = () => {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const { cropId } = useParams<{ cropId: string }>();
  const location = useLocation();
  const crop = location.state?.crop as Crop;
  const stage = location.state?.stage as string | undefined;
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblems, setSelectedProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [problemsRes, mappingsRes] = await Promise.all([
          supabase
            .from('problems')
            .select('*')
            .eq('crop_id', cropId),
          supabase
            .from('product_mappings' as any)
            .select('problem_id, stage')
            .eq('crop_id', cropId)
        ]);

        if (problemsRes.error) throw problemsRes.error;

        const allProblems = problemsRes.data || [];
        const mappings = mappingsRes.data || [];

        const filteredProblems = allProblems.filter(problem => {
          const problemMappings = mappings.filter((m: any) => m.problem_id === problem.id);
          const specificStages = problemMappings
            .map((m: any) => m.stage)
            .filter((s: string) => s && s !== 'All Stages');

          const isGeneralProblem = specificStages.length === 0;

          if (!stage || stage === 'All Stages') {
            return isGeneralProblem;
          } else {
            const isMappedToCurrentStage = problemMappings.some((m: any) => m.stage === stage);
            return isMappedToCurrentStage;
          }
        });

        setProblems(filteredProblems);
      } catch (error) {
        console.error('Error fetching problems:', error);
        toast.error('Failed to load problems');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [cropId, stage]);

  const handleProblemSelect = (problem: Problem) => {
    setSelectedProblems(prev => {
      const isSelected = prev.some(p => p.id === problem.id);
      if (isSelected) {
        return prev.filter(p => p.id !== problem.id);
      } else {
        return [...prev, problem];
      }
    });
  };

  const handleProceed = () => {
    if (selectedProblems.length === 0) {
      toast.error('Please select at least one problem');
      return;
    }
    navigate(`/products`, { state: { crop, problems: selectedProblems, stage } });
  };

  const getProblemTitle = (problem: Problem) => {
    if (language === 'te') return problem.title_te;
    if (language === 'hi') return problem.title_hi;
    return problem.title_en;
  };

  const getCropName = (crop: Crop) => {
    if (language === 'te') return crop.name_te;
    if (language === 'hi') return crop.name_hi;
    return crop.name_en;
  };

  return (
    <div className="min-h-screen bg-problems-selection flex flex-col relative text-white">
      <HomeButton />
      <div className="absolute inset-0 bg-black/50 z-0"></div> 

      <div className="container mx-auto px-4 py-12 pt-16 flex-1 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 animate-fade-in">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="text-white bg-[#1B4332] hover:bg-[#2D5A47] rounded-2xl h-14 px-8 text-xl font-bold border-2 border-[#4ADE80]/30 shadow-xl"
          >
            <ArrowLeft className="mr-3 h-6 w-6" />
            {t('selectCrop')}
          </Button>

          <div className="text-center md:text-right space-y-2">
            <p className="text-2xl text-[#4ADE80] font-black drop-shadow-md">
              {t('crop')}: <span className="text-white uppercase">{getCropName(crop)}</span>
            </p>
            {stage && (
              <p className="text-lg text-white font-bold italic bg-white/10 px-4 py-1 rounded-full">
                {stage} Stage
              </p>
            )}
          </div>
        </div>

        <div className="text-center mb-16 animate-fade-in">
          <h1 className="text-5xl md:text-7xl font-display font-black text-[#4ADE80] mb-6 drop-shadow-lg">
            {t('selectProblem')}
          </h1>
          <p className="text-xl md:text-2xl text-white font-medium max-w-2xl mx-auto drop-shadow-md">
            Identify the issue affecting your crop
          </p>
        </div>

        {loading ? (
          <div className="text-center text-3xl text-[#4ADE80] mt-20 font-bold animate-pulse">
            Fetching Problems...
          </div>
        ) : problems.length === 0 ? (
          <div className="text-center p-12 bg-white/10 backdrop-blur-md rounded-[3rem] border-2 border-dashed border-white/20 max-w-2xl mx-auto">
            <p className="text-3xl font-bold mb-6">No problems found for this stage.</p>
            <Button onClick={() => navigate(-1)} className="bg-[#4ADE80] text-[#1B4332] h-16 px-10 rounded-2xl text-xl font-black">{t('goBack')}</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12 max-w-7xl mx-auto pb-24">
            {problems.map((problem) => {
              const isSelected = selectedProblems.some(p => p.id === problem.id);
              return (
                <Card
                  key={problem.id}
                  className={`group relative overflow-hidden rounded-[3rem] border-4 transition-all duration-500 shadow-2xl cursor-pointer animate-fade-in ${
                    isSelected ? 'border-[#4ADE80] bg-[#2D5A47] scale-[1.02]' : 'border-[#4ADE80]/20 bg-[#1B4332] hover:bg-[#2D5A47]'
                  }`}
                  onClick={() => handleProblemSelect(problem)}
                >
                  <div className="aspect-[3/2] w-full overflow-hidden relative">
                    <img
                      src={problem.image_url || getProblemImage(problem)}
                      alt={problem.title_en}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent group-hover:from-black/100 transition-all duration-500"></div>
                    {isSelected && (
                      <div className="absolute top-6 right-6 bg-[#4ADE80] text-[#1B4332] p-3 rounded-full shadow-xl animate-bounce">
                        <Bug className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  <div className="p-8 md:p-10 text-center">
                    <h3 className="text-3xl md:text-5xl font-display font-black text-white mb-4 tracking-tight leading-tight">
                      {language === 'te' ? problem.title_te : language === 'hi' ? problem.title_hi : problem.title_en}
                    </h3>
                    <p className="text-xl text-[#4ADE80] font-bold line-clamp-3 leading-relaxed mb-6">
                      {problem.description || (language === 'te' ? 'సమస్య వివరణ' : language === 'hi' ? 'समस्या का विवरण' : 'Identifying details...')}
                    </p>
                    <div className={`inline-flex items-center gap-2 p-1 px-4 rounded-full font-black text-sm uppercase tracking-widest transition-colors ${
                      isSelected ? 'bg-white text-[#1B4332]' : 'bg-[#4ADE80] text-[#1B4332] group-hover:bg-white'
                    }`}>
                      {isSelected ? 'Selected' : 'Detect Issue'}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {selectedProblems.length > 0 && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
            <Button
              onClick={handleProceed}
              className="bg-[#4ADE80] text-[#1B4332] hover:bg-white h-20 px-12 rounded-[2rem] text-3xl font-black shadow-[0_0_50px_rgba(74,222,128,0.5)] border-4 border-white transition-all transform hover:scale-110 active:scale-95"
            >
              Recommend Products ({selectedProblems.length})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProblemSelection;
