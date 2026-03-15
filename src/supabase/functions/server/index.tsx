import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { format, eachDayOfInterval, isBefore, startOfDay, subDays, addDays } from "npm:date-fns";
import * as kv from "./kv_store.tsx";
import { processSheetRow, getRecentSyncLogs, isRowProcessed, markRowAsProcessed, type GoogleSheetRow } from "./google-sheets-sync.ts";

const app = new Hono();

// Enable logger
app.use('*', logger((message) => console.log(message)));

// Enable CORS
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "x-client-info", "apikey"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "X-Kuma-Revision"],
    maxAge: 600,
  }),
);

// Supabase Client
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET_NAME = "make-c5bcdb1f-drying-chamber-photos";

// Helpers
async function ensureBucket() {
  try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
      if (!bucketExists) {
        await supabase.storage.createBucket(BUCKET_NAME, {
          public: false,
          fileSizeLimit: 10485760, // 10MB
        });
      }
  } catch (e) {
      console.error("Bucket check failed:", e);
  }
}

async function signCycleUrls(cycle: any) {
  const extractPathFromUrl = (url: string) => {
    try {
      if (!url) return null;
      const match = url.match(new RegExp(`/sign/${BUCKET_NAME}/([^?]+)`));
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  if (cycle.recipePhotoPath) {
    const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(cycle.recipePhotoPath, 3600 * 24);
    cycle.recipePhotoUrl = data?.signedUrl;
  }
  
  if (cycle.recipePhotos && Array.isArray(cycle.recipePhotos)) {
    for (const photo of cycle.recipePhotos) {
      if (!photo.path && photo.url && photo.url.includes(BUCKET_NAME)) {
        const recoveredPath = extractPathFromUrl(photo.url);
        if (recoveredPath) photo.path = recoveredPath;
      }
      if (photo.path) {
        const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(photo.path, 3600 * 24);
        photo.url = data?.signedUrl;
      }
    }
  }
  
  if (cycle.resultPhotos && Array.isArray(cycle.resultPhotos)) {
    for (const photo of cycle.resultPhotos) {
      if (!photo.path && photo.url && photo.url.includes(BUCKET_NAME)) {
        const recoveredPath = extractPathFromUrl(photo.url);
        if (recoveredPath) photo.path = recoveredPath;
      }
      if (photo.path) {
        const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(photo.path, 3600 * 24);
        photo.url = data?.signedUrl;
      }
    }
  }
  return cycle;
}

// API Routes
const routes = new Hono();

routes.get('/health', (c) => {
  return c.json({ status: "ok" });
});

// Alias for driver view compatibility
// NOTE: Этот endpoint сохраняет генерацию signed URLs для совместимости с DriverView
// Там обычно небольшое количество циклов (только завершенные для взвешивания), поэтому не критично
routes.get('/work-cycles', async (c) => {
  try {
    console.log('[WorkCycles] Запрос на получение рабочих циклов');
    
    const cycles = await kv.getByPrefix("cycle_");
    console.log(`[WorkCycles] Загружено ${cycles.length} циклов`);
    
    const signedCycles = await Promise.all(cycles.map(async (cycle: any) => {
      if (!cycle) return null;
      try {
        return await signCycleUrls(cycle);
      } catch (signError: any) {
        console.error(`[WorkCycles] Ошибка подписания URL для цикла ${cycle.id}:`, signError);
        return cycle;
      }
    }));
    
    const validCycles = signedCycles.filter(c => c !== null);
    validCycles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return c.json(validCycles);
  } catch (error: any) {
    console.error("[WorkCycles] Ошибка получения циклов:", error);
    return c.json([]);
  }
});

routes.get('/cycles', async (c) => {
  try {
    console.log('[Cycles] Запрос на получение циклов (без фотографий)');
    
    const cycles = await kv.getByPrefix("cycle_");
    console.log(`[Cycles] Загружено ${cycles.length} циклов`);
    
    // Поддержка фильтрации по sequentialNumber для Google Sheets синхронизации
    const sequentialNumber = c.req.query('sequentialNumber');
    let filteredCycles = cycles;
    
    if (sequentialNumber) {
      filteredCycles = cycles.filter((cycle: any) => 
        cycle && cycle.sequentialNumber === sequentialNumber
      );
      console.log(`[Cycles] Отфильтровано по sequentialNumber ${sequentialNumber}: ${filteredCycles.length} циклов`);
    }
    
    // ✅ ОПТИМИЗАЦИЯ: Не генерируем signed URLs для списка циклов
    // Фотографии будут загружаться только при открытии конкретного цикла через GET /cycles/:id
    const validCycles = filteredCycles.filter(c => c !== null);
    validCycles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`[Cycles] Возвращаем ${validCycles.length} циклов БЕЗ signed URLs`);
    return c.json(validCycles);
  } catch (error: any) {
    console.error("[Cycles] Критическая ошибка получения циклов:", error);
    console.error("[Cycles] Stack trace:", error.stack);
    
    // Возвращаем пустой массив вместо ошибки 500
    return c.json([]);
  }
});

// ✅ НОВЫЙ ENDPOINT: Получение одного цикла с фотографиями
routes.get('/cycles/:id', async (c) => {
  try {
    const id = c.req.param("id");
    console.log(`[Cycle] Запрос на получение цикла ${id} с фотографиями`);
    
    const cycle = await kv.get(`cycle_${id}`);
    if (!cycle) {
      console.log(`[Cycle] Цикл ${id} не найден`);
      return c.json({ error: "Cycle not found" }, 404);
    }
    
    // Генерируем signed URLs только для этого одного цикла
    const signedCycle = await signCycleUrls(cycle);
    console.log(`[Cycle] Цикл ${id} возвращен с signed URLs`);
    
    return c.json(signedCycle);
  } catch (error: any) {
    console.error(`[Cycle] Ошибка получения цикла:`, error);
    return c.json({ error: error.message }, 500);
  }
});

// ✅ НОВЫЙ ENDPOINT: Удаление истории взвешиваний
routes.delete('/cycles/:id/weighing-history', async (c) => {
  try {
    const id = c.req.param("id");
    console.log(`[Cycle] Запрос на удаление истории взвешиваний для цикла ${id}`);
    
    const cycle = await kv.get(`cycle_${id}`);
    if (!cycle) {
      console.log(`[Cycle] Цикл ${id} не найден`);
      return c.json({ error: "Cycle not found" }, 404);
    }
    
    // Удаляем историю взвешиваний
    const updatedCycle = {
      ...cycle,
      weighingHistory: []
    };
    
    await kv.set(`cycle_${id}`, updatedCycle);
    console.log(`[Cycle] История взвешиваний удалена для цикла ${id}`);
    
    return c.json({ success: true, message: "Weighing history cleared" });
  } catch (error: any) {
    console.error(`[Cycle] Ошибка удаления истории взвешиваний:`, error);
    return c.json({ error: error.message }, 500);
  }
});

routes.post('/cycles', async (c) => {
  try {
    const body = await c.req.json();
    const id = crypto.randomUUID();
    const newCycle = {
      ...body,
      id,
      createdAt: new Date().toISOString(),
      status: 'In Progress'
    };
    await kv.set(`cycle_${id}`, newCycle);
    return c.json(newCycle);
  } catch (error: any) {
    console.error("Error creating cycle:", error);
    return c.json({ error: error.message }, 500);
  }
});

routes.put('/cycles/:id', async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing = await kv.get(`cycle_${id}`);
    if (!existing) {
      return c.json({ error: "Cycle not found" }, 404);
    }
    const updated = { ...existing, ...body, id };
    
    const hasFinalMoisture = updated.finalMoisture !== undefined && updated.finalMoisture !== null && updated.finalMoisture !== "";
    const hasRating = updated.qualityRating !== undefined && updated.qualityRating !== null;
    const hasResultPhoto = updated.resultPhotos && updated.resultPhotos.length > 0;
    
    if (hasFinalMoisture && hasRating && hasResultPhoto) {
      updated.status = "Completed";
    } else {
      updated.status = "In Progress";
    }

    await kv.set(`cycle_${id}`, updated);
    return c.json(updated);
  } catch (error: any) {
    console.error("Error updating cycle:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Alias for driver view - update cycle with weighing result
routes.put('/update-cycle', async (c) => {
  try {
    const body = await c.req.json();
    const { id, weighingResult } = body;
    
    if (!id) {
      return c.json({ error: "Cycle ID required" }, 400);
    }
    
    const existing = await kv.get(`cycle_${id}`);
    if (!existing) {
      return c.json({ error: "Cycle not found" }, 404);
    }
    
    const updated = { 
      ...existing, 
      weighingResult,
      weighedAt: new Date().toISOString()
    };
    
    await kv.set(`cycle_${id}`, updated);
    console.log(`[Driver] Цикл ${id} обновлён результатами взвешивания`);
    return c.json(updated);
  } catch (error: any) {
    console.error("Error updating cycle with weighing:", error);
    return c.json({ error: error.message }, 500);
  }
});

routes.delete('/cycles/:id', async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`cycle_${id}`);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting cycle:", error);
    return c.json({ error: error.message }, 500);
  }
});

