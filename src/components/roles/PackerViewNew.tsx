import React, { useState, useEffect } from 'react';
import { Loader2, LogOut, Package, Calendar, Filter, ArrowLeft, Search, X } from 'lucide-react';
import { api, DryingCycle, CurrentWorkCycle } from '../../utils/api';
import { toast } from 'sonner@2.0.3';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../utils/i18n';
import LineSelectionScreen from './LineSelectionScreen';
import PackerCycleCard from './PackerCycleCard';
import PackerCycleDetailModal from './PackerCycleDetailModal';
import CurrentWorkCard from './CurrentWorkCard';

export default function PackerViewNew() {
  const { logout } = useAuth();
  const { t, lang } = useLanguage();
  const [selectedLine, setSelectedLine] = useState<'1-2' | '3' | null>(null);
  const [cycles, setCycles] = useState<DryingCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<DryingCycle | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [currentWork, setCurrentWork] = useState<CurrentWorkCycle[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [woodFilter, setWoodFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingModal, setLoadingModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Загрузка всех завершённых циклов
  const fetchCycles = async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    try {
      const data = await api.getCycles();
      // ✅ ИСПРАВЛЕНИЕ: Загружаем ВСЕ циклы, а не только Completed
      // Фильтрация будет происходить ниже в completedCycles
      
      console.log(`📊 Загружено циклов из API: ${data.length}`);
      const withEndDate = data.filter((c: DryingCycle) => c.end_date);
      const withCompletedStatus = data.filter((c: DryingCycle) => c.status === 'Completed');
      console.log(`  - С endDate: ${withEndDate.length}`);
      console.log(`  - Со статусом Completed: ${withCompletedStatus.length}`);
      
      // Обновляем только если данные изменились
      setCycles(prevCycles => {
        const hasChanged = JSON.stringify(data) !== JSON.stringify(prevCycles);
        
        if (hasChanged) {
          setLastUpdate(new Date().toISOString());
        }
        
        return hasChanged ? data : prevCycles;
      });
    } catch (err) {
      console.error('Error fetching cycles:', err);
      // Не показываем ошибку при автообновлении
    } finally {
      if (showIndicator) {
        // Показываем индикатор минимум 500ms для визуального feedback
        setTimeout(() => setIsRefreshing(false), 500);
      }
      setLoading(false);
    }
  };

  // Загрузка текущих работ
  const fetchCurrentWork = async () => {
    try {
      const data = await api.getCurrentWork();
      console.log("DATA:", data);
      console.log("LINE1:", data.line1);
      console.log("CYCLE:", data.line1?.cycle);
      const mapped = [
  data.line1 ? { ...data.line1, lineId: '1' } : null,
  data.line2 ? { ...data.line2, lineId: '2' } : null,
  data.line3 ? { ...data.line3, lineId: '3' } : null
].filter(Boolean);

console.log("FINAL:", mapped);

setCurrentWork(mapped);
    } catch (err) {
      console.error('Error fetching current work:', err);
    }
  };

  useEffect(() => {
    fetchCycles();
    fetchCurrentWork();
    const cyclesInterval = setInterval(fetchCycles, 10000); // Refresh every 10 seconds
    const workInterval = setInterval(fetchCurrentWork, 10000); // Refresh every 10 seconds
    return () => {
      clearInterval(cyclesInterval);
      clearInterval(workInterval);
    };
  }, []);

  // Active cycles (In Progress) - показываем ВСЕ камеры независимо от линии
  const activeCycles = cycles.filter(
    c => c.status === 'In Progress' && !c.endDate
  ).sort((a, b) => a.chamberNumber - b.chamberNumber);

  // Completed cycles - показываем ВСЕ камеры независимо от линии
  let completedCycles = cycles.filter(
    c => c.endDate || c.status === 'Completed'
  );
  
  console.log(`🔍 После фильтра (endDate ИЛИ Completed): ${completedCycles.length} циклов`);

  // Apply date filter
  if (dateFilter === '7days') {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    completedCycles = completedCycles.filter(c => 
      c.endDate && new Date(c.endDate) >= sevenDaysAgo
    );
  } else if (dateFilter === '30days') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    completedCycles = completedCycles.filter(c => 
      c.endDate && new Date(c.endDate) >= thirtyDaysAgo
    );
  }

  // Apply wood type filter
  if (woodFilter !== 'all') {
    completedCycles = completedCycles.filter(c => 
      c.woodType?.toLowerCase().includes(woodFilter.toLowerCase())
    );
  }

  // Apply smart search query filter
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    
    // Умная логика поиска
    if (/^\d+$/.test(q)) {
      // Только цифры
      if (q.length <= 2) {
        // 1-2 цифры: поиск по номеру камеры
        completedCycles = completedCycles.filter(c => 
          String(c.chamberNumber) === q
        );
      } else {
        // 3+ цифр: поиск по порядковому номеру сушки
        completedCycles = completedCycles.filter(c => 
          c.sequentialNumber?.includes(q)
        );
      }
    } else {
      // Текстовый поиск: порода дерева, комментарии, статус
      completedCycles = completedCycles.filter(c => 
        c.woodType?.toLowerCase().includes(q) ||
        c.overallComment?.toLowerCase().includes(q) ||
        c.status?.toLowerCase().includes(q) ||
        (c.isFailed && (q.includes('fail') || q.includes('сыр') || q.includes('šlap')))
      );
    }
  }

  // Sort by end date (newest first)
  completedCycles.sort((a, b) => 
    new Date(b.endDate || b.createdAt).getTime() - new Date(a.endDate || a.createdAt).getTime()
  );

  // Get unique wood types for filter
  const uniqueWoodTypes = Array.from(
    new Set(cycles.map(c => c.woodType).filter(Boolean))
  ).sort();

  const getWoodStyle = (woodType: string) => {
    const type = (woodType || '').toLowerCase();
    // Beržas (Береза) - синий
    if (type.includes('birch') || type.includes('beržas')) return 'bg-blue-100 text-blue-800 border-blue-200';
    // Ąžuolas (Дуб) - желтый
    if (type.includes('oak') || type.includes('ąžuolas')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    // Alksnis (Ольха) - серый
    if (type.includes('alder') || type.includes('alksnis')) return 'bg-gray-100 text-gray-800 border-gray-200';
    // Klevas / Uosis (Клен / Ясень) - зеленый
    if (type.includes('maple') || type.includes('klevas') || type.includes('ash') || type.includes('uosis')) {
        return 'bg-green-100 text-green-800 border-green-200';
    }
    // Skroblas (Граб) - белый
    if (type.includes('scroblas') || type.includes('skroblas')) return 'bg-white text-gray-800 border-gray-300 shadow-sm';
    // Все остальное - янтарный
    return 'bg-amber-50 text-amber-800 border-amber-100';
};

  // If no line selected, show selection screen
  if (!selectedLine) {
    return <LineSelectionScreen onSelectLine={setSelectedLine} />;
  }

  const titleKey = selectedLine === '1-2' ? 'leaderLine1And2Title' : 'leaderLine3Title';

  // 🔥 Фильтруем текущие работы по выбранной линии
// Важно: work.lineId мы добавили сами на фронте (в fetchCurrentWork)

const relevantWork = currentWork.filter(work => {
  // Если выбраны линии 1-2 → показываем только их
  if (selectedLine === '1-2') {
    return work.lineId === '1' || work.lineId === '2';
  }

  // Если выбрана линия 3 → показываем только её
  return work.lineId === '3';
});

  // 🔥 Обработчик открытия деталей цикла
// Загружает полный цикл (с фото и signed URLs)

const handleViewDetails = async (cycle: DryingCycle) => {
  try {
    // ❗ Защита: если нет id — не делаем запрос
    if (!cycle?.id) {
      console.error('Cycle ID is missing');
      return;
    }

    setLoadingModal(true);

    // 👉 получаем полный цикл с сервера
    const fullCycle = await api.getCycleById(cycle.id);

    setSelectedCycle(fullCycle);
    setDetailModalOpen(true);

  } catch (error) {
    console.error('Error loading cycle details:', error);
    toast.error(t('error'));
  } finally {
    setLoadingModal(false);
  }
};

  // 🔥 Обновление цикла (например после редактирования)

const handleCycleUpdate = (updatedCycle: DryingCycle) => {

  // ✅ 1. Обновляем список всех циклов
  setCycles(cycles.map(c => 
    c.id === updatedCycle.id ? { ...c, ...updatedCycle } : c
  ));

  // ✅ 2. Обновляем currentWork (если этот цикл там есть)
  setCurrentWork(currentWork.map(work => 
    work.cycle?.id === updatedCycle.id
      ? {
          ...work,
          cycle: {
            ...work.cycle,
            ...updatedCycle // 🔥 обновляем данные внутри карточки
          }
        }
      : work
  ));

  // ✅ 3. Обновляем открытый модал
  setSelectedCycle(updatedCycle);
};

  // 🔥 Получение названия линии (для UI)

const getLineLabel = (lineId: '1' | '2' | '3') => {
  if (lineId === '1') return t('line1');
  if (lineId === '2') return t('line2');
  return t('line3');
};

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSelectedLine(null)}
              className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-amber-500" />
              {t(titleKey)}
            </h1>
          </div>
          <button onClick={logout} className="text-gray-500 hover:text-red-600 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        
        {/* Instructions */}
        <div className="px-4 pb-3 border-t border-gray-100 pt-3">
          <p className="text-sm text-gray-600 text-center">
            {t('leaderInstructions')}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="w-10 h-10 text-gray-400 animate-spin" />
        </div>
      ) : (
        <div className="p-3 sm:p-4 space-y-6">
          {/* Current Work Section - from Google Sheets */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              {t('currentWork')} ({relevantWork.length})
            </h2>
            {relevantWork.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                {t('currentWorkEmpty')}
              </div>
            ) : (
              <div className={`grid gap-3 ${
                selectedLine === '3' 
                  ? 'grid-cols-1 max-w-2xl mx-auto' 
                  : 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto'
              }`}>
                {relevantWork.map((work, idx) => {
  console.log("RENDER WORK:", work);

  return (
    <CurrentWorkCard
      key={`${work.lineId}-${idx}`}
      workCycle={work}
      lineLabel={getLineLabel(work.lineId)}
      onClick={() => work.cycle && handleViewDetails(work.cycle)}
    />
  );
})}
              </div>
            )}
          </div>

          {/* Smart Search Bar */}
          <div className="bg-white rounded-2xl p-4 shadow-apple-sm border border-gray-200">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder={lang === 'ru' 
                  ? '🔍 Поиск: 1-2 цифры - камера, 3+ цифр - № сушки, текст - порода' 
                  : '🔍 Paieška: 1-2 skaitm. - kamera, 3+ - džiov. Nr., tekstas - medis'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-12 py-4 bg-gray-50 border-2 border-gray-200 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 rounded-xl text-base font-medium placeholder:text-gray-400 placeholder:text-sm shadow-sm transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            
            {/* Search Hints */}
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                💡 {lang === 'ru' 
                  ? '1-2 цифры → камера' 
                  : '1-2 skaitmenys → kamera'}
              </div>
              <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                🔢 {lang === 'ru' 
                  ? '3+ цифр → № сушки' 
                  : '3+ skaitm. → džiov. Nr.'}
              </div>
              <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                🌳 {lang === 'ru' 
                  ? 'Текст → порода' 
                  : 'Tekstas → medis'}
              </div>
            </div>
          </div>

          {/* Completed Cycles Section */}
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 gap-2.5">
              <h2 className="text-lg font-bold text-gray-900">
                {t('completedCycles')} ({completedCycles.length})
              </h2>
              
              {/* Filters - КОМПАКТНЫЕ */}
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Date Filter */}
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                >
                  <option value="all">{t('filterAll')}</option>
                  <option value="7days">{t('filter7Days')}</option>
                  <option value="30days">{t('recentFilter')}</option>
                </select>

                {/* Wood Type Filter */}
                <select
                  value={woodFilter}
                  onChange={(e) => setWoodFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                >
                  <option value="all">{t('allWoodTypes')}</option>
                  {uniqueWoodTypes.map(wood => (
                    <option key={wood} value={wood}>{wood}</option>
                  ))}
                </select>
              </div>
            </div>

            {completedCycles.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                {t('cyclesNotFound')}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {completedCycles.map(cycle => (
                  <PackerCycleCard key={cycle.id} cycle={cycle} onClick={() => handleViewDetails(cycle)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {detailModalOpen && selectedCycle && (
        <PackerCycleDetailModal 
          key={selectedCycle.id}
          cycle={selectedCycle} 
          onClose={() => setDetailModalOpen(false)} 
          onUpdate={handleCycleUpdate}
          allowEdit={true}
        />
      )}
      
      {/* Loading indicator for modal */}
      {loadingModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
            <p className="text-gray-600 font-medium">{t('loading')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
