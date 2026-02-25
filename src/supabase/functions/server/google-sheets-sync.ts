// Google Sheets Synchronization Module
// Обрабатывает события завершения циклов из Google Sheets

import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import { normalizeWoodType, convertLithuanianToEnglish } from "./wood-type-mapping.ts";
import { format } from "npm:date-fns";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Интерфейс строки из Google Sheets
export interface GoogleSheetRow {
  rowNumber: number;                // Номер строки в таблице (для логирования)
  chamberNumber: number;            // Номер камеры (1-21) - ОДИН И ТОТ ЖЕ для старого и нового
  woodTypeLithuanian: string;       // Литовское название породы для НОВОГО цикла (конвертируется в английский)
  oldSequentialNumber: string;      // Порядковый номер СТАРОГО цикла (например: "9954")
  oldCycleEndDate: string;          // Дата окончания СТАРОГО цикла
  newSequentialNumber: string;      // Порядковый номер НОВОГО цикла (например: "9955")
  newCycleStartDate: string;        // Дата начала НОВОГО цикла
}

// Структура для логирования
interface SyncLog {
  timestamp: string;
  action: 'complete_old' | 'create_new' | 'error';
  rowNumber: number;
  chamberNumber: number;
  sequentialNumber: string;
  success: boolean;
  message: string;
  details?: any;
}

/**
 * Главная функция обработки новой строки из Google Sheets
 * Выполняет две операции:
 * 1. Завершает старый цикл
 * 2. Создаёт новый цикл (с задержкой)
 */
export async function processSheetRow(row: GoogleSheetRow): Promise<void> {
  const logs: SyncLog[] = [];
  
  console.log(`[GoogleSheets] Обработка строки ${row.rowNumber}`);
  console.log(`[GoogleSheets] Камера: ${row.chamberNumber}, Цикл: ${row.oldSequentialNumber}`);
  
  try {
    // Шаг 1: Завершаем старый цикл
    const completeResult = await completeOldCycle(row);
    logs.push(completeResult);
    
    if (!completeResult.success) {
      throw new Error(`Не удалось завершить старый цикл: ${completeResult.message}`);
    }
    
    console.log(`[GoogleSheets] Старый цикл ${row.oldSequentialNumber} успешно завершён`);
    
    // ⚠️ ЗАДЕРЖКА УБРАНА: Deno Edge Functions могут прерывать setTimeout после возврата HTTP-ответа
    // Оператор должен подождать 2-3 минуты перед началом новой сушки (рабочий процесс)
    console.log(`[GoogleSheets] Создание нового цикла ${row.newSequentialNumber}...`);
    
    // Шаг 2: Создаём новый цикл сразу
    const createResult = await createNewCycle(row.chamberNumber, row.newSequentialNumber, row.woodTypeLithuanian, row.newCycleStartDate);
    logs.push(createResult);
    
    if (!createResult.success) {
      throw new Error(`Не удалось создать новый цикл: ${createResult.message}`);
    }
    
    console.log(`[GoogleSheets] Новый цикл ${row.newSequentialNumber} успешно создан`);
    
    // Сохраняем логи успешной операции
    await saveSyncLogs(logs);
    
  } catch (error: any) {
    console.error(`[GoogleSheets] Ошибка обработки строки ${row.rowNumber}:`, error);
    
    logs.push({
      timestamp: new Date().toISOString(),
      action: 'error',
      rowNumber: row.rowNumber,
      chamberNumber: row.chamberNumber,
      sequentialNumber: row.oldSequentialNumber,
      success: false,
      message: error.message,
      details: error.stack,
    });
    
    await saveSyncLogs(logs);
    throw error;
  }
}

/**
 * Получает погодную аналитику для завершённого цикла
 * Вычисляет min, max, avg, avgDay, avgNight температуры
 */
