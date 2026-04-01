// ✅ MIGRATED TO SQL
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { format, eachDayOfInterval, isBefore, startOfDay, subDays, addDays } from "npm:date-fns";
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

// Supabase Client✅✅✅✅
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET_NAME = "make-c5bcdb1f-drying-chamber-photos";

// ✅✅✅✅✅
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
// ✅✅✅✅✅✅ MIGRATED TO SQL
// Alias для DriverView (экран взвешивания)
// 👉 Этот endpoint отдаёт только необходимые данные для работы оператора
routes.get('/work-cycles', async (c) => {
  try {
    console.log('[WorkCycles] 📥 SQL запрос рабочих циклов');

    const { data, error } = await supabase
      .from('cycles')
      .select(`
        id,
        status,
        chamber_number,
        sequential_number,
        wood_type_lt,
        start_temperature,
        created_at,
        start_date,
        end_date
      `)
      .is('end_date', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[WorkCycles] ❌ SQL ошибка:', error);
      return c.json([]);
    }

    if (!data || data.length === 0) {
      console.log('[WorkCycles] ⚠️ Нет циклов в базе данных');
      return c.json([]);
    }

    const cycles = data.map((row: any) => ({
      id: row.id,
      status: row.status,
      chamberNumber: row.chamber_number,
      sequentialNumber: row.sequential_number,
      woodType: row.wood_type_lt,
      loadingTemp: row.start_temperature,
      createdAt: row.created_at,
      startDate: row.start_date,
      endDate: row.end_date,
    }));

    console.log(`[WorkCycles] ✅ Возвращаем ${cycles.length} циклов`);

    return c.json(cycles);

  } catch (error: any) {
    console.error("[WorkCycles] ❌ Критическая ошибка:", error);

    return c.json(
      { error: error.message || "Failed to fetch work cycles" },
      500
    );
  }
});


// ✅✅✅✅✅✅✅ KV → SQL migration completed
// - Добавлен mapper (camelCase ↔ snake_case)
// - Логика НЕ изменена
// - Статус считается корректно
// - JSON поля работают (photos, weighing_history)
// - Backend теперь готов к масштабированию
// ✅ Преобразование frontend → SQL (camelCase → snake_case)
const toDb = (data: any) => ({
  // ❗ БЕЗ ...data

  final_moisture: data.finalMoisture,
  quality_rating: data.qualityRating,

  result_photos: Array.isArray(data.resultPhotos) 
  ? data.resultPhotos 
  : [],

  start_temperature: data.loadingTemp,
  avg_day_temp: data.avgDayTemp,
  avg_night_temp: data.avgNightTemp,

  chamber_number: data.chamberNumber,
  sequential_number: data.sequentialNumber,

  wood_type_lt: data.woodTypeLt, 

  start_date: data.startDate,
  end_date: data.endDate,

  recipe_photos: Array.isArray(data.recipePhotos)
  ? data.recipePhotos
  : [],

  overall_comment: data.overallComment,
  is_test: data.isTest,

  avg_temp: data.avgTemp,
  max_temp: data.maxTemp,
  min_temp: data.minTemp,

  weighed_at: data.weighedAt
});


// ✅ ИСПРАВЛЕННЫЙ МАППЕР для API Backend
// Этот код нужно добавить в ваш api-routes.ts на сервере (Deno/Supabase Edge Function)

// ✅ Преобразование SQL → frontend (snake_case → camelCase)
const fromDb = (data: any) => {
  const safeArray = (v: any) => Array.isArray(v) ? v : [];

  return {
    // ID и временные метки
    id: data.id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,

    // ✅ ДОБАВЛЕНО: status (критично!)
    status: data.status || 'In Progress',

    // Температуры
    startTemperature: data.start_temperature, // ✅ ИСПРАВЛЕНО: было loadingTemp
    avgDayTemp: data.avg_day_temp,
    avgNightTemp: data.avg_night_temp,
    avgTemp: data.avg_temp ?? null,
    maxTemp: data.max_temp ?? null,
    minTemp: data.min_temp ?? null,

    // Результаты
    finalMoisture: data.final_moisture,
    qualityRating: data.quality_rating,

    // Фотографии (массивы)
    resultPhotos: safeArray(data.result_photos),
    recipePhotos: safeArray(data.recipe_photos),

    // ✅ ДОБАВЛЕНО: старые поля для обратной совместимости
    recipePhotoPath: data.recipe_photo_path || null,
    recipePhotoUrl: data.recipe_photo_url || null,

    // Номера и идентификаторы
    chamberNumber: data.chamber_number,
    sequentialNumber: data.sequential_number || '',

    // ✅ ДОБАВЛЕНО: recipeCode
    recipeCode: data.recipe_code || '',

    // Порода древесины
    woodType: data.wood_type_lt || data.wood_type || '',
    
    // ✅ ДОБАВЛЕНО: customWoodType
    customWoodType: data.custom_wood_type || null,

    // Даты
    startDate: data.start_date,
    endDate: data.end_date,

    // Комментарий
    overallComment: data.overall_comment || null,

    // Флаги
    isTest: Boolean(data.is_test),
    
    // ✅ ДОБАВЛЕНО: isBaseRecipe
    isBaseRecipe: Boolean(data.is_base_recipe),
    
    // ✅ ДОБАВЛЕНО: isFailed (для мокрых/неудачных циклов)
    isFailed: Boolean(data.is_failed),

    // ✅ ДОБАВЛЕНО: погода
    startWeatherCode: data.start_weather_code || null,

    // ✅ ДОБАВЛЕНО: прогресс (из Google Sheets)
    progressPercent: data.progress_percent || null,

    // Дополнительные поля
    weighedAt: data.weighed_at || null,

    // Примечание: weighingHistory загружается отдельно в getCycle по ID
  };
};


routes.get('/cycles', async (c) => {
  try {
    const { data, error } = await supabase
      .from('cycles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SQL] Ошибка получения циклов:', error);
      return c.json({ error: error.message }, 500);
    }

    // ✅ snake_case → camelCase
    const mapped = data.map(fromDb);

    // ✅ ПРОСТО возвращаем
    return c.json(mapped);

  } catch (error: any) {
    console.error('[Cycles] ❌ Ошибка:', error);
    return c.json({ error: error.message }, 500);
  }
});


// ⚠️ LEGACY: используется OperatorView
// ❗ НЕ ТРОГАТЬ пока фронт не переведён на /work-cycles
// TODO: удалить после миграции
routes.get('/cycles/active', async (c) => { 
  const { data, error } = await supabase 
  .from('cycles') 
  .select('*') 
  .eq('status', 'In Progress'); // 🔥 ВОТ ЭТО 
  return c.json(data); 
});

