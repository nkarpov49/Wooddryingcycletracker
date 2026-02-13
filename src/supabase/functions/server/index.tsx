import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { format, eachDayOfInterval, isBefore, startOfDay, subDays, addDays } from "npm:date-fns";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Supabase Client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = "make-c5bcdb1f-drying-chamber-photos";

// Helper to ensure bucket exists
async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
  if (!bucketExists) {
    await supabase.storage.createBucket(BUCKET_NAME);
  }
}

// Helper to sign URLs in cycle data
async function signCycleUrls(cycle: any) {
  // Helper to extract path from expired URL if path is missing
  const extractPathFromUrl = (url: string) => {
    try {
      if (!url) return null;
      // Pattern: /storage/v1/object/sign/make-c5bcdb1f-drying-chamber-photos/filename.ext?token=...
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
    const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(cycle.recipePhotoPath, 3600 * 24); // 24 hours
    cycle.recipePhotoUrl = data?.signedUrl;
  }
  
  // Sign Recipe Photos Array (New)
  if (cycle.recipePhotos && Array.isArray(cycle.recipePhotos)) {
    for (const photo of cycle.recipePhotos) {
      // Recovery for missing path in recipePhotos
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
  
  // Fix for missing path in resultPhotos (legacy data recovery)
  if (cycle.resultPhotos && Array.isArray(cycle.resultPhotos)) {
    for (const photo of cycle.resultPhotos) {
      if (!photo.path && photo.url && photo.url.includes(BUCKET_NAME)) {
        const recoveredPath = extractPathFromUrl(photo.url);
        if (recoveredPath) {
            photo.path = recoveredPath; // Add path for future
        }
      }
      
      if (photo.path) {
        const { data } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(photo.path, 3600 * 24);
        photo.url = data?.signedUrl;
      }
    }
  }
  return cycle;
}

// Health check
app.get("/make-server-c5bcdb1f/health", (c) => {
  return c.json({ status: "ok" });
});

// GET all cycles
app.get("/make-server-c5bcdb1f/cycles", async (c) => {
  try {
    const cycles = await kv.getByPrefix("cycle_");
    
    // Parse JSON values if they are strings (kv store might return objects or strings depending on implementation, usually objects if set as objects)
    // The kv_store implementation likely handles JSON.stringify/parse or the underlying store does.
    // Assuming objects.
    
    const signedCycles = await Promise.all(cycles.map(async (cycle: any) => {
      // cycle is the stored data object directly
      return await signCycleUrls(cycle);
    }));

    // Sort by created date descending
    signedCycles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json(signedCycles);
  } catch (error) {
    console.error("Error fetching cycles:", error);
    return c.json({ error: error.message }, 500);
  }
});

// POST new cycle
app.post("/make-server-c5bcdb1f/cycles", async (c) => {
  try {
    const body = await c.req.json();
    const id = crypto.randomUUID();
    const newCycle = {
      ...body,
      id,
      createdAt: new Date().toISOString(),
      status: 'In Progress' // Default
    };
    
    await kv.set(`cycle_${id}`, newCycle);
    return c.json(newCycle);
  } catch (error) {
    console.error("Error creating cycle:", error);
    return c.json({ error: error.message }, 500);
  }
});

// PUT update cycle
app.put("/make-server-c5bcdb1f/cycles/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    // Get existing to preserve immutable fields if needed, or just overwrite
    const existing = await kv.get(`cycle_${id}`);
    if (!existing) {
      return c.json({ error: "Cycle not found" }, 404);
    }
    
    const updated = {
      ...existing,
      ...body,
      id // Ensure ID doesn't change
    };
    
    // Auto-calculate status
    // "Completed" when Final Moisture + Quality Rating + at least one result photo are present
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
  } catch (error) {
    console.error("Error updating cycle:", error);
    return c.json({ error: error.message }, 500);
  }
});

// DELETE cycle
app.delete("/make-server-c5bcdb1f/cycles/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`cycle_${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting cycle:", error);
    return c.json({ error: error.message }, 500);
  }
});

// GET wood durations
app.get("/make-server-c5bcdb1f/settings/durations", async (c) => {
  try {
    const data = await kv.get("settings_durations");
    return c.json(data || {});
  } catch (error) {
    console.error("Error fetching settings:", error);
    return c.json({ error: error.message }, 500);
  }
});

// POST wood durations
app.post("/make-server-c5bcdb1f/settings/durations", async (c) => {
  try {
    const body = await c.req.json();
    await kv.set("settings_durations", body);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error saving settings:", error);
    return c.json({ error: error.message }, 500);
  }
});

// POST upload file
app.post("/make-server-c5bcdb1f/upload", async (c) => {
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

    // Return the path, frontend will need signed URL later
    return c.json({ path: data.path });
  } catch (error) {
    console.error("Error uploading file:", error);
    return c.json({ error: error.message }, 500);
  }
});

