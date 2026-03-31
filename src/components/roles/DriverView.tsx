import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../utils/i18n';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Check, X, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { format } from 'date-fns';
import { api } from '../../utils/api';

type WorkCycle = {
  id: string;
  chamberNumber: number;
  sequentialNumber: string; // ✅ FIX
  woodType: string;
  status: string;
  recipePhotos?: string[];
};

type WeightData = {
  boxNumber: number;
  weight: number | null;
};

type WoodTypeConfig = {
  name: string;
  weightLimit: number;
  warmupTime: number;
  dryingRateTime: number;
};

// ✅ упрощённая и надёжная функция
const normalize = (str: string) =>
  str
    .toLowerCase()
    .replace(/\s+/g, '') // убираем все пробелы
    .trim();

const getWoodConfig = (
  woodType: string,
  configs: WoodTypeConfig[]
): WoodTypeConfig | undefined => {
  if (!woodType || !configs.length) return undefined;

  const normalizedType = normalize(woodType);

  return configs.find(c =>
    normalize(c.name) === normalizedType
  );
};

export default function DriverView() {
  const { t, lang } = useLanguage();
  const { logout } = useAuth();
  const [cycles, setCycles] = useState<WorkCycle[]>([]);
  const [selectedChamber, setSelectedChamber] = useState<WorkCycle | null>(null);
  const [weights, setWeights] = useState<WeightData[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Настройки пород дерева
  const [woodConfigs, setWoodConfigs] = useState<WoodTypeConfig[]>([]);
  
  // Калькулятор
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [currentBoxIndex, setCurrentBoxIndex] = useState<number | null>(null);
  const [calculatorValue, setCalculatorValue] = useState('');

  // Долгое нажатие для выхода
  const [holdTimer, setHoldTimer] = useState<NodeJS.Timeout | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  
  // Защита от двойного клика при подтверждении
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Chambers 1-21
  const chambers = Array.from({ length: 21 }, (_, i) => i + 1);
useEffect(() => {
  let isMounted = true;

  const init = async () => {
    await loadWoodSettings();
    await fetchActiveChambers();
  };

  init();

  // 🔁 авто-обновление каждые 5 сек
  const interval = setInterval(() => {
    loadWoodSettings();
  }, 15000);

  return () => {
    isMounted = false;
    clearInterval(interval);
  };
}, []);

const loadWoodSettings = async () => {
  try {
    const url = `https://${projectId}.supabase.co/functions/v1/make-server-c5bcdb1f/wood-settings?ts=${Date.now()}`;

    console.log('[WoodSettings] 📥 Запрос:', url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
      }
    });

    if (!response.ok) {
      console.error('[WoodSettings] ❌ Ошибка:', response.status);
      return;
    }

    const data = await response.json();

    console.log('[WoodSettings] ✅ Получено:', data);

    if (!Array.isArray(data)) {
      console.error('[WoodSettings] ⚠️ Не массив:', data);
      return;
    }

    // 🔥 защита от лишних обновлений (очень важно)
    setWoodConfigs(prev => {
      const prevStr = JSON.stringify(prev);
      const newStr = JSON.stringify(data);

      if (prevStr === newStr) {
        return prev; // ничего не меняем → нет ререндера
      }

      console.log('[WoodSettings] 🔄 Обновление состояния');
      return data;
    });

  } catch (error: any) {
    console.error('[WoodSettings] ❌ Ошибка загрузки:', error.message);
  }
};

  const fetchActiveChambers = async () => {
    try {
      console.log('[DriverView] 📥 Загрузка активных камер...');
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-c5bcdb1f/work-cycles`;
      console.log('[DriverView] URL запроса:', url);
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${publicAnonKey}` }
      });
      
      console.log('[DriverView] Статус ответа:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DriverView] ❌ Ошибка ${response.status}:`, errorText);
        
        // Показываем пользователю понятное сообщение
        if (response.status === 500) {
          toast.error(lang === 'ru' ? 'Ошибка сервера. Попробуйте позже.' : 'Serverio klaida. Bandykite vėliau.');
        } else if (response.status === 404) {
          toast.error(lang === 'ru' ? 'Сервис недоступен' : 'Paslauga nepasiekiama');
        } else {
          toast.error(t('error'));
        }
        
        setCycles([]);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      console.log('[DriverView] ✅ Получено циклов:', data?.length || 0);
      
      // Проверяем что data это массив
      if (!Array.isArray(data)) {
        console.error('[DriverView] ⚠️ Неверный формат данных:', typeof data);
        setCycles([]);
        setLoading(false);
        return;
      }
      
      // Показываем циклы В ПРОЦЕССЕ (готовые к взвешиванию)
      const inProgressCycles = data.filter((c: WorkCycle) => 
        c.status && (c.status.toLowerCase() === 'in progress' || c.status === 'In Progress')
      );
      console.log('[DriverView] ✅ Циклы в процессе:', inProgressCycles.length);
      setCycles(inProgressCycles);
    } catch (error: any) {
      console.error('[DriverView] ❌ Критическая ошибка загрузки камер:', error);
      console.error('[DriverView] Тип ошибки:', error.name);
      console.error('[DriverView] Сообщение:', error.message);
      
      // Проверяем тип ошибки
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        toast.error(
          lang === 'ru' 
            ? 'Не удалось подключиться к серверу. Проверьте интернет.' 
            : 'Nepavyko prisijungti prie serverio. Patikrinkite internetą.'
        );
      } else {
        toast.error(t('error'));
      }
      
      setCycles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChamberSelect = (chamber: WorkCycle) => {
    setSelectedChamber(chamber);
    // Инициализируем 3 ящика минимум
    setWeights([
      { boxNumber: 1, weight: null },
      { boxNumber: 2, weight: null },
      { boxNumber: 3, weight: null },
      { boxNumber: 4, weight: null },
    ]);
    setShowResult(false);
  };

  const handleWeightChange = (index: number, value: string) => {
    const numValue = parseFloat(value);
    setWeights(prev => prev.map((w, i) => 
      i === index ? { ...w, weight: isNaN(numValue) ? null : numValue } : w
    ));
  };

  // Функции калькулятора
  const openCalculator = (index: number) => {
    setCurrentBoxIndex(index);
    setCalculatorValue(weights[index].weight?.toString() || '');
    setCalculatorOpen(true);
  };

  const handleCalculatorInput = (value: string) => {
    if (value === 'backspace') {
      setCalculatorValue(prev => prev.slice(0, -1));
    } else if (value === '.') {
      if (!calculatorValue.includes('.')) {
        setCalculatorValue(prev => prev + '.');
      }
    } else {
      // Ограничение: максимум 4 цифры до точки и 1 после
      const parts = calculatorValue.split('.');
      if (parts[0].length < 4 || (parts.length === 2 && parts[1].length < 1)) {
        setCalculatorValue(prev => prev + value);
      }
    }
  };

  const confirmCalculator = () => {
    if (currentBoxIndex !== null && calculatorValue) {
      handleWeightChange(currentBoxIndex, calculatorValue);
    }
    setCalculatorOpen(false);
    setCalculatorValue('');
    setCurrentBoxIndex(null);
  };

  const cancelCalculator = () => {
    setCalculatorOpen(false);
    setCalculatorValue('');
    setCurrentBoxIndex(null);
  };

  const calculateResult = () => {
    if (!selectedChamber) return null;

    const config = getWoodConfig(selectedChamber.woodType, woodConfigs);
    const weightLimit = config?.weightLimit || 12.0;
    const warmupTime = config?.warmupTime || 2;
    const dryingRateTime = config?.dryingRateTime || 4;
    
    const validWeights = weights.filter(w => w.weight !== null && w.weight > 0);
    
    if (validWeights.length < 3) {
      return { approved: false, message: t('error') };
    }

    // Проверяем сколько ящиков в норме
    const boxesInLimit = validWeights.filter(w => w.weight! <= weightLimit).length;
    const approved = boxesInLimit >= 3;

    if (!approved) {
      // Рассчитываем среднее превышение
      const overweights = validWeights
        .filter(w => w.weight! > weightLimit)
        .map(w => w.weight! - weightLimit);
      const avgOverweight = overweights.reduce((a, b) => a + b, 0) / overweights.length;
      
      // НОВАЯ ФОРМУЛА: Время разогрева + (превышение / 0.3) * время_сушки_0.3т
      const dryingHours = (avgOverweight / 0.3) * dryingRateTime;
      const totalHours = Math.ceil(warmupTime + dryingHours);
      
      const currentTime = new Date();
      const endTime = new Date(currentTime.getTime() + totalHours * 60 * 60 * 1000);

      return {
        approved: false,
        avgOverweight: avgOverweight.toFixed(2),
        warmupTime,
        dryingHours: Math.ceil(dryingHours),
        hoursNeeded: totalHours,
        currentTime: format(currentTime, 'HH:mm'),
        endTime: format(endTime, 'HH:mm')
      };
    }

    return { approved: true };
  };

  const handleShowResult = () => {
    setShowResult(true);
  };

  const handleConfirm = async () => {
    // Защита от двойного клика
    if (isSubmitting) return;
    
    const result = calculateResult();
    if (!result || !selectedChamber) return;

    setIsSubmitting(true);
    
    try {
      // Получаем текущий цикл с полными данными
      const cycleResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c5bcdb1f/cycles/${selectedChamber.id}`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` }
        }
      );
      const currentCycle = await cycleResponse.json();
      
      // Вычисляем временные метки
      const now = new Date();
      const startDate = new Date(currentCycle.startDate || currentCycle.createdAt);
      const hoursFromStart = Math.round((now.getTime() - startDate.getTime()) / (1000 * 60 * 60));
      
      // Получаем предыдущую историю взвешиваний
      const previousHistory = currentCycle.weighingHistory || [];
      const lastWeighing = previousHistory[previousHistory.length - 1];
      
      // Вычисляем часы с последней проверки
      let hoursSinceLastCheck: number | undefined;
      if (lastWeighing) {
        const lastCheckDate = new Date(lastWeighing.timestamp);
        hoursSinceLastCheck = Math.round((now.getTime() - lastCheckDate.getTime()) / (1000 * 60 * 60));
      }
      
      // Подготавливаем массив весов
      const weightsArray = weights
        .filter(w => w.weight !== null && w.weight > 0)
        .map(w => w.weight!);
      
      const totalWeight = weightsArray.reduce((sum, w) => sum + w, 0);
      
      // Сохраняем структурированные данные для рекомендации
      const recommendationData = result.approved 
        ? { type: 'approved' as const }
        : { 
            type: 'continue' as const, 
            hoursNeeded: result.hoursNeeded, 
            endTime: result.endTime 
          };
      
      // Получаем текущий weightLimit из конфига
      const config = getWoodConfig(selectedChamber.woodType, woodConfigs);
      const weightLimit = config?.weightLimit || 12.0;
      
      // Создаем новую запись взвешивания
      const newWeighingRecord = {
        timestamp: now.toISOString(),
        hoursFromStart,
        hoursSinceLastCheck,
        weights: weightsArray,
        totalWeight: parseFloat(totalWeight.toFixed(2)),
        recommendationData, // Сохраняем структурированные данные
        driverName: 'Водитель', // Можно добавить имя водителя из контекста
        weightLimit: weightLimit // Сохраняем целевой вес для этого взвешивания
      };
      
      // Обновляем историю
      const updatedHistory = [...previousHistory, newWeighingRecord];

      // 1. Обновляем цикл (FIX ID!)
