import React from 'react';
import { DryingCycle } from '../../utils/api';
import { useLanguage } from '../../utils/i18n';
import { format, parseISO, differenceInHours } from 'date-fns';
import { Calendar, Droplets, MessageSquare, Image as ImageIcon, Star, Scale } from 'lucide-react';
import { getWoodStyle } from '../../utils/wood-styles';

interface PackerCycleCardProps {
  cycle: DryingCycle;
  onClick?: () => void;
}

export default function PackerCycleCard({ cycle, onClick }: PackerCycleCardProps) {
  const { t } = useLanguage();


  const hasComment = cycle.overallComment && cycle.overallComment.trim().length > 0;
  const hasWeighingData = cycle.weighingHistory && cycle.weighingHistory.length > 0;
  
  // Calculate duration
  let duration = null;
  if (cycle.startDate && cycle.endDate) {
    const hours = differenceInHours(parseISO(cycle.endDate), parseISO(cycle.startDate));
    duration = hours;
  }

  // Rating background color
  const ratingBgColor = cycle.qualityRating && cycle.qualityRating < 3 
    ? 'bg-red-50 border-red-200' 
    : 'bg-white border-gray-200';

  const recipePhotoCount = (Array.isArray(cycle.recipePhotos) ? cycle.recipePhotos.length : 0) || (cycle.recipePhotoPath ? 1 : 0);
  const resultPhotoCount = Array.isArray(cycle.resultPhotos) ? cycle.resultPhotos.length : 0;
  const totalPhotos = recipePhotoCount + resultPhotoCount;

  return (
    <button 
      className={`rounded-xl border-2 shadow-sm p-3.5 hover:shadow-lg active:shadow-xl transition-all cursor-pointer text-left w-full ${ratingBgColor} hover:border-amber-400 active:scale-[0.99]`}
      onClick={onClick}
    >
      {/* Header: Chamber + Sequential */}
      <div className="flex justify-between items-start mb-2.5">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5 font-semibold">
            {t('chamberShort')} {cycle.chamberNumber}
          </div>
          {cycle.sequentialNumber && (
            <div className="text-lg font-bold text-gray-900">
              #{cycle.sequentialNumber}
            </div>
          )}
        </div>

        {/* Rating - КОМПАКТНО */}
        {cycle.qualityRating !== undefined && cycle.qualityRating !== null && (
          <div className="flex items-center gap-1 bg-yellow-100 px-2 py-1 rounded-lg">
            <Star className="w-3.5 h-3.5 text-yellow-600 fill-yellow-600" />
            <span className="text-sm font-bold text-yellow-800">
              {cycle.qualityRating.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Wood Type - КОМПАКТНО */}
      <div className={`inline-block px-2 py-1 rounded text-xs font-bold border uppercase tracking-wide mb-2.5 ${getWoodStyle(cycle.woodType)}`}>
        {cycle.woodType || t('other')}
      </div>

      {/* End Date - КОМПАКТНО */}
      {cycle.endDate && (
        <div className="text-xs text-gray-600 flex items-center gap-1 mb-1.5">
          <Calendar className="w-3 h-3" />
          <span className="font-medium">{t('unloadDate')}:</span>
          {format(parseISO(cycle.endDate), 'dd.MM.yyyy HH:mm')}
        </div>
      )}

      {/* Duration - КОМПАКТНО */}
      {duration !== null && (
        <div className="text-xs text-gray-600 mb-2">
          <span className="font-medium">{t('duration')}:</span> {duration} {t('hoursShort')}
        </div>
      )}

      {/* Indicators Row - КОМПАКТНО */}
      <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pt-2.5 border-t border-gray-200">
        {/* Moisture */}
        {cycle.finalMoisture !== undefined && cycle.finalMoisture !== null && (
          <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-bold">
            <Droplets className="w-3 h-3" />
            <span>{cycle.finalMoisture}%</span>
          </div>
        )}

        {/* Weighing Data Indicator */}
        {hasWeighingData && (
          <div className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-bold">
            <Scale className="w-3 h-3" />
            <span>{cycle.weighingHistory.length}</span>
          </div>
        )}

        {/* Comment Indicator */}
        {hasComment && (
          <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
            <MessageSquare className="w-3 h-3" />
          </div>
        )}

        {/* Photos Indicator */}
        {totalPhotos > 0 && (
          <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded font-bold">
            <ImageIcon className="w-3 h-3" />
            <span>{totalPhotos}</span>
          </div>
        )}
      </div>
    </button>
  );
}
