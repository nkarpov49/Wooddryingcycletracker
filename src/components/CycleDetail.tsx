import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { api, DryingCycle, WeighingRecord } from '../utils/api';
import { ArrowLeft, Star, Edit, Trash2, CheckCircle, Droplets, TrendingUp, Calendar, X, Sun, Moon, ArrowDown, ArrowUp, CloudSun, Clock, Scale, AlertTriangle, Check } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { toast } from 'sonner@2.0.3';
import { useLanguage } from "../utils/i18n";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { useAuth } from '../contexts/AuthContext';
import AdvancedPhotoGallery from './AdvancedPhotoGallery';
import PhotoZoomViewer from './PhotoZoomViewer';

export default function CycleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<DryingCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const { t } = useLanguage();
  const { role } = useAuth();

  useEffect(() => {
    if (id) loadCycle(id);
  }, [id]);

  async function loadCycle(cycleId: string) {
    try {
      // ✅ ОПТИМИЗАЦИЯ: Загружаем только один цикл с фотографиями
      const cycle = await api.getCycle(cycleId);
      if (cycle) {
        setCycle(cycle);
      } else {
        toast.error(t('cyclesNotFound'));
        navigate('/');
      }
    } catch (err) {
      console.error('Error loading cycle:', err);
      toast.error(t('error'));
      navigate('/');
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
  
  const handleClearWeighingHistory = async () => {
    if (!id) return;
    try {
      await api.clearWeighingHistory(id);
      toast.success(t('historyCleared'));
      setShowClearHistoryConfirm(false);
      // Перезагрузить цикл для обновления данных
      loadCycle(id);
    } catch (err) {
      console.error('Error clearing weighing history:', err);
      toast.error(t('error'));
    }
  };
  
  const handleToggleFailedStatus = async () => {
    if (!id || !cycle) return;
    const newStatus = !cycle.isFailed;
    
    try {
      await api.markCycleAsFailed(id, newStatus);
      toast.success(newStatus ? t('markAsFailed') : t('markAsSuccess'));
      // Update local state
      setCycle({ ...cycle, isFailed: newStatus });
    } catch (err) {
      console.error('Error toggling failed status:', err);
      toast.error(t('error'));
    }
  };

  const handleDeleteWeighingRecord = async (index: number) => {
    if (!id || !cycle) return;
    
    console.log(`[CycleDetail] Удаление записи взвешивания. Цикл: ${id}, Индекс: ${index}`);
    console.log(`[CycleDetail] Всего записей: ${cycle.weighingHistory?.length || 0}`);
    
    const record = cycle.weighingHistory?.[index];
    if (!record) {
      console.error(`[CycleDetail] Запись с индексом ${index} не найдена`);
      toast.error(t('recordNotFound'));
      return;
    }
    
    // 🔥 ИСПРАВЛЕНО: проверяем наличие ID взвешивания
    if (!record.id) {
      console.error(`[CycleDetail] У записи отсутствует ID!`, record);
      toast.error('Ошибка: у записи нет ID');
      return;
    }
    
    console.log(`[CycleDetail] Удаляем запись ID: ${record.id}, Timestamp:`, new Date(record.timestamp).toISOString());
    
    try {
      // 🔥 ПЕРЕДАЁМ ID ВЗВЕШИВАНИЯ, А НЕ ИНДЕКС!
      const result = await api.deleteWeighingRecord(id, record.id);
      console.log(`[CycleDetail] ✅ Запись успешно удалена:`, result);
      toast.success(t('recordDeleted'));
      // Перезагружаем цикл для обновления данных
      await loadCycle(id);
    } catch (err) {
      console.error('[CycleDetail] ❌ Ошибка удаления записи:', err);
      toast.error(t('error'));
    }
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
          {/* Mark as Failed/Wet Button - только для лидеров и админов */}
          {(role === 'packer' || role === 'admin') && (
            <button
              onClick={handleToggleFailedStatus}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all border ${
                cycle.isFailed
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                  : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
              }`}
              title={cycle.isFailed ? t('markAsSuccess') : t('markAsFailed')}
            >
              {cycle.isFailed ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>{t('markAsSuccess')}</span>
                </>
              ) : (
                <>
                  <Droplets className="w-4 h-4" />
                  <span>{t('wet')}</span>
                </>
              )}
            </button>
          )}
          
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
            <div className="glass rounded-3xl p-6 shadow-apple-md border border-white/20 relative overflow-hidden">
              <div className={`absolute top-0 right-0 px-4 py-2 text-xs font-semibold rounded-bl-2xl backdrop-blur-sm ${
                 isCompleted ? 'bg-success/20 text-success border-l border-b border-success/30' : 'bg-warning/20 text-warning border-l border-b border-warning/30'
              }`}>
                {isCompleted ? t('completed').toUpperCase() : t('inProgress').toUpperCase()}
              </div>
              
              <div className="mb-4">
                 <div className="flex items-center gap-2 mb-1">
                   <h1 className="text-2xl font-bold text-gray-900">№{cycle.chamberNumber}</h1>
                   {cycle.isTest && (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold border border-red-200">TEST</span>
                   )}
                   {cycle.isFailed && (
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-sm font-bold border-2 border-blue-300 flex items-center gap-1 shadow-sm">
                        <Droplets className="w-4 h-4" />
                        {t('wet')}
                      </span>
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
              <div className="glass rounded-3xl p-6 shadow-apple-md border border-white/20">
                <h3 className="font-semibold text-foreground mb-5 flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-success to-green-400 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-lg">{t('resultsAndQuality')}</span>
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
            
            {/* Weight Progress Chart */}
            {/* Removed - Chart is no longer displayed */}
            
            {/* Weighing History Card */}
            {cycle.weighingHistory && cycle.weighingHistory.length > 0 && (
              <div className="glass rounded-3xl p-6 shadow-apple-md border border-white/20">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center">
                      <Scale className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-lg">{t('weighingHistory')}</span>
                  </h3>
                  {/* Кнопка удаления истории */}
                  <button
                    onClick={() => setShowClearHistoryConfirm(true)}
                    className="p-2.5 text-destructive hover:bg-destructive/10 rounded-xl transition-apple"
                    title={t('clearHistory')}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-3">
                  {cycle.weighingHistory.map((record: WeighingRecord, index: number) => (
                    <div 
                      key={index}
                      className="glass rounded-2xl p-4 border border-white/30 shadow-apple-sm"
                    >
                      {/* Header - только кружок с номером и дата */}
                      <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200/50">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-blue-400 text-white flex items-center justify-center text-sm font-bold shadow-apple-sm">
                            {index + 1}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-muted-foreground font-medium">
                              {format(new Date(record.timestamp), 'dd.MM.yyyy HH:mm')}
                            </div>
                            <div className="flex items-center gap-1 text-primary font-bold text-sm">
                              <Clock className="w-4 h-4" />
                              <span>{record.hoursFromStart} {t('hoursShort')}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Кнопка удаления конкретной записи */}
                        <button
                          onClick={() => handleDeleteWeighingRecord(index)}
                          className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-apple"
                          title={t('deleteRecord')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Time Info - только с момента последней проверки */}
                      {record.hoursSinceLastCheck !== undefined && (
                        <div className="mb-3">
                          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 text-center border border-white/40">
                            <div className="text-xs text-muted-foreground mb-1 font-medium">{t('sinceLastCheck')}</div>
                            <div className="font-bold text-purple-600 text-base">
                              {record.hoursSinceLastCheck} {t('hoursShort')}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Weights - с цветовой индикацией */}
                      <div className="mb-3">
                        <div className="text-xs font-semibold text-foreground/70 mb-2 flex items-center gap-1.5">
                          <span className="text-xl">📦</span> 
                          <span>{t('boxWeights')}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {record.weights.map((weight, i) => {
                            // Определяем цвет ячейки на основе целевого веса из записи
                            const targetWeight = record.weightLimit;
                            let bgColor = 'bg-gray-300';
                            let textColor = 'text-gray-900';
                            
                            if (targetWeight !== undefined) {
                              if (weight <= targetWeight) {
                                // Вес меньше или равен допуску - готово (зеленый)
                                bgColor = 'bg-gradient-to-br from-success to-green-400';
                                textColor = 'text-white';
                              } else {
                                // Вес больше допуска - нужно сушить (красный)
                                bgColor = 'bg-gradient-to-br from-destructive to-red-400';
                                textColor = 'text-white';
                              }
                            }
                            
                            return (
                              <div 
                                key={i}
                                className={`${bgColor} rounded-xl px-2 py-2 text-center shadow-apple-sm`}
                              >
                                <div className={`font-bold ${textColor} text-sm`}>
                                  {weight}т
                                </div>
                              </div>
                            );
                          })} 
                        </div>
                      </div>
                      
                      {/* Recommendation */}
                      {record.recommendationData ? (
                        <div className={`rounded-xl p-3 border-2 backdrop-blur-sm shadow-apple-sm ${
                          record.recommendationData.type === 'approved'
                            ? 'bg-success/10 border-success/30 text-success'
                            : 'bg-warning/10 border-warning/30 text-warning'
                        }`}>
                          <div className="text-xs font-semibold mb-1 opacity-80">💡 {t('recommendation')}</div>
                          <div className="font-semibold text-sm">
                            {record.recommendationData.type === 'approved' 
                              ? t('readyToCollect')
                              : `${t('continueDrying')} +${record.recommendationData.hoursNeeded} ${t('hoursShort')} (${t('until')} ${record.recommendationData.endTime})`
                            }
                          </div>
                        </div>
                      ) : record.recommendation ? (
                        // Fallback для старых записей с текстовой рекомендацией
                        <div className={`rounded-xl p-3 border-2 backdrop-blur-sm shadow-apple-sm ${
                          record.recommendation.includes(t('ready')) || record.recommendation.includes(t('collectWood')) || record.recommendation.includes(t('readyToCollect'))
                            ? 'bg-success/10 border-success/30 text-success'
                            : 'bg-warning/10 border-warning/30 text-warning'
                        }`}>
                          <div className="text-xs font-semibold mb-1 opacity-80">💡 {t('recommendation')}</div>
                          <div className="font-semibold text-sm">{record.recommendation}</div>
                        </div>
                      ) : null}
                    </div>
                  ))} 
                </div>
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
                onClick={() => setFullscreenPhoto(idx)}
                className="relative aspect-square rounded-2xl overflow-hidden border border-white/30 shadow-apple-sm cursor-zoom-in group"
              >
                <ImageWithFallback src={photo.url} alt={photo.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white p-3 text-xs">
                  <span className="font-bold block">{photo.title}</span>
                  {photo.caption && <span className="opacity-80 text-xs">{photo.caption}</span>}
                </div>
              </div>
            ))} 
          </div>
        </div>
      </div>

      {/* Advanced Photo Gallery Modal */}
      {fullscreenPhoto !== null && (
        <AdvancedPhotoGallery
          photos={allPhotos}
          initialIndex={fullscreenPhoto}
          onClose={() => setFullscreenPhoto(null)}
        />
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
      
      {/* Clear Weighing History Modal */}
      {showClearHistoryConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-red-100 p-3 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{t('clearHistoryConfirm')}</h3>
            </div>
            <p className="text-gray-600 mb-6">
              {t('clearHistoryWarning')}
              <span className="font-bold text-red-600"> {t('cannotUndo')}</span>
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowClearHistoryConfirm(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleClearWeighingHistory}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
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
