import React, { useState, useEffect, useMemo } from 'react';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, subDays, addDays, 
  parseISO, differenceInHours, areIntervalsOverlapping, startOfDay, endOfDay,
  isWithinInterval, getDay
} from 'date-fns';
import { ru, lt } from 'date-fns/locale';
import { Link } from 'react-router';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, CloudSun
} from 'lucide-react';
import { DryingCycle } from '../utils/api';
import { useLanguage } from '../utils/i18n';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface CalendarViewProps {
  cycles: DryingCycle[];
}

// Weather Code Mapper
const getWeatherIcon = (code: number | undefined) => {
  if (code === undefined) return null;
  // WMO Weather interpretation codes (WW)
  if (code === 0) return <Sun className="w-5 h-5 text-yellow-500 fill-yellow-500" />;
  if (code >= 1 && code <= 3) return <CloudSun className="w-5 h-5 text-gray-500" />;
  if (code === 45 || code === 48) return <CloudFog className="w-5 h-5 text-gray-400" />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRain className="w-5 h-5 text-blue-500" />;
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return <CloudSnow className="w-5 h-5 text-indigo-300" />;
  if (code >= 95) return <CloudLightning className="w-5 h-5 text-purple-500" />;
  return <Cloud className="w-5 h-5 text-gray-400" />;
};

