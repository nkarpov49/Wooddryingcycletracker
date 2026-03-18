import React, { useState, useEffect } from 'react';
import { Send, AlertCircle, CheckCircle, Settings } from 'lucide-react';
import { api } from '../utils/api';
import { toast } from 'sonner@2.0.3';
import { useLanguage } from '../utils/i18n';

export default function TelegramSettings() {
  const { lang, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await api.getTelegramSettings();
      setBotToken(settings.botToken || '');
      setChatId(settings.chatId || '');
      setEnabled(settings.enabled || false);
    } catch (err) {
      console.error('Error loading Telegram settings:', err);
      toast.error(lang === 'ru' ? 'Ошибка загрузки настроек' : 'Klaida įkeliant nustatymus');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!botToken || !chatId) {
      toast.error(lang === 'ru' ? 'Заполните все поля' : 'Užpildykite visus laukus');
      return;
    }

    setSaving(true);
    try {
      await api.saveTelegramSettings({ botToken, chatId, enabled });
      toast.success(lang === 'ru' ? 'Настройки сохранены!' : 'Nustatymai išsaugoti!');
    } catch (err) {
      console.error('Error saving Telegram settings:', err);
      toast.error(lang === 'ru' ? 'Ошибка сохранения' : 'Išsaugojimo klaida');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!botToken || !chatId) {
      toast.error(lang === 'ru' ? 'Заполните все поля перед тестированием' : 'Užpildykite visus laukus prieš testavimą');
      return;
    }

    setTesting(true);
    try {
      const result = await api.testTelegramSettings({ botToken, chatId });
      toast.success(lang === 'ru' ? '✅ Тестовое сообщение отправлено!' : '✅ Testinis pranešimas išsiųstas!');
    } catch (err: any) {
      console.error('Error testing Telegram:', err);
      const errorMessage = err.message || (lang === 'ru' ? 'Ошибка отправки' : 'Siuntimo klaida');
      
      // Показываем понятное сообщение
      if (errorMessage.includes('ЧАТ НЕ НАЙДЕН') || errorMessage.includes('chat not found')) {
        toast.error(
          lang === 'ru' 
            ? '❌ ВЫ ЗАБЫЛИ ОТПРАВИТЬ /start БОТУ!\n\n1. Откройте Telegram\n2. Найдите вашего бота\n3. Нажмите СТАРТ или отправьте /start\n4. Вернитесь сюда и нажмите "Тестировать" снова' 
            : '❌ PAMIRŠOTE IŠSIŲSTI /start BOTUI!\n\n1. Atidarykite Telegram\n2. Raskite savo botą\n3. Paspauskite STARTAS arba siųskite /start\n4. Grįžkite čia ir paspauskite "Testuoti" vėl',
          { duration: 10000 }
        );
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === 'ru' ? 'Настройки Telegram' : 'Telegram nustatymai'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {lang === 'ru' 
              ? 'Настройте Telegram бота для получения уведомлений о взвешивании' 
              : 'Nustatykite Telegram botą pranešimams apie svėrimą'}
          </p>
        </div>
        <Send className="w-8 h-8 text-blue-600" />
      </div>

      {/* Настройки */}
      <div className="space-y-4">
        {/* Enable/Disable Toggle */}
        <div className="glass rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-semibold text-gray-900 text-lg">
                {lang === 'ru' ? 'Включить Telegram уведомления' : 'Įjungti Telegram pranešimus'}
              </label>
              <p className="text-sm text-gray-600 mt-1">
                {lang === 'ru' 
                  ? 'Автоматическая отправка информации о взвешивании в Telegram' 
                  : 'Automatinis svėrimo informacijos siuntimas į Telegram'}
              </p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                enabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Bot Token */}
        <div className="glass rounded-2xl border border-gray-200 p-6">
          <label className="block font-semibold text-gray-900 mb-2">
            {lang === 'ru' ? 'Токен бота' : 'Boto tokenas'}
            <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="password"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-2">
            {lang === 'ru' 
              ? 'Получите токен от @BotFather в Telegram' 
              : 'Gaukite tokeną iš @BotFather Telegram programoje'}
          </p>
        </div>

        {/* Chat ID */}
        <div className="glass rounded-2xl border border-gray-200 p-6">
          <label className="block font-semibold text-gray-900 mb-2">
            Chat ID
            <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="-1001234567890 или 123456789"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-2">
            {lang === 'ru' 
              ? 'ID группы (начинается с -100) или личного чата (просто число). Узнайте через @userinfobot' 
              : 'Grupės ID (prasideda -100) arba asmeninio pokalbio (paprastas numeris). Sužinokite per @userinfobot'}
          </p>
          
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs font-bold text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {lang === 'ru' 
                ? '⚠️ Перед получением Chat ID обязательно отправьте /start вашему боту!' 
                : '⚠️ Prieš gaunant Chat ID būtinai išsiųskite /start savo botui!'}
            </p>
          </div>
        </div>
      </div>

      {/* Status Preview */}
      {botToken && chatId && enabled && (
        <div className="glass rounded-2xl border border-green-200 p-6 bg-green-50">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900">
                {lang === 'ru' ? 'Telegram настроен!' : 'Telegram sukonfigūruotas!'}
              </p>
              <p className="text-sm text-green-700 mt-1">
                {lang === 'ru' 
                  ? 'После взвешивания информация автоматически отправится в Telegram' 
                  : 'Po svėrimo informacija automatiškai bus išsiųsta į Telegram'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !botToken || !chatId}
          className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-white transition-all shadow-lg ${
            saving || !botToken || !chatId
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:scale-95'
          }`}
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>{lang === 'ru' ? 'Сохранение...' : 'Išsaugoma...'}</span>
            </>
          ) : (
            <>
              <Settings className="w-5 h-5" />
              <span>{lang === 'ru' ? 'Сохранить настройки' : 'Išsaugoti nustatymus'}</span>
            </>
          )}
        </button>
        <button
          onClick={handleTest}
          disabled={testing || !botToken || !chatId}
          className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-white transition-all shadow-lg ${
            testing || !botToken || !chatId
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:scale-95'
          }`}
        >
          {testing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>{lang === 'ru' ? 'Тестирование...' : 'Testavimas...'}</span>
            </>
          ) : (
            <>
              <Settings className="w-5 h-5" />
              <span>{lang === 'ru' ? 'Тестировать' : 'Testuoti'}</span>
            </>
          )}
        </button>
      </div>

      {/* Example Message */}
      <div className="glass rounded-2xl border border-gray-200 p-6">
        <p className="font-semibold text-gray-900 mb-3">
          {lang === 'ru' ? 'Пример сообщения:' : 'Pranešimo pavyzdys:'}
        </p>
        <div className="bg-white rounded-xl p-4 border border-gray-200 font-mono text-sm text-gray-700 whitespace-pre-line">
{`📦 12

📅 17.03.2026 14:35
⏱ 48val nuo pradžios
🌲 Beržas (#2024-125)
🎯 Tikslas: 12.0t/dėžė

Rezultatas:
📦 12.1t ❌
📦 11.9t ✅
📦 12.0t ✅
📦 11.8t ✅

📉 12.8t → 11.9t (-0.9t per 6.0val)
⚡️ Greitis: 0.150t/val

⏳ Tęsti +2val (iki 16:35)`}
        </div>
      </div>
    </div>
  );
}