async function fetchWeatherStats(startDateIso: string, endDateIso: string): Promise<{
  avgTemp?: number;
  minTemp?: number;
  maxTemp?: number;
  avgDayTemp?: number;
  avgNightTemp?: number;
}> {
  try {
    const startDate = new Date(startDateIso);
    const endDate = new Date(endDateIso);
    
    // Anykščiai coordinates
    const lat = 55.5264;
    const lon = 25.1027;
    
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${endStr}&hourly=temperature_2m,weather_code&timezone=Europe%2FVilnius`;
    
    console.log(`[Weather] Запрос аналитики погоды ${startStr} → ${endStr}...`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.hourly && data.hourly.temperature_2m && data.hourly.time) {
      const temps = data.hourly.temperature_2m;
      const times = data.hourly.time;
      
      let validTemps: number[] = [];
      let dayTemps: number[] = [];
      let nightTemps: number[] = [];
      
      for (let i = 0; i < times.length; i++) {
        const time = new Date(times[i]);
        if (time >= startDate && time <= endDate) {
          const temp = temps[i];
          if (temp !== null && temp !== undefined) {
            validTemps.push(temp);
            const h = time.getHours();
            if (h >= 6 && h < 22) {
              dayTemps.push(temp);
            } else {
              nightTemps.push(temp);
            }
          }
        }
      }
      
      if (validTemps.length > 0) {
        const avg = validTemps.reduce((a,b) => a+b, 0) / validTemps.length;
        const min = Math.min(...validTemps);
        const max = Math.max(...validTemps);
        const avgDay = dayTemps.length ? dayTemps.reduce((a,b) => a+b, 0) / dayTemps.length : undefined;
        const avgNight = nightTemps.length ? nightTemps.reduce((a,b) => a+b, 0) / nightTemps.length : undefined;
        
        console.log(`[Weather] ✅ Аналитика: avg=${avg.toFixed(1)}°C, min=${min}°C, max=${max}°C`);
        
        return {
          avgTemp: parseFloat(avg.toFixed(1)),
          minTemp: min,
          maxTemp: max,
          avgDayTemp: avgDay !== undefined ? parseFloat(avgDay.toFixed(1)) : undefined,
          avgNightTemp: avgNight !== undefined ? parseFloat(avgNight.toFixed(1)) : undefined,
        };
      }
    }
    
    console.warn(`[Weather] ⚠️ Не удалось получить аналитику погоды для ${startStr} → ${endStr}`);
    return {};
    
  } catch (error: any) {
    console.error(`[Weather] ❌ Ошибка получения аналитики погоды:`, error);
    return {};
  }
}

/**
 * Получает данные о погоде для начальной даты цикла (только startTemperature и startWeatherCode)
 * Аналогично функции fetchWeatherStats в CycleForm.tsx
 */
async function fetchStartWeather(startDateIso: string): Promise<{
  startTemperature?: number;
  startWeatherCode?: number;
}> {
  try {
    const startDate = new Date(startDateIso);
    // Anykščiai coordinates
    const lat = 55.5264;
    const lon = 25.1027;
    
    const startStr = format(startDate, 'yyyy-MM-dd');
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${startStr}&hourly=temperature_2m,weather_code&timezone=Europe%2FVilnius`;
    
    console.log(`[Weather] Запрос погоды для старта ${startStr}...`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.hourly && data.hourly.temperature_2m && data.hourly.time) {
      const temps = data.hourly.temperature_2m;
      const times = data.hourly.time;
      const codes = data.hourly.weather_code;
      
      // Находим ближайший час к дате начала
      const startHourIndex = times.findIndex((t: string) => {
        const time = new Date(t);
        const targetTime = new Date(startDate);
        targetTime.setMinutes(0, 0, 0);
        return time.getTime() >= targetTime.getTime();
      });
      
      if (startHourIndex !== -1 && temps[startHourIndex] !== undefined) {
        const startTemp = temps[startHourIndex];
        const startCode = codes[startHourIndex];
        console.log(`[Weather] ✅ Температура на старте: ${startTemp}°C, код: ${startCode}`);
        return {
          startTemperature: startTemp,
          startWeatherCode: startCode,
        };
      }
    }
    
    console.warn(`[Weather] ⚠️ Не удалось получить данные о погоде для ${startStr}`);
    return {};
    
  } catch (error: any) {
    console.error(`[Weather] ❌ Ошибка получения погоды:`, error);
    return {};
  }
}

