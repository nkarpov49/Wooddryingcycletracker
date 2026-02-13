import { projectId, publicAnonKey } from '../utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-c5bcdb1f`;

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
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const headers = {
    'Authorization': `Bearer ${publicAnonKey}`,
    ...options.headers,
  };
  
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || response.statusText);
  }
  return response.json();
}

export const api = {
  getWoodDurations: async () => {
    return fetchWithAuth(`${BASE_URL}/settings/durations`);
  },
  
  updateWoodDurations: async (durations: Record<string, number>) => {
    return fetchWithAuth(`${BASE_URL}/settings/durations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(durations),
    });
  },

  getCycles: async () => {
    return fetchWithAuth(`${BASE_URL}/cycles`);
  },
  
  createCycle: async (cycle: DryingCycle) => {
    return fetchWithAuth(`${BASE_URL}/cycles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cycle),
    });
  },
  
  updateCycle: async (id: string, cycle: Partial<DryingCycle>) => {
    return fetchWithAuth(`${BASE_URL}/cycles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
  }
};
