import React, { useState, useEffect, useRef } from 'react';
import { Camera, Check, Loader2, X, LogOut, Plus, Trash2, Image, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, DryingCycle } from '../../utils/api';
import { toast } from 'sonner@2.0.3';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../utils/i18n';

export default function OperatorView() {
  const { logout } = useAuth();
  const { t } = useLanguage();
  const [cycles, setCycles] = useState<DryingCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedChamber, setSelectedChamber] = useState<number | null>(null);
  
  // Staged Photos (new photos to add)
  const [stagedPhotos, setStagedPhotos] = useState<{file: File, url: string}[]>([]);
  // Existing Photos (already saved)
  const [existingPhotos, setExistingPhotos] = useState<{path: string, url: string, caption?: string}[]>([]);
  
  // Lightbox for viewing photos
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chambers 1-21
  const chambers = Array.from({ length: 21 }, (_, i) => i + 1);

  const fetchCycles = async () => {
    try {
      const data = await api.getCycles();
      setCycles(data.filter((c: any) => c.status === 'In Progress' && !c.endDate));
    } catch (e) {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCycles();
    const interval = setInterval(fetchCycles, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleChamberClick = async (chamberId: number) => {
    setSelectedChamber(chamberId);
    setStagedPhotos([]);
    
    // Load existing photos for this chamber
    const cycle = cycles.find(c => c.chamberNumber === chamberId);
    if (cycle && cycle.recipePhotos && cycle.recipePhotos.length > 0) {
      // Server already provides signed URLs in the 'url' field
      const photos = cycle.recipePhotos.map((p: any) => ({
        path: p.path,
        url: p.url,  // Use signed URL from server
        caption: p.caption
      }));
      setExistingPhotos(photos);
    } else {
      setExistingPhotos([]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setStagedPhotos(prev => [...prev, { file, url }]);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    setStagedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!selectedChamber || stagedPhotos.length === 0) return;
    
    setUploading(true);
    try {
      // 1. Upload all photos
      const newPhotos = [];
      for (const photo of stagedPhotos) {
          const { path } = await api.uploadFile(photo.file);
          newPhotos.push({
              path,
              url: photo.url, // Temporary
              caption: `Recipe photo ${format(new Date(), 'dd.MM HH:mm')}`
          });
      }

      // 2. Find active cycle or create new one
      const existingCycle = cycles.find(c => c.chamberNumber === selectedChamber);
      
      if (existingCycle) {
        // Update existing
        const updatedPhotos = [...(existingCycle.recipePhotos || []), ...newPhotos];
        await api.updateCycle(existingCycle.id, {
          ...existingCycle,
          recipePhotos: updatedPhotos,
          recipePhotoPath: newPhotos[0].path // Legacy sync (first one)
        });
      } else {
        // Create new cycle automatically
        const newCycle = {
          chamberNumber: selectedChamber,
          startDate: new Date().toISOString(),
          status: 'In Progress',
          woodType: 'Не указано', // Default
          sequentialNumber: `${new Date().getFullYear()}-${selectedChamber}-${Math.floor(Math.random() * 1000)}`, // Temp ID
          recipePhotos: newPhotos,
          recipePhotoPath: newPhotos[0].path
        };
        await api.createCycle(newCycle as any);
      }

      toast.success(t('saved'));
      setSelectedChamber(null);
      fetchCycles();
    } catch (e) {
      console.error(e);
      toast.error(t('error'));
    } finally {
      setUploading(false);
    }
  };

  const getWoodStyle = (woodType: string) => {
    const type = (woodType || '').toLowerCase();
    // Минималистичные цвета для пожилых людей
    if (type.includes('birch')) return 'bg-slate-100 text-slate-800 border-slate-300';
    if (type.includes('oak')) return 'bg-slate-100 text-slate-800 border-slate-300';
    if (type.includes('alder')) return 'bg-slate-100 text-slate-800 border-slate-300';
    if (type.includes('maple') || type.includes('ash')) return 'bg-slate-100 text-slate-800 border-slate-300';
    if (type.includes('scroblas')) return 'bg-white text-gray-800 border-gray-300 shadow-sm';
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  const openLightbox = (index: number) => {
    setCurrentPhotoIndex(index);
    setLightboxOpen(true);
  };

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % existingPhotos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + existingPhotos.length) % existingPhotos.length);
  };

  const activeCycle = selectedChamber ? cycles.find(c => c.chamberNumber === selectedChamber) : null;

  // Lightbox Modal
  if (lightboxOpen && existingPhotos.length > 0) {
    const currentPhoto = existingPhotos[currentPhotoIndex];
    
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 bg-black/50 backdrop-blur-sm">
          <button 
            onClick={() => setLightboxOpen(false)}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="text-white text-sm">
            {currentPhotoIndex + 1} / {existingPhotos.length}
          </div>
          <div className="w-10"></div> {/* Spacer */}
        </div>

        {/* Image */}
        <div className="flex-1 relative flex items-center justify-center p-4">
          <img 
            src={currentPhoto.url} 
            alt={currentPhoto.caption || 'Photo'} 
            className="max-w-full max-h-full object-contain"
          />

          {/* Navigation Arrows */}
          {existingPhotos.length > 1 && (
            <>
              <button 
                onClick={prevPhoto}
                className="absolute left-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button 
                onClick={nextPhoto}
                className="absolute right-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}
        </div>

        {/* Caption */}
        {currentPhoto.caption && (
          <div className="p-4 bg-black/50 backdrop-blur-sm text-white text-center">
            {currentPhoto.caption}
          </div>
        )}
      </div>
    );
  }

  if (selectedChamber) {
    // CAMERA / UPLOAD VIEW
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col text-white">
        <div className="flex-1 flex flex-col p-4">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <button 
              onClick={() => setSelectedChamber(null)}
              className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="text-center">
              <span className="text-sm text-gray-400 uppercase tracking-widest">{t('chamber')}</span>
              <h2 className="text-3xl font-bold">№{selectedChamber}</h2>
            </div>
            <div className="w-12"></div> {/* Spacer */}
          </div>

          <div className="flex-1 flex flex-col items-center justify-start gap-6 overflow-y-auto">
            {/* Existing Photos Section */}
            {existingPhotos.length > 0 && (
              <div className="w-full max-w-md">
                <h3 className="text-lg font-bold text-gray-300 mb-3">{t('existingPhotos')}</h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {existingPhotos.map((photo, idx) => (
                    <button
                      key={idx}
                      onClick={() => openLightbox(idx)}
                      className="relative aspect-[3/4] bg-black rounded-xl overflow-hidden border border-gray-600 hover:border-blue-400 transition-colors cursor-pointer group"
                    >
                      <img src={photo.url} alt={`Existing ${idx}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 backdrop-blur-sm rounded-full p-3">
                          <Image className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-xs text-white/80">{photo.caption}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Staged Photos Section */}
            {stagedPhotos.length > 0 ? (
              <div className="w-full max-w-md">
                  <h3 className="text-lg font-bold text-gray-300 mb-3">{t('newPhotos')}</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                      {stagedPhotos.map((photo, idx) => (
                          <div key={idx} className="relative aspect-[3/4] bg-black rounded-xl overflow-hidden border border-green-500 group">
                              <img src={photo.url} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                              <button 
                                  onClick={() => removePhoto(idx)}
                                  className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-full text-white shadow-md hover:bg-red-700 transition-colors"
                              >
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                      ))}
                      
                      {/* Add Button Always Visible */}
                      <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-[3/4] bg-gray-800 rounded-xl border-2 border-dashed border-gray-600 flex flex-col items-center justify-center gap-2 hover:bg-gray-700 transition-colors"
                      >
                          <Plus className="w-8 h-8 text-gray-400" />
                          <span className="text-sm text-gray-400 font-bold">{t('addMore')}</span>
                      </button>
                  </div>
                  <p className="text-center text-gray-400 text-sm">
                      {t('photosTaken')}: {stagedPhotos.length}
                  </p>
              </div>
            ) : (
              <div className="text-center space-y-4 mt-8">
                <div className="bg-gray-800 p-6 rounded-2xl inline-block mb-4">
                  <Camera className="w-16 h-16 text-gray-500" />
                </div>
                {activeCycle && activeCycle.sequentialNumber && (
                  <p className="text-xl text-gray-300">
                    #{activeCycle.sequentialNumber}
                  </p>
                )}
                <p className="text-gray-500">{t('takeSettingsPhoto')}</p>
              </div>
            )}
          </div>

          <div className="mt-8 pb-8 w-full max-w-md mx-auto">
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {stagedPhotos.length === 0 ? (
              <div className="flex flex-col gap-3">
                {/* Primary: Camera */}
                <button 
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.setAttribute('capture', 'environment');
                      fileInputRef.current.click();
                    }
                  }}
                  className="w-full py-6 bg-green-600 hover:bg-green-500 text-white rounded-3xl font-bold text-xl shadow-lg flex items-center justify-center gap-3 transition-transform active:scale-95"
                >
                  <Camera className="w-8 h-8" />
                  {t('takePhoto')}
                </button>

                {/* Secondary: Gallery */}
                <button 
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute('capture');
                      fileInputRef.current.click();
                    }
                  }}
                  className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-2xl font-medium text-lg shadow flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <Image className="w-6 h-6" />
                  {t('chooseFromGallery')}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleSave}
                  disabled={uploading}
                  className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all"
                >
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
                  {t('done')} ({stagedPhotos.length})
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // DASHBOARD VIEW
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header with Reminder - МОБИЛЬНЫЙ */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="px-4 py-4">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-2xl font-black text-gray-900">{t('operator')}</h1>
            <button
              onClick={logout}
              className="p-3 hover:bg-gray-100 rounded-full transition-colors active:bg-gray-200"
            >
              <LogOut className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
        
        {/* Reminder Banner for Operators */}
        <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 border-b border-amber-200 px-4 sm:px-6 py-2">
          <p className="text-xs sm:text-sm font-bold text-amber-900 text-center flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="leading-tight">
              {t('lang') === 'ru' 
                ? '⚠️ ВАЖНО: Сфотографируйте рецепт перед загрузкой древесины!' 
                : '⚠️ SVARBU: Nufotografuokite receptą prieš pakraunant medieną!'}
            </span>
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="w-10 h-10 text-gray-400 animate-spin" />
        </div>
      ) : (
        <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {chambers.map(chamberNum => {
            const active = cycles.find(c => c.chamberNumber === chamberNum);
            const hasRecipePhoto = active && (active.recipePhotoPath || (active.recipePhotos && active.recipePhotos.length > 0));
            
            return (
              <button
                key={chamberNum}
                onClick={() => handleChamberClick(chamberNum)}
                className={`
                  relative flex flex-col items-center justify-between p-5 sm:p-6 rounded-2xl border-2 transition-all min-h-[200px]
                  hover:shadow-lg active:scale-[0.98] active:shadow-xl
                  ${active 
                    ? 'bg-white border-gray-300 shadow-sm hover:border-gray-400' 
                    : 'bg-gray-50 border-dashed border-gray-300 text-gray-400 hover:border-gray-400'}
                `}
              >
                {active ? (
                  <div className="text-center w-full flex flex-col items-center gap-3">
                    {/* Large Chamber Number */}
                    <div className="text-5xl sm:text-4xl font-black text-gray-900">
                      {chamberNum}
                    </div>
                    
                    {/* Sequential Number */}
                    {active.sequentialNumber && (
                      <div className="text-base sm:text-sm font-bold text-gray-700">
                        #{active.sequentialNumber}
                      </div>
                    )}
                    
                    {/* Wood Type Badge */}
                    <span className={`px-3 py-1.5 sm:px-3 sm:py-1 rounded-lg text-sm sm:text-xs font-bold border uppercase tracking-wide ${getWoodStyle(active.woodType)}`}>
                        {active.woodType || t('other')}
                    </span>
                    
                    {/* Date */}
                    <div className="text-sm sm:text-xs text-gray-600 font-medium">
                      {format(new Date(active.startDate || ''), 'dd.MM HH:mm')}
                    </div>

                    {/* Photo Status Text */}
                    <div className={`text-base sm:text-sm font-bold px-4 py-2 sm:px-3 sm:py-1.5 rounded-lg ${
                      hasRecipePhoto 
                        ? 'bg-green-100 text-green-800 border-2 border-green-300' 
                        : 'bg-red-100 text-red-800 border-2 border-red-300'
                    }`}>
                      {hasRecipePhoto 
                        ? (t('lang') === 'ru' ? '✓ Есть фото' : '✓ Yra nuotrauka')
                        : (t('lang') === 'ru' ? '✗ Нет фото' : '✗ Nėra nuotraukos')
                      }
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    {/* Large Chamber Number for inactive */}
                    <div className="text-6xl sm:text-5xl font-black text-gray-300 mb-2">
                      {chamberNum}
                    </div>
                    <div className="text-sm sm:text-xs text-gray-400 font-medium">
                      {t('lang') === 'ru' ? 'Не активна' : 'Neaktyvu'}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}