import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Package, Calculator, Sprout } from 'lucide-react';
import { ProductMapping, Problem, Crop } from '@/types/app';
import { toast } from 'sonner';
import { HomeButton } from '@/components/HomeButton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const ProductRecommendation = () => {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const { problemId } = useParams<{ problemId: string }>();
  const location = useLocation();

  const crop = (location.state as any)?.crop as Crop | undefined;
  const problems = (location.state as any)?.problems as Problem[] | undefined;
  const stage = (location.state as any)?.stage as string | undefined;

  const problemIds = problems?.map(p => p.id) || [];

  const [mappings, setMappings] = useState<(ProductMapping & { coveredProblems?: Problem[] })[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedMapping, setSelectedMapping] = useState<ProductMapping | null>(null);
  const [acres, setAcres] = useState('');
  const [showAcresDialog, setShowAcresDialog] = useState(false);
  const [combinationFound, setCombinationFound] = useState(true);

  useEffect(() => {
    if (problemIds.length === 0) {
      toast.error('Invalid problem selection');
      navigate('/');
      return;
    }

    const fetchProducts = async () => {
      try {
        let query = supabase
          .from('product_mappings' as any) 
          .select(`
            *,
            products (
              id,
              name,
              name_te,
              name_hi,
              description_te,
              description_hi,
              features_te,
              features_hi,
              image_url,
              scientific_formula,
              pack_sizes
            )
          `)
          .in('problem_id', problemIds)
          .eq('crop_id', crop?.id);

        if (stage) {
          query = query.eq('stage', stage);
        }

        const { data, error } = await query;

        if (error) throw error;

        const rawMappings = (data as unknown as ProductMapping[]) || [];
        
        // --- IMPROVED COVERAGE LOGIC ---
        // Goal: Show ALL products that provide the best possible coverage for remaining problems
        const finalMappings: (ProductMapping & { coveredProblems?: Problem[] })[] = [];
        const remainingProblemIds = new Set(problemIds);
        let firstIteration = true;
        let combinationFound = false;

        while (remainingProblemIds.size > 0) {
          // Group remaining considerations
          const productCoverageMap = new Map<string, { mapping: ProductMapping, coveredProblems: Set<string> }>();
          
          rawMappings.forEach(m => {
            if (!productCoverageMap.has(m.product_id)) {
              productCoverageMap.set(m.product_id, { mapping: m, coveredProblems: new Set() });
            }
            productCoverageMap.get(m.product_id)!.coveredProblems.add(m.problem_id);
          });

          // Find the maximum coverage possible for the remaining problems
          let maxCoverage = 0;
          for (const info of productCoverageMap.values()) {
            const currentCoverage = [...info.coveredProblems].filter(pId => remainingProblemIds.has(pId)).length;
            if (currentCoverage > maxCoverage) maxCoverage = currentCoverage;
          }

          if (maxCoverage === 0) break;

          if (firstIteration && maxCoverage > 1) {
            combinationFound = true;
          }

          // Collect ALL products that hit this max coverage
          const bestProductsForThisRound: string[] = [];
          for (const [productId, info] of productCoverageMap.entries()) {
            const currentCoverage = [...info.coveredProblems].filter(pId => remainingProblemIds.has(pId)).length;
            if (currentCoverage === maxCoverage) {
              bestProductsForThisRound.push(productId);
            }
          }

          // Add them to final list and update remaining problems
          const problemsCoveredInThisRound = new Set<string>();
          
          bestProductsForThisRound.forEach(productId => {
            const info = productCoverageMap.get(productId)!;
            const coveredInRound = (problems || []).filter(p => info.coveredProblems.has(p.id) && remainingProblemIds.has(p.id));
            
            // We also want to know ALL problems it solves from the ORIGINAL selection for the treatment plan
            const allCoveredFromSelection = (problems || []).filter(p => info.coveredProblems.has(p.id));

            finalMappings.push({
              ...info.mapping,
              coveredProblems: allCoveredFromSelection
            });

            coveredInRound.forEach(p => problemsCoveredInThisRound.add(p.id));
            
            // Remove product from consideration for next rounds
            rawMappings.splice(rawMappings.findIndex(m => m.product_id === productId), 1);
          });

          // Update remaining problems
          problemsCoveredInThisRound.forEach(pId => remainingProblemIds.delete(pId));
          firstIteration = false;
        }

        setMappings(finalMappings);
        setCombinationFound(combinationFound);
        if (!combinationFound && problemIds.length > 1) {
          toast.info('Showing individual solutions.');
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load products');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [JSON.stringify(problemIds), navigate]);

  const handleProductSelect = (mapping: ProductMapping) => {
    setSelectedMapping(mapping);
    setShowAcresDialog(true);
  };

  const handleGeneratePlan = async () => {
    if (!acres || Number(acres) <= 0) {
      toast.error('Enter valid acres');
      return;
    }

    if (!selectedMapping) return;

    try {
      const inserts = (problems || []).map(p => ({
        crop_id: crop?.id ?? null,
        problem_id: p.id,
        product_id: selectedMapping.products.id, 
        acres: Number(acres),
        language,
      }));
      await supabase.from('analytics').insert(inserts);
    } catch {
      // ignore analytics error
    }

    const selectedProblems = (selectedMapping as any).coveredProblems || problems || [];

    navigate('/treatment-plan', {
      state: {
        crop,
        problems: selectedProblems,
        product: selectedMapping,
        acres: Number(acres),
      },
    });
  };

  const getCropName = (c?: Crop) =>
    !c ? '—' : language === 'te' ? c.name_te : language === 'hi' ? c.name_hi : c.name_en;

  const getProblemTitle = (p?: Problem) =>
    !p ? '—' : language === 'te' ? p.title_te : language === 'hi' ? p.title_hi : p.title_en;

  const getProductName = (p?: any) =>
    !p ? '—' : language === 'te' ? (p.name_te || p.name) : language === 'hi' ? (p.name_hi || p.name) : p.name;

  return (
    <div className="min-h-screen bg-products-selection flex flex-col relative text-white">
      <HomeButton />
      <div className="absolute inset-0 bg-black/40 z-0"></div>

      <div className="container mx-auto px-4 py-12 pt-16 flex-1 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 animate-fade-in">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="text-white bg-[#1B4332] hover:bg-[#2D5A47] rounded-2xl h-14 px-8 text-xl font-bold border-2 border-[#4ADE80]/30 shadow-xl"
          >
            <ArrowLeft className="mr-3 h-6 w-6" />
            {t('selectProblem')}
          </Button>

          <div className="text-center md:text-right space-y-2">
            <p className="text-2xl text-[#4ADE80] font-black drop-shadow-md">
              {t('crop')}: <span className="text-white uppercase">{getCropName(crop)}</span>
            </p>
            <p className="text-2xl text-[#4ADE80] font-black drop-shadow-md">
              {t('problem')}: <span className="text-white uppercase">
                {problems?.map(p => getProblemTitle(p)).join(', ')}
              </span>
            </p>
            {stage && (
              <p className="text-lg text-white font-bold italic bg-white/10 px-4 py-1 rounded-full">
                {stage} Stage
              </p>
            )}
          </div>
        </div>

        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-display font-bold text-[#4ADE80] mb-4 drop-shadow-lg">
            {t('recommendedProducts')}
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
            {combinationFound || problemIds.length <= 1 
              ? "Choose the best solution for your crop's health" 
              : "No single product covers all selected problems. Showing best individual solutions below."}
          </p>
        </div>

        {loading ? (
          <div className="text-center text-2xl text-white/80 mt-20">
            <span className="animate-pulse">Fetching solutions...</span>
          </div>
        ) : mappings.length === 0 ? (
          <div className="text-center p-12 bg-white/10 backdrop-blur-md rounded-[2rem] border border-white/20 max-w-2xl mx-auto">
            <p className="text-2xl font-display font-medium">No products available for this problem at this stage.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {mappings.map((mapping) => {
              const product = mapping.products;
              
              return (
                <Card key={mapping.id} className="group overflow-hidden rounded-[2rem] border-2 border-[#4ADE80]/20 bg-[#1B4332] hover:bg-[#2D5A47] transition-all duration-500 shadow-2xl animate-fade-in flex flex-col h-full">
                  <div className="aspect-video w-full overflow-hidden relative">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={getProductName(product)}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                        <Package className="w-20 h-20 text-[#4ADE80]" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                    <div className="absolute bottom-4 left-6">
                      <span className="bg-[#4ADE80] text-[#1B4332] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                        Effective Formula
                      </span>
                    </div>
                  </div>

                    <div className="p-8 md:p-10 flex-1 flex flex-col">
                    <h3 className="text-4xl md:text-5xl font-display font-black text-white mb-6 leading-[1.1] drop-shadow-md">
                      {getProductName(product)}
                    </h3>

                    {mapping.coveredProblems && (
                      <div className="flex flex-wrap gap-2 mb-8">
                        {mapping.coveredProblems.map(p => (
                          <span key={p.id} className="bg-white/10 text-[#4ADE80] text-[10px] font-black px-3 py-1 rounded-full uppercase border border-[#4ADE80]/30">
                            Solves: {language === 'te' ? p.title_te : language === 'hi' ? p.title_hi : p.title_en}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="space-y-6 mb-10 text-white">
                      <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                        <div className="bg-[#4ADE80] p-3 rounded-xl mt-1 shadow-[0_0_15px_rgba(74,222,128,0.3)]">
                          <Sprout className="w-6 h-6 text-[#1B4332]" />
                        </div>
                        <div>
                          <p className="text-sm uppercase text-[#4ADE80] font-black tracking-widest mb-1">{t('dosagePerAcre')}</p>
                          <p className="text-2xl font-black leading-tight">{mapping.dosage_recommendation}</p>
                        </div>
                      </div>

                      {mapping.spray_interval && (
                        <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                          <div className="bg-[#4ADE80] p-3 rounded-xl mt-1 shadow-[0_0_15px_rgba(74,222,128,0.3)]">
                            <Calculator className="w-6 h-6 text-[#1B4332]" />
                          </div>
                          <div>
                            <p className="text-sm uppercase text-[#4ADE80] font-black tracking-widest mb-1">{t('sprayInterval')}</p>
                            <p className="text-2xl font-black leading-tight">{mapping.spray_interval}</p>
                          </div>
                        </div>
                      )}

                      {mapping.safety_notes && (
                        <div className="mt-4 p-6 bg-red-600/20 rounded-3xl border-2 border-red-500/30">
                          <p className="text-sm uppercase text-red-400 font-black tracking-widest mb-2">Safety Notes</p>
                          <p className="text-lg text-red-50 font-bold italic leading-relaxed">{mapping.safety_notes}</p>
                        </div>
                      )}
                    </div>

                    <Button 
                      className="w-full h-14 mt-auto rounded-2xl font-bold text-xl bg-[#4ADE80] text-[#1B4332] hover:bg-[#2E7D32] hover:text-white transition-all transform hover:scale-[1.02] shadow-lg shadow-[#4ADE80]/20" 
                      onClick={() => handleProductSelect(mapping)}
                    >
                      {t('select')}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showAcresDialog} onOpenChange={setShowAcresDialog}>
        <DialogContent className="sm:max-w-md bg-[#FDFBF7] border-none rounded-[2.5rem] p-10 overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-2 bg-[#4ADE80]"></div>
          <DialogHeader className="mb-8">
            <DialogTitle className="text-3xl font-display font-bold text-[#1B4332] flex items-center gap-3">
              <div className="bg-[#4ADE80]/10 p-2 rounded-xl">
                <Calculator className="h-8 w-8 text-[#2E7D32]" />
              </div>
              {t('enterAcres')}
            </DialogTitle>
            <DialogDescription className="text-lg text-[#405D4E] mt-2">
              Calculate precisely for: <span className="font-bold text-[#1B4332]">{getProductName(selectedMapping?.products)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-8">
            <div className="relative group">
              <Input
                type="number"
                step="0.1"
                min="0"
                value={acres}
                onChange={(e) => setAcres(e.target.value)}
                className="h-20 rounded-2xl text-3xl font-bold bg-[#E8F5E9] border-none text-[#1B4332] focus-visible:ring-4 focus-visible:ring-[#4ADE80] px-8 pl-14 transition-all"
                placeholder="0.0"
              />
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-bold text-[#2E7D32]/50">#</span>
              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-lg font-bold text-[#2E7D32]">Acres</span>
            </div>

            <Button 
              onClick={handleGeneratePlan} 
              size="lg" 
              className="w-full h-16 rounded-2xl text-xl font-bold bg-[#2E7D32] hover:bg-[#1B4332] text-white shadow-xl shadow-[#2E7D32]/20 transition-all transform active:scale-95"
            >
              {t('generatePlan')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductRecommendation;