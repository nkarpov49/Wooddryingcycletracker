import React, { useState } from 'react';
import { DryingCycle } from '../../utils/api';
import { useLanguage } from '../../utils/i18n';
import { format, parseISO, differenceInHours } from 'date-fns';
import { X, Calendar, Droplets, Star, MessageSquare, Image as ImageIcon, ChevronLeft, ChevronRight, Save, Camera, Upload, Trash2, Plus } from 'lucide-react';
import { api } from '../../utils/api';
import { toast } from 'sonner';

interface PackerCycleDetailModalProps {
  cycle: DryingCycle;
  onClose: () => void;
  onUpdate?: (updatedCycle: DryingCycle) => void;
  allowEdit?: boolean;
}

export default function PackerCycleDetailModal({ cycle, onClose, onUpdate, allowEdit = false }: PackerCycleDetailModalProps) {
  const { t, lang } = useLanguage();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [currentPhotoType, setCurrentPhotoType] = useState<'recipe' | 'result'>('recipe');
  
  // Состояние редактирования
  const [editedComment, setEditedComment] = useState(cycle.overallComment || '');
  const [editedResultPhotos, setEditedResultPhotos] = useState(cycle.resultPhotos || []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const getWoodStyle = (woodType: string) => {
    const type = (woodType || '').toLowerCase();
    if (type.includes('birch')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (type.includes('oak')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (type.includes('alder')) return 'bg-gray-100 text-gray-800 border-gray-200';
    if (type.includes('maple') || type.includes('ash')) return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-amber-50 text-amber-800 border-amber-100';
  };

  const allRecipePhotos = cycle.recipePhotos || [];
  const duration = cycle.startDate && cycle.endDate 
    ? differenceInHours(parseISO(cycle.endDate), parseISO(cycle.startDate))
    : null;

  const openLightbox = (type: 'recipe' | 'result', index: number) => {
    setCurrentPhotoType(type);
    setCurrentPhotoIndex(index);
    setLightboxOpen(true);
  };

  const currentPhotos = currentPhotoType === 'recipe' ? allRecipePhotos : editedResultPhotos;

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % currentPhotos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + currentPhotos.length) % currentPhotos.length);
  };

  const handleSave = async () => {
    if (!cycle.id) return;
    
    setSaving(true);
    try {
      const updatedCycle = await api.updateCycle(cycle.id, {
        overallComment: editedComment,
        resultPhotos: editedResultPhotos,
      });
      
      toast.success(t('saved'));
      
      if (onUpdate) {
        onUpdate({ ...cycle, ...updatedCycle });
      }
      
      // Закрываем модальное окно после сохранения
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('Error saving cycle:', error);
      toast.error(t('error'));
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    setUploading(true);
    try {
      const { path } = await api.uploadFile(file);
      const tempUrl = URL.createObjectURL(file);
      const newPhoto = { path, url: tempUrl, caption: '' };
      setEditedResultPhotos([...editedResultPhotos, newPhoto]);
      toast.success(lang === 'ru' ? 'Фото добавлено' : 'Nuotrauka pridėta');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error(t('error'));
    } finally {
      setUploading(false);
    }
  };

  const handleTakePhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handlePhotoUpload(file);
    };
    input.click();
  };

  const handleChooseFromGallery = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      for (const file of files) {
        await handlePhotoUpload(file);
      }
    };
    input.click();
  };

  const handleDeletePhoto = (index: number) => {
    setEditedResultPhotos(editedResultPhotos.filter((_, i) => i !== index));
  };

  // Проверка есть ли изменения
  const hasChanges = editedComment !== (cycle.overallComment || '') || 
                     JSON.stringify(editedResultPhotos) !== JSON.stringify(cycle.resultPhotos || []);

  // Lightbox
  if (lightboxOpen && currentPhotos.length > 0) {
    const currentPhoto = currentPhotos[currentPhotoIndex];
    
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col animate-in fade-in duration-200">
        <div className="flex justify-between items-center p-4 bg-black/50 backdrop-blur-sm">
          <button 
            onClick={() => setLightboxOpen(false)}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="text-white text-sm font-medium">
            {currentPhotoIndex + 1} / {currentPhotos.length}
          </div>
          <div className="w-10"></div>
        </div>

        <div className="flex-1 relative flex items-center justify-center p-4">
          <img 
            src={currentPhoto.url} 
            alt={currentPhoto.caption || 'Photo'} 
            className="max-w-full max-h-full object-contain"
          />

          {currentPhotos.length > 1 && (
            <>
              <button 
                onClick={prevPhoto}
                className="absolute left-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors backdrop-blur-sm"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button 
                onClick={nextPhoto}
                className="absolute right-4 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors backdrop-blur-sm"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}
        </div>

        {currentPhoto.caption && (
          <div className="p-4 bg-black/50 backdrop-blur-sm text-white text-center">
            {currentPhoto.caption}
          </div>
        )}
      </div>
    );
  }

  // Modal
  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center animate-in fade-in duration-200" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Sticky */}
        <div className="sticky top-0 bg-gradient-to-b from-white to-white/95 backdrop-blur-sm border-b border-gray-200 p-4 z-10">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-1">
                {t('chamber')} {cycle.chamberNumber}
              </div>
              {cycle.sequentialNumber && (
                <h2 className="text-2xl font-black text-gray-900">
                  #{cycle.sequentialNumber}
                </h2>
              )}
            </div>
            <button 
              onClick={onClose}
              className="p-2 -mt-1 -mr-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Wood Type + Rating */}
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1.5 rounded-lg text-sm font-bold border uppercase tracking-wide ${getWoodStyle(cycle.woodType)}`}>
              {cycle.woodType || t('other')}
            </div>
            {cycle.qualityRating !== undefined && cycle.qualityRating !== null && (
              <div className="flex items-center gap-1.5 bg-yellow-100 px-2.5 py-1 rounded-lg border border-yellow-200">
                <Star className="w-4 h-4 text-yellow-600 fill-yellow-600" />
                <span className="text-sm font-bold text-yellow-800">
                  {cycle.qualityRating.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Dates + Duration + Moisture - Compact Grid */}
          <div className="grid grid-cols-2 gap-2">
            {cycle.startDate && (
              <div className="bg-gray-50 p-2.5 rounded-lg">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-0.5">{t('startDate')}</div>
                <div className="text-xs font-bold text-gray-900">
                  {format(parseISO(cycle.startDate), 'dd.MM.yyyy HH:mm')}
                </div>
              </div>
            )}
            {cycle.endDate && (
              <div className="bg-gray-50 p-2.5 rounded-lg">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-0.5">{t('endDate')}</div>
                <div className="text-xs font-bold text-gray-900">
                  {format(parseISO(cycle.endDate), 'dd.MM.yyyy HH:mm')}
                </div>
              </div>
            )}
            {duration !== null && (
              <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                <div className="text-[10px] uppercase tracking-wider text-blue-600 font-bold mb-0.5">{t('duration')}</div>
                <div className="text-sm font-bold text-blue-900">
                  {duration} {t('hoursShort')}
                </div>
              </div>
            )}
            {cycle.finalMoisture !== undefined && cycle.finalMoisture !== null && (
              <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                <div className="text-[10px] uppercase tracking-wider text-blue-600 font-bold mb-0.5">{t('finalMoisture')}</div>
                <div className="text-sm font-bold text-blue-900 flex items-center gap-1">
                  <Droplets className="w-4 h-4" />
                  {cycle.finalMoisture}%
                </div>
              </div>
            )}
          </div>

          {/* Recipe Photos */}
          {allRecipePhotos.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ImageIcon className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-gray-900">{t('recipePhoto')}</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {allRecipePhotos.map((photo, idx) => (
                  <button
                    key={idx}
                    onClick={() => openLightbox('recipe', idx)}
                    className="aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200 hover:border-amber-400 transition-all cursor-pointer group active:scale-95"
                  >
                    <img src={photo.url} alt={`Recipe ${idx}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Result Photos Section - Always Editable if allowEdit */}
          {allowEdit && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-green-500 rounded-lg">
                  <ImageIcon className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">{t('resultPhoto')}</h3>
              </div>
              
              {/* Photo Grid */}
              {editedResultPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {editedResultPhotos.map((photo, idx) => (
                    <div key={idx} className="relative aspect-square bg-white rounded-xl overflow-hidden border-2 border-green-200 shadow-sm group">
                      <img src={photo.url} alt={`Result ${idx}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => handleDeletePhoto(idx)}
                        className="absolute top-1.5 right-1.5 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow-lg opacity-0 group-hover:opacity-100 active:scale-90"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openLightbox('result', idx)}
                        className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors"
                      />
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add Photo Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleTakePhoto}
                  disabled={uploading}
                  className="flex flex-col items-center justify-center gap-2 px-4 py-4 bg-white border-2 border-blue-300 text-blue-600 rounded-xl hover:bg-blue-50 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
                >
                  <Camera className="w-6 h-6" />
                  <span className="text-xs font-bold">{uploading ? t('loading') : (lang === 'ru' ? 'Камера' : 'Kamera')}</span>
                </button>
                <button
                  onClick={handleChooseFromGallery}
                  disabled={uploading}
                  className="flex flex-col items-center justify-center gap-2 px-4 py-4 bg-white border-2 border-purple-300 text-purple-600 rounded-xl hover:bg-purple-50 hover:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-xs font-bold">{lang === 'ru' ? 'Галерея' : 'Galerija'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Comment Section - Always Editable if allowEdit */}
          {allowEdit && (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">{t('overallComment')}</h3>
              </div>
              <textarea
                value={editedComment}
                onChange={(e) => setEditedComment(e.target.value)}
                placeholder={lang === 'ru' ? 'Качество доски, дефекты, замечания...' : 'Lentos kokybė, defektai, pastabos...'}
                rows={4}
                className="w-full px-4 py-3 bg-white border-2 border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm placeholder:text-gray-400"
              />
            </div>
          )}

          {/* Read-only view for non-editable mode */}
          {!allowEdit && (
            <>
              {cycle.resultPhotos && cycle.resultPhotos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ImageIcon className="w-4 h-4 text-green-600" />
                    <h3 className="text-sm font-bold text-gray-900">{t('resultPhoto')}</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {cycle.resultPhotos.map((photo, idx) => (
                      <button
                        key={idx}
                        onClick={() => openLightbox('result', idx)}
                        className="aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200 hover:border-green-400 transition-all cursor-pointer group active:scale-95"
                      >
                        <img src={photo.url} alt={`Result ${idx}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {cycle.overallComment && cycle.overallComment.trim().length > 0 && (
                <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-purple-600" />
                    <h3 className="text-sm font-bold text-purple-900">{t('overallComment')}</h3>
                  </div>
                  <p className="text-sm text-purple-800 whitespace-pre-wrap">
                    {cycle.overallComment}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Save Button - Sticky at bottom (только если allowEdit) */}
        {allowEdit && (
          <div className="sticky bottom-0 bg-gradient-to-t from-white to-white/95 backdrop-blur-sm border-t border-gray-200 p-4">
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all font-bold text-base shadow-lg active:scale-[0.98]"
            >
              <Save className="w-5 h-5" />
              {saving ? (lang === 'ru' ? 'Сохранение...' : 'Išsaugoma...') : (lang === 'ru' ? 'Сохранить' : 'Išsaugoti')}
            </button>
            {!hasChanges && (
              <p className="text-center text-xs text-gray-500 mt-2">
                {lang === 'ru' ? 'Нет изменений для сохранения' : 'Nėra pakeitimų išsaugoti'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