// 1. Обновляем цикл
await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-c5bcdb1f/cycles/${selectedChamber.id}`,
  {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publicAnonKey}`
    },
    body: JSON.stringify({
      weighingResult: {
        approved: result.approved,
        weights: weights.map(w => ({ box: w.boxNumber, weight: w.weight })),
        timestamp: now.toISOString(),
        ...result
      }
    })
  }
);

// 2. Telegram
await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-c5bcdb1f/send-telegram-weighing`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publicAnonKey}`
    },
    body: JSON.stringify({
      cycleId: selectedChamber.id, // ✅ ВОТ ТУТ ФИКС
      weighingRecord: {
        weights: weights.map(w => w.weight),
        timestamp: now.toISOString(),
        hoursFromStart: result.hoursFromStart,
        weightLimit: result.weightLimit,
        recommendation: result.recommendation,
        recommendationData: result.recommendationData
      }
    })
  }
);
      console.log('🔥 selectedChamber:', selectedChamber);
console.log('🔥 sending cycleId:', selectedChamber.id);

      // ✅ Отправляем в Telegram (если настроен)
      try {
        await api.sendWeighingToTelegram(selectedChamber.id, newWeighingRecord);
        console.log('[Telegram] Сообщение отправлено');
      } catch (telegramError: any) {
        console.log('[Telegram] Ошибка отправки (возможно не настроен):', telegramError.message);
        // Не показываем ошибку пользователю, так как это не критично
      }

      toast.success(t('saved'));
      setSelectedChamber(null);
      fetchActiveChambers();
    } catch (error) {
      console.error('Error saving result:', error);
      toast.error(t('error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartHold = () => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 6;
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        logout();
      }
    }, 100); // 5 секунд (100 * 50ms)
    setHoldTimer(interval);
  };

  const handleEndHold = () => {
    if (holdTimer) {
      clearInterval(holdTimer);
      setHoldTimer(null);
    }
    setHoldProgress(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">{t('loading')}</div>
      </div>
    );
  }

  // Экран взвешивания
  if (selectedChamber) {
    const result = showResult ? calculateResult() : null;
    const weightLimit = getWoodConfig(selectedChamber.woodType, woodConfigs)?.weightLimit || 12.0;

    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 sticky top-0 z-10 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => setSelectedChamber(null)}
              className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">
                {t('chamber')} {selectedChamber.chamberNumber}
              </h1>
              <div className="text-sm opacity-90">
                #{selectedChamber.sequentialNumber} • {selectedChamber.woodType}
              </div>
            </div>
          </div>
          <div className="text-sm bg-blue-700/50 rounded-lg px-3 py-2">
            {t('weightLimit')}: <span className="font-bold">{weightLimit} т</span>
          </div>
        </div>

        {/* Результат */}
        {showResult && result && (
          <div className={`m-4 rounded-2xl p-6 text-center ${result.approved ? 'bg-green-500' : 'bg-red-500'} text-white shadow-2xl`}>
            <div className="mb-4">
              {result.approved ? (
                <Check className="w-24 h-24 mx-auto stroke-[3]" />
              ) : (
                <X className="w-24 h-24 mx-auto stroke-[3]" />
              )}
            </div>
            <h2 className="text-3xl font-black mb-4">
              {result.approved ? t('approvedForShipment') : t('overweight')}
            </h2>
            
            {!result.approved && (
              <div className="bg-white/20 rounded-xl p-4 space-y-2 text-lg">
                <div className="flex justify-between">
                  <span>{t('avgOverweight')}:</span>
                  <span className="font-bold">{result.avgOverweight} т</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('additionalDrying')}:</span>
                  <span className="font-bold">{result.hoursNeeded} {t('hoursShort')}</span>
                </div>
                <div className="border-t border-white/30 pt-2 mt-2">
                  <div className="flex items-center justify-center gap-2 text-xl">
                    <Clock className="w-6 h-6" />
                    <span>{result.currentTime}</span>
                    <span>→</span>
                    <span className="font-black">{result.endTime}</span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="mt-6 w-full bg-white text-gray-900 font-bold text-xl py-4 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>{t('loading')}</span>
                </>
              ) : (
                t('confirmResult')
              )}
            </button>
          </div>
        )}

        {/* Сетка ящиков с кнопками + */}
        {!showResult && (
          <div className="p-4 max-w-xl mx-auto">
            {/* Сетка 2x2 - меньше на больших экранах */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
              {weights.map((weight, index) => (
                <button
                  key={index}
                  onClick={() => openCalculator(index)}
                  className={`
                    aspect-square rounded-2xl border-4 flex flex-col items-center justify-center gap-2 sm:gap-3 transition-all shadow-lg
                    ${weight.weight 
                      ? weight.weight <= weightLimit
                        ? 'bg-green-50 border-green-500 hover:bg-green-100 active:scale-95'
                        : 'bg-red-50 border-red-500 hover:bg-red-100 active:scale-95'
                      : 'bg-white border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 active:scale-95'
                    }
                  `}
                >
                  {weight.weight ? (
                    <>
                      <div className={`text-3xl sm:text-4xl font-black ${weight.weight <= weightLimit ? 'text-green-600' : 'text-red-600'}`}>
                        {weight.weight}т
                      </div>
                      {weight.weight > weightLimit && (
                        <div className="text-xs font-bold text-red-700">
                          +{(weight.weight - weightLimit).toFixed(1)}т
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-5xl sm:text-6xl text-gray-400 font-light">+</div>
                  )}
                </button>
              ))}
            </div>

            {/* Кнопка расчета */}
            <button
              onClick={handleShowResult}
              disabled={weights.filter(w => w.weight !== null && w.weight > 0).length < 3}
              className="w-full bg-blue-600 text-white font-bold text-2xl py-6 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-all shadow-lg active:scale-98"
            >
              {t('calculate')} ({weights.filter(w => w.weight !== null && w.weight > 0).length}/4)
            </button>
          </div>
        )}

        {/* Модальное окно калькулятора */}
        {calculatorOpen && currentBoxIndex !== null && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Header */}
              <div className="bg-blue-600 text-white p-6 text-center">
                <h3 className="text-xl font-bold">Ящик {weights[currentBoxIndex].boxNumber}</h3>
                <p className="text-sm opacity-90 mt-1">Введите вес в тоннах</p>
              </div>

              {/* Дисплей */}
              <div className="p-6 bg-gray-50">
                <div className="bg-white border-4 border-blue-200 rounded-2xl p-6 text-center">
                  <div className="text-5xl font-black text-gray-900 min-h-[60px] flex items-center justify-center">
                    {calculatorValue || '0'}<span className="text-3xl ml-1">т</span>
                  </div>
                </div>
              </div>

              {/* Цифровые кнопки */}
              <div className="p-6 pt-0">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(num => (
                    <button
                      key={num}
                      onClick={() => handleCalculatorInput(num)}
                      className="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-3xl font-bold text-gray-900 rounded-2xl py-6 transition-colors shadow"
                    >
                      {num}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleCalculatorInput('.')}
                    className="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-3xl font-bold text-gray-900 rounded-2xl py-6 transition-colors shadow"
                  >
                    .
                  </button>
                  <button
                    onClick={() => handleCalculatorInput('0')}
                    className="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-3xl font-bold text-gray-900 rounded-2xl py-6 transition-colors shadow"
                  >
                    0
                  </button>
                  <button
                    onClick={() => handleCalculatorInput('backspace')}
                    className="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-2xl font-bold text-gray-900 rounded-2xl py-6 transition-colors shadow"
                  >
                    ⌫
                  </button>
                </div>
              </div>

              {/* Кнопки действий */}
              <div className="p-6 pt-0 grid grid-cols-2 gap-3">
                <button
                  onClick={cancelCalculator}
                  className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-bold text-xl py-5 rounded-2xl transition-colors shadow-lg flex items-center justify-center gap-2"
                >
                  <X className="w-10 h-10" />
                </button>
                <button
                  onClick={confirmCalculator}
                  disabled={!calculatorValue}
                  className="bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-xl py-5 rounded-2xl transition-colors shadow-lg flex items-center justify-center gap-2"
                >
                  <Check className="w-10 h-10" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Основой экран - сетка камер (все 21 камера)
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="px-4 py-4">
          <div 
            className="flex justify-between items-center mb-3 relative"
            onTouchStart={handleStartHold}
            onTouchEnd={handleEndHold}
            onMouseDown={handleStartHold}
            onMouseUp={handleEndHold}
            onMouseLeave={handleEndHold}
          >
            <h1 className="text-2xl font-black text-gray-900">{t('driverTitle')}</h1>
            
            {/* Индикатор прогресса для выхода */}
            {holdProgress > 0 && (
              <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all duration-100"
                  style={{ width: `${holdProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="w-10 h-10 text-gray-400 animate-spin" />
        </div>
      ) : (
        <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {chambers.map(chamberNum => {
            const completedCycle = cycles.find(c => c.chamberNumber === chamberNum);
            
            return (
              <button
                key={chamberNum}
                onClick={() => completedCycle && handleChamberSelect(completedCycle)}
                disabled={!completedCycle}
                className={`
                  relative flex flex-col items-center justify-between p-5 sm:p-6 rounded-2xl border-2 transition-all min-h-[200px]
                  ${completedCycle 
                    ? 'bg-white border-gray-300 shadow-sm hover:border-gray-400 hover:shadow-lg active:scale-[0.98] active:shadow-xl cursor-pointer' 
                    : 'bg-gray-50 border-dashed border-gray-300 text-gray-400 cursor-not-allowed'}
                `}
              >
                {completedCycle ? (
                  <div className="text-center w-full flex flex-col items-center gap-3">
                    {/* Large Chamber Number */}
                    <div className="text-5xl sm:text-4xl font-black text-gray-900">
                      {chamberNum}
                    </div>
                    
                    {/* Sequential Number */}
                    {completedCycle.sequentialNumber && (
                      <div className="text-base sm:text-sm font-bold text-gray-700">
                        #{completedCycle.sequentialNumber}
                      </div>
                    )}
                    
                    {/* Wood Type Badge */}
                    <span className="px-3 py-1.5 sm:px-3 sm:py-1 rounded-lg text-sm sm:text-xs font-bold border uppercase tracking-wide bg-slate-100 text-slate-800 border-slate-300">
                      {completedCycle.woodType}
                    </span>
                    
                    {/* Weight Limit Info */}
                    <div className="text-sm sm:text-xs text-blue-600 font-bold">
                      {getWoodConfig(completedCycle.woodType, woodConfigs)?.weightLimit || 12.0} т
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    {/* Large Chamber Number for inactive */}
                    <div className="text-6xl sm:text-5xl font-black text-gray-300 mb-2">
                      {chamberNum}
                    </div>
                    <div className="text-sm sm:text-xs text-gray-400 font-medium">
                      {lang === 'ru' ? 'Не готова' : 'Neparuošta'}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Подсказка о скрытой кнопке */}
      <div className="fixed bottom-4 left-4 right-4 bg-blue-900/90 text-white text-xs p-3 rounded-lg text-center">
        💡 {lang === 'ru' ? 'Удерживайте ЗАГОЛОВОК 2 секунды для выхода' : 'Palaikykite antraštę 2 sekundes išėjimui'}
      </div>
    </div>
  );
}
