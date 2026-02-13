import React, { useEffect, useState } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Loader2, Thermometer } from 'lucide-react';
import { format } from 'date-fns';
import { useLanguage } from '../utils/i18n';

interface WeatherWidgetProps {
  date: string; // ISO string
}

export function WeatherWidget({ date }: WeatherWidgetProps) {
  const [weatherData, setWeatherData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    async function fetchWeather() {
      if (!date) return;
      
      const dateObj = new Date(date);
      const dateStr = format(dateObj, 'yyyy-MM-dd');
      const hour = dateObj.getHours();

      // Anykščiai coordinates: 55.5264, 25.1027
      // Open-Meteo Archive API
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=55.5264&longitude=25.1027&start_date=${dateStr}&end_date=${dateStr}&hourly=temperature_2m,weather_code&timezone=Europe%2FVilnius`;

      try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.hourly) {
          // Find the index for the specific hour
          const index = hour; 
          setWeatherData({
            temp: data.hourly.temperature_2m[index],
            code: data.hourly.weather_code[index]
          });
        }
      } catch (err) {
        console.error("Failed to fetch weather", err);
      } finally {
        setLoading(false);
      }
    }

    fetchWeather();
  }, [date]);

  const getWeatherIcon = (code: number) => {
    // WMO Weather interpretation codes (WW)
    if (code === 0) return <Sun className="w-6 h-6 text-yellow-500" />;
    if (code >= 1 && code <= 3) return <Cloud className="w-6 h-6 text-gray-500" />;
    if (code >= 45 && code <= 48) return <Cloud className="w-6 h-6 text-gray-400" />;
    if (code >= 51 && code <= 67) return <CloudRain className="w-6 h-6 text-blue-400" />;
    if (code >= 71 && code <= 77) return <CloudSnow className="w-6 h-6 text-blue-200" />;
    if (code >= 80 && code <= 82) return <CloudRain className="w-6 h-6 text-blue-500" />;
    if (code >= 85 && code <= 86) return <CloudSnow className="w-6 h-6 text-blue-300" />;
    if (code >= 95) return <CloudLightning className="w-6 h-6 text-purple-500" />;
    return <Sun className="w-6 h-6 text-yellow-500" />;
  };

  if (loading) return null; // Don't show anything while loading to avoid layout shift
  if (!weatherData) return null;

  return (
    <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 flex items-center justify-between mt-2">
      <div className="flex items-center gap-2">
        {getWeatherIcon(weatherData.code)}
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Anykščiai</span>
          <span className="text-sm font-semibold text-gray-700">{format(new Date(date), 'HH:mm')}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 bg-white px-3 py-1 rounded-full shadow-sm">
        <Thermometer className="w-4 h-4 text-red-500" />
        <span className="font-bold text-gray-800">{weatherData.temp}°C</span>
      </div>
    </div>
  );
}