/**
 * Завершает старый цикл по sequentialNumber
 * НОВАЯ ЛОГИКА:
 * - Если цикл уже завершён (status: Completed) → ОБНОВЛЯЕМ дату окончания и погодные данные
 * - Если цикл ещё в процессе → завершаем как обычно
 * Это позволяет корректировать данные через Google Sheets
 */
async function completeOldCycle(row: GoogleSheetRow): Promise<SyncLog> {
  const log: SyncLog = {
    timestamp: new Date().toISOString(),
    action: 'complete_old',
    rowNumber: row.rowNumber,
    chamberNumber: row.chamberNumber,
    sequentialNumber: row.oldSequentialNumber,
    success: false,
    message: '',
  };
  
  try {
    // Ищем цикл по sequentialNumber
    const cycles = await kv.getByPrefix("cycle_");
    const oldCycle = cycles.find((c: any) => 
      c.sequentialNumber === row.oldSequentialNumber &&
      c.chamberNumber === row.chamberNumber
    );
    
    if (!oldCycle) {
      log.message = `Цикл с номером ${row.oldSequentialNumber} для камеры ${row.chamberNumber} не найден`;
      log.details = { searchedNumber: row.oldSequentialNumber, chamberNumber: row.chamberNumber };
      console.warn(`[GoogleSheets] ${log.message}`);
      return log;
    }
    
    console.log(`[GoogleSheets] Найден цикл ${oldCycle.id} (статус: ${oldCycle.status})`);
    
    // ⚠️ КРИТИЧЕСКИ ВАЖНО: Обновляем ТОЛЬКО поля завершения
    // Используем spread operator чтобы сохранить ВСЕ существующие поля
    const updatedCycle = {
      ...oldCycle,  // Копируем ВСЕ существующие поля
      status: 'Completed',  // Меняем только статус
      endDate: row.oldCycleEndDate,  // И дату окончания
    };
    
    // Вычисляем погодную аналитику если есть startDate и endDate
    if (oldCycle.startDate && row.oldCycleEndDate) {
      const weatherStats = await fetchWeatherStats(oldCycle.startDate, row.oldCycleEndDate);
      if (weatherStats.avgTemp !== undefined) {
        updatedCycle.avgTemp = weatherStats.avgTemp;
      }
      if (weatherStats.minTemp !== undefined) {
        updatedCycle.minTemp = weatherStats.minTemp;
      }
      if (weatherStats.maxTemp !== undefined) {
        updatedCycle.maxTemp = weatherStats.maxTemp;
      }
      if (weatherStats.avgDayTemp !== undefined) {
        updatedCycle.avgDayTemp = weatherStats.avgDayTemp;
      }
      if (weatherStats.avgNightTemp !== undefined) {
        updatedCycle.avgNightTemp = weatherStats.avgNightTemp;
      }
    }
    
    await kv.set(`cycle_${oldCycle.id}`, updatedCycle);
    
    const wasCompleted = oldCycle.status === 'Completed';
    log.success = true;
    log.message = wasCompleted 
      ? `Цикл ${row.oldSequentialNumber} ОБНОВЛЁН (уже был завершён). Новая дата окончания: ${row.oldCycleEndDate}` 
      : `Цикл ${row.oldSequentialNumber} завершён. Статус: Completed, Дата окончания: ${row.oldCycleEndDate}`;
    log.details = {
      cycleId: oldCycle.id,
      oldStatus: oldCycle.status,
      newStatus: 'Completed',
      endDate: row.oldCycleEndDate,
      wasAlreadyCompleted: wasCompleted,
    };
    
    console.log(`[GoogleSheets] ✅ ${log.message}`);
    
  } catch (error: any) {
    log.message = `Ошибка при завершении цикла: ${error.message}`;
    log.details = { error: error.stack };
    console.error(`[GoogleSheets] ❌ ${log.message}`, error);
  }
  
  return log;
}

