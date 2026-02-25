import React from 'react';
import { CurrentWorkCycle } from '../../utils/api';
import { useLanguage } from '../../utils/i18n';
import { format, parseISO } from 'date-fns';
import { MessageSquare, Image as ImageIcon, Eye, AlertCircle } from 'lucide-react';

interface CurrentWorkCardProps {
  workCycle: CurrentWorkCycle;
  lineLabel: string;
  onClick: () => void;
}

export default function CurrentWorkCard({ workCycle, lineLabel, onClick }: CurrentWorkCardProps) {
  const { t } = useLanguage();

  const getWoodStyle = (woodType: string) => {
    const type = (woodType || '').toLowerCase();
    if (type.includes('birch') || type.includes('beržas')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (type.includes('oak') || type.includes('ąžuolas')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (type.includes('alder') || type.includes('alksnis')) return 'bg-gray-100 text-gray-800 border-gray-200';
    if (type.includes('maple') || type.includes('ash') || type.includes('uosis')) return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-amber-50 text-amber-800 border-amber-100';
  };

  // Если цикл не найден в базе
  if (!workCycle.cycle) {
    return (
      <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-start gap-3 mb-3">
          <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-xs font-bold text-orange-600 uppercase tracking-wide mb-1">
              {lineLabel}
            </div>
            <div className="text-lg font-bold text-gray-900 mb-2">
              #{workCycle.sequentialNumber}
            </div>
            <div className="text-sm text-gray-600 mb-2">
              {workCycle.rawText}
            </div>
            <div className="text-xs text-orange-700 font-medium">
              {t('notFoundInDatabase')}
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

  return (
    <button
      onClick={onClick}
      className="bg-white border-2 border-green-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-green-400 transition-all text-left w-full group"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-xs font-bold text-green-600 uppercase tracking-wide mb-1">
            {lineLabel}
          </div>
          <div className="text-2xl font-black text-gray-900">
            #{workCycle.sequentialNumber}
          </div>
        </div>
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
      </div>

      {/* Wood Type */}
      <div className={`inline-block px-3 py-1 rounded-lg text-xs font-bold border uppercase tracking-wide mb-3 ${getWoodStyle(cycle.woodType)}`}>
        {cycle.woodType || t('other')}
      </div>

      {/* Chamber Info */}
      {cycle.chamberNumber && (
        <div className="text-xs text-gray-600 mb-2">
          <span className="font-medium">{t('chamber')}:</span> #{cycle.chamberNumber}
        </div>
      )}

      {/* Start Date */}
      {cycle.startDate && (
        <div className="text-xs text-gray-600 mb-3">
          <span className="font-medium">{t('startDate')}:</span> {format(parseISO(cycle.startDate), 'dd.MM.yyyy HH:mm')}
        </div>
      )}

      {/* Raw Text from Sheets */}
      <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mb-3 font-mono">
        {workCycle.rawText}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
        {hasComment && (
          <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
            <MessageSquare className="w-3 h-3" />
          </div>
        )}
        {(hasRecipePhoto || hasResultPhoto) && (
          <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
            <ImageIcon className="w-3 h-3" />
            <span>{(cycle.recipePhotos?.length || 0) + (cycle.resultPhotos?.length || 0)}</span>
          </div>
        )}
        <div className="flex-1"></div>
        <div className="flex items-center gap-1 text-xs text-green-600 font-medium group-hover:text-green-700">
          <Eye className="w-3 h-3" />
          <span>{t('viewDetails')}</span>
        </div>
      </div>
    </button>
  );
}