routes.get('/cycles', async (c) => {
  try {
    const limit = Number(c.req.query('limit') || 50);
    const offset = Number(c.req.query('offset') || 0);

    const { data, error } = await supabase
      .from('cycles')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[SQL][GET /cycles] Ошибка:', error);
      return c.json({ error: error.message }, 500);
    }

    const mapped = (data || []).map(fromDb);

    return c.json({
      data: mapped,
      limit,
      offset,
      hasMore: (data || []).length === limit
    });

  } catch (error: any) {
    console.error('[Cycles][GET /cycles] ❌ Ошибка:', error);
    return c.json({ error: error.message }, 500);
  }
});

routes.get('/cycles/:id', async (c) => {
  try {
    const id = c.req.param("id");

    const { data, error } = await supabase
      .from('cycles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return c.json({ error: "Cycle not found" }, 404);
    }

    // ✅ Преобразуем данные в frontend формат
    const cycle = fromDb(data);

    // ✅ Загружаем историю взвешиваний из weighing_records
    const { data: weighingRecords } = await supabase
      .from('weighing_records')
      .select('*')
      .eq('cycle_id', id)
      .order('timestamp', { ascending: true });

    // Преобразуем weighing_records в формат weighingHistory с ПАРСИНГОМ JSON
    if (weighingRecords && weighingRecords.length > 0) {
      cycle.weighingHistory = weighingRecords.map((record: any) => {
        // 🔥 ПАРСИМ JSON поля из БД (PostgreSQL JSONB возвращается как строки)
        let weights = [];
        let recommendationData = null;
        
        try {
          weights = typeof record.weights === 'string' 
            ? JSON.parse(record.weights) 
            : (record.weights || []);
        } catch (e) {
          console.error('[Cycle] Ошибка парсинга weights:', e);
          weights = [];
        }
        
        try {
          recommendationData = typeof record.recommendation_data === 'string'
            ? JSON.parse(record.recommendation_data)
            : record.recommendation_data;
        } catch (e) {
          console.error('[Cycle] Ошибка парсинга recommendation_data:', e);
          recommendationData = null;
        }
        
        return {
          id: record.id, // 🔥 ДОБАВИЛИ ID для удаления!
          timestamp: record.timestamp,
          hoursFromStart: record.hours_from_start,
          hoursSinceLastCheck: record.hours_since_last_check,
          weights: weights,
          totalWeight: record.total_weight,
          weightLimit: record.weight_limit,
          recommendation: record.recommendation,
          recommendationData: recommendationData,
          driverName: record.driver_name
        };
      });
    } else {
      cycle.weighingHistory = [];
    }

    // ✅ Подписываем URL фотографий
    const signedCycle = await signCycleUrls(cycle);

    return c.json(signedCycle);

  } catch (error: any) {
    console.error("Error fetching cycle:", error);
    return c.json({ error: error.message }, 500);
  }
});

routes.post('/cycles', async (c) => {
  try {
    const body = await c.req.json();
    // 🔍 DEBUG: проверяем что приходит с фронта
    console.log('BODY:', body);

    const id = crypto.randomUUID();

    // 🧠 Маппинг + добавление системных полей
    const newCycle = {
      ...toDb(body),
      id,
      created_at: new Date().toISOString(),
      status: 'In Progress'
    };

    const { error } = await supabase
      .from('cycles')
      .insert([newCycle]);

    if (error) {
      console.error('[SQL] Ошибка создания цикла:', error);
      return c.json({ error: error.message }, 500);
    }

    // 📤 Возвращаем обратно в camelCase
    return c.json(fromDb(newCycle));

  } catch (error: any) {
    console.error("Error creating cycle:", error);
    return c.json({ error: error.message }, 500);
  }
});

routes.put('/cycles/:id', async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();

    // 🔍 Получаем текущий цикл
    const { data: existing, error: fetchError } = await supabase
      .from('cycles')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return c.json({ error: "Cycle not found" }, 404);
    }

    // 🔄 Маппим входящие данные
    const mappedBody = Object.fromEntries(
  Object.entries(toDb(body)).filter(([_, v]) => v !== undefined)
);
// 🛡 нормализация даты
if (mappedBody.end_date && typeof mappedBody.end_date === 'string') {
  if (/^\d{2}:\d{2}$/.test(mappedBody.end_date)) {
    const now = new Date();
    const [h, m] = mappedBody.end_date.split(':').map(Number);

    now.setHours(h);
    now.setMinutes(m);
    now.setSeconds(0);

    mappedBody.end_date = now.toISOString();
  }
}
    // 🧠 Объединяем (как раньше в KV)
    const updated = { ...existing, ...mappedBody };

    // ✅ ЛОГИКА СТАТУСА (исправлена под SQL)
    const hasFinalMoisture =
      updated.final_moisture !== null &&
      updated.final_moisture !== undefined;

    const hasRating =
      updated.quality_rating !== null &&
      updated.quality_rating !== undefined;

    const hasResultPhoto =
      updated.result_photos &&
      updated.result_photos.length > 0;

    if (hasFinalMoisture && hasRating && hasResultPhoto) {
      updated.status = "Completed";
    } else {
      updated.status = "In Progress";
    }

    // 🔥 НОВОЕ: Если передан weighingResult - сохраняем взвешивание
    if (body.weighingResult) {
      const weighing = body.weighingResult;
      
      console.log('[Cycle PUT] Сохраняем взвешивание:', weighing);
      console.log('[Cycle PUT] 🔍 weightLimit:', weighing.weightLimit);
      console.log('[Cycle PUT] 🔍 hoursFromStart:', weighing.hoursFromStart);
      
      // 🔥 НОВОЕ: Получаем weight_limit из wood_type_settings
      let finalWeightLimit = weighing.weightLimit;
      let finalHoursFromStart = weighing.hoursFromStart;
      
      // Если weightLimit не передан frontend - берём из wood_type_settings
      if (!finalWeightLimit && existing.wood_type_lt) {
        const { data: woodSettings } = await supabase
          .from('wood_type_settings')
          .select('weight_limit')
          .eq('name', existing.wood_type_lt)
          .single();
        
        if (woodSettings?.weight_limit) {
          finalWeightLimit = parseFloat(woodSettings.weight_limit);
          console.log('[Cycle PUT] ✅ weight_limit из БД:', finalWeightLimit);
        }
      }
      
      // Если hoursFromStart не передан - вычисляем на backend
      if (!finalHoursFromStart && existing.start_date) {
        const now = new Date(weighing.timestamp || new Date().toISOString());
        const startDate = new Date(existing.start_date);
        finalHoursFromStart = Math.round((now.getTime() - startDate.getTime()) / (1000 * 60 * 60));
        console.log('[Cycle PUT] ✅ hours_from_start вычислен:', finalHoursFromStart);
      }
      
      const { error: weighingError } = await supabase
        .from('weighing_records')
        .insert({
          cycle_id: id,
          timestamp: weighing.timestamp || new Date().toISOString(),
          weights: Array.isArray(weighing.weights) 
            ? weighing.weights.map((w: any) => typeof w === 'object' ? w.weight : w)
            : [],
          weight_limit: finalWeightLimit,              // ✅ ИСПРАВЛЕНО
          hours_from_start: finalHoursFromStart,       // ✅ ИСПРАВЛЕНО
          hours_since_last_check: weighing.hoursSinceLastCheck,
          total_weight: weighing.totalWeight,
          recommendation: weighing.recommendation,
          recommendation_data: weighing.recommendationData || null,
          driver_name: weighing.driverName,
          
          // 🔥 ДОБАВЛЕНО: Дополнительные поля из калькулятора
          approved: weighing.approved,
          drying_hours: weighing.dryingHours,
          hours_needed: weighing.hoursNeeded,
          avg_overweight: weighing.avgOverweight,
          warmup_time: weighing.warmupTime,
          end_time: weighing.endTime,
          current_time_value: weighing.currentTime
        });
      
      if (weighingError) {
        console.error('[Cycle PUT] Ошибка сохранения взвешивания:', weighingError);
        // Не прерываем обновление цикла, просто логируем ошибку
      } else {
        console.log('[Cycle PUT] ✅ Взвешивание сохранено');
        
        // 🔥 АВТОМАТИЧЕСКАЯ ОТПРАВКА В TELEGRAM после сохранения взвешивания
        try {
          // Получаем настройки Telegram
          const { data: settingsRow } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'telegram_settings')
            .single();
          
          // Проверяем что Telegram настроен и включён
          if (settingsRow?.value?.enabled && settingsRow.value.botToken && settingsRow.value.chatId) {
            // 🔥 ЗАЩИТА ОТ ДУБЛЕЙ: проверяем кеш
            const cacheKey = `${id}_${weighing.timestamp}`;
            const lastSent = telegramSentCache.get(cacheKey);
            const now = Date.now();
            
            if (lastSent && (now - lastSent) < CACHE_TTL) {
              console.log(`[Cycle PUT] ⏭️ Пропускаем отправку в Telegram (дубль, кеш: ${Math.round((now - lastSent) / 1000)}с назад)`);
            } else {
              console.log('[Cycle PUT] 📤 Отправляем в Telegram...');
              
              // Вызываем внутреннюю функцию отправки
              await sendWeighingToTelegram(id, settingsRow.value);
              
              // Сохраняем в кеш
              telegramSentCache.set(cacheKey, now);
              
              // Очищаем старые записи из кеша (старше 5 минут)
              for (const [key, time] of telegramSentCache.entries()) {
                if (now - time > 300000) {
                  telegramSentCache.delete(key);
                }
              }
              
              console.log('[Cycle PUT] ✅ Telegram отправлен успешно');
            }
          } else {
            console.log('[Cycle PUT] ℹ️ Telegram не настроен или выключен, пропускаем отправку');
          }
        } catch (telegramError: any) {
          console.error('[Cycle PUT] ⚠️ Ошибка Telegram (не критично):', telegramError.message);
          // Не прерываем выполнение, просто логируем
        }
      }
    }

    // 💾 Сохраняем цикл
    const { error: updateError } = await supabase
      .from('cycles')
      .update({
  ...mappedBody,
  status: updated.status
})
      .eq('id', id);

    if (updateError) {
      console.error('[SQL] Ошибка обновления:', updateError);
      return c.json({ error: updateError.message }, 500);
    }

    // 📤 Возвращаем в frontend формате
    return c.json(fromDb(updated));

  } catch (error: any) {
    console.error("Error updating cycle:", error);
    return c.json({ error: error.message }, 500);
  }
});


routes.delete('/cycles/:id/weighings', async (c) => {
  const cycleId = c.req.param('id');

  const { error } = await supabase
    .from('weighing_records')
    .delete()
    .eq('cycle_id', cycleId);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({
    success: true,
    message: 'All weighings deleted'
  });
});

// 🔥 НОВЫЙ: Удаление одного взвешивания по weighingId
routes.delete('/cycles/:cycleId/weighings/:weighingId', async (c) => {
  const weighingId = c.req.param('weighingId');

  console.log('[Delete Weighing] ID:', weighingId);

  const { data, error } = await supabase
    .from('weighing_records')
    .delete()
    .eq('id', weighingId)
    .select()
    .single();

  if (error || !data) {
    console.error('[Delete Weighing] Ошибка:', error);
    return c.json({ error: 'Weighing record not found' }, 404);
  }

  console.log('[Delete Weighing] ✅ Удалено:', data);

  return c.json({
    success: true,
    deleted: data
  });
});

routes.delete('/weighings/:id', async (c) => {
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('weighing_records')
    .delete()
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json({
    success: true,
    deleted: data
  });
});


routes.delete('/cycles/:id', async (c) => {
  try {
    const id = c.req.param("id");

    const { error } = await supabase
      .from('cycles')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[SQL] Ошибка удаления:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true });

  } catch (error: any) {
    console.error("Error deleting cycle:", error);
    return c.json({ error: error.message }, 500);
  }
});

routes.get('/settings/durations', async (c) => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'durations')
      .single();

    // 👉 если нет записи — просто возвращаем пустой объект
    if (error && error.code !== 'PGRST116') {
      console.error('[SQL] Ошибка получения settings:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json(data?.value || {});

  } catch (error: any) {
    console.error("Error fetching settings:", error);
    return c.json({ error: error.message }, 500);
  }
});

routes.post('/settings/durations', async (c) => {
  try {
    const body = await c.req.json();

    const { error } = await supabase
      .from('settings')
      .upsert(
        {
          key: 'durations',
          value: body
        },
        { onConflict: 'key' }
      );

    if (error) {
      console.error('[SQL] Ошибка сохранения settings:', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true });

  } catch (error: any) {
    console.error("Error saving settings:", error);
    return c.json({ error: error.message }, 500);
  }
});

