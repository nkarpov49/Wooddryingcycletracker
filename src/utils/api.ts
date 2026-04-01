import { projectId, publicAnonKey } from '../utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-c5bcdb1f`;

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 DryTrack API Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Project ID: ${projectId}
🔗 Base URL: ${BASE_URL}
🔑 Auth Key: ${publicAnonKey.substring(0, 30)}...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

export interface CyclePhoto {
  path: string;
  url?: string;
  caption?: string;
}

export interface WeighingRecord {
  id?: string; // 🔥 ДОБАВЛЕНО: ID взвешивания из БД
  timestamp: string; // ISO дата и время взвешивания
  hoursFromStart: number; // Часов с момента старта цикла
  hoursSinceLastCheck?: number; // Часов с последней проверки (если не первое)
  weights: number[]; // Массив весов ящиков в тоннах
  totalWeight: number; // Общий вес (сумма)
  recommendation?: string; // Старый формат: текстовая рекомендация (для обратной совместимости)
  recommendationData?: {  // Новый формат: структурированные данные
    type: 'approved' | 'continue';
    hoursNeeded?: number;
    endTime?: string;
  };
  driverName?: string; // Кто взвешивал (опционально)
  weightLimit?: number; // Целевой вес (допуск) в тоннах для этого взвешивания
}

export interface DryingCycle {
  id?: string;
  chamberNumber: number;
  sequentialNumber: string;
  recipeCode: string;
  woodType: string;
  customWoodType?: string;
  recipePhotoPath: string; // Deprecated, but kept for compatibility
  recipePhotoUrl?: string; // Deprecated, but kept for compatibility
  recipePhotos?: CyclePhoto[]; // New field for multiple recipe photos
  finalMoisture?: number;
  qualityRating?: number;
  resultPhotos: CyclePhoto[];
  overallComment?: string;
  isBaseRecipe: boolean;
  status: 'In Progress' | 'Completed';
  createdAt?: string;
  startDate?: string;
  endDate?: string; // New field
  isTest?: boolean; // New field
  startTemperature?: number;
  startWeatherCode?: number;
  
  // New Stats
  avgTemp?: number;
  avgDayTemp?: number;
  avgNightTemp?: number;
  minTemp?: number;
  maxTemp?: number;
  
  // Progress (from Google Sheets)
  progressPercent?: number; // 0-100
  
  // Weighing History (from Driver)
  weighingHistory?: WeighingRecord[];
  
  // Failed/Wet Cycle Marker
  isFailed?: boolean; // true if marked as failed/wet
}

export interface CurrentWorkCycle {
  lineId: '1' | '2' | '3';
  sequentialNumber: string;
  rawText: string;
  cycle: DryingCycle | null;
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const headers = {
    'Authorization': `Bearer ${publicAnonKey}`,
    'Content-Type': 'application/json',
    'apikey': publicAnonKey, // Добавляем apikey для Supabase
    ...options.headers,
  };
  
