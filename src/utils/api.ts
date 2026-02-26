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
    ...options.headers,
  };
  
  console.log(`[API] Запрос к: ${url}`);
  
  try {
    const response = await fetch(url, { ...options, headers });
    
    console.log(`[API] Ответ от ${url}:`, response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] Ошибка ${response.status}:`, errorText);
      throw new Error(errorText || response.statusText);
    }
    
    const data = await response.json();
    console.log(`[API] Данные получены от ${url}:`, data);
    return data;
  } catch (error) {
    console.error(`[API] Ошибка запроса к ${url}:`, error);
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

  getCycles: async () => {
    return fetchWithAuth(`${BASE_URL}/cycles`);
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
    return fetchWithAuth(`${BASE_URL}/cycles/${id}`, {
      method: 'DELETE',
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
  
  getCurrentWork: async (): Promise<CurrentWorkCycle[]> => {
    const response = await fetchWithAuth(`${BASE_URL}/sheets/current-work`);
    return response.currentWork || [];
  },
};