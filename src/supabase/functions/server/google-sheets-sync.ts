// Google Sheets Synchronization Module
// Обрабатывает события завершения циклов из Google Sheets

import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import { normalizeWoodType, convertLithuanianToEnglish } from "./wood-type-mapping.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Интерфейс строки из Google Sheets
export interface GoogleSheetRow {
  rowNumber: number;
  chamberNumber: number;
  oldSequentialNumber: string;  // 4-значный номер старого цикла
  newSequentialNumber: string;  // 4-значный номер нового цикла
  woodTypeLithuanian: string;   // Литовское название породы из колонки C
  oldCycleEndDate: string;      // Время завершения старого цикла
  newCycleStartDate: string;    // Время начала нового цикла
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
  console.log(`[GoogleSheets] Камера: ${row.chamberNumber}, Старый цикл: ${row.oldSequentialNumber}, Новый цикл: ${row.newSequentialNumber}`);
  
  try {
    // Шаг 1: Завершаем старый цикл
    const completeResult = await completeOldCycle(row);
    logs.push(completeResult);
    
    if (!completeResult.success) {
      throw new Error(`Не удалось завершить старый цикл: ${completeResult.message}`);
    }
    
    console.log(`[GoogleSheets] Старый цикл ${row.oldSequentialNumber} успешно завершён`);
    console.log(`[GoogleSheets] Ожидание 2-3 минуты перед созданием нового цикла...`);
    
    // Шаг 2: Задержка 2-3 минуты
    const delayMs = 2.5 * 60 * 1000; // 2.5 минуты
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    console.log(`[GoogleSheets] Создание нового цикла ${row.newSequentialNumber}...`);
    
    // Шаг 3: Создаём новый цикл
    const createResult = await createNewCycle(row);
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
 * Завершает старый цикл по sequentialNumber
 * Обновляет только status и endDate, не трогая фото, комментарии, рейтинг
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
    
    console.log(`[GoogleSheets] Найден цикл ${oldCycle.id} для завершения`);
    
    // ⚠️ КРИТИЧЕСКИ ВАЖНО: Обновляем ТОЛЬКО поля завершения
    // Используем spread operator чтобы сохранить ВСЕ существующие поля
    const updatedCycle = {
      ...oldCycle,  // Копируем ВСЕ существующие поля
      status: 'Completed',  // Меняем только статус
      endDate: row.oldCycleEndDate,  // И дату окончания
    };
    
    // НЕ трогаем (они останутся как были благодаря spread):
    // - id (остаётся прежним UUID)
    // - sequentialNumber (остаётся прежним)
    // - chamberNumber (остаётся прежним)
    // - woodType (остаётся прежним)
    // - startDate (остаётся прежним)
    // - createdAt (остаётся прежним)
    // - finalMoisture (остаётся как было)
    // - qualityRating (остаётся как было)
    // - recipePhotos (остаются как были)
    // - resultPhotos (остаются как были)
    // - overallComment (остаётся как был)
    // - recipePhotoPath (legacy, остаётся)
    // - recipePhotoUrl (legacy, остаётся)
    // - recipeCode (остаётся)
    // - customWoodType (остаётся)
    // - isBaseRecipe (остаётся)
    // - isTest (остаётся)
    // - startTemperature (остаётся)
    // - startWeatherCode (остаётся)
    // - avgTemp (остаётся)
    // - avgDayTemp (остаётся)
    // - avgNightTemp (остаётся)
    // - minTemp (остаётся)
    // - maxTemp (остаётся)
    // И любые другие поля, которые могут быть в старых карточках!
    
    await kv.set(`cycle_${oldCycle.id}`, updatedCycle);
    
    log.success = true;
    log.message = `Цикл ${row.oldSequentialNumber} завершён. Статус: Completed, Дата окончания: ${row.oldCycleEndDate}`;
    log.details = {
      cycleId: oldCycle.id,
      oldStatus: oldCycle.status,
      newStatus: 'Completed',
      endDate: row.oldCycleEndDate,
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
 * Создаёт новый цикл для той же камеры
 * Конвертирует литовское название породы в английский формат
 */
async function createNewCycle(row: GoogleSheetRow): Promise<SyncLog> {
  const log: SyncLog = {
    timestamp: new Date().toISOString(),
    action: 'create_new',
    rowNumber: row.rowNumber,
    chamberNumber: row.chamberNumber,
    sequentialNumber: row.newSequentialNumber,
    success: false,
    message: '',
  };
  
  try {
    // Конвертируем литовское название в английский формат
    const woodTypeEnglish = normalizeWoodType(row.woodTypeLithuanian);
    
    if (!woodTypeEnglish) {
      log.message = `Не удалось конвертировать породу "${row.woodTypeLithuanian}" в английский формат`;
      log.details = { 
        lithuanianName: row.woodTypeLithuanian,
        attemptedConversion: convertLithuanianToEnglish(row.woodTypeLithuanian)
      };
      console.warn(`[GoogleSheets] ${log.message}`);
      return log;
    }
    
    console.log(`[GoogleSheets] Конвертация породы: ${row.woodTypeLithuanian} → ${woodTypeEnglish}`);
    
    // Генерируем ID для нового цикла
    const newId = crypto.randomUUID();
    
    // Формируем код рецепта (можно настроить формат)
    const recipeCode = `${woodTypeEnglish}-${row.newSequentialNumber}`;
    
    // Создаём новую карточку с минимальными данными
    const newCycle = {
      id: newId,
      chamberNumber: row.chamberNumber,
      sequentialNumber: row.newSequentialNumber,
      recipeCode: recipeCode,
      woodType: woodTypeEnglish,
      customWoodType: '',
      recipePhotoPath: '',
      recipePhotoUrl: '',
      recipePhotos: [],
      finalMoisture: undefined,
      qualityRating: undefined,
      resultPhotos: [],
      overallComment: '',
      isBaseRecipe: false,
      status: 'In Progress',
      createdAt: row.newCycleStartDate,
      startDate: row.newCycleStartDate,
      endDate: undefined,
      isTest: false,
      startTemperature: undefined,
      startWeatherCode: undefined,
      avgTemp: undefined,
      avgDayTemp: undefined,
      avgNightTemp: undefined,
      minTemp: undefined,
      maxTemp: undefined,
    };
    
    // Сохраняем новый цикл
    await kv.set(`cycle_${newId}`, newCycle);
    
    log.success = true;
    log.message = `Новый цикл ${row.newSequentialNumber} создан для камеры ${row.chamberNumber}`;
    log.details = {
      cycleId: newId,
      chamberNumber: row.chamberNumber,
      sequentialNumber: row.newSequentialNumber,
      woodType: woodTypeEnglish,
      woodTypeLithuanian: row.woodTypeLithuanian,
      recipeCode: recipeCode,
      startDate: row.newCycleStartDate,
    };
    
    console.log(`[GoogleSheets] ✅ ${log.message}`);
    
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
    return processed !== null;
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