routes.get('/settings/durations', async (c) => {
  try {
    const data = await kv.get("settings_durations");
    return c.json(data || {});
  } catch (error: any) {
    console.error("Error fetching settings:", error);
    return c.json({ error: error.message }, 500);
  }
});

routes.post('/settings/durations', async (c) => {
  try {
    const body = await c.req.json();
    await kv.set("settings_durations", body);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error saving settings:", error);
    return c.json({ error: error.message }, 500);
  }
});

routes.post('/upload', async (c) => {
  try {
    await ensureBucket();
    const body = await c.req.parseBody();
    const file = body['file'];
    
    if (!file || !(file instanceof File)) {
      return c.json({ error: "No file uploaded" }, 400);
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      });

    if (error) throw error;
    return c.json({ path: data.path });
  } catch (error: any) {
    console.error("Error uploading file:", error);
    return c.json({ error: error.message }, 500);
  }
});

routes.post('/weather', async (c) => {
  try {
    const { startDate, endDate } = await c.req.json();
    if (!startDate || !endDate) return c.json({ error: "Missing dates" }, 400);

    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = startOfDay(new Date());
    const days = eachDayOfInterval({ start, end });
    
    const weatherData: Record<string, { temp: number, code: number }> = {};
    const missingDays: Date[] = [];

    await Promise.all(days.map(async (day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      if (isBefore(day, today)) {
        const cached = await kv.get(`weather_${dateStr}`);
        if (cached) weatherData[dateStr] = cached;
        else missingDays.push(day);
      } else {
        missingDays.push(day);
      }
    }));

    if (missingDays.length > 0) {
      const ninetyDaysAgo = subDays(today, 90);
      const oldDays = missingDays.filter(d => isBefore(d, ninetyDaysAgo));
      const recentDays = missingDays.filter(d => !isBefore(d, ninetyDaysAgo));

      if (oldDays.length > 0) {
        const minDate = oldDays.reduce((a, b) => (a < b ? a : b));
        const maxDate = oldDays.reduce((a, b) => (a > b ? a : b));
        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=55.5264&longitude=25.1027&start_date=${format(minDate, 'yyyy-MM-dd')}&end_date=${format(maxDate, 'yyyy-MM-dd')}&daily=temperature_2m_mean,weather_code&timezone=Europe%2FVilnius`;
        const res = await fetch(url);
        if (res.ok) {
           const data = await res.json();
           if (data.daily) {
             data.daily.time.forEach((t: string, i: number) => {
               if (data.daily.temperature_2m_mean[i] !== null) {
                 const val = { temp: data.daily.temperature_2m_mean[i], code: data.daily.weather_code[i] };
                 weatherData[t] = val;
                 kv.set(`weather_${t}`, val);
               }
             });
           }
        }
      }

      if (recentDays.length > 0) {
        const minDate = recentDays.reduce((a, b) => (a < b ? a : b));
        const maxDate = recentDays.reduce((a, b) => (a > b ? a : b));
        const limitDate = addDays(today, 10);
        const actualMax = maxDate > limitDate ? limitDate : maxDate;
        
        if (minDate <= actualMax) {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=55.5264&longitude=25.1027&start_date=${format(minDate, 'yyyy-MM-dd')}&end_date=${format(actualMax, 'yyyy-MM-dd')}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Europe%2FVilnius`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.daily) {
                    data.daily.time.forEach((t: string, i: number) => {
                        const max = data.daily.temperature_2m_max[i];
                        const min = data.daily.temperature_2m_min[i];
                        if (max !== null && min !== null) {
                            const val = { temp: (max + min) / 2, code: data.daily.weather_code[i] };
                            weatherData[t] = val;
                            if (t < format(today, 'yyyy-MM-dd')) kv.set(`weather_${t}`, val);
                        }
                    });
                }
            }
        }
      }
    }
    return c.json(weatherData);
  } catch (error: any) {
    console.error("Error fetching weather:", error);
    return c.json({ error: error.message }, 500);
  }
});

