import React, { useState, useEffect } from 'react';
import { useLanguage } from '../utils/i18n';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { Save, Loader2 } from 'lucide-react';

type WoodTypeConfig = {
  name: string;
  weightLimit: number;      // тонны
  warmupTime: number;        // часы
  dryingRateTime: number;    // часы для высыхания 0.3т
};

const DEFAULT_WOOD_TYPES: WoodTypeConfig[] = [
  { name: 'Alksnis', weightLimit: 10.0, warmupTime: 2, dryingRateTime: 4 },
  { name: 'Beržas 235', weightLimit: 12.0, warmupTime: 2, dryingRateTime: 4 },
  { name: 'Beržas 285', weightLimit: 11.6, warmupTime: 2, dryingRateTime: 4 },
  { name: 'Ąžuolas', weightLimit: 12.0, warmupTime: 2.5, dryingRateTime: 4 },
  { name: 'Klevas', weightLimit: 12.3, warmupTime: 2, dryingRateTime: 4 },
  { name: 'Uosis', weightLimit: 12.3, warmupTime: 2, dryingRateTime: 4 },
  { name: 'Skroblas', weightLimit: 12.3, warmupTime: 2, dryingRateTime: 4 },
];

export default function WoodTypeSettings() {
  const { t, lang } = useLanguage();
  const [configs, setConfigs] = useState<WoodTypeConfig[]>(DEFAULT_WOOD_TYPES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c5bcdb1f/wood-settings`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          setConfigs(data);
        }
      }
    } catch (error) {
      console.error('Error loading wood type configs:', error);
      toast.error('Ошибка загрузки настроек');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c5bcdb1f/wood-settings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(configs)
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast.success(lang === 'ru' ? 'Настройки сохранены' : 'Nustatymai išsaugoti');
    } catch (error) {
      console.error('Error saving wood type configs:', error);
      toast.error(lang === 'ru' ? 'Ошибка сохранения' : 'Klaida saugant');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (index: number, field: keyof Omit<WoodTypeConfig, 'name'>, value: string) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;

    setConfigs(prev => prev.map((config, i) => 
      i === index ? { ...config, [field]: numValue } : config
    ));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === 'ru' ? 'Настройки пород дерева' : 'Medienos rūšių nustatymai'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {lang === 'ru' 
              ? 'Формула расчета: Время разогрева + Время сушки' 
              : 'Skaičiavimo formulė: Šildymo laikas + Džiovinimo laikas'}
          </p>
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold px-6 py-3 rounded-lg transition-colors shadow-sm"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {lang === 'ru' ? 'Сохранить' : 'Išsaugoti'}
        </button>
      </div>

      {/* Таблица с литовскими породами */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">
                  {lang === 'ru' ? 'Порода дерева' : 'Medienos rūšis'}
                </th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">
                  {lang === 'ru' ? 'Допустимый вес (т)' : 'Leistinas svoris (t)'}
                </th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">
                  {lang === 'ru' ? 'Время разогрева (ч)' : 'Šildymo laikas (val)'}
                </th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">
                  {lang === 'ru' ? 'Время сушки 0.3т (ч)' : 'Džiovinimo 0.3t (val)'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {configs.map((config, index) => (
                <tr key={config.name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {config.name}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={config.weightLimit}
                      onChange={(e) => handleChange(index, 'weightLimit', e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={config.warmupTime}
                      onChange={(e) => handleChange(index, 'warmupTime', e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={config.dryingRateTime}
                      onChange={(e) => handleChange(index, 'dryingRateTime', e.target.value)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Пояснения */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
        <h3 className="font-bold text-blue-900 mb-2">
          {lang === 'ru' ? 'ℹ️ Пояснения' : 'ℹ️ Paaiškinimai'}
        </h3>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>
            <strong>{lang === 'ru' ? 'Допустимый вес:' : 'Leistinas svoris:'}</strong>{' '}
            {lang === 'ru' 
              ? 'Максимальный вес для отгрузки (в тоннах)' 
              : 'Maksimalus svoris siuntimui (tonomis)'}
          </li>
          <li>
            <strong>{lang === 'ru' ? 'Время разогрева:' : 'Šildymo laikas:'}</strong>{' '}
            {lang === 'ru' 
              ? 'Время необходимое для разогрева камеры перед сушкой (в часах)' 
              : 'Laikas reikalingas kamerai pašildyti prieš džiovinimą (valandomis)'}
          </li>
          <li>
            <strong>{lang === 'ru' ? 'Время сушки 0.3т:' : 'Džiovinimo 0.3t:'}</strong>{' '}
            {lang === 'ru' 
              ? 'Время за которое испаряется 0.3 тонны влаги (в часах)' 
              : 'Laikas per kurį išgaruoja 0.3 tonos drėgmės (valandomis)'}
          </li>
        </ul>
      </div>
    </div>
  );
}