/**
 * Создаёт новый цикл с данными из Google Sheets
 * НОВАЯ ЛОГИКА:
 * - Если цикл с таким sequentialNumber уже существует → ОБНОВЛЯЕМ его данные
 * - Если цикла нет → создаём новый
 * Это позволяет корректировать породу, дату старта и погоду через Google Sheets
 */
async function createNewCycle(chamberNumber: number, sequentialNumber: string, woodTypeLithuanian: string, startDate: string): Promise<SyncLog> {
  const log: SyncLog = {
    timestamp: new Date().toISOString(),
    action: 'create_new',
    rowNumber: 0,  // Не используется в этом контексте
    chamberNumber: chamberNumber,
    sequentialNumber: sequentialNumber,
    success: false,
    message: '',
  };
  
  try {
    console.log(`[GoogleSheets] 🔄 Начало создания/обновления цикла...`);
    console.log(`[GoogleSheets] Параметры: chamber=${chamberNumber}, seq=${sequentialNumber}, wood=${woodTypeLithuanian}, start=${startDate}`);
    
    // Конвертируем литовское название в английский формат
    const woodTypeEnglish = normalizeWoodType(woodTypeLithuanian);
    console.log(`[GoogleSheets] normalizeWoodType результат: ${woodTypeEnglish}`);
    
    if (!woodTypeEnglish) {
      log.message = `Не удалось конвертировать породу "${woodTypeLithuanian}" в английский формат`;
      log.details = { 
        lithuanianName: woodTypeLithuanian,
        attemptedConversion: convertLithuanianToEnglish(woodTypeLithuanian)
      };
      console.warn(`[GoogleSheets] ${log.message}`);
      return log;
    }
    
    console.log(`[GoogleSheets] ✅ Конвертация породы: ${woodTypeLithuanian} → ${woodTypeEnglish}`);
    
    // Проверяем, существует ли уже цикл с таким sequentialNumber
    const cycles = await kv.getByPrefix("cycle_");
    const existingCycle = cycles.find((c: any) => 
      c.sequentialNumber === sequentialNumber &&
      c.chamberNumber === chamberNumber
    );
    
    // Получаем данные о погоде
    const weatherData = await fetchStartWeather(startDate);
    
    if (existingCycle) {
      // ОБНОВЛЯЕМ существующий цикл
      console.log(`[GoogleSheets] Цикл ${sequentialNumber} уже существует (${existingCycle.id}), обновляем...`);
      
      const updatedCycle = {
        ...existingCycle,  // Сохраняем все существующие поля
        woodType: woodTypeEnglish,  // Обновляем породу
        startDate: startDate,  // Обновляем дату начала
      };
      
      // Обновляем погоду если удалось получить
      if (weatherData.startTemperature !== undefined) {
        updatedCycle.startTemperature = weatherData.startTemperature;
      }
      if (weatherData.startWeatherCode !== undefined) {
        updatedCycle.startWeatherCode = weatherData.startWeatherCode;
      }
      
      await kv.set(`cycle_${existingCycle.id}`, updatedCycle);
      
      log.success = true;
      log.message = `Цикл ${sequentialNumber} ОБНОВЛЁН. Порода: ${woodTypeEnglish}, Дата: ${startDate}`;
      log.details = {
        cycleId: existingCycle.id,
        chamberNumber: chamberNumber,
        sequentialNumber: sequentialNumber,
        woodType: woodTypeEnglish,
        woodTypeLithuanian: woodTypeLithuanian,
        startDate: startDate,
        wasUpdate: true,
      };
      
      console.log(`[GoogleSheets] ✅ ${log.message}`);
      
    } else {
      // СОЗДАЁМ новый цикл
      console.log(`[GoogleSheets] Цикл ${sequentialNumber} не найден, создаём новый...`);
      
      const newId = crypto.randomUUID();
      
      const newCycle: any = {
        id: newId,
        chamberNumber: chamberNumber,
        sequentialNumber: sequentialNumber,
        woodType: woodTypeEnglish,  // Порода из таблицы (конвертированная)
        status: 'In Progress',
        createdAt: startDate,  // Дата из таблицы
        startDate: startDate,  // Дата из таблицы
      };
      
      // Добавляем погоду если удалось получить
      if (weatherData.startTemperature !== undefined) {
        newCycle.startTemperature = weatherData.startTemperature;
      }
      if (weatherData.startWeatherCode !== undefined) {
        newCycle.startWeatherCode = weatherData.startWeatherCode;
      }
      
      // Сохраняем новый цикл
      await kv.set(`cycle_${newId}`, newCycle);
      
      log.success = true;
      log.message = `Новый цикл ${sequentialNumber} создан для камеры ${chamberNumber} с породой ${woodTypeEnglish}`;
      log.details = {
        cycleId: newId,
        chamberNumber: chamberNumber,
        sequentialNumber: sequentialNumber,
        woodType: woodTypeEnglish,
        woodTypeLithuanian: woodTypeLithuanian,
        startDate: startDate,
        wasUpdate: false,
      };
      
      console.log(`[GoogleSheets] ✅ ${log.message}`);
    }
    
  } catch (error: any) {
    log.message = `Ошибка при создании нового цикла: ${error.message}`;
    log.details = { error: error.stack };
    console.error(`[GoogleSheets] ❌ ${log.message}`, error);
  }
  
  return log;
}