  console.log(`[API] 🔄 Запрос к: ${url}`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 секунд таймаут (увеличено с 15)
    
    const response = await fetch(url, { 
      ...options, 
      headers,
      signal: controller.signal 
    });
    
    clearTimeout(timeoutId);
    
    console.log(`[API] ✅ Ответ от ${url}:`, response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] ❌ Ошибка ${response.status}:`, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`[API] 📦 Данные получены от ${url}`);
    return data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`[API] ⏰ Timeout: Сервер не ответил за 30 секунд`);
      throw new Error('Сервер не отвечает. Проверьте подключение.');
    }
    
    console.error(`[API] ❌ Ошибка запроса к ${url}:`, error);
    console.error(`[API] Тип ошибки:`, error.name);
    console.error(`[API] Сообщение:`, error.message);
    
    // Если это Failed to fetch, значит сервер недоступен
    if (error.message === 'Failed to fetch') {
      console.error(`[API] 🔴 Сервер недоступен. Возможно, Edge Function не запущена.`);
      console.error(`[API] 💡 Попробуйте перезагрузить страницу или подождите несколько секунд.`);
    }
    
    throw error;
  }
}

export const api = {
  // Health check endpoint для проверки связи с сервером
  healthCheck: async () => {
    try {
      console.log(`[API] Health check: ${BASE_URL}/health`);
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();
      console.log('[API] Health check result:', data);
      return data;
    } catch (error) {
      console.error('[API] Health check failed:', error);
      throw error;
    }
  },
  
  getWoodDurations: async () => {
    return fetchWithAuth(`${BASE_URL}/settings/durations`);
  },
  
  updateWoodDurations: async (durations: Record<string, number>) => {
    return fetchWithAuth(`${BASE_URL}/settings/durations`, {
      method: 'POST',
      body: JSON.stringify(durations),
    });
  },

  getCycles: async (limit: number = 50, offset: number = 0) => {
  const response = await fetchWithAuth(`${BASE_URL}/cycles?limit=${limit}&offset=${offset}`);
  // Backend returns { data, limit, offset, hasMore }
  return {
    data: response.data || [],
    hasMore: response.hasMore || false
  };
},
  
  getCycle: async (id: string) => {
    return fetchWithAuth(`${BASE_URL}/cycles/${id}`);
  },
  
  // Alias for getCycle for convenience
  getActiveCycles: () => fetchWithAuth(`${BASE_URL}/cycles/active`),
  getCycleById: async (id: string) => {
    return fetchWithAuth(`${BASE_URL}/cycles/${id}`);
  },
  
  createCycle: async (cycle: DryingCycle) => {
    return fetchWithAuth(`${BASE_URL}/cycles`, {
      method: 'POST',
      body: JSON.stringify(cycle),
    });
  },
  
  updateCycle: async (id: string, cycle: Partial<DryingCycle>) => {
    return fetchWithAuth(`${BASE_URL}/cycles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(cycle),
    });
  },
  
  deleteCycle: async (id: string) => {
    return fetchWithAuth(`${BASE_URL}/cycles/${id}`, { method: 'DELETE' });
  },
  
  clearWeighingHistory: async (id: string) => {
    // 🔥 ИСПРАВЛЕНО: правильный endpoint для очистки истории
    return fetchWithAuth(`${BASE_URL}/cycles/${id}/weighings`, { method: 'DELETE' });
  },
  
  // 🔥 ИСПРАВЛЕНО: удаление по weighingId вместо индекса
  deleteWeighingRecord: async (cycleId: string, weighingId: string) => {
    return fetchWithAuth(`${BASE_URL}/cycles/${cycleId}/weighings/${weighingId}`, { method: 'DELETE' });
  },
  
  // Mark cycle as failed/wet
  markCycleAsFailed: async (id: string, isFailed: boolean) => {
    return fetchWithAuth(`${BASE_URL}/cycles/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ isFailed }),
    });
  },
  
  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    // Authorization header is needed for the function
    const response = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Upload failed');
    }
    return response.json();
  },
  
  async getCurrentWork() {
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-c5bcdb1f/sheets/current-work?ts=${Date.now()}`,
    {
      cache: 'no-store'
    }
  );

  const data = await res.json();

  console.log("[API] RAW current work:", data);

  return data;
}
  
  // Telegram Settings
  getTelegramSettings: async () => {
    return fetchWithAuth(`${BASE_URL}/telegram-settings`);
  },
  
  saveTelegramSettings: async (settings: { botToken: string; chatId: string; enabled: boolean }) => {
    return fetchWithAuth(`${BASE_URL}/telegram-settings`, {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },
  
  testTelegramSettings: async (settings: { botToken: string; chatId: string }) => {
    return fetchWithAuth(`${BASE_URL}/test-telegram`, {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },
  
  // Send weighing info to Telegram
 // sendWeighingToTelegram:  sendWeighingToTelegram: async (cycleId: string, weighingRecord: WeighingRecord) => {
    return fetchWithAuth(`${BASE_URL}/send-telegram-weighing`, {
      method: 'POST',
      body: JSON.stringify({ cycleId, weighingRecord }),
    });
  },
};