routes.post('/upload', async (c) => {
  try {
    await ensureBucket();

    // ✅ правильный способ получения файла
    const formData = await c.req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No file uploaded" }, 400);
    }

    // ✅ ограничение размера (например 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return c.json({ error: "File too large (max 5MB)" }, 400);
    }

    // ✅ проверка типа файла
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: "Invalid file type" }, 400);
    }

    // ✅ безопасное расширение
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;

    // 💾 загрузка
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false
      });

    if (error) throw error;

    // ✅ можно сразу вернуть публичный URL (удобно фронту)
    const { data: publicUrl } = supabase
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return c.json({
      path: data.path,
      url: publicUrl.publicUrl
    });

  } catch (error: any) {
    console.error("Error uploading file:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ✅✅ НАДО ФИКСИТЬ ✅
routes.post('/weather', async (c) => {
  try {
    const { startDate, endDate } = await c.req.json();

    const startStr = startDate.split('T')[0];
const endStr = endDate.split('T')[0];

const { data, error } = await supabase
  .from('weather')
  .select('*')
  .gte('date', startStr + 'T00:00:00')
  .lte('date', endStr + 'T23:59:59');

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    const weatherData: Record<string, any> = {};

    // ✅ нормализуем даты из SQL (убираем время)
    const existingDates = new Set(
      data.map(d => d.date.split('T')[0])
    );

    // ✅ также нормализуем ключи
    data.forEach(d => {
      const key = d.date.split('T')[0];

      weatherData[key] = {
        temp: d.temp,
        code: d.code
      };
    });

    // 2. Ищем недостающие дни
    const start = new Date(startStr);
    const end = new Date(endStr);
    const days = eachDayOfInterval({ start, end });

    const missing = days.filter(d => {
      const str = format(d, 'yyyy-MM-dd');
      return !existingDates.has(str);
    });

    // ✅ КРИТИЧНО: сортировка
    missing.sort((a, b) => a.getTime() - b.getTime());

    // 3. Если всё есть → сразу возвращаем
    if (missing.length === 0) {
      return c.json(weatherData);
    }

    // 4. Берём только нужный диапазон
    const minDate = format(missing[0], 'yyyy-MM-dd');
    const maxDate = format(missing[missing.length - 1], 'yyyy-MM-dd');

    const url = `https://api.open-meteo.com/v1/forecast?latitude=55.5264&longitude=25.1027&start_date=${minDate}&end_date=${maxDate}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Europe%2FVilnius`;

    const res = await fetch(url);

    if (!res.ok) {
      return c.json(weatherData);
    }

    const apiData = await res.json();
    const toInsert: any[] = [];

    if (apiData.daily) {
      apiData.daily.time.forEach((t: string, i: number) => {
        const max = apiData.daily.temperature_2m_max[i];
        const min = apiData.daily.temperature_2m_min[i];

        if (max !== null && min !== null) {
          const key = t; // уже yyyy-MM-dd

          const val = {
            date: key,
            temp: (max + min) / 2,
            code: apiData.daily.weather_code[i]
          };

          // ✅ сразу кладём в ответ
          weatherData[key] = {
            temp: val.temp,
            code: val.code
          };

          toInsert.push(val);
        }
      });
    }

    // 5. Сохраняем новые данные
    if (toInsert.length > 0) {
      await supabase
        .from('weather')
        .upsert(toInsert, { onConflict: 'date' });
    }

    return c.json(weatherData);

  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});
// ✅✅✅✅✅✅✅✅✅✅✅✅✅✅
// 📊 UPDATE CURRENT WORK (SQL)
//
// Принимает данные по линиям (line1–line3)
// Сохраняет их в current_work через upsert
// Используется как замена старого KV-хранилища
routes.get('/sheets/current-work', async (c) => {
  try {
    console.log('[Sheets] Запрос текущих работ');

    // 🔧 helpers
    const normalize = (v: any) => String(v).trim();

    const getStatus = (cycle: any) => {
      if (cycle.end_date) return "Finished";
      if (cycle.start_date) return "In Progress";
      return "Pending";
    };

    // Helper для безопасного парсинга JSON
    const parseJsonField = (field: any) => {
      if (!field) return [];
      if (Array.isArray(field)) return field;
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch (e) {
          console.error('Failed to parse JSON field:', e);
          return [];
        }
      }
      return [];
    };

    const mapCycle = (cycle: any) => ({
      id: cycle.id,
      sequentialNumber: cycle.sequential_number,
      woodType: cycle.wood_type_lt,
      chamberNumber: cycle.chamber_number,
      startDate: cycle.start_date,
      endDate: cycle.end_date,

      recipePhotos: parseJsonField(cycle.recipe_photos),
      resultPhotos: parseJsonField(cycle.result_photos),
      overallComment: cycle.overall_comment,

      avgTemp: cycle.avg_temp,
      maxTemp: cycle.max_temp,
      minTemp: cycle.min_temp,

      status: getStatus(cycle)
    });

    // 1. current_work
    const { data: rows, error } = await supabase
      .from("current_work")
      .select("*")
      .order("line_number");

    if (error) {
      console.error("❌ SQL ERROR (current_work):", error);
      return c.json({ error }, 500);
    }

    if (!rows || rows.length === 0) {
      return c.json({
        line1: null,
        line2: null,
        line3: null,
        timestamp: null
      });
    }

    // 2. преобразуем current_work
    const data: any = {};

    for (const row of rows) {
      data[`line${row.line_number}`] = {
        rawText: row.raw_text,
        sequentialNumber: normalize(row.sequential_number)
      };
    }

    // 3. timestamp
    const timestamp = rows.reduce((latest, row) => {
      return !latest || row.updated_at > latest ? row.updated_at : latest;
    }, null);

    // 4. cycles
    const { data: cycles, error: cyclesError } = await supabase
      .from("cycles")
      .select("*");

    if (cyclesError) {
      console.error("❌ SQL ERROR (cycles):", cyclesError);
    }

    // 5. map cycles
    const cyclesMap = new Map();

    for (const cycle of cycles || []) {
      if (cycle.sequential_number) {
        cyclesMap.set(normalize(cycle.sequential_number), cycle);
      }
    }

    // 6. собираем currentWork
    const currentWork: any = {};

    for (let i = 1; i <= 3; i++) {
      const line = data[`line${i}`];

      if (!line) {
        currentWork[`line${i}`] = null;
        continue;
      }

      const cycle = cyclesMap.get(normalize(line.sequentialNumber));

      currentWork[`line${i}`] = {
        sequentialNumber: line.sequentialNumber,
        rawText: line.rawText || '',
        cycle: cycle ? mapCycle(cycle) : null // ✅ ВОТ ГЛАВНЫЙ ФИКС
      };
    }

    currentWork.timestamp = timestamp;

    // 7. подписываем URL
    await Promise.all(
      Object.keys(currentWork).map(async (key) => {
        const work = currentWork[key];

        if (work?.cycle) {
          try {
            work.cycle = await signCycleUrls(work.cycle);
          } catch (e) {
            console.error('[Sheets] Ошибка подписания URL:', e);
          }
        }
      })
    );

    console.log("RESULT currentWork:", JSON.stringify(currentWork, null, 2));

    return c.json(currentWork);

  } catch (error: any) {
    console.error('[Sheets] ERROR:', error);

    return c.json({
      line1: null,
      line2: null,
      line3: null,
      timestamp: null
    });
  }
});
routes.post('/sheets/update-current-work', async (c) => {
  try {
    console.log('[Sheets] UPDATE current work');

    const body = await c.req.json();

    console.log('BODY:', body);

    // 🔥 ПАРСИНГ СТРОКИ
    const parseLine = (text: string | null) => {
      if (!text) return null;

      const parts = text.split('/').map(p => p.trim());

      if (parts.length < 3) return null;

      return {
        raw_text: text,
        sequential_number: parts[2] // ← ВАЖНО
      };
    };

    const line1 = parseLine(body.line1);
    const line2 = parseLine(body.line2);
    const line3 = parseLine(body.line3);

    console.log('PARSED:', { line1, line2, line3 });

    if (!line1 && !line2 && !line3) {
      return c.json({
        success: false,
        message: 'No valid data'
      });
    }

    const updates: any[] = [];

    if (line1) {
      updates.push({
        line_number: 1,
        ...line1
      });
    }

    if (line2) {
      updates.push({
        line_number: 2,
        ...line2
      });
    }

    if (line3) {
      updates.push({
        line_number: 3,
        ...line3
      });
    }

    console.log('UPSERT DATA:', updates);

    const { error } = await supabase
      .from('current_work')
      .upsert(updates, { onConflict: 'line_number' });

    if (error) {
      console.error('❌ SQL ERROR:', error);

      return c.json({
        success: false,
        message: error.message
      });
    }

    return c.json({
      success: true
    });

  } catch (error: any) {
    console.error('❌ UPDATE ERROR:', error);

    return c.json({
      success: false,
      message: error.message
    });
  }
});


// Webhook endpoint для приёма данных из Google Sheets
// Когда оператор завершает сушку и в Google Sheets появляется новая строка,
// Apps Script вызывает этот endpoint
async function isRowProcessed(rowNumber: number) {
  const { data, error } = await supabase
    .from('processed_rows')
    .select('row_number')
    .eq('row_number', rowNumber)
    .maybeSingle();

  if (error) {
    console.error('[SQL] Ошибка проверки:', error);
    return false;
  }

  return !!data;
}

async function markRowAsProcessed(rowNumber: number, body: any) {
  const { error } = await supabase
    .from('processed_rows')
    .insert({
      row_number: rowNumber,
      details: body
    });

  if (error) {
    console.error('[SQL] Ошибка записи:', error);
  }
}

// ✅ ВСТАВЛЯЕШЬ СЮДА
async function processSheetRow(body: any) {
  const chamber = Number(body.chamberNumber);
  const old_cycle = String(body.oldSequentialNumber);
  const new_cycle = String(body.newSequentialNumber);
  const finish_time = body.oldCycleEndDate;
  const start_time = body.newCycleStartDate;
  const wood_lt = body.woodTypeLithuanian;


  console.log('[SQL] Обработка строки:', body);

  const { error: closeError } = await supabase
    .from('cycles')
    .update({
      status: 'Completed',
      end_date: finish_time
    })
    .eq('sequential_number', old_cycle);

  if (closeError) throw closeError;

  const { error: createError } = await supabase
    .from('cycles')
    .insert({
      chamber_number: chamber,
      sequential_number: new_cycle,
      wood_type_lt: wood_lt,
      start_date: start_time,
      status: 'In Progress'
    });

  if (createError && createError.code !== '23505') {
    throw createError;
  }

  await supabase.from('sync_logs').insert({
    action: 'cycle_switch',
    chamber_number: chamber,
    sequential_number: new_cycle,
    success: true,
    message: `Цикл ${old_cycle} → ${new_cycle}`,
    details: body
  });

  console.log('[SQL] ✅ Готово');
}

routes.post('/sheets/process-row', async (c) => {
  try {
    const body = await c.req.json();

    console.log('[Sheets] Получен запрос:', body);

    // ✅ нормализация типов
    const rowNumber = Number(body.rowNumber);
    const chamberNumber = Number(body.chamberNumber);

    // ✅ ВАЛИДАЦИЯ (простая и надежная)
    if (
  !rowNumber ||
  !chamberNumber ||
  !body.oldSequentialNumber ||
  !body.newSequentialNumber ||
  !body.oldCycleEndDate ||
  !body.newCycleStartDate ||
  !body.woodTypeLithuanian
) {
      console.log('[Sheets] ❌ Ошибка валидации:', body);

      return c.json({
        error: 'Отсутствуют обязательные поля'
      }, 400);
    }

    // ✅ Проверка дубля
    const alreadyProcessed = await isRowProcessed(rowNumber);
    if (alreadyProcessed) {
      console.log(`[Sheets] Строка ${rowNumber} уже обработана`);
      return c.json({
        success: true,
        skipped: true
      });
    }

    // 🔥 ЛОГИКА (через SQL)
    await processSheetRow(body);

    // ✅ фиксируем обработку
    await markRowAsProcessed(rowNumber, body);

    console.log(`[Sheets] ✅ Готово: ${rowNumber}`);

    return c.json({
      success: true,
      rowNumber
    });

  } catch (error: any) {
    console.error('[Sheets] ❌ Ошибка:', error);

    return c.json({
      error: error.message
    }, 500);
  }
});

// Получить последние логи синхронизации ✅ 
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

// Проверить статус обработки строки ✅ 
routes.get('/sheets/row-status/:rowNumber', async (c) => {
  try {
    const rowNumber = parseInt(c.req.param('rowNumber'));

    const { data, error } = await supabase
      .from('processed_rows')
      .select('*')
      .eq('row_number', rowNumber)
      .maybeSingle();

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    return c.json({ 
      processed: !!data,
      data
    });

  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Сброс татуса обработки строки (для повторного тестирования) ✅ 
routes.delete('/sheets/reset-row/:rowNumber', async (c) => {
  try {
    const rowNumber = parseInt(c.req.param('rowNumber'));
    
    console.log(`[Sheets] Сброс статуса строки ${rowNumber}`);
    
    // Удаляем метку обработки ✅ 
    await supabase
  .from('processed_rows')
  .delete()
  .eq('row_number', rowNumber);
    
    return c.json({ 
      success: true, 
      message: `Статус строки ${rowNumber} сброшен. Теперь её можно обработать снова.` 
    });
  } catch (error: any) {
    console.error('[Sheets] Ошибка сброса статуса строки:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Получить список всех обработанных строк ✅ 
routes.get('/sheets/processed-rows', async (c) => {
  try {
    const { data, error } = await supabase
      .from('processed_rows')
      .select('*')
      .order('row_number', { ascending: false });

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    return c.json({ 
      rows: data,
      count: data.length
    });

  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Очистить все обработанные строки (для массового тестированя) ✅ 
routes.post('/sheets/clear-processed', async (c) => {
  try {
    const { error } = await supabase
      .from('processed_rows')
      .delete()
      .neq('row_number', 0); // удалить всё

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    return c.json({ 
      success: true,
      message: 'Все строки очищены'
    });

  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// НОВЫЙ: Удалить дубликаы циклов по порядковому номеру (оставить только последний) ✅ 
routes.delete('/sheets/remove-duplicates/:sequentialNumber', async (c) => {
  return c.json({ message: 'disabled for now' });
});

// Ручная синхронизация (для тестирвания) ✅ 
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


// НОВЫЙ: Получить настройки пород дерева ✅ 
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

    // 🔥 ВАЖНО: конвертация в старый формат
    const formatted = data.map((item: any) => ({
      name: item.name,
      warmupTime: item.warmup_time,
      weightLimit: item.weight_limit,
      dryingRateTime: item.drying_rate_time,
    }));

    console.log('[WoodSettings] Найдены настройки:', formatted.length);
    return c.json(formatted);

  } catch (error: any) {
    console.error('[WoodSettings] Ошибка получения:', error);
    return c.json([]);
  }
});

// НОВЫЙ: Сохранить настройки пород дерева ✅ 
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
  console.log('🔥 POST /wood-settings CALLED');
});

// Проверка общего пароля приложения ✅ 
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

// Проверка пароля администратора ✅ 
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

// Обновить настройки паролей (только для админа) ✅ 
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
// Получить настройки Telegram (только для админа) ✅ 
async function getSetting(key: string, defaultValue: any = null) {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    console.error('[Settings] Ошибка получения:', error);
    return defaultValue;
  }

  return data?.value ?? defaultValue;
}

async function setSetting(key: string, value: any) {
  const { error } = await supabase
    .from('settings')
    .upsert({
      key,
      value
    });

  if (error) {
    console.error('[Settings] Ошибка сохранения:', error);
    throw error;
  }
}
// Получить настройки Telegram (только для админа)
routes.get('/telegram-settings', async (c) => {
  try {
    const settings = await getSetting('telegram_settings', {
      botToken: '',
      chatId: '',
      enabled: false
    });

    return c.json({
      ...settings,
      botToken: settings.botToken ? '******' : ''
    });

  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Сохранить настройки Telegram (только для админа)  ✅ 
routes.post('/telegram-settings', async (c) => {
  try {
    const { botToken, chatId, enabled } = await c.req.json();

    const current = await getSetting('telegram_settings', {});

    const newSettings = {
      botToken: botToken ?? current.botToken ?? '',
      chatId: chatId ?? current.chatId ?? '',
      enabled: enabled ?? current.enabled ?? false
    };

    await setSetting('telegram_settings', newSettings);

    return c.json({ success: true });

  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// 🔥 HELPER: Отправка взвешивания в Telegram (вынесена в отдельную функцию)
async function sendWeighingToTelegram(cycleId: string, telegramSettings: any) {
  try {
    const callId = Math.random().toString(36).substring(7);
    console.log(`[Telegram:${callId}] 📤 Начало отправки для цикла:`, cycleId);
    
    // 1. Получаем цикл
    const { data: cycle, error: cycleError } = await supabase
      .from('cycles')
      .select('*')
      .eq('id', cycleId)
      .single();

    if (cycleError || !cycle) {
      console.error('[Telegram] ❌ Цикл не найден:', cycleError);
      return;
    }
    
    // 🔥 ПРОВЕРКА: chamber_number должен существовать
    if (!cycle.chamber_number) {
      console.error('[Telegram] ❌ У цикла отсутствует chamber_number!');
      return;
    }

    // 2. ЧИТАЕМ ПОСЛЕДНЕЕ ВЗВЕШИВАНИЕ ИЗ БД
    const { data: latestWeighings, error: latestError } = await supabase
      .from('weighing_records')
      .select('*')
      .eq('cycle_id', cycleId)
      .order('timestamp', { ascending: false })
      .limit(1);

    if (latestError || !latestWeighings || latestWeighings.length === 0) {
      console.error('[Telegram] ❌ Взвешивание не найдено:', latestError);
      return;
    }

    const savedRecord = latestWeighings[0];
    
    console.log('[Telegram] ✅ Используем взвешивание из БД:', savedRecord.id);
    
    // 3. ПАРСИМ JSON поля из БД
    let weights = [];
    let recommendationData = null;
    
    try {
      weights = typeof savedRecord.weights === 'string' 
        ? JSON.parse(savedRecord.weights) 
        : (savedRecord.weights || []);
    } catch (e) {
      console.error('[Telegram] Ошибка парсинга weights:', e);
      weights = [];
    }
    
    try {
      recommendationData = typeof savedRecord.recommendation_data === 'string'
        ? JSON.parse(savedRecord.recommendation_data)
        : savedRecord.recommendation_data;
    } catch (e) {
      console.error('[Telegram] Ошибка парсинга recommendation_data:', e);
      recommendationData = null;
    }
    
    // 🔥 НОВОЕ: Вычисляем hoursFromStart и weightLimit если они NULL
    let hoursFromStart = savedRecord.hours_from_start;
    let weightLimit = savedRecord.weight_limit;
    
    // Если hoursFromStart == NULL - вычисляем
    if (!hoursFromStart && cycle.start_date) {
      const now = new Date(savedRecord.timestamp);
      const startDate = new Date(cycle.start_date);
      hoursFromStart = Math.round((now.getTime() - startDate.getTime()) / (1000 * 60 * 60));
      console.log('[Telegram] ⚠️ hours_from_start был NULL, вычислили:', hoursFromStart);
    }
    
    // Если weightLimit == NULL - берём из wood_type_settings
    if (!weightLimit && cycle.wood_type_lt) {
      const { data: woodSettings } = await supabase
        .from('wood_type_settings')
        .select('weight_limit')
        .eq('name', cycle.wood_type_lt)
        .single();
      
      if (woodSettings?.weight_limit) {
        weightLimit = parseFloat(woodSettings.weight_limit);
        console.log('[Telegram] ⚠️ weight_limit был NULL, взяли из БД:', weightLimit);
      } else {
        weightLimit = 0; // fallback
      }
    }
    
    if (!weightLimit) weightLimit = 0; // final fallback

    // 4. Предыдущее взвешивание
    const { data: previousWeighings } = await supabase
      .from('weighing_records')
      .select('*')
      .eq('cycle_id', cycleId)
      .lt('timestamp', savedRecord.timestamp)
      .order('timestamp', { ascending: false })
      .limit(1);

    const previousWeighing = previousWeighings?.[0];

    // 5. Время
    const lithuanianTime = new Date(savedRecord.timestamp).toLocaleString('lt-LT', {
      timeZone: 'Europe/Vilnius',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    // 6. 3 ближайших ящика
    const getClosest3Boxes = (boxes: number[]) => {
      if (boxes.length <= 3) return boxes;

      const sorted = [...boxes].sort((a, b) => a - b);

      let minDiff = Infinity;
      let bestStart = 0;

      for (let i = 0; i <= sorted.length - 3; i++) {
        const diff = sorted[i + 2] - sorted[i];
        if (diff < minDiff) {
          minDiff = diff;
          bestStart = i;
        }
      }

      return [sorted[bestStart], sorted[bestStart + 1], sorted[bestStart + 2]];
    };

    // 7. Средний вес
    const closest3Current = getClosest3Boxes(weights);
    const averageWeight = (
      closest3Current.reduce((sum, w) => sum + w, 0) / 3
    ).toFixed(2);

    // 8. Список коробок
    const boxList = weights
      .map((w: number) => {
        const emoji = w <= weightLimit ? '✅' : '❌';
        return `📦 ${w}t ${emoji}`;
      })
      .join('\n');

    // 9. Рекомендация
    let recommendationText = '';
    
    // Добавляем информацию о перегрузе
    if (savedRecord.avg_overweight && parseFloat(savedRecord.avg_overweight) > 0) {
      recommendationText += `\n\n⚠️ Persvara: ${parseFloat(savedRecord.avg_overweight).toFixed(2)}t`;
    }

    if (recommendationData) {
      if (recommendationData.type === 'approved') {
        recommendationText += '\n✅ GATAVA RINKTI!';
      } else {
        if (savedRecord.hours_needed) {
          recommendationText += `\n⏰ Rekomenduojama dosušiti: ${savedRecord.hours_needed}val`;
        }
        if (savedRecord.current_time_value && savedRecord.end_time) {
          recommendationText += `\n🕐 ${savedRecord.current_time_value} → ${savedRecord.end_time}`;
        }
      }
    }

    // 10. Изменение веса
    let changeInfo = '';

    if (previousWeighing) {
      let prevWeights = [];
      try {
        prevWeights = typeof previousWeighing.weights === 'string'
          ? JSON.parse(previousWeighing.weights)
          : (previousWeighing.weights || []);
      } catch (e) {
        console.error('[Telegram] Ошибка парсинга prevWeights:', e);
      }

      const timeDiff =
        (new Date(savedRecord.timestamp).getTime() -
          new Date(previousWeighing.timestamp).getTime()) /
        (1000 * 60 * 60);

      const closest3Prev = getClosest3Boxes(prevWeights);

      const prevAvg =
        closest3Prev.reduce((sum: number, w: number) => sum + w, 0) / 3;

      const currAvg = parseFloat(averageWeight);

      const weightLoss = prevAvg - currAvg;
      const lossRate = timeDiff > 0 ? weightLoss / timeDiff : 0;

      if (weightLoss > 0) {
        changeInfo =
          `\n\n📉 ${prevAvg.toFixed(2)}t → ${averageWeight}t (-${weightLoss.toFixed(2)}t per ${timeDiff.toFixed(1)}val)` +
          `\n⚡️ Greitis: ${lossRate.toFixed(3)}t/val`;
      }
    }

    // 11. Сообщение
    const message = `📦 ${cycle.chamber_number}

📅 ${lithuanianTime}
⏱ ${hoursFromStart || '?'}val nuo pradžios
🌲 ${cycle.wood_type_lt} (#${cycle.sequential_number})
🎯 Tikslas: ${weightLimit || 0}t/dėžė

Rezultatas:
${boxList}${changeInfo}${recommendationText}`.trim();

    // 12. Telegram send
    const response = await fetch(
      `https://api.telegram.org/bot${telegramSettings.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramSettings.chatId,
          text: message,
          parse_mode: 'HTML'
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Telegram] ❌ Ошибка:', errorData);
      throw new Error('Telegram API error');
    }

    const result = await response.json();
    console.log(`[Telegram:${callId}] ✅ Сообщение отправлено! Message ID:`, result.result?.message_id);

  } catch (error: any) {
    console.error('[Telegram] ❌ Ошибка отправки:', error.message);
    throw error;
  }
}

// Отправить информацию о взвешивании в Telegram 
routes.post('/send-telegram-weighing', async (c) => {
  try {
    const { cycleId, weighingRecord } = await c.req.json();

    if (!cycleId || !weighingRecord) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    console.log('[Telegram] Отправка взвешивания:', cycleId);

    // ✅ 1. Telegram settings
    const { data: settingsRow, error: settingsError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'telegram_settings')
      .single();

    if (settingsError || !settingsRow?.value) {
      return c.json({ error: 'Telegram settings not found' }, 404);
    }

    const settings = settingsRow.value;

    if (!settings.enabled || !settings.botToken || !settings.chatId) {
      return c.json({ error: 'Telegram not configured' }, 400);
    }

    // ✅ 2. Cycle
    const { data: cycle, error: cycleError } = await supabase
      .from('cycles')
      .select('*')
      .eq('id', cycleId)
      .single();

    if (cycleError || !cycle) {
      return c.json({ error: 'Цикл не найден' }, 404);
    }

    // ✅ 3. ЧИТАЕМ ПОСЛЕДНЕЕ ВЗВЕШИВАНИЕ ИЗ БД (НЕ ВСТАВЛЯЕМ!)
    const { data: latestWeighings, error: latestError } = await supabase
      .from('weighing_records')
      .select('*')
      .eq('cycle_id', cycleId)
      .order('timestamp', { ascending: false })
      .limit(1);

    if (latestError || !latestWeighings || latestWeighings.length === 0) {
      console.error('[Telegram] Взвешивание не найдено:', latestError);
      return c.json({ error: 'Взвешивание не найдено в базе данных' }, 404);
    }

    const savedRecord = latestWeighings[0];
    
    console.log('[Telegram] Используем взвешивание из БД:', savedRecord.id);
    
    // 🔥 ПАРСИМ JSON поля из БД
    let weights = [];
    let recommendationData = null;
    
    try {
      weights = typeof savedRecord.weights === 'string' 
        ? JSON.parse(savedRecord.weights) 
        : (savedRecord.weights || []);
    } catch (e) {
      console.error('[Telegram] Ошибка парсинга weights:', e);
      weights = [];
    }
    
    try {
      recommendationData = typeof savedRecord.recommendation_data === 'string'
        ? JSON.parse(savedRecord.recommendation_data)
        : savedRecord.recommendation_data;
    } catch (e) {
      console.error('[Telegram] Ошибка парсинга recommendation_data:', e);
      recommendationData = null;
    }
    
    const hoursFromStart = savedRecord.hours_from_start;
    const weightLimit = savedRecord.weight_limit || 0;

    // ✅ 4. Предыдущее взвешивание (SQL вместо weighingHistory)
    const { data: previousWeighings } = await supabase
      .from('weighing_records')
      .select('*')
      .eq('cycle_id', cycleId)
      .lt('timestamp', savedRecord.timestamp)
      .order('timestamp', { ascending: false })
      .limit(1);

    const previousWeighing = previousWeighings?.[0];

    // ✅ 5. Время
    const lithuanianTime = new Date(savedRecord.timestamp).toLocaleString('lt-LT', {
      timeZone: 'Europe/Vilnius',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    // ✅ 6. 3 ближайших ящика
    const getClosest3Boxes = (boxes: number[]) => {
      if (boxes.length <= 3) return boxes;

      const sorted = [...boxes].sort((a, b) => a - b);

      let minDiff = Infinity;
      let bestStart = 0;

      for (let i = 0; i <= sorted.length - 3; i++) {
        const diff = sorted[i + 2] - sorted[i];
        if (diff < minDiff) {
          minDiff = diff;
          bestStart = i;
        }
      }

      return [sorted[bestStart], sorted[bestStart + 1], sorted[bestStart + 2]];
    };

    // ✅ 7. Средний вес
    const closest3Current = getClosest3Boxes(weights);
    const averageWeight = (
      closest3Current.reduce((sum, w) => sum + w, 0) / 3
    ).toFixed(2);

    // ✅ 8. Список коробок
    const boxList = weights
      .map((w: number) => {
        const emoji = w <= weightLimit ? '✅' : '❌';
        return `📦 ${w}t ${emoji}`;
      })
      .join('\n');

    // ✅ 9. Рекомендация
    let recommendationText = '';

    if (recommendationData) {
      if (recommendationData.type === 'approved') {
        recommendationText = '\n\n✅ GATAVA RINKTI!';
      } else {
        recommendationText =
          `\n\n⏳ Tęsti +${recommendationData.hoursNeeded}val (iki ${recommendationData.endTime})`;
      }
    }

    // ✅ 10. Изменение веса
    let changeInfo = '';

    if (previousWeighing) {
      const prevWeights = previousWeighing.weights || [];

      const timeDiff =
        (new Date(weighingRecord.timestamp).getTime() -
          new Date(previousWeighing.timestamp).getTime()) /
        (1000 * 60 * 60);

      const closest3Prev = getClosest3Boxes(prevWeights);

      const prevAvg =
        closest3Prev.reduce((sum: number, w: number) => sum + w, 0) / 3;

      const currAvg = parseFloat(averageWeight);

      const weightLoss = prevAvg - currAvg;
      const lossRate = timeDiff > 0 ? weightLoss / timeDiff : 0;

      if (weightLoss > 0) {
        changeInfo =
          `\n\n📉 ${prevAvg.toFixed(2)}t → ${averageWeight}t (-${weightLoss.toFixed(2)}t per ${timeDiff.toFixed(1)}val)` +
          `\n⚡️ Greitis: ${lossRate.toFixed(3)}t/val`;
      }
    }

    // ✅ 11. Сообщение
    const message = `<b>📦 ${cycle.chamber_number}</b>

📅 ${lithuanianTime}
⏱ ${hoursFromStart}val nuo pradžios
🌲 ${cycle.wood_type_lt} (#${cycle.sequential_number})
🎯 Tikslas: ${weightLimit}t/dėžė

<b>Rezultatas:</b>
${boxList}${changeInfo}${recommendationText}`.trim();

    // ✅ 12. Telegram send
    const response = await fetch(
      `https://api.telegram.org/bot${settings.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: settings.chatId,
          text: message,
          parse_mode: 'HTML'
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Telegram] Ошибка:', errorData);
      return c.json({ error: 'Ошибка отправки в Telegram', details: errorData }, 500);
    }

    const result = await response.json();

    return c.json({
      success: true,
      messageId: result.result?.message_id
    });

  } catch (error: any) {
    console.error('[Telegram] ERROR:', error);
    return c.json({ error: error.message }, 500);
  }
});
    

routes.post('/test-telegram', async (c) => {
  try {
    const { botToken, chatId } = await c.req.json();

    if (!botToken || !chatId) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const testMessage = `
🧪 <b>TEST MESSAGE / TESTINIS PRANEŠIMAS</b>

✅ <b>Telegram bot configured successfully!</b>
Telegram botas sukonfigūruotas sėkmingai!

DryTrack notification system is ready to use.
Sistema paruošta naudojimui.

🔔 You will receive weighing notifications here.
Čia gausite svėrimo pranešimus.
    `.trim();

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: testMessage,
          parse_mode: 'HTML'
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return c.json({ error: 'Telegram error', details: errorData }, 500);
    }

    return c.json({ success: true });

  } catch (error: any) {
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
