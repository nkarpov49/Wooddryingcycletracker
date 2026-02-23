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

routes.get('/cycles', async (c) => {
  try {
    const cycles = await kv.getByPrefix("cycle_");
    const signedCycles = await Promise.all(cycles.map(async (cycle: any) => {
      return await signCycleUrls(cycle);
    }));
    signedCycles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json(signedCycles);
  } catch (error: any) {
    console.error("Error fetching cycles:", error);
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

// Webhook endpoint для приёма данных из Google Sheets
// Когда оператор завершает сушку и в Google Sheets появляется новая строка,
// Apps Script вызывает этот endpoint
routes.post('/sheets/process-row', async (c) => {
  try {
    const body = await c.req.json() as GoogleSheetRow;
    
    console.log('[Sheets] Получен запрос на обработку строки:', body);
    
    // Проверяем обязательные поля
    if (!body.rowNumber || !body.chamberNumber || !body.oldSequentialNumber || !body.newSequentialNumber) {
      return c.json({ error: 'Отсутствуют обязательные поля' }, 400);
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
    // Процесс может занять 2-3 минуты из-за задержки
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
      rowNumber: body.rowNumber,
      estimatedTime: '2-3 минуты'
    });
    
  } catch (error: any) {
    console.error('[Sheets] Ошибка в endpoint process-row:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Получить логи последних синхронизаций
routes.get('/sheets/sync-logs', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10');
    const logs = await getRecentSyncLogs(limit);
    return c.json({ logs, count: logs.length });
  } catch (error: any) {
    console.error('[Sheets] Ошибка получения логов:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Проверить статус обработки строки
routes.get('/sheets/row-status/:rowNumber', async (c) => {
  try {
    const rowNumber = parseInt(c.req.param('rowNumber'));
    const processed = await isRowProcessed(rowNumber);
    
    if (processed) {
      const details = await kv.get(`processed_row_${rowNumber}`);
      return c.json({ processed: true, details });
    }
    
    return c.json({ processed: false });
  } catch (error: any) {
    console.error('[Sheets] Ошибка проверки статуса строки:', error);
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

// Mount Routes
app.route('/make-server-c5bcdb1f', routes);
app.route('/functions/v1/make-server-c5bcdb1f', routes);

Deno.serve(app.fetch);