// GET/POST weather with caching
app.post("/make-server-c5bcdb1f/weather", async (c) => {
  try {
    const { startDate, endDate } = await c.req.json();
    if (!startDate || !endDate) {
      return c.json({ error: "Missing dates" }, 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = startOfDay(new Date());
    const days = eachDayOfInterval({ start, end });
    
    // 1. Check KV for cached data
    const weatherData: Record<string, { temp: number, code: number }> = {};
    const missingDays: Date[] = [];

    // Parallel fetch from KV is not supported by provided kv_store (only get, no mget). 
    // We have to loop. `getByPrefix` might be inefficient if we have tons of keys, 
    // but maybe `getByPrefix("weather_")` is better if we have a lot?
    // Actually, getting all weather history ever might be too much.
    // Let's do parallel individual gets.
    
    await Promise.all(days.map(async (day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      // Only check cache for past days
      if (isBefore(day, today)) {
        const cached = await kv.get(`weather_${dateStr}`);
        if (cached) {
          weatherData[dateStr] = cached;
        } else {
          missingDays.push(day);
        }
      } else {
        // Future/Today: always fetch fresh
        missingDays.push(day);
      }
    }));

    // 2. Fetch missing data
    if (missingDays.length > 0) {
      // We need to fetch range(s). For simplicity, let's fetch the bounding box of missing days 
      // OR just fetch the original requested range from API if we have gaps, but strictly filter what we need?
      // Optimization: Fetch the whole originally requested range from Open-Meteo if there are ANY missing days,
      // because Open-Meteo is fast and handling multiple fragmented time windows is complex.
      // Then fill in the gaps.
      
      // Actually, we should be careful not to overwrite valid cache with potentially null data if API fails?
      // But we trust API.

      // We need to split into "Archive" (old) and "Forecast" (recent/future) if needed?
      // Open-Meteo Forecast API covers past 92 days.
      // Archive API covers everything but has 5 day delay.
      // Strategy:
      // - If day is > 5 days ago: Use Archive (or Forecast Past if < 92 days).
      // - If day is recent: Use Forecast.
      // Simple logic: Use Forecast API for everything if possible (last 3 months).
      // If we need older than 3 months, use Archive.
      
      // Let's split missing days into "Old" (older than 90 days) and "Recent" (last 90 days + future).
      const ninetyDaysAgo = subDays(today, 90);
      
      const oldDays = missingDays.filter(d => isBefore(d, ninetyDaysAgo));
      const recentDays = missingDays.filter(d => !isBefore(d, ninetyDaysAgo));

      // Fetch Old (Archive)
      if (oldDays.length > 0) {
        // Find min/max of oldDays to form a range
        const minDate = oldDays.reduce((a, b) => (a < b ? a : b));
        const maxDate = oldDays.reduce((a, b) => (a > b ? a : b));
        
        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=55.5264&longitude=25.1027&start_date=${format(minDate, 'yyyy-MM-dd')}&end_date=${format(maxDate, 'yyyy-MM-dd')}&daily=temperature_2m_mean,weather_code&timezone=Europe%2FVilnius`;
        const res = await fetch(url);
        if (res.ok) {
           const data = await res.json();
           if (data.daily) {
             data.daily.time.forEach((t: string, i: number) => {
               if (data.daily.temperature_2m_mean[i] !== null) {
                 const val = {
                   temp: data.daily.temperature_2m_mean[i],
                   code: data.daily.weather_code[i]
                 };
                 weatherData[t] = val;
                 // Cache it!
                 kv.set(`weather_${t}`, val);
               }
             });
           }
        }
      }

      // Fetch Recent (Forecast)
      if (recentDays.length > 0) {
        const minDate = recentDays.reduce((a, b) => (a < b ? a : b));
        const maxDate = recentDays.reduce((a, b) => (a > b ? a : b));
        
        // Clamp maxDate to today + 10 to avoid error
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
                            const val = {
                                temp: (max + min) / 2,
                                code: data.daily.weather_code[i]
                            };
                            weatherData[t] = val;
                            
                            // Cache ONLY if it is strictly in the past
                            // t is YYYY-MM-DD. 
                            const d = new Date(t);
                            // Be careful with timezones. t is just date string.
                            // If we construct new Date(t), it's UTC 00:00. 'today' is local 00:00?
                            // 'today' variable above is `startOfDay(new Date())` (server time).
                            // Let's string compare.
                            if (t < format(today, 'yyyy-MM-dd')) {
                                kv.set(`weather_${t}`, val);
                            }
                        }
                    });
                }
            }
        }
      }
    }

    return c.json(weatherData);

  } catch (error) {
    console.error("Error fetching weather:", error);
    return c.json({ error: error.message }, 500);
  }
});

Deno.serve(app.fetch);
