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
    console.log('[WorkCycles] 📥 Запрос на получение рабочих циклов');
    
    const cycles = await kv.getByPrefix("cycle_");
    console.log(`[WorkCycles] ✅ Загружено ${cycles.length} циклов из БД`);
    
    if (cycles.length === 0) {
      console.log('[WorkCycles] ⚠️ Нет циклов в базе данных');
      return c.json([]);
    }
    
    console.log('[WorkCycles] 🔐 Подписываем URL для фотографий...');
    const signedCycles = await Promise.all(cycles.map(async (cycle: any) => {
      if (!cycle) return null;
      try {
        return await signCycleUrls(cycle);
      } catch (signError: any) {
        console.error(`[WorkCycles] ❌ Ошибка подписания URL для цикла ${cycle.id}:`, signError.message);
        return cycle;
      }
    }));
    
    const validCycles = signedCycles.filter(c => c !== null);
    validCycles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`[WorkCycles] ✅ Возвращаем ${validCycles.length} валидных циклов`);
    return c.json(validCycles);
  } catch (error: any) {
    console.error("[WorkCycles] ❌ Критическая ошибка:", error);
    console.error("[WorkCycles] Stack trace:", error.stack);
    return c.json({ error: error.message || "Failed to fetch work cycles" }, 500);
  }
});

routes.get('/cycles', async (c) => {
  try {
    console.log('[Cycles] Запрос на получение циклов (без фотографий)');
    
    const cycles = await kv.getByPrefix("cycle_");
    console.log(`[Cycles] Загружено ${cycles.length} циклов`);
    
    // Поддержка фильтрации по sequentialNumber для Google Sheets синхронизаци
    const sequentialNumber = c.req.query('sequentialNumber');
    let filteredCycles = cycles;
    
    if (sequentialNumber) {
      filteredCycles = cycles.filter((cycle: any) => 
        cycle && cycle.sequentialNumber === sequentialNumber
      );
      console.log(`[Cycles] Отфильтровано по sequentialNumber ${sequentialNumber}: ${filteredCycles.length} циклов`);
    }
    
    // ✅ ОПТИМИЗАЦИЯ: Не генерируем signed URLs для списка цикл
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
    const id = c.req.param('id');
    console.log(`[Cycle] Удаление истории взвешиваний для цикла ${id}`);
    
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

// Delete specific weighing record from history
routes.delete('/cycles/:id/weighing-history/:index', async (c) => {
  try {
    const id = c.req.param('id');
    const indexToDelete = parseInt(c.req.param('index'));
    console.log(`[Cycle] Запрос на удаление записи взвешивания. Цикл: ${id}, Индекс: ${indexToDelete}`);
    
    const cycle = await kv.get(`cycle_${id}`);
    if (!cycle) {
      console.log(`[Cycle] Цикл ${id} не найден`);
      return c.json({ error: "Cycle not found" }, 404);
    }
    
    const weighingHistory = cycle.weighingHistory || [];
    console.log(`[Cycle] Текущая длина истории: ${weighingHistory.length}`);
    console.log(`[Cycle] Записи в истории:`, weighingHistory.map((w: any, i: number) => `${i}: ${new Date(w.timestamp).toISOString()}`));
    
    if (isNaN(indexToDelete)) {
      console.log(`[Cycle] Индекс не является числом: ${c.req.param('index')}`);
      return c.json({ error: "Invalid index format" }, 400);
    }
    
    if (indexToDelete < 0 || indexToDelete >= weighingHistory.length) {
      console.log(`[Cycle] Индекс ${indexToDelete} вне диапазона 0-${weighingHistory.length - 1}`);
      return c.json({ error: `Invalid index. Must be between 0 and ${weighingHistory.length - 1}` }, 400);
    }
    
    // Удаляем конкретную запись
    const recordToDelete = weighingHistory[indexToDelete];
    console.log(`[Cycle] Удаляем запись ${indexToDelete}:`, new Date(recordToDelete.timestamp).toISOString());
    
    const updatedHistory = weighingHistory.filter((_: any, idx: number) => idx !== indexToDelete);
    
    const updatedCycle = {
      ...cycle,
      weighingHistory: updatedHistory
    };
    
    await kv.set(`cycle_${id}`, updatedCycle);
    console.log(`[Cycle] ✅ Запись взвешивания ${indexToDelete} удалена для цикла ${id}. Осталось записей: ${updatedHistory.length}`);
    
    return c.json({ success: true, message: "Weighing record deleted", cycle: updatedCycle });
  } catch (error: any) {
    console.error(`[Cycle] ❌ Ошибка удаления записи взвешивания:`, error);
    console.error(`[Cycle] Stack trace:`, error.stack);
    return c.json({ error: error.message || "Internal server error" }, 500);
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
    console.log("🔥 SQL ENDPOINT HIT");

    const body = await c.req.json();

    const timestamp = body.timestamp || new Date().toISOString();

    const rows = Object.entries(body)
      .filter(([key]) => key.startsWith("line"))
      .map(([key, value]: any) => ({
        line_number: Number(key.replace("line", "")),
        sequential_number: value.sequentialNumber,
        raw_text: value.rawText,
        updated_at: timestamp
      }));

    const { error } = await supabase
      .from("current_work")
      .upsert(rows, { onConflict: "line_number" });

    if (error) {
      console.error("❌ SQL ERROR:", error);
      return c.json({ error }, 500);
    }

    return c.json({ success: true });

  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// НОВЫЙ: Получить текущие работы (для фронтенда)
routes.get('/sheets/current-work', async (c) => {
  try {
    console.log('[Sheets] Запрос текущих работ');

    // 1. SQL → current_work
    const { data: rows, error } = await supabase
      .from("current_work")
      .select("*")
      .order("line_number");

    if (error) {
      console.error("❌ SQL ERROR:", error);
      return c.json({ error }, 500);
    }

    if (!rows || rows.length === 0) {
      return c.json({ currentWork: [] });
    }

    // 2. Преобразуем
    const data: any = {};

    for (const row of rows) {
      data[`line${row.line_number}`] = {
        rawText: row.raw_text,
        sequentialNumber: row.sequential_number
      };
    }

    data.timestamp = rows[0]?.updated_at;

    // 3. Получаем cycles из KV (пока)
    const { data: dbData } = await supabase
      .from("kv_store_c5bcdb1f")
      .select("key, value")
      .like("key", "cycle_%")
      .limit(1000);

    const cyclesMap = new Map();

    for (const item of dbData || []) {
      const seq = item.value?.sequentialNumber;
      if (seq) {
        cyclesMap.set(seq, item.value);
      }
    }

    // 4. Формируем результат
    const currentWork = [];

    for (let i = 1; i <= 3; i++) {
      const line = data[`line${i}`];

      if (line?.sequentialNumber) {
        currentWork.push({
          lineId: String(i),
          sequentialNumber: line.sequentialNumber,
          rawText: line.rawText || '',
          cycle: cyclesMap.get(line.sequentialNumber) || null
        });
      }
    }

    // 5. Подписываем URL
    for (const work of currentWork) {
      if (work.cycle) {
        try {
          work.cycle = await signCycleUrls(work.cycle);
        } catch (e) {
          console.error('[Sheets] Ошибка подписания URL:', e);
        }
      }
    }

    return c.json({
      currentWork,
      timestamp: data.timestamp
    });

  } catch (error: any) {
    console.error('[Sheets] ERROR:', error);

    return c.json({
      currentWork: [],
      error: error.message
    });
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
    
    // ✅ ОПТИМИЗАЦИЯ: Используем прямой запрос к БД вместо загрузки всех циклов
    let cyclesMap = new Map();
    
    if (sequentialNumbers.length > 0) {
      try {
        // Делаем прямой запрос к базе для каждого sequentialNumber
        for (const seqNum of sequentialNumbers) {
          console.log(`[Sheets] Поиск цикла с sequentialNumber: ${seqNum}`);
          
          const { data: dbData, error } = await supabase
            .from("kv_store_c5bcdb1f")
            .select("key, value")
            .like("key", "cycle_%")
            .limit(1000); // Ограничиваем для безопасности
          
          if (error) {
            console.error('[Sheets] Ошибка запроса к БД:', error);
            continue;
          }
          
          // Ищем цикл с нужным sequentialNumber
          const matchingCycle = dbData?.find((item: any) => {
            try {
              return item.value?.sequentialNumber === seqNum;
            } catch (e) {
              return false;
            }
          });
          
          if (matchingCycle) {
            cyclesMap.set(seqNum, matchingCycle.value);
            console.log(`[Sheets] Найден цикл для ${seqNum}:`, matchingCycle.value.id);
          } else {
            console.log(`[Sheets] Цикл с sequentialNumber ${seqNum} не найден`);
          }
        }
        
        console.log(`[Sheets] Найдено циклов: ${cyclesMap.size}`);
      } catch (cycleError: any) {
        console.error('[Sheets] Ошибка загрузки циклов:', cycleError);
        // Продолжаем с пустым Map
      }
    }
    
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

// Сброс татуса обработки строки (для повторного тестирования)
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

// НОВЫЙ: Удалить дубликаы циклов по порядковому номеру (оставить только последний)
routes.delete('/sheets/remove-duplicates/:sequentialNumber', async (c) => {
  try {
    const sequentialNumber = c.req.param('sequentialNumber');
    
    console.log(`[Sheets] Удаление дубликатов для икла ${sequentialNumber}`);
    
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
    
    // Оставляем только ПОСЛЕДНИЙ (самый новый), удаляем осталные
    const toKeep = duplicates[0];
    const toDelete = duplicates.slice(1);
    
    console.log(`[Sheets] Найдено ${duplicates.length} циклов. Оставляем ${toKeep.cycle.id}, удаляем ${toDelete.length}`);
    
    // Удаляем дубликаты (используем правильный ключ cycle_${id})
    for (const item of toDelete) {
      await kv.del(item.key); // Используем оригиальный ключ из БД
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
          // Обновляем процент (сохраняем с одним знаком после запятй)
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

    // Опраляем изображеие на OpenAI Vision API
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

    const { data, error } = await supabase
      .from('wood_type_settings')
      .select('*')
      .order('name');

    if (error) {
      console.error('[WoodSettings] Ошибка SQL:', error);
      return c.json([]);
    }

    console.log('[WoodSettings] Найдены настройки:', data.length);
    return c.json(data);
  } catch (error: any) {
    console.error('[WoodSettings] Ошибка получения:', error);
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

    // 1. Удаляем старые данные
    const { error: deleteError } = await supabase
      .from('wood_type_settings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // удаляем всё

    if (deleteError) {
      console.error('[WoodSettings] Ошибка удаления:', deleteError);
      return c.json({ error: deleteError.message }, 500);
    }

    // 2. Подготавливаем данные под SQL
    const formatted = body.map((item: any) => ({
      name: item.name,
      warmup_time: item.warmupTime,
      weight_limit: item.weightLimit,
      drying_rate_time: item.dryingRateTime,
    }));

    // 3. Вставляем новые
    const { error: insertError } = await supabase
      .from('wood_type_settings')
      .insert(formatted);

    if (insertError) {
      console.error('[WoodSettings] Ошибка вставки:', insertError);
      return c.json({ error: insertError.message }, 500);
    }

    console.log('[WoodSettings] Успешно сохранено:', formatted.length);
    return c.json({ success: true });

  } catch (error: any) {
    console.error('[WoodSettings] Ошибка сохранения:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Проверка общего пароля приложения
routes.post('/check-app-password', async (c) => {
  try {
    const { password } = await c.req.json();

    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'app_password')
      .single();

    let savedPassword = data?.value;

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
    console.error('[AppPassword] Ошибка:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Проверка пароля администратора
routes.post('/check-admin-password', async (c) => {
  try {
    const { password } = await c.req.json();

    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'admin_password')
      .single();

    let savedPassword = data?.value;

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
    console.error('[AdminPassword] Ошибка:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Обновить настройки паролей (только для админа)
routes.post('/password-settings', async (c) => {
  try {
    const { appPassword, adminPassword } = await c.req.json();

    if (appPassword) {
      await supabase.from('settings').upsert({
        key: 'app_password',
        value: appPassword
      });
      console.log('[PasswordSettings] Пароль приложения обновлен');
    }

    if (adminPassword) {
      await supabase.from('settings').upsert({
        key: 'admin_password',
        value: adminPassword
      });
      console.log('[PasswordSettings] Пароль администратора обновлен');
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('[PasswordSettings] Ошибка:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Получить настройки Telegram (только для админа)
routes.get('/telegram-settings', async (c) => {
  try {
    const settings = await kv.get('telegram_settings') || {
      botToken: '',
      chatId: '',
      enabled: false
    };
    
    return c.json(settings);
  } catch (error: any) {
    console.error('[TelegramSettings] Ошибка получения настроек:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Сохранить настройки Telegram (только для админа)
routes.post('/telegram-settings', async (c) => {
  try {
    const { botToken, chatId, enabled } = await c.req.json();
    
    const settings = {
      botToken: botToken || '',
      chatId: chatId || '',
      enabled: enabled || false
    };
    
    await kv.set('telegram_settings', settings);
    console.log('[TelegramSettings] Настройки Telegram сохранены');
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('[TelegramSettings] Ошибка сохранения настроек:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Отправить информацию о взвешивании в Telegram
routes.post('/send-telegram-weighing', async (c) => {
  try {
    const { cycleId, weighingRecord } = await c.req.json();
    
    if (!cycleId || !weighingRecord) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    console.log('[Telegram] Отправка информации о взвешивании для цикла:', cycleId);
    
    // Получаем настройки Telegram
    const settings = await kv.get('telegram_settings');
    
    if (!settings || !settings.enabled || !settings.botToken || !settings.chatId) {
      console.log('[Telegram] Telegram не настроен или отключен');
      return c.json({ 
        error: 'Telegram не настроен. Пожалуйста, настройте бота в панели администратора.' 
      }, 400);
    }
    
    // Получаем информацию о цикле
    const cycle = await kv.get(`cycle_${cycleId}`);
    
    if (!cycle) {
      return c.json({ error: 'Цикл не найден' }, 404);
    }
    
    // Получаем историю взвешиваний для этого цикла
    const weighingHistory = cycle.weighingHistory || [];
    
    // Находим предыдущее взвешивание (не текущее)
    const currentTimestamp = weighingRecord.timestamp;
    const previousWeighing = weighingHistory
      .filter((w: any) => w.timestamp !== currentTimestamp)
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    
    // Формируем красивое сообщение на литовском
    const { weights, hoursFromStart, recommendation, recommendationData, totalWeight } = weighingRecord;
    
    // Конвертируем время в литовский часовой пояс (Europe/Vilnius)
    const lithuanianTime = new Date(weighingRecord.timestamp).toLocaleString('lt-LT', {
      timeZone: 'Europe/Vilnius',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    // Функция для выбора 3 наиболее близких по весу ящиков
    const getClosest3Boxes = (boxes: number[]) => {
      if (boxes.length <= 3) return boxes;
      
      // Сортируем ящики по весу
      const sorted = [...boxes].sort((a, b) => a - b);
      
      // Находим 3 последовательных ящика с минимальной разницей
      let minDiff = Infinity;
      let bestStart = 0;
      
      for (let i = 0; i <= sorted.length - 3; i++) {
        const diff = sorted[i + 2] - sorted[i]; // разница между первым и третьим
        if (diff < minDiff) {
          minDiff = diff;
          bestStart = i;
        }
      }
      
      return [sorted[bestStart], sorted[bestStart + 1], sorted[bestStart + 2]];
    };
    
    // Получаем 3 наиболее близких ящика для текущего взвешивания
    const closest3Current = getClosest3Boxes(weights);
    const averageWeight = (closest3Current.reduce((sum, w) => sum + w, 0) / 3).toFixed(2);
    
    // Определяем эмодзи для каждой коробки (зеленый/красный)
    const weightLimit = weighingRecord.weightLimit || 0;
    const allGood = weights.every((w: number) => w <= weightLimit);
    const statusEmoji = allGood ? '✅' : '❌';
    
    // Формируем компактный список коробок БЕЗ НОМЕРОВ
    const boxList = weights
      .map((w: number) => {
        const emoji = w <= weightLimit ? '✅' : '❌';
        return `📦 ${w}t ${emoji}`;
      })
      .join('\n');
    
    // Определяем рекомендацию (упрощенная)
    let recommendationText = '';
    
    if (recommendationData) {
      if (recommendationData.type === 'approved') {
        recommendationText = '\n\n✅ GATAVA RINKTI!';
      } else {
        recommendationText = `\n\n⏳ Tęsti +${recommendationData.hoursNeeded}val (iki ${recommendationData.endTime})`;
      }
    }
    
    // Вычисляем изменения только если есть предыдущее взвешивание
    let changeInfo = '';
    if (previousWeighing) {
      const previousWeights = previousWeighing.weights || [];
      const timeDiff = (new Date(weighingRecord.timestamp).getTime() - new Date(previousWeighing.timestamp).getTime()) / (1000 * 60 * 60);
      
      // Получаем 3 наиболее близких ящика из предыдущего взвешивания
      const closest3Previous = getClosest3Boxes(previousWeights);
      const previousAverage = closest3Previous.reduce((sum, w) => sum + w, 0) / 3;
      const currentAverage = parseFloat(averageWeight);
      
      // Рассчитываем изменение среднего веса
      const weightLoss = previousAverage - currentAverage;
      const lossRate = timeDiff > 0 ? (weightLoss / timeDiff) : 0;
      
      if (weightLoss > 0) {
        changeInfo = `\n\n📉 ${previousAverage.toFixed(2)}t → ${averageWeight}t (-${weightLoss.toFixed(2)}t per ${timeDiff.toFixed(1)}val)\n⚡️ Greitis: ${lossRate.toFixed(3)}t/val`;
      }
    }
    
    // УПРОЩЕННОЕ СООБЩЕНИЕ
    const message = `<b>📦 ${cycle.chamberNumber}</b>

📅 ${lithuanianTime}
⏱ ${hoursFromStart}val nuo pradžios
🌲 ${cycle.woodType} (#${cycle.sequentialNumber})
🎯 Tikslas: ${weightLimit}t/dėžė

<b>Rezultatas:</b>
${boxList}${changeInfo}${recommendationText}`.trim();
    
    // Отправляем сообщение в Telegram
    const telegramUrl = `https://api.telegram.org/bot${settings.botToken}/sendMessage`;
    
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: settings.chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Telegram] Ошибка отправки:', errorData);
      
      // Формируем понятное сообщение об ошибке
      let errorMessage = 'Ошибка отправки в Telegram';
      if (errorData.description?.includes('bot was blocked')) {
        errorMessage = 'Бот заблокирован пользователем. Разблокируйте бота и попробуйте снова.';
      } else if (errorData.description?.includes('chat not found')) {
        errorMessage = 'Чат не найден. Проверьте правильность Chat ID.';
      } else if (errorData.description?.includes('bots can\'t send messages to bots')) {
        errorMessage = 'Нельзя отправлять сообщения другим ботам. Укажите Chat ID личного чата или группы.';
      } else if (errorData.description?.includes('Unauthorized')) {
        errorMessage = 'Неверный токен бота. Проверьте правильность токена.';
      }
      
      return c.json({ 
        error: errorMessage, 
        details: errorData 
      }, 500);
    }
    
    const result = await response.json();
    console.log('[Telegram] Сообщение отправлено успешно:', result);
    
    return c.json({ 
      success: true, 
      message: 'Сообщение отправлено в Telegram',
      messageId: result.result?.message_id
    });
    
  } catch (error: any) {
    console.error('[Telegram] Ошибка отправки сообщения:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Тестирование настроек Telegram
routes.post('/test-telegram', async (c) => {
  try {
    const { botToken, chatId } = await c.req.json();
    
    if (!botToken || !chatId) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    console.log('[Telegram] Тестовая отправка сообщения');
    
    const testMessage = `
🧪 <b>TEST MESSAGE / TESTINIS PRANEŠIMAS</b>

✅ <b>Telegram bot configured successfully!</b>
Telegram botas sukonfigūruotas sėkmingai!

DryTrack notification system is ready to use.
DryTrack pranešimų система paruošta naudojimui.

🔔 You will receive weighing notifications here.
Čia gausite pranešimus apie svėrimą.
    `.trim();
    
    // Отправляем тестовое сообщение
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: testMessage,
        parse_mode: 'HTML'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Telegram] Ошибка тестовой отправки:', errorData);
      
      // Формируем понятное сообщение об ошибке
      let errorMessage = 'Ошибка отправки в Telegram';
      if (errorData.description?.includes('bot was blocked')) {
        errorMessage = 'Бот заблокирован пользователем. Разблокируйте бота и попробуйте снова.';
      } else if (errorData.description?.includes('chat not found')) {
        errorMessage = '❌ ЧАТ НЕ НАЙДЕН!\n\n🔴 ВЫ ЗАБЫЛИ САМЫЙ ВАЖНЫЙ ШАГ:\n\n1️⃣ Откройте Telegram\n2️⃣ Найдите вашего бота по username (например @YourBot)\n3️⃣ ОБЯЗАТЕЛЬНО нажмите кнопку "СТАРТ" или отправьте /start\n4️⃣ После этого вернитесь сюда и нажмите "Тестировать" снова\n\n💡 БЕЗ /start бот не может отправлять сообщения!';
      } else if (errorData.description?.includes('bots can\'t send messages to bots')) {
        errorMessage = 'Нельзя отправлять сообщения другим ботам! Chat ID должен быть вашим личным чатом или группой. Используйте @userinfobot чтобы получить правильный Chat ID.';
      } else if (errorData.description?.includes('Unauthorized')) {
        errorMessage = 'Неверный токен бота. Проверьте правильность токена от @BotFather.';
      }
      
      return c.json({ 
        error: errorMessage, 
        details: errorData 
      }, 400);
    }
    
    const result = await response.json();
    console.log('[Telegram] Тестовое сообщение отправлено успешно:', result);
    
    return c.json({ 
      success: true, 
      message: 'Тестовое сообщение отправлено успешно!',
      messageId: result.result?.message_id
    });
    
  } catch (error: any) {
    console.error('[Telegram] Ошибка тестирования:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Mount Routes
app.route('/make-server-c5bcdb1f', routes);
app.route('/functions/v1/make-server-c5bcdb1f', routes);

// Root health check (без префикса для тестирования)
app.get('/health', (c) => {
  return c.json({ status: "ok", message: "DryTrack server is running" });
});

app.get('/', (c) => {
  return c.json({ 
    status: "ok", 
    message: "DryTrack API Server",
    version: "1.0.0",
    endpoints: [
      '/make-server-c5bcdb1f/health',
      '/make-server-c5bcdb1f/cycles',
      '/make-server-c5bcdb1f/sheets/current-work'
    ]
  });
});

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

// Start server
console.log('[Server] Starting DryTrack server...');
console.log('[Server] Available routes:');
console.log('  - GET /health');
console.log('  - GET /make-server-c5bcdb1f/*');
console.log('  - GET /functions/v1/make-server-c5bcdb1f/*');

Deno.serve(app.fetch);