// Consistent Color Generator based on Chamber Number
const getChamberColor = (chamber: string | number) => {
  const colors = [
    { bg: 'bg-blue-100', text: 'text-blue-900', border: 'border-blue-200', hover: 'hover:bg-blue-200' },
    { bg: 'bg-purple-100', text: 'text-purple-900', border: 'border-purple-200', hover: 'hover:bg-purple-200' },
    { bg: 'bg-green-100', text: 'text-green-900', border: 'border-green-200', hover: 'hover:bg-green-200' },
    { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-200', hover: 'hover:bg-amber-200' },
    { bg: 'bg-pink-100', text: 'text-pink-900', border: 'border-pink-200', hover: 'hover:bg-pink-200' },
    { bg: 'bg-indigo-100', text: 'text-indigo-900', border: 'border-indigo-200', hover: 'hover:bg-indigo-200' },
    { bg: 'bg-teal-100', text: 'text-teal-900', border: 'border-teal-200', hover: 'hover:bg-teal-200' },
    { bg: 'bg-rose-100', text: 'text-rose-900', border: 'border-rose-200', hover: 'hover:bg-rose-200' },
    { bg: 'bg-cyan-100', text: 'text-cyan-900', border: 'border-cyan-200', hover: 'hover:bg-cyan-200' },
    { bg: 'bg-lime-100', text: 'text-lime-900', border: 'border-lime-200', hover: 'hover:bg-lime-200' },
  ];
  
  // Simple hash
  const num = parseInt(String(chamber).replace(/\D/g, '')) || 0;
  const index = num % colors.length;
  return colors[index];
};

export default function CalendarView({ cycles }: CalendarViewProps) {
  const { lang, t } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoveredCycleId, setHoveredCycleId] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<Record<string, { temp: number, code: number }>>({});
  
  const locale = lang === 'lt' ? lt : ru;
  const dateFormat = "yyyy-MM-dd";

  const { monthStart, monthEnd, startDate, endDate } = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    return {
        monthStart,
        monthEnd,
        startDate: startOfWeek(monthStart, { weekStartsOn: 1 }),
        endDate: endOfWeek(monthEnd, { weekStartsOn: 1 })
    };
  }, [currentDate]);

  // Fetch Weather Data
  useEffect(() => {
      async function fetchWeather() {
          try {
              const startStr = format(startDate, dateFormat);
              const endStr = format(endDate, dateFormat);
              
              const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-c5bcdb1f/weather`, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${publicAnonKey}`
                  },
                  body: JSON.stringify({ startDate: startStr, endDate: endStr })
              });

              if (!response.ok) {
                  console.warn('Weather fetch failed', await response.text());
                  return;
              }
              
              const data = await response.json();
              setWeatherData(data);
          } catch (e) {
              console.error("Failed to fetch calendar weather", e);
          }
      }
      
      fetchWeather();
  }, [startDate, endDate]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  // --- Layout Algorithm ---
  // Group days into weeks
  const weeks = useMemo(() => {
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    const weeksArray: Date[][] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      weeksArray.push(allDays.slice(i, i + 7));
    }
    return weeksArray;
  }, [startDate, endDate]);

  // Process events for each week to assign visual slots
  const weeksWithEvents = useMemo(() => {
    return weeks.map(weekDays => {
      const weekStart = startOfDay(weekDays[0]);
      const weekEnd = endOfDay(weekDays[6]);

      // 1. Find overlapping cycles for this week
      const weekCycles = cycles.filter(c => {
        if (!c.startDate) return false;
        // Filter out low quality if needed (user said Problematic <= 3, Success >= 4. Let's show all or just relevant?
        // User prompt: "краткая информация о успешных циклах сушки (4+ звезд)" in previous turn.
        // Current prompt implies showing cycles. I will stick to 4+ or show all? 
        // "Если в день получается несколько разных циклов..." -> implies potentially many.
        // Let's stick to the filter we had (>= 4 stars) to keep view clean as requested previously, or show all if user wants completeness.
        // Background says "отслеживать...". I will show >= 3 (Problematic + Success) maybe? 
        // The prompt "краткая информация о успешных циклах" was specific to the calendar request.
        // I'll stick to >= 4 for now to avoid clutter unless requested otherwise.
        // Actually, user said "фильтр Проблемные включает <=3". 
        // Let's filter >= 3 to be safe, or just 4+ as strictly requested before. 
        // I will keep >= 4 for now to match "Successful cycles" requirement.
        return (c.qualityRating || 0) >= 4;
      }).filter(c => {
        const start = parseISO(c.startDate!);
        const end = c.endDate ? parseISO(c.endDate) : new Date();
        return areIntervalsOverlapping({ start: weekStart, end: weekEnd }, { start, end });
      });

      // 2. Sort cycles by start date, then duration (longer first)
      weekCycles.sort((a, b) => {
        const startA = parseISO(a.startDate!).getTime();
        const startB = parseISO(b.startDate!).getTime();
        if (startA !== startB) return startA - startB;
        
        // Duration tie-break
        const endA = a.endDate ? parseISO(a.endDate).getTime() : new Date().getTime();
        const endB = b.endDate ? parseISO(b.endDate).getTime() : new Date().getTime();
        return (endB - startB) - (endA - startA);
      });

      // 3. Assign slots
      // slots[dayIndex] = [cycleId, cycleId, null, cycleId]
      // We need to know which vertical slot (0, 1, 2...) is free for the duration of the event within this week.
      
      const eventSlots: { cycle: DryingCycle, slot: number, startDayIdx: number, endDayIdx: number }[] = [];
      const dayUsage: boolean[][] = Array(7).fill(null).map(() => []); // dayUsage[dayIdx][slotIdx] = true/false

      weekCycles.forEach(cycle => {
        const start = parseISO(cycle.startDate!);
        const end = cycle.endDate ? parseISO(cycle.endDate) : new Date();

        // Calculate overlap with this week
        // Clamp to week boundaries
        const effectiveStart = start < weekStart ? weekStart : start;
        const effectiveEnd = end > weekEnd ? weekEnd : end;

        // Map to 0-6 index
        const startDayIdx = getDay(effectiveStart) === 0 ? 6 : getDay(effectiveStart) - 1; 
        // date-fns getDay: 0=Sun, 1=Mon...6=Sat. 
        // Our week starts Monday. 
        // If weekStartsOn=1, getDay returns standard JS day (0=Sun).
        // Let's just use differenceInDays from weekStart.
        
        let startIdx = Math.floor((effectiveStart.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
        let endIdx = Math.floor((effectiveEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));

        // Clamp indices (just in case of timezone/DST weirdness)
        startIdx = Math.max(0, Math.min(6, startIdx));
        endIdx = Math.max(0, Math.min(6, endIdx));

        // Find lowest available slot
        let slot = 0;
        while (true) {
          let isFree = true;
          for (let d = startIdx; d <= endIdx; d++) {
            if (dayUsage[d][slot]) {
              isFree = false;
              break;
            }
          }
          if (isFree) break;
          slot++;
        }

        // Mark as used
        for (let d = startIdx; d <= endIdx; d++) {
          dayUsage[d][slot] = true;
        }

        eventSlots.push({ cycle, slot, startDayIdx: startIdx, endDayIdx: endIdx });
      });

      // Max slots used in this week
      const maxSlots = Math.max(0, ...dayUsage.map(d => d.length));

      return { days: weekDays, eventSlots, maxSlots };
    });
  }, [weeks, cycles]);

  const weekDaysHeader = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden font-sans">
      {/* Header */}
      <div className="flex items-center justify-between p-4 px-6 border-b border-gray-100 bg-white backdrop-blur-md sticky top-0 z-30">
        <h2 className="text-2xl font-bold text-gray-900 capitalize flex items-center gap-3">
            {format(currentDate, 'LLLL yyyy', { locale })}
        </h2>
        <div className="flex items-center gap-2 bg-gray-100/80 p-1 rounded-lg">
            <button onClick={prevMonth} className="p-1.5 hover:bg-white rounded-md shadow-sm transition-all text-gray-600">
                <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={nextMonth} className="p-1.5 hover:bg-white rounded-md shadow-sm transition-all text-gray-600">
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 bg-white">
        {weekDaysHeader.map((day) => (
          <div key={day} className="py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-widest">
            {t(day)}
          </div>
        ))}
      </div>

      {/* Calendar Grid - Rendering Week by Week */}
      <div className="flex flex-col divide-y divide-gray-100">
        {weeksWithEvents.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 relative bg-white">
            
            {/* Background Grid Lines (Vertical) */}
             <div className="absolute inset-0 grid grid-cols-7 divide-x divide-gray-50 pointer-events-none">
                 {[...Array(7)].map((_, i) => <div key={i} className="h-full" />)}
             </div>

            {/* Days Content */}
            {week.days.map((day, dayIdx) => {
              const dayStr = format(day, dateFormat);
              const weather = weatherData[dayStr];
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, currentDate);
              const daySlots = week.eventSlots.filter(s => 
                  dayIdx >= s.startDayIdx && dayIdx <= s.endDayIdx
              );

              // Find visual slots for this day
              // We need to render a placeholder for every slot up to the max slot in the week, 
              // or at least up to the max slot used in this day.
              // Actually, to align perfectly, we should iterate up to week.maxSlots
              
              const slotsToRender = Array(week.maxSlots).fill(null).map((_, slotIdx) => {
                  return week.eventSlots.find(s => 
                      s.slot === slotIdx && 
                      dayIdx >= s.startDayIdx && 
                      dayIdx <= s.endDayIdx
                  );
              });

              return (
                <div 
                  key={day.toISOString()} 
                  className={`
                     min-h-[140px] p-2 relative z-10
                     ${!isCurrentMonth ? 'opacity-40 bg-gray-50/30' : ''}
                  `}
                >
                    {/* Header: Date & Weather */}
                    <div className="flex justify-between items-start mb-2">
                        {/* Date Number */}
                        <div className={`
                            w-8 h-8 flex items-center justify-center rounded-full text-lg font-medium transition-colors
                            ${isToday ? 'bg-red-500 text-white shadow-md font-bold' : 'text-gray-900'}
                        `}>
                            {format(day, 'd')}
                        </div>

                        {/* Weather */}
                        {weather && (
                            <div className="flex flex-col items-end">
                                <div className="text-xl font-semibold text-gray-700 leading-none mb-0.5">
                                    {Math.round(weather.temp)}°
                                </div>
                                <div>
                                    {getWeatherIcon(weather.code)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Events Stacking */}
                    <div className="flex flex-col gap-[2px] mt-1 relative">
                        {/* We use a spacer approach for slots */}
                        {slotsToRender.map((eventSlot, idx) => {
                            if (!eventSlot) {
                                // Empty slot spacer
                                return <div key={`spacer-${idx}`} className="h-6" />;
                            }

                            const { cycle, startDayIdx, endDayIdx } = eventSlot;
                            
                            // Determine if this is the START of the visual bar in this week
                            const isBarStart = dayIdx === startDayIdx;
                            // Determine if this is the END of the visual bar in this week
                            const isBarEnd = dayIdx === endDayIdx;

                            // We only render the content div if it's the start of the bar segment for this week
                            // AND we span across the grid using absolute positioning or just width?
                            // In a CSS Grid context, absolute positioning across columns is hard without subgrid.
                            // Better approach: Render segments in each cell, visually connected.
                            
                            const colors = getChamberColor(cycle.chamberNumber);
                            const isHovered = hoveredCycleId === cycle.id;
                            
                            // Styling for connections
                            const roundL = isBarStart ? 'rounded-l-md pl-2' : 'rounded-l-none border-l-0 -ml-2.5';
                            const roundR = isBarEnd ? 'rounded-r-md pr-2' : 'rounded-r-none border-r-0 -mr-2.5';
                            
                            // Only show text on the very first day of the actual cycle OR first day of week
                            // To match Apple Calendar: Text appears on the first visible segment.
                            const showText = isBarStart;
                            
                            const duration = cycle.endDate && cycle.startDate 
                                ? differenceInHours(parseISO(cycle.endDate), parseISO(cycle.startDate))
                                : null;

                            return (
                                <Link 
                                   key={cycle.id}
                                   to={`/cycle/${cycle.id}`}
                                   onMouseEnter={() => setHoveredCycleId(cycle.id)}
                                   onMouseLeave={() => setHoveredCycleId(null)}
                                   className={`
                                     h-6 text-[11px] leading-tight flex items-center relative transition-all no-underline
                                     ${colors.bg} ${colors.text} ${isHovered ? 'brightness-95 ring-1 ring-inset ring-black/10 z-20' : 'z-10'}
                                     ${roundL} ${roundR}
                                     block mb-[2px]
                                   `}
                                >
                                    <div className="truncate font-semibold px-1 w-full flex items-center gap-1">
                                        {showText && (
                                            <>
                                                <span className="whitespace-nowrap font-bold">№{cycle.chamberNumber}</span>
                                                {cycle.woodType && <span className="font-normal opacity-90 truncate"> - {cycle.woodType}</span>}
                                                {duration && <span className="opacity-75 font-normal whitespace-nowrap"> ({duration}{t('hoursShort')})</span>}
                                            </>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
