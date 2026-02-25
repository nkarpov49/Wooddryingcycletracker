import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigationType } from "react-router";
import { 
  Plus, CheckCircle, Clock, Info, Edit, Search, CloudSun, Calendar, ArrowUpDown, Droplets, Star, AlertTriangle, Image as ImageIcon, MessageSquare, ChevronDown, ChevronUp, Camera, XCircle, X, Filter
} from "lucide-react";
import { api, DryingCycle } from "../utils/api";
import { format, differenceInHours, subDays, parseISO, isAfter, isBefore } from "date-fns";
import { toast } from "sonner@2.0.3";
import { useLanguage } from "../utils/i18n";
import CalendarView from "./CalendarView";

// Helper to get stored state safely
const getStoredState = () => {
  try {
    const stored = sessionStorage.getItem('cycleListState');
    const parsed = stored ? JSON.parse(stored) : null;
    
    // Migration: Convert old single activeFilter to array if needed
    if (parsed && typeof parsed.activeFilter === 'string') {
        parsed.activeFilters = parsed.activeFilter === 'all' ? [] : [parsed.activeFilter];
        delete parsed.activeFilter;
    }
    return parsed;
  } catch {
    return null;
  }
};

export default function CycleList() {
  const navType = useNavigationType();
  const storedState = getStoredState();
  const { t } = useLanguage();

  // Initialize state from storage if available
  const [cycles, setCycles] = useState<DryingCycle[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState(storedState?.searchQuery || "");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  
  const [activeTab, setActiveTab] = useState<'actual' | 'calendar'>(storedState?.activeTab || 'actual');
  
  // Changed activeFilter (string) to activeFilters (string[])
  const [activeFilters, setActiveFilters] = useState<string[]>(storedState?.activeFilters || []);
  
  const [selectedWood, setSelectedWood] = useState<string>(storedState?.selectedWood || "");
  const [sortOption, setSortOption] = useState<'SeqDesc' | 'SeqAsc' | 'DateNew' | 'QualityDesc' | 'DurationAsc'>(storedState?.sortOption || 'SeqDesc');

  // Persist State to Session Storage on any change
  useEffect(() => {
    const stateToSave = {
      searchQuery,
      activeTab,
      activeFilters,
      selectedWood,
      sortOption,
    };
    sessionStorage.setItem('cycleListState', JSON.stringify(stateToSave));
  }, [searchQuery, activeTab, activeFilters, selectedWood, sortOption]);

  // Save scroll position on scroll
  useEffect(() => {
     const handleScroll = () => {
         sessionStorage.setItem('cycleListScroll', window.scrollY.toString());
     };
     window.addEventListener('scroll', handleScroll, { passive: true });
     return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load Data
  useEffect(() => {
    loadCycles();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      loadCycles(true); // Pass true to skip toast on auto-refresh
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  async function loadCycles(silent = false) {
    try {
      const data = await api.getCycles();
      
      // Only update if data changed
      setCycles(prevCycles => {
        const hasChanged = JSON.stringify(data) !== JSON.stringify(prevCycles);
        return hasChanged ? data : prevCycles;
      });
    } catch (err) {
      console.error(err);
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  }

  // Restore Scroll Position ONLY if coming back (POP navigation)
  useEffect(() => {
    if (!loading && cycles.length > 0 && navType === 'POP') {
        // Small timeout to allow DOM layout to stabilize
        const timer = setTimeout(() => {
            const savedScroll = sessionStorage.getItem('cycleListScroll');
            if (savedScroll) {
                window.scrollTo(0, parseInt(savedScroll, 10));
            }
        }, 50);
        return () => clearTimeout(timer);
    }
  }, [loading, cycles, navType]);


  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setExpandedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleRate = async (e: React.MouseEvent, cycleId: string, rating: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Optimistic Update
    setCycles(prev => prev.map(c => c.id === cycleId ? { ...c, qualityRating: rating } : c));
    
    try {
        await api.updateCycle(cycleId, { qualityRating: rating });
    } catch (err) {
        console.error(err);
        toast.error(t('error'));
    }
  };

  // --- Logic Helpers ---

  // 1. Split into Tabs
  const thirtyDaysAgo = subDays(new Date(), 30);
  
  const tabFilteredCycles = useMemo(() => {
      return cycles.filter(cycle => {
          const date = cycle.startDate ? parseISO(cycle.startDate) : (cycle.createdAt ? parseISO(cycle.createdAt) : new Date(0));
          const isRecent = isAfter(date, thirtyDaysAgo);
          const isInProgress = cycle.status === 'In Progress';

          if (activeTab === 'actual') {
              // Actual: Recent (<30 days) OR In Progress (even if old)
              return isRecent || isInProgress;
          } else {
              // Archive: Older than 30 days AND not In Progress
              return !isRecent && !isInProgress;
          }
      });
  }, [cycles, activeTab, thirtyDaysAgo]);

  const toggleFilter = (filterKey: string) => {
    if (filterKey === 'all') {
        setActiveFilters([]);
        return;
    }
    
    setActiveFilters(prev => {
        if (prev.includes(filterKey)) {
            return prev.filter(f => f !== filterKey);
        } else {
            return [...prev, filterKey];
        }
    });
  };

  // 2. Apply Filters (Only for Actual tab usually, but logic applies generally if needed)
  const filteredCycles = useMemo(() => {
      let result = tabFilteredCycles;

      if (activeTab === 'actual') {
          // Apply each active filter (AND logic)
          if (activeFilters.includes('inProgress')) {
              // Ensure we filter strictly for truly in-progress (no end date)
              result = result.filter(c => !c.endDate);
          }
          if (activeFilters.includes('completed')) {
              result = result.filter(c => !!c.endDate);
          }
          if (activeFilters.includes('success')) {
              result = result.filter(c => c.qualityRating !== undefined && c.qualityRating >= 4);
          }
          if (activeFilters.includes('problem')) {
              result = result.filter(c => c.qualityRating !== undefined && c.qualityRating <= 3);
          }
          if (activeFilters.includes('last7')) {
              const sevenDaysAgo = subDays(new Date(), 7);
              result = result.filter(c => {
                  const d = c.startDate ? parseISO(c.startDate) : new Date(0);
                  return isAfter(d, sevenDaysAgo);
              });
          }
          if (activeFilters.includes('wood') && selectedWood) {
              result = result.filter(c => c.woodType === selectedWood);
          }
      }

      // Search Query
      if (searchQuery) {
         const query = searchQuery.trim().toLowerCase();
         const isNumeric = /^\d+$/.test(query);

         if (isNumeric) {
             if (query.length < 3) {
                 // 1 or 2 digits -> Strict search by Chamber Number
                 // User request: 1 digit = search single digit chambers, 2 digits = search double digit chambers
                 result = result.filter(c => String(c.chamberNumber) === query);
             } else {
                 // 3+ digits -> Search by Sequential Number
                 result = result.filter(c => (c.sequentialNumber || '').includes(query));
             }
         } else {
             // Standard text search
             result = result.filter(c => {
                 const seq = (c.sequentialNumber || '').toLowerCase();
                 const code = (c.recipeCode || '').toLowerCase();
                 const wood = (c.woodType || '').toLowerCase();
                 return seq.includes(query) || code.includes(query) || wood.includes(query);
             });
         }
      }

      return result;
  }, [tabFilteredCycles, activeFilters, selectedWood, searchQuery, activeTab]);

  // 3. Sorting
  const sortedCycles = useMemo(() => {
      const list = [...filteredCycles];

      // Special rule: If "inProgress" filter is active, sort by Chamber Number Ascending
      if (activeFilters.includes('inProgress')) {
          return list.sort((a, b) => {
              return (Number(a.chamberNumber) || 0) - (Number(b.chamberNumber) || 0);
          });
      }

      return list.sort((a, b) => {
          switch (sortOption) {
              case 'SeqDesc':
                  return (parseInt(b.sequentialNumber.replace(/\D/g,'')) || 0) - (parseInt(a.sequentialNumber.replace(/\D/g,'')) || 0);
              case 'SeqAsc':
                  return (parseInt(a.sequentialNumber.replace(/\D/g,'')) || 0) - (parseInt(b.sequentialNumber.replace(/\D/g,'')) || 0);
              case 'DateNew':
                  return new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime();
              case 'QualityDesc':
                  return (b.qualityRating || 0) - (a.qualityRating || 0);
              case 'DurationAsc':
                  const durA = (a.startDate && a.endDate) ? differenceInHours(parseISO(a.endDate), parseISO(a.startDate)) : 999999;
                  const durB = (b.startDate && b.endDate) ? differenceInHours(parseISO(b.endDate), parseISO(b.startDate)) : 999999;
                  return durA - durB;
              default:
                  return 0;
          }
      });
  }, [filteredCycles, sortOption, activeFilters]);

  // Unique Wood Types for Dropdown
  const uniqueWoods = useMemo(() => {
      const woods = new Set(cycles.map(c => c.woodType).filter(Boolean));
      return Array.from(woods).sort();
  }, [cycles]);

  // --- UI Helpers ---

  const getWoodStyle = (woodType: string) => {
    const type = (woodType || '').toLowerCase();
    if (type.includes('birch')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (type.includes('oak')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (type.includes('alder')) return 'bg-gray-100 text-gray-800 border-gray-200';
    if (type.includes('maple') || type.includes('ash')) return 'bg-green-100 text-green-800 border-green-200';
    if (type.includes('scroblas')) return 'bg-white text-gray-800 border-gray-300 shadow-sm';
    return 'bg-amber-50 text-amber-800 border-amber-100';
  };

  const getDuration = (cycle: DryingCycle) => {
      if (!cycle.startDate || !cycle.endDate) return null;
      return differenceInHours(parseISO(cycle.endDate), parseISO(cycle.startDate));
  };

  // Calculate In Progress Count (based on CURRENT tab context, i.e., Actual or Archive, though usually relevant for Actual)
  // robust check: must not have end date to be truly in progress
  const inProgressCount = useMemo(() => {
      return tabFilteredCycles.filter(c => !c.endDate).length;
  }, [tabFilteredCycles]);

  const Chip = ({ label, active, onClick, icon, count }: any) => (
      <button 
        onClick={onClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${
            active 
            ? 'bg-amber-100 text-amber-900 border-amber-200' 
            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
        }`}
      >
          {icon && <span className="opacity-70">{icon}</span>}
          {label}
          {count !== undefined && (
              <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-amber-200 text-amber-900' : 'bg-gray-100 text-gray-600'
              }`}>
                  {count}
              </span>
          )}
      </button>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-700"></div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Search Bar */}
      <div className="mb-2 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-sm"
          />
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100/50 p-1 rounded-xl mb-3 border border-gray-200">
          <button 
            onClick={() => setActiveTab('actual')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                activeTab === 'actual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
              {t('tabActual')}
          </button>
          <button 
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                activeTab === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
              {t('tabCalendar')}
          </button>
      </div>

      {/* Filters & Sorting (Only for Actual) */}
      {activeTab === 'actual' && (
          <div className="mb-4 space-y-3">
              {/* Horizontal Scroll Chips */}
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4">
                  <Chip 
                    label={t('filterAll')} 
                    active={activeFilters.length === 0} 
                    onClick={() => toggleFilter('all')} 
                  />
                  <Chip 
                    label={t('inProgress')} 
                    active={activeFilters.includes('inProgress')} 
                    onClick={() => toggleFilter('inProgress')}
                    icon={<Clock className="w-3 h-3" />}
                    count={inProgressCount}
                  />
                  <Chip 
                    label={t('completed')} 
                    active={activeFilters.includes('completed')} 
                    onClick={() => toggleFilter('completed')}
                    icon={<CheckCircle className="w-3 h-3" />}
                  />
                  <Chip 
                    label={t('filterSuccess')} 
                    active={activeFilters.includes('success')} 
                    onClick={() => toggleFilter('success')}
                    icon={<Star className="w-3 h-3" />}
                  />
                  <Chip 
                    label={t('filterProblem')} 
                    active={activeFilters.includes('problem')} 
                    onClick={() => toggleFilter('problem')}
                    icon={<AlertTriangle className="w-3 h-3" />}
                  />
                  <Chip 
                    label={t('filter7Days')} 
                    active={activeFilters.includes('last7')} 
                    onClick={() => toggleFilter('last7')}
                  />
                  
                  {/* Wood Dropdown Chip */}
                  <div className="relative">
                      <select 
                          className={`appearance-none pl-3 pr-8 py-1.5 rounded-full text-xs font-bold border transition-colors focus:outline-none ${
                              activeFilters.includes('wood')
                                ? 'bg-amber-100 text-amber-900 border-amber-200' 
                                : 'bg-white text-gray-600 border-gray-200'
                          }`}
                          value={selectedWood}
                          onChange={(e) => {
                              setSelectedWood(e.target.value);
                              // Ensure 'wood' filter is active if a wood is selected
                              if (!activeFilters.includes('wood')) {
                                  toggleFilter('wood');
                              }
                          }}
                          // Optional: Clicking the select itself doesn't need to toggle off, 
                          // but usually we rely on the user picking an option.
                          // If they want to turn it off, they can click the chip area (tricky with select overlay)
                          // or we can add an "X" or just let them select empty.
                          // Let's rely on selecting empty string to disable?
                          // Actually, let's keep it simple: Selecting activates it.
                      >
                          <option value="">{t('filterWood')}</option>
                          {uniqueWoods.map(w => (
                              <option key={w} value={w}>{w}</option>
                          ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-50" />
                  </div>
              </div>

              {/* Sort Select */}
              <div className="relative">
                 <select 
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as any)}
                    className="w-full pl-3 pr-10 py-2 bg-white border border-gray-200 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
                 >
                   <option value="SeqDesc">{t('sortBySeq')} ↓</option>
                   <option value="SeqAsc">{t('sortBySeq')} ↑</option>
                   <option value="DateNew">{t('sortDate')}</option>
                   <option value="QualityDesc">{t('sortQuality')}</option>
                   <option value="DurationAsc">{t('sortDuration')}</option>
                 </select>
                 <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
          </div>
      )}

      {/* Calendar View */}
      {activeTab === 'calendar' ? (
          <CalendarView cycles={cycles} />
      ) : (
        /* Cycle List */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedCycles.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400">
            <p>{t('cyclesNotFound')}</p>
          </div>
        ) : (
          sortedCycles.map(cycle => {
            const isCompleted = cycle.status === 'Completed' || !!cycle.endDate;
            const isExpanded = expandedIds[cycle.id || ''] || false;
            
            // Photo Logic
            const recipePhotosCount = (cycle.recipePhotos?.length) || (cycle.recipePhotoUrl ? 1 : 0);
            const resultPhotosCount = cycle.resultPhotos?.length || 0;
            const photoCount = recipePhotosCount + resultPhotosCount;

            // Warnings Logic
            const hasRecipePhoto = recipePhotosCount > 0;
            const hasResults = cycle.finalMoisture !== undefined || cycle.qualityRating !== undefined;
            const showNotEntered = isCompleted && !hasResults;

            // Date & Duration
            const dateStr = cycle.startDate 
              ? format(new Date(cycle.startDate), 'dd.MM')
              : (cycle.createdAt ? format(new Date(cycle.createdAt), 'dd.MM') : '-');
            const duration = getDuration(cycle);

            // Red background for low rating (< 3)
            const isLowQuality = (cycle.qualityRating || 0) > 0 && (cycle.qualityRating || 0) < 3;

            return (
              <div key={cycle.id} className={`rounded-xl border shadow-sm overflow-hidden transition-all ${
                  isLowQuality ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 hover:border-amber-200'
              }`}>
                {/* Card Header / Main Row */}
                <Link to={`/cycle/${cycle.id}`} className="block p-3">
                   <div className="flex items-start justify-between gap-3">
                       
                       {/* Left Side: Badges & Info */}
                       <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                               <span className="font-mono text-lg font-bold text-gray-900">№{cycle.chamberNumber}</span>
                               <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${getWoodStyle(cycle.woodType)}`}>
                                   {cycle.woodType}
                               </span>
                               <span className="bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                   #{cycle.sequentialNumber}
                               </span>
                               {cycle.isTest && (
                                   <span className="bg-red-100 text-red-600 border border-red-200 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                       TEST
                                   </span>
                               )}
                           </div>

                           <div className="flex items-center gap-3 text-xs text-gray-500">
                               <div className="flex items-center gap-1">
                                   <Calendar className="w-3 h-3" />
                                   {dateStr}
                               </div>
                               
                               {/* Temp */}
                               {cycle.startTemperature !== undefined && (
                                   <div className="flex items-center gap-1">
                                       <CloudSun className="w-3 h-3 text-gray-400" />
                                       {cycle.avgTemp !== undefined && isCompleted ? `${cycle.avgTemp}°` : `${cycle.startTemperature}°`}
                                   </div>
                               )}

                               {/* Moisture */}
                               {cycle.finalMoisture !== undefined && (
                                   <div className="flex items-center gap-1 font-bold text-blue-600">
                                       <Droplets className="w-3 h-3" />
                                       {cycle.finalMoisture}%
                                   </div>
                               )}

                               {/* Duration */}
                               {duration !== null && (
                                   <div className="flex items-center gap-1 font-medium text-gray-700">
                                       <Clock className="w-3 h-3" />
                                       {duration}{t('hoursShort')}
                                   </div>
                               )}
                           </div>
                       </div>

                       {/* Right Side: Status Icons & Photo Count */}
                       <div className="flex flex-col items-end gap-2">
                           {/* Status Icon */}
                           {isCompleted ? (
                               <CheckCircle className="w-5 h-5 text-green-500" />
                           ) : (
                               <Clock className="w-5 h-5 text-amber-500" />
                           )}
                           
                           {/* Photo Count or No Photo Badge */}
                           {photoCount > 0 ? (
                               <div className="flex items-center gap-1 text-xs font-bold text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                   <Camera className="w-3 h-3" />
                                   {photoCount}
                               </div>
                           ) : (
                               <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 whitespace-nowrap">
                                   <Camera className="w-3 h-3" />
                                   <X className="w-2 h-2 -ml-1" />
                               </div>
                           )}
                       </div>
                   </div>
                </Link>

                {/* Middle Row: Warnings (Compact) */}
                {(showNotEntered || !hasRecipePhoto) && (
                    <div className="px-3 pb-2 flex flex-wrap gap-2">
                         {!hasRecipePhoto && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                                <Camera className="w-3 h-3" />
                                <X className="w-2 h-2 -ml-1" />
                                {t('noPhotoShort')}
                            </div>
                         )}
                         {showNotEntered && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3" />
                                {t('notEnteredShort')}
                            </div>
                         )}
                    </div>
                )}

                {/* Bottom Row: Rating & Comments */}
                <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    
                    {/* Interactive Stars */}
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {[1, 2, 3, 4, 5].map((star) => (
                           <button
                              key={star}
                              type="button"
                              onClick={(e) => handleRate(e, cycle.id || '', star)}
                              className="focus:outline-none active:scale-90 transition-transform p-0.5"
                           >
                             <Star 
                               className={`w-5 h-5 ${
                                 (cycle.qualityRating || 0) >= star 
                                   ? 'fill-amber-400 text-amber-400' 
                                   : 'text-gray-300'
                               }`} 
                             />
                           </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Expand Comment Button */}
                        {cycle.overallComment && (
                            <button 
                               onClick={(e) => toggleExpand(cycle.id || '', e)}
                               className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all border shadow-sm ${
                                   isExpanded 
                                    ? 'bg-amber-100 text-amber-900 border-amber-200' 
                                    : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'
                               }`}
                            >
                               <MessageSquare className={`w-3.5 h-3.5 ${isExpanded ? '' : 'fill-blue-200'}`} />
                               <span>{t('hasComment')}</span>
                               {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                            </button>
                        )}
                        
                        {/* Quick Edit Button */}
                        <Link 
                            to={`/edit/${cycle.id}`}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                            title={t('edit')}
                        >
                            <Edit className="w-4 h-4" />
                        </Link>
                    </div>
                </div>

                {/* Expanded Comment */}
                {isExpanded && cycle.overallComment && (
                    <div className="px-3 py-2 bg-gray-50 text-sm text-gray-700 border-t border-gray-100">
                        <p className="whitespace-pre-wrap italic leading-relaxed text-gray-600">"{cycle.overallComment}"</p>
                    </div>
                )}
              </div>
            );
          })
        )}
      </div>
      )}

      {/* FAB */}
      <Link 
        to="/new" 
        className="fixed bottom-6 right-6 w-14 h-14 bg-amber-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-amber-700 hover:scale-105 transition-all z-40 focus:outline-none focus:ring-4 focus:ring-amber-300"
      >
        <Plus className="w-8 h-8" />
      </Link>
    </div>
  );
}