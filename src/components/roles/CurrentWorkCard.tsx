import React from 'react';
import { CurrentWorkCycle } from '../../utils/api';
import { useLanguage } from '../../utils/i18n';
import { format, parseISO } from 'date-fns';
import { MessageSquare, Image as ImageIcon, Eye, AlertCircle, Scale, Droplets } from 'lucide-react';
import { getWoodStyle } from '../../utils/wood-styles';

interface CurrentWorkCardProps {
  workCycle: CurrentWorkCycle;
  lineLabel: string;
  onClick: () => void;
}

export default function CurrentWorkCard({ workCycle, lineLabel, onClick }: CurrentWorkCardProps) {
  const { t } = useLanguage();


  // Если цикл не найден в базе
  if (!workCycle.cycle) {
    return (
      <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-start gap-2.5 mb-2">
          <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            {/* Line Badge - ЗАМЕТНЫЙ */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white px-3 py-1 rounded-lg font-black text-xs inline-block mb-2 shadow-md">
              {lineLabel.toUpperCase()}
            </div>
            <div className="text-xl font-bold text-gray-900 mb-2">
              #{workCycle.sequentialNumber}
            </div>
            <div className="text-sm text-gray-600 mb-2 font-mono bg-white px-2 py-1 rounded">
              {workCycle.rawText}
            </div>
            <div className="text-xs text-orange-700 font-medium">
              ⚠️ {t('notFoundInDatabase')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const cycle = workCycle.cycle;
  const hasRecipePhoto = cycle.recipePhotos && cycle.recipePhotos.length > 0;
  const hasResultPhoto = cycle.resultPhotos && cycle.resultPhotos.length > 0;
  const hasComment = cycle.overallComment && cycle.overallComment.trim().length > 0;
  const hasWeighingData = cycle.weighingHistory && cycle.weighingHistory.length > 0;

  return (
    <button
      onClick={onClick}
      className="bg-white border-2 border-green-200 rounded-xl p-3.5 shadow-sm hover:shadow-lg active:shadow-xl hover:border-green-400 active:border-green-500 transition-all text-left w-full group active:scale-[0.99]"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-2.5">
        <div className="flex items-center gap-2">
          {/* Line Badge - ЗАМЕТНЫЙ И КРУПНЫЙ ДЛЯ СТАРИКОВ */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white px-4 py-2 rounded-lg font-black text-lg shadow-md">
            {lineLabel.toUpperCase()}
          </div>
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Sequential Number - КРУПНО */}
      <div className="text-2xl font-black text-gray-900 mb-2.5">
        #{workCycle.sequentialNumber}
      </div>

      {/* Wood Type - КОМПАКТНО */}
      <div className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border uppercase tracking-wide mb-2.5 ${getWoodStyle(cycle.woodType)}`}>
        {cycle.woodType || t('other')}
      </div>

      {/* Chamber Info - КОМПАКТНО */}
      {cycle.chamberNumber && (
        <div className="text-xs text-gray-600 mb-1.5">
          <span className="font-medium">{t('chamber')}:</span> #{cycle.chamberNumber}
        </div>
      )}

      {/* Start Date - КОМПАКТНО */}
      {cycle.startDate && (
        <div className="text-xs text-gray-600 mb-2.5">
          <span className="font-medium">{t('startDate')}:</span> {format(parseISO(cycle.startDate), 'dd.MM.yyyy HH:mm')}
        </div>
      )}

      {/* Raw Text from Sheets - КОМПАКТНО */}
      <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mb-2.5 font-mono">
        {workCycle.rawText}
      </div>

      {/* Action Buttons - КОМПАКТНО */}
      <div className="flex items-center gap-1.5 pt-2.5 border-t border-gray-200">
        {/* Moisture Indicator */}
        {cycle.finalMoisture !== undefined && cycle.finalMoisture !== null && (
          <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg font-bold border border-blue-100 shadow-sm">
            <Droplets className="w-3.5 h-3.5" />
            <span>{cycle.finalMoisture}%</span>
          </div>
        )}

        {/* Weighing Data Indicator */}
        {hasWeighingData && (
          <div className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg font-bold border border-indigo-100 shadow-sm">
            <Scale className="w-3.5 h-3.5" />
            <span>{cycle.weighingHistory?.length}</span>
          </div>
        )}

        {hasComment && (
          <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded font-bold">
            <MessageSquare className="w-3 h-3" />
          </div>
        )}
        {(hasRecipePhoto || hasResultPhoto) && (
          <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-bold">
            <ImageIcon className="w-3 h-3" />
            <span>{(cycle.recipePhotos?.length || 0) + (cycle.resultPhotos?.length || 0)}</span>
          </div>
        )}
        <div className="flex-1"></div>
        <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium group-hover:text-green-700">
          <Eye className="w-3 h-3" />
          <span>{t('viewDetails')}</span>
        </div>
      </div>
    </button>
  );
}