// Google Sheets Sync Endpoints

// НОВЫЙ: Получить текущие работы из Sheets (через POST от Apps Script)
routes.post('/sheets/update-current-work', async (c) => {
  try {
    const body = await c.req.json();
    
    console.log('[Sheets] Получены данные о текущих работах:', body);
    
    // Сохраняем данные в KV store
    await kv.set('current_work', {
      line1: body.line1 || { rawText: '', sequentialNumber: null },
      line2: body.line2 || { rawText: '', sequentialNumber: null },
      line3: body.line3 || { rawText: '', sequentialNumber: null },
      timestamp: new Date().toISOString()
    });
    
    return c.json({ 
      success: true, 
      message: 'Данные о текущих работах обновлены' 
    });
    
  } catch (error: any) {
    console.error('[Sheets] Ошибка обновления текущих работ:', error);
    return c.json({ error: error.message }, 500);
  }
});

// НОВЫЙ: Получить текущие работы (для фронтенда)
routes.get('/sheets/current-work', async (c) => {
  try {
    console.log('[Sheets] Запрос текущих работ');
    
    const data = await kv.get('current_work');
    
    if (!data) {
      console.log('[Sheets] Данные о текущих работах не найдены, возвращаем пустой массив');
      return c.json({ 
        currentWork: [],
        message: 'Данные о текущих работах не найдены' 
      });
    }
    
    console.log('[Sheets] Найдены данные о текущих работах:', data);
    
    // Находим циклы по порядковым номерам
    const sequentialNumbers = [
      data.line1?.sequentialNumber,
      data.line2?.sequentialNumber,
      data.line3?.sequentialNumber,
    ].filter(Boolean);
    
    console.log('[Sheets] Порядковые номера циклов:', sequentialNumbers);
    
    // Получаем все циклы с обработкой ошибок
    let allCycles = [];
    try {
      allCycles = await kv.getByPrefix('cycle_');
      console.log(`[Sheets] Загружено ${allCycles.length} циклов из базы`);
    } catch (cycleError: any) {
      console.error('[Sheets] Ошибка загрузки циклов:', cycleError);
      // Продолжаем с пустым массивом циклов
      allCycles = [];
    }
    
    // Создаём Map для быстрого поиска по sequentialNumber
    const cyclesMap = new Map();
    for (const cycle of allCycles) {
      if (cycle && cycle.sequentialNumber) {
        cyclesMap.set(cycle.sequentialNumber, cycle);
      }
    }
    
    console.log(`[Sheets] Создана карта циклов: ${cyclesMap.size} записей`);
    
    // Формируем результат
    const currentWork = [];
    
    if (data.line1?.sequentialNumber) {
      const cycle = cyclesMap.get(data.line1.sequentialNumber) || null;
      currentWork.push({
        lineId: '1',
        sequentialNumber: data.line1.sequentialNumber,
        rawText: data.line1.rawText || '',
        cycle
      });
      console.log(`[Sheets] Линия 1: ${data.line1.sequentialNumber}, цикл найден: ${!!cycle}`);
    }
    
    if (data.line2?.sequentialNumber) {
      const cycle = cyclesMap.get(data.line2.sequentialNumber) || null;
      currentWork.push({
        lineId: '2',
        sequentialNumber: data.line2.sequentialNumber,
        rawText: data.line2.rawText || '',
        cycle
      });
      console.log(`[Sheets] Линия 2: ${data.line2.sequentialNumber}, цикл найден: ${!!cycle}`);
    }
    
    if (data.line3?.sequentialNumber) {
      const cycle = cyclesMap.get(data.line3.sequentialNumber) || null;
      currentWork.push({
        lineId: '3',
        sequentialNumber: data.line3.sequentialNumber,
        rawText: data.line3.rawText || '',
        cycle
      });
      console.log(`[Sheets] Линия 3: ${data.line3.sequentialNumber}, цикл найден: ${!!cycle}`);
    }
    
    // Подписываем URL для фото
    for (const work of currentWork) {
      if (work.cycle) {
        try {
          work.cycle = await signCycleUrls(work.cycle);
        } catch (signError: any) {
          console.error('[Sheets] Ошибка подписания URL для цикла:', signError);
          // Продолжаем без подписанных URL
        }
      }
    }
    
    console.log(`[Sheets] Возвращаем ${currentWork.length} текущих работ`);
    return c.json({ currentWork, timestamp: data.timestamp });
    
  } catch (error: any) {
    console.error('[Sheets] Критическая ошибка получения текущих работ:', error);
    console.error('[Sheets] Stack trace:', error.stack);
    
    // Возвращаем пустой массив вместо ошибки 500
    return c.json({ 
      currentWork: [], 
      error: error.message,
      message: 'Ошибка загрузки данных, попробуйте позже'
    });
  }
});