/**
 * Сохраняет логи синхронизации в KV store
 */
async function saveSyncLogs(logs: SyncLog[]): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const logKey = `sync_log_${timestamp}`;
    
    await kv.set(logKey, {
      timestamp,
      logs,
      count: logs.length,
    });
    
    console.log(`[GoogleSheets] Логи сохранены: ${logKey}`);
  } catch (error) {
    console.error('[GoogleSheets] Ошибка сохранения логов:', error);
  }
}

/**
 * Получает последние логи синхронизации
 */
export async function getRecentSyncLogs(limit: number = 10): Promise<any[]> {
  try {
    const allLogs = await kv.getByPrefix("sync_log_");
    
    // Сортируем по времени (новые первые)
    const sorted = allLogs.sort((a: any, b: any) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    return sorted.slice(0, limit);
  } catch (error) {
    console.error('[GoogleSheets] Ошибка получения логов:', error);
    return [];
  }
}

/**
 * Проверяет, была ли строка уже обработана (по номеру строки)
 * Для предотвращения дублирования при повторных запусках
 */
export async function isRowProcessed(rowNumber: number): Promise<boolean> {
  try {
    const processed = await kv.get(`processed_row_${rowNumber}`);
    console.log(`[GoogleSheets] isRowProcessed(${rowNumber}): kv.get вернул:`, processed);
    // Проверяем и null и undefined
    return processed != null;  // Используем != вместо !== чтобы проверить оба случая
  } catch (error) {
    console.error('[GoogleSheets] Ошибка проверки обработанной строки:', error);
    return false;
  }
}

/**
 * Помечает строку как обработанную
 */
export async function markRowAsProcessed(rowNumber: number, details: any): Promise<void> {
  try {
    await kv.set(`processed_row_${rowNumber}`, {
      processedAt: new Date().toISOString(),
      details,
    });
    console.log(`[GoogleSheets] Строка ${rowNumber} помечена как обработанная`);
  } catch (error) {
    console.error('[GoogleSheets] Ошибка при пометке строки:', error);
  }
}