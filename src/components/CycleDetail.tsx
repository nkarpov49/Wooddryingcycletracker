import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { 
  Edit, Trash2, CheckCircle, Droplets, Star, X, Copy, CloudSun, Calendar, Moon, Sun, ArrowDown, ArrowUp, Clock
} from "lucide-react";
import { api, DryingCycle } from "../utils/api";
import { format, differenceInHours } from "date-fns";
import { toast } from "sonner@2.0.3";
import { useLanguage } from "../utils/i18n";
import { ImageWithFallback } from "./figma/ImageWithFallback";

export default function CycleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<DryingCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (id) loadCycle(id);
  }, [id]);

  async function loadCycle(cycleId: string) {
    try {
      const cycles = await api.getCycles();
      const found = cycles.find((c: any) => c.id === cycleId);
      if (found) {
        setCycle(found);
      } else {
        toast.error(t('cyclesNotFound'));
        navigate("/");
      }
    } catch (err) {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async () => {
    if (!id) return;
    try {
      await api.deleteCycle(id);
      toast.success(t('delete') + " OK");
      navigate("/");
    } catch (err) {
      toast.error(t('error'));
    }
  };

  const handleCopy = () => {
    if (!cycle) return;
    navigate("/new", { state: { copyFrom: cycle } });
  };

  if (loading) return <div className="p-8 text-center">{t('loading')}</div>;
  if (!cycle) return null;

  // Prepare photos list
  // 1. Recipe Photos
  let recipePhotosList: any[] = [];
  if (cycle.recipePhotos && cycle.recipePhotos.length > 0) {
      recipePhotosList = cycle.recipePhotos.map((p, i) => ({
          url: p.url || '',
          caption: p.caption || t('recipePhoto'),
          title: `${t('recipePhoto')} ${i + 1}`
      }));
  } else if (cycle.recipePhotoUrl) {
      recipePhotosList = [{
          url: cycle.recipePhotoUrl,
          caption: t('recipePhoto'),
          title: t('recipePhoto')
      }];
  }

  // 2. Result Photos
  const resultPhotosList = (cycle.resultPhotos || []).map((p, i) => ({ 
      url: p.url || '', 
      caption: p.caption, 
      title: `${t('resultPhoto')} ${i + 1}` 
  }));

  const allPhotos = [...recipePhotosList, ...resultPhotosList].filter(p => p.url);

  const displayDate = cycle.startDate || cycle.createdAt;
  const isCompleted = cycle.status === 'Completed' || !!cycle.endDate;
  const hasResults = cycle.finalMoisture || cycle.qualityRating || cycle.overallComment;

  return (
    <div className="pb-20">
      {/* Header Actions (Back button handled by Global Layout) */}
      <div className="flex items-center justify-end mb-4">
        <div className="flex gap-2">
          <Link 
            to={`/edit/${id}`}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full border border-transparent hover:border-blue-100 transition-colors"
            title={t('edit')}
          >
            <Edit className="w-5 h-5" />
          </Link>
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-full border border-transparent hover:border-red-100 transition-colors"
            title={t('delete')}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
            {/* Title Card */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 relative overflow-hidden">
              <div className={`absolute top-0 right-0 px-3 py-1 text-xs font-bold rounded-bl-xl ${
                 isCompleted ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {isCompleted ? t('completed').toUpperCase() : t('inProgress').toUpperCase()}
              </div>
              
              <div className="mb-4">
                 <div className="flex items-center gap-2 mb-1">
                   <h1 className="text-2xl font-bold text-gray-900">№{cycle.chamberNumber}</h1>
                   {cycle.isTest && (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold border border-red-200">TEST</span>
                   )}
                 </div>
                <p className="text-gray-600 font-medium">{cycle.woodType}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="block text-gray-500 text-xs mb-1">ID</span>
                  <span className="font-bold text-lg">#{cycle.sequentialNumber}</span>
                </div>
                 {cycle.recipeCode && cycle.recipeCode !== "N/A" && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="block text-gray-500 text-xs mb-1">{t('recipeCode')}</span>
                      <span className="font-bold text-lg">{cycle.recipeCode}</span>
                    </div>
                 )}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-100">
                 <div className="flex justify-between items-center text-xs text-gray-400 mb-2">
                   <span className="flex items-center gap-1">
                     <Calendar className="w-3 h-3" />
                     {displayDate ? format(new Date(displayDate), 'dd.MM.yyyy HH:mm') : '-'}
                   </span>
                   {cycle.isBaseRecipe && (
                     <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">BASE</span>
                   )}
                 </div>

                 {/* Detailed Weather Stats */}
                 {isCompleted ? (
                   // Show Range Stats
                   cycle.avgTemp !== undefined ? (
                      <div className="bg-blue-50/50 rounded-xl border border-blue-100 overflow-hidden">
                          <div className="p-3 bg-blue-100/30 flex items-center justify-between border-b border-blue-100">
                            <span className="text-sm font-semibold text-gray-700">{t('avgTemp')}</span>
                            <div className="flex items-center gap-1">
                                <CloudSun className="w-5 h-5 text-amber-500" />
                                <span className="text-lg font-bold text-gray-900">{cycle.avgTemp}°C</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 divide-x divide-blue-100 text-center">
                            <div className="p-2">
                                <div className="flex items-center justify-center gap-1 mb-1 text-gray-500 text-xs">
                                  <Sun className="w-3 h-3 text-orange-400" /> {t('dayTemp')}
                                </div>
                                <span className="font-medium text-gray-800">{cycle.avgDayTemp ?? '-'}°</span>
                            </div>
                            <div className="p-2">
                                <div className="flex items-center justify-center gap-1 mb-1 text-gray-500 text-xs">
                                  <Moon className="w-3 h-3 text-blue-400" /> {t('nightTemp')}
                                </div>
                                <span className="font-medium text-gray-800">{cycle.avgNightTemp ?? '-'}°</span>
                            </div>
                            <div className="p-2">
                                <div className="flex items-center justify-center gap-1 mb-1 text-gray-500 text-xs">
                                  <ArrowDown className="w-3 h-3 text-blue-500" /> / <ArrowUp className="w-3 h-3 text-red-500" />
                                </div>
                                <span className="font-medium text-gray-800">{cycle.minTemp ?? '-'} / {cycle.maxTemp ?? '-'}</span>
                            </div>
                          </div>
                      </div>
                   ) : (
                      // Legacy completed cycles with no stats
                      <div className="text-center text-sm text-gray-500 italic p-2 bg-gray-50 rounded">
                          Weather data unavailable for this cycle range.
                      </div>
                   )
                 ) : (
                    // In Progress: Show Start Temp only
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex items-center justify-between">
                       <div className="flex items-center gap-2">
                          <Clock className="w-5 h-5 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">Loading Time Temp:</span>
                       </div>
                       <span className="font-bold text-lg">{cycle.startTemperature !== undefined ? `${cycle.startTemperature}°C` : '-'}</span>
                    </div>
                 )}
              </div>
            </div>

            {/* Results Card */}
            {(isCompleted || hasResults) && (
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  {t('resultsAndQuality')}
                </h3>
                
                {!cycle.finalMoisture && !cycle.qualityRating ? (
                    <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                       <p className="text-gray-500 italic">{t('notEntered')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="text-center">
                        <span className="block text-gray-500 text-xs uppercase mb-1">{t('finalMoisture')}</span>
                        <div className="flex items-center justify-center gap-1 text-blue-600">
                          <Droplets className="w-5 h-5" />
                          <span className="text-2xl font-bold">{cycle.finalMoisture ? `${cycle.finalMoisture}%` : '-'}</span>
                        </div>
                      </div>
                      <div className="text-center border-l border-gray-100">
                        <span className="block text-gray-500 text-xs uppercase mb-1">{t('qualityRating')}</span>
                        <div className="flex items-center justify-center gap-1 text-amber-500">
                          <Star className="w-5 h-5 fill-current" />
                          <span className="text-2xl font-bold">{cycle.qualityRating || '-'}</span>
                        </div>
                      </div>
                    </div>
                )}

                {cycle.overallComment && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-gray-600 italic">"{cycle.overallComment}"</p>
                  </div>
                )}
                {cycle.startDate && cycle.endDate && (
                   <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                       <span className="text-xs text-gray-500 uppercase">{t('duration')}</span>
                       <p className="font-bold text-gray-900">{differenceInHours(new Date(cycle.endDate), new Date(cycle.startDate))} {t('hoursShort')}</p>
                   </div>
                )}
              </div>
            )}
        </div>

        {/* Gallery */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3 px-1">{t('gallery')} ({allPhotos.length})</h3>
          <div className="grid grid-cols-2 gap-3">
            {allPhotos.map((photo, idx) => (
              <div 
                key={idx} 
                onClick={() => {
                  setFullscreenPhoto(photo);
                }}
                className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 shadow-sm cursor-zoom-in group"
              >
                <ImageWithFallback src={photo.url} alt={photo.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-2 text-xs truncate">
                  <span className="font-bold mr-1">{photo.title}</span>
                  {photo.caption && <span className="opacity-80">- {photo.caption}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {fullscreenPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setFullscreenPhoto(null)}
        >
          <button className="fixed top-4 right-4 text-white p-2 bg-white/20 rounded-full z-50 hover:bg-white/30">
            <X className="w-6 h-6" />
          </button>
          
          <div 
            className="w-full h-full overflow-auto flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()} 
          >
             <ImageWithFallback 
               src={fullscreenPhoto.url} 
               alt={fullscreenPhoto.caption} 
               className="max-h-full max-w-full object-contain"
             />
          </div>
          
          <div className="fixed bottom-0 left-0 right-0 bg-black/50 text-white p-4 text-center backdrop-blur-sm z-50 pointer-events-none">
            <p className="font-bold text-lg">{fullscreenPhoto.title}</p>
            {fullscreenPhoto.caption && <p className="text-gray-200 mt-1">{fullscreenPhoto.caption}</p>}
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{t('delete')}?</h3>
            <p className="text-gray-600 mb-6">{t('requiredField')}?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