// Webhook endpoint для приёма данных из Google Sheets
// Когда оператор завершает сушку и в Google Sheets появляется новая строка,
// Apps Script вызывает этот endpoint
routes.post('/sheets/process-row', async (c) => {
  try {
    const body = await c.req.json() as GoogleSheetRow;
    
    console.log('[Sheets] Получен запрос на обработку строки:', body);
    
    // Проверяем обязательные поля
    if (!body.rowNumber || !body.chamberNumber || !body.oldSequentialNumber || 
        !body.newSequentialNumber || !body.woodTypeLithuanian || 
        !body.oldCycleEndDate || !body.newCycleStartDate) {
      return c.json({ 
        error: 'Отсутствуют обязательные поля',
        required: ['rowNumber', 'chamberNumber', 'woodTypeLithuanian', 'oldSequentialNumber', 'oldCycleEndDate', 'newSequentialNumber', 'newCycleStartDate']
      }, 400);
    }
    
    // Проверяем, не была ли строка уже обработана
    const alreadyProcessed = await isRowProcessed(body.rowNumber);
    if (alreadyProcessed) {
      console.log(`[Sheets] Строка ${body.rowNumber} уже была обработана ранее, пропускаем`);
      return c.json({ 
        success: true, 
        message: 'Строка уже обработана',
        skipped: true 
      });
    }
    
    // Запускаем обработку в фоне (не блокируем ответ)
    processSheetRow(body)
      .then(() => {
        markRowAsProcessed(body.rowNumber, body);
        console.log(`[Sheets] ✅ Строка ${body.rowNumber} успешно обработана`);
      })
      .catch((error) => {
        console.error(`[Sheets] ❌ Ошибка обработки строки ${body.rowNumber}:`, error);
      });
    
    // Сразу возвращаем успешный ответ
    return c.json({ 
      success: true, 
      message: 'Обработка строки запущена',
      rowNumber: body.rowNumber
    });
    
  } catch (error: any) {
    console.error('[Sheets] Ошибка в endpoint process-row:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Получить последние логи синхронизации
routes.get('/sheets/sync-logs', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10');
    const logs = await getRecentSyncLogs(limit);
    
    return c.json({ 
      success: true,
      logs,
      count: logs.length
    });
  } catch (error: any) {
    console.error('[Sheets] Ошибка получения логов:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Проверить статус обработки строки
routes.get('/sheets/row-status/:rowNumber', async (c) => {
  try {
    const rowNumber = parseInt(c.req.param('rowNumber'));
    
    console.log(`[Sheets] Проверка статуса строки ${rowNumber}`);
    
    // Проверяем через kv.get
    const kvResult = await kv.get(`processed_row_${rowNumber}`);
    console.log(`[Sheets] kv.get результат:`, kvResult);
    
    // Проверяем напрямую через Supabase
    const { data, error } = await supabase
      .from("kv_store_c5bcdb1f")
      .select("key, value")
      .eq("key", `processed_row_${rowNumber}`)
      .single();
    
    console.log(`[Sheets] Supabase прямой запрос:`, data, error);
    
    const processed = await isRowProcessed(rowNumber);
    
    return c.json({ 
      processed,
      kvResult,
      supabaseData: data,
      supabaseError: error?.message
    });
  } catch (error: any) {
    console.error('[Sheets] Ошибка проверки статуса строки:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Сброс статуса обработки строки (для повторного тестирования)
routes.delete('/sheets/reset-row/:rowNumber', async (c) => {
  try {
    const rowNumber = parseInt(c.req.param('rowNumber'));
    
    console.log(`[Sheets] Сброс статуса строки ${rowNumber}`);
    
    // Удаляем метку обработки
    await kv.del(`processed_row_${rowNumber}`);
    
    return c.json({ 
      success: true, 
      message: `Статус строки ${rowNumber} сброшен. Теперь её можно обработать снова.` 
    });
  } catch (error: any) {
    console.error('[Sheets] Ошибка сброса статуса строки:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Получить список всех обработанных строк
routes.get('/sheets/processed-rows', async (c) => {
  try {
    console.log('[Sheets] Запрос на получение обработанных строк');
    
    // Используем прямой запрос к базе через service role
    const { data, error } = await supabase
      .from("kv_store_c5bcdb1f")
      .select("key, value")
      .like("key", "processed_row_%");
    
    if (error) {
      console.error('[Sheets] Ошибка получения строк из БД:', error);
      return c.json({ error: `Database error: ${error.message}` }, 500);
    }
    
    console.log(`[Sheets] Найдено ${data?.length || 0} обработанных строк`);
    
    const rows = (data || []).map((item: any) => {
      const rowNumber = parseInt(item.key?.replace('processed_row_', '') || '0');
      return {
        rowNumber,
        processedAt: item.value?.processedAt,
        details: item.value?.details
      };
    }).sort((a: any, b: any) => b.rowNumber - a.rowNumber);
    
    console.log('[Sheets] Возвращаем данные клиенту');
    return c.json({ rows, count: rows.length });
  } catch (error: any) {
    console.error('[Sheets] Ошибка получения обработанных строк:', error);
    return c.json({ error: error.message || 'Unknown error' }, 500);
  }
});

// Очистить все обработанные строки (для массового тестированя)
routes.post('/sheets/clear-processed', async (c) => {
  try {
    console.log('[Sheets] Очистка всех обработанных строк');
    
    // Получаем все ключи processed_row_*
    const allRows = await kv.getByPrefix('processed_row_');
    
    // Удаляем все метки
    for (const row of allRows) {
      await kv.del(row.key);
    }
    
    return c.json({ 
      success: true, 
      message: `Очищено ${allRows.length} обработанных строк`,
      count: allRows.length
    });
  } catch (error: any) {
    console.error('[Sheets] Ошибка очистки обработанных строк:', error);
    return c.json({ error: error.message }, 500);
  }
});

// НОВЫЙ: Удалить дубликаты циклов по порядковому номеру (оставить только последний)
routes.delete('/sheets/remove-duplicates/:sequentialNumber', async (c) => {
  try {
    const sequentialNumber = c.req.param('sequentialNumber');
    
    console.log(`[Sheets] Удаление дубликатов для цикла ${sequentialNumber}`);
    
    // Находим все циклы с этим порядковым номером
    const allCycles = await kv.getByPrefix('cycle_');
    const duplicates = allCycles
      .filter(item => item.value && item.value.sequentialNumber === sequentialNumber) // Проверяем что value существует
      .map(item => ({ key: item.key, cycle: item.value })) // Сохраняем и ключ и значение
      .sort((a, b) => new Date(b.cycle.startDate).getTime() - new Date(a.cycle.startDate).getTime()); // Сортируем по дате (новые первые)
    
    if (duplicates.length <= 1) {
      return c.json({
        success: true,
        message: 'Дубликатов не найдено',
        found: duplicates.length
      });
    }
    
    // Оставляем только ПОСЛЕДНИЙ (самый новый), удаляем остальные
    const toKeep = duplicates[0];
    const toDelete = duplicates.slice(1);
    
    console.log(`[Sheets] Найдено ${duplicates.length} циклов. Оставляем ${toKeep.cycle.id}, удаляем ${toDelete.length}`);
    
    // Удаляем дубликаты (используем правильный ключ cycle_${id})
    for (const item of toDelete) {
      await kv.del(item.key); // Используем оригинальный ключ из БД
      console.log(`[Sheets] Удалён дубликат: ${item.cycle.id} (ключ: ${item.key})`);
    }
    
    return c.json({
      success: true,
      message: `Удалено ${toDelete.length} дубликатов. Оставлен цикл от ${new Date(toKeep.cycle.startDate).toLocaleString()}`,
      kept: toKeep.cycle,
      deleted: toDelete.length,
      total: duplicates.length
    });
    
  } catch (error: any) {
    console.error('[Sheets] Ошибка удаления дубликатов:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Ручная синхронизация (для тестирования)
routes.post('/sheets/manual-sync', async (c) => {
  try {
    const body = await c.req.json() as GoogleSheetRow;
    
    console.log('[Sheets] Запущена ручная синхронизация:', body);
    
    // Обрабатываем синхронно для ручного режима
    await processSheetRow(body);
    await markRowAsProcessed(body.rowNumber, body);
    
    return c.json({ 
      success: true, 
      message: 'Синхронизация завершена',
      rowNumber: body.rowNumber 
    });
    
  } catch (error: any) {
    console.error('[Sheets] Ошибка ручной синхронизации:', error);
    return c.json({ error: error.message }, 500);
  }
});

// **NEW**: Синхронизация процентов завершения из Google Sheets (каждые 15 мин)
// Вызывается по расписанию (каждые 15 минут) из Google Apps Script
// Формат: { "1": 45.5, "2": 78.3, "3": 99.0, ... "21": 115.5 }
routes.post('/sheets/sync-progress', async (c) => {
  try {
    const body = await c.req.json();
    console.log('[Sheets] Получены проценты завершения:', body);
    
    // Валидация: должен быть объект с числами от 1 до 21 как ключами
    if (typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ error: 'Неверный формат данных. Ожидается объект { "1": percent, "2": percent, ... }' }, 400);
    }
    
    const updates: Array<{ chamber: number, progress: number, success: boolean, error?: string }> = [];
    
    // Обновляем каждую камеру
    for (const [chamberStr, progressPercent] of Object.entries(body)) {
      const chamberNum = parseInt(chamberStr);
      const progress = typeof progressPercent === 'number' ? progressPercent : parseFloat(progressPercent as string);
      
      // Валидация
      if (isNaN(chamberNum) || chamberNum < 1 || chamberNum > 21 || isNaN(progress)) {
        updates.push({ chamber: chamberNum, progress, success: false, error: 'Invalid data' });
        continue;
      }
      
      try {
        // Найти активный цикл для этой камеры
        const cycles = await kv.getByPrefix(`cycle_`);
        const activeCycle = cycles.find((c: any) => 
          c.chamberNumber === chamberNum && 
          c.status === 'In Progress' && 
          !c.endDate
        );
        
        if (activeCycle) {
          // Обновляем процент (сохраняем с одним знаком после запятой)
          const roundedProgress = Math.round(progress * 10) / 10;
          activeCycle.progressPercent = roundedProgress;
          await kv.set(`cycle_${activeCycle.id}`, activeCycle);
          updates.push({ chamber: chamberNum, progress: roundedProgress, success: true });
          console.log(`[Sheets] Камера ${chamberNum}: обновлен процент до ${roundedProgress}%`);
        } else {
          // Нет активного цикла - пропускаем
          updates.push({ chamber: chamberNum, progress, success: false, error: 'No active cycle' });
        }
      } catch (err: any) {
        console.error(`[Sheets] Ошибка обновления камеры ${chamberNum}:`, err);
        updates.push({ chamber: chamberNum, progress, success: false, error: err.message });
      }
    }
    
    const successCount = updates.filter(u => u.success).length;
    console.log(`[Sheets] Синхронизация процентов завершена: ${successCount}/${updates.length} успешно`);
    
    return c.json({ 
      success: true, 
      message: `Обновлено ${successCount} из ${updates.length} камер`,
      updates 
    });
    
  } catch (error: any) {
    console.error('[Sheets] Ошибка синхронизации процентов:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /analyze-weight - Analyze weight from scale photo using OpenAI Vision
routes.post('/analyze-weight', async (c) => {
  try {
    const { image } = await c.req.json();
    
    if (!image) {
      return c.json({ error: 'No image provided' }, 400);
    }

    const openAIKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIKey) {
      console.error('OPENAI_API_KEY not configured');
      return c.json({ error: 'OpenAI API key not configured' }, 500);
    }

    // Отправляем изображение на OpenAI Vision API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAIKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Look at this image of a scale/weighing device. Extract ONLY the weight number in tons (t). Return ONLY a number, nothing else. If you see multiple numbers, return the largest weight value. Examples: "10.5" or "12.3". If no weight is visible, return "0".'
              },
              {
                type: 'image_url',
                image_url: {
                  url: image
                }
              }
            ]
          }
        ],
        max_tokens: 50
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return c.json({ error: 'Failed to analyze image', details: errorText }, 500);
    }

    const data = await response.json();
    const weightText = data.choices?.[0]?.message?.content?.trim();
    const weight = parseFloat(weightText || '0');

    console.log(`Weight analyzed: ${weight} tons`);
    
    return c.json({ weight: isNaN(weight) ? 0 : weight });
    
  } catch (error: any) {
    console.error('Error analyzing weight:', error);
    return c.json({ error: error.message }, 500);
  }
});

// НОВЫЙ: Получить настройки пород дерева
routes.get('/wood-settings', async (c) => {
  try {
    console.log('[WoodSettings] Запрос настроек пород дерева');
    
    const settings = await kv.get('wood_type_settings');
    
    if (!settings) {
      console.log('[WoodSettings] Настройки не найдены, возвращаем пустой массив');
      return c.json([]);
    }
    
    console.log('[WoodSettings] Найдены настройки для пород:', settings.length);
    return c.json(settings);
  } catch (error: any) {
    console.error('[WoodSettings] Ошибка получения настроек:', error);
    return c.json([]);
  }
});

// НОВЫЙ: Сохранить настройки пород дерева
routes.post('/wood-settings', async (c) => {
  try {
    console.log('[WoodSettings] Сохранение настроек пород дерева');
    
    const body = await c.req.json();
    
    if (!Array.isArray(body)) {
      return c.json({ error: 'Неверный формат данных' }, 400);
    }
    
    await kv.set('wood_type_settings', body);
    
    console.log('[WoodSettings] Настройки сохранены для пород:', body.length);
    return c.json({ success: true });
  } catch (error: any) {
    console.error('[WoodSettings] Ошибка сохранения настроек:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Проверка общего пароля приложения
routes.post('/check-app-password', async (c) => {
  try {
    const { password } = await c.req.json();
    
    // Получаем сохраненный пароль из KV
    let savedPassword = await kv.get('app_password');
    
    // Если пароль не установлен, используем дефолтный
    if (!savedPassword) {
      savedPassword = 'drytrack2024';
    }
    
    console.log('[AppPassword] Проверка пароля приложения');
    
    if (password === savedPassword) {
      return c.json({ success: true });
    } else {
      return c.json({ success: false, error: 'Invalid password' });
    }
  } catch (error: any) {
    console.error('[AppPassword] Ошибка проверки пароля:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Проверка пароля администратора
routes.post('/check-admin-password', async (c) => {
  try {
    const { password } = await c.req.json();
    
    // Получаем сохраненный пароль администратора из KV
    let savedPassword = await kv.get('admin_password');
    
    // Если пароль не установлен, используем дефолтный
    if (!savedPassword) {
      savedPassword = 'admin2024';
    }
    
    console.log('[AdminPassword] Проверка пароля администратора');
    
    if (password === savedPassword) {
      return c.json({ success: true });
    } else {
      return c.json({ success: false, error: 'Invalid password' });
    }
  } catch (error: any) {
    console.error('[AdminPassword] Ошибка проверки пароля:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Получить настройки паролей (только для админа)
routes.get('/password-settings', async (c) => {
  try {
    const appPassword = await kv.get('app_password') || 'drytrack2024';
    const adminPassword = await kv.get('admin_password') || 'admin2024';
    
    return c.json({ 
      appPassword,
      adminPassword 
    });
  } catch (error: any) {
    console.error('[PasswordSettings] Ошибка получения настроек паролей:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Обновить настройки паролей (только для админа)
routes.post('/password-settings', async (c) => {
  try {
    const { appPassword, adminPassword } = await c.req.json();
    
    if (appPassword) {
      await kv.set('app_password', appPassword);
      console.log('[PasswordSettings] Пароль приложения обновлен');
    }
    
    if (adminPassword) {
      await kv.set('admin_password', adminPassword);
      console.log('[PasswordSettings] Пароль администратора обновлен');
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('[PasswordSettings] Ошибка сохранения паролей:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Mount Routes
app.route('/make-server-c5bcdb1f', routes);
app.route('/functions/v1/make-server-c5bcdb1f', routes);

// Initialize bucket on startup
(async () => {
  try {
    console.log('[Server] Initializing storage bucket...');
    await ensureBucket();
    console.log('[Server] Storage bucket ready');
  } catch (error) {
    console.error('[Server] Bucket initialization failed:', error);
  }
})();

Deno.serve(app.fetch);