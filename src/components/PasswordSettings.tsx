import React, { useState, useEffect } from 'react';
import { useLanguage } from '../utils/i18n';
import { Lock, Save, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../utils/supabase/info';

export default function PasswordSettings() {
  const { lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [appPassword, setAppPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c5bcdb1f/password-settings`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAppPassword(data.appPassword || 'drytrack2024');
        setAdminPassword(data.adminPassword || 'admin2024');
      }
    } catch (error) {
      console.error('Error loading password settings:', error);
      toast.error(lang === 'ru' ? 'Ошибка загрузки настроек' : 'Klaida įkeliant nustatymus');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!appPassword || !adminPassword) {
      toast.error(lang === 'ru' ? 'Заполните все поля' : 'Užpildykite visus laukus');
      return;
    }

    if (appPassword.length < 4 || adminPassword.length < 4) {
      toast.error(lang === 'ru' ? 'Пароли должны содержать минимум 4 символа' : 'Slaptažodžiai turi būti bent 4 simbolių');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c5bcdb1f/password-settings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            appPassword,
            adminPassword
          })
        }
      );

      if (response.ok) {
        toast.success(lang === 'ru' ? 'Пароли обновлены!' : 'Slaptažodžiai atnaujinti!');
        
        // Предупреждение о необходимости перезагрузки
        setTimeout(() => {
          toast.info(lang === 'ru' 
            ? 'Для применения изменений перезагрузите страницу' 
            : 'Perkraukite puslapį, kad pritaikytumėte pakeitimus');
        }, 1000);
      } else {
        toast.error(lang === 'ru' ? 'Ошибка сохранения' : 'Išsaugojimo klaida');
      }
    } catch (error) {
      console.error('Error saving passwords:', error);
      toast.error(lang === 'ru' ? 'Ошибка сохранения' : 'Išsaugojimo klaida');
    } finally {
      setSaving(false);
    }
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
            {lang === 'ru' ? 'Настройки паролей' : 'Slaptažodžių nustatymai'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {lang === 'ru' 
              ? 'Управление доступом к системе' 
              : 'Prieigos prie sistemos valdymas'}
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

      {/* Предупреждение */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-bold mb-1">
            {lang === 'ru' ? 'Важно!' : 'Svarbu!'}
          </p>
          <p>
            {lang === 'ru' 
              ? 'Изменение паролей применится сразу. Запомните новые пароли! Текущие пользователи будут разлогинены при следующем обновлении страницы.' 
              : 'Slaptažodžių pakeitimai įsigalios iš karto. Įsiminkite naujus slaptažodžius! Esami vartotojai bus atjungti kitą kartą atnaujinus puslapį.'}
          </p>
        </div>
      </div>

      {/* Настройки паролей */}
      <div className="grid gap-6">
        {/* Общий пароль приложения */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Lock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {lang === 'ru' ? 'Общий пароль приложения' : 'Bendras programos slaptažodis'}
              </h2>
              <p className="text-sm text-gray-600">
                {lang === 'ru' 
                  ? 'Требуется для входа в систему (все роли)' 
                  : 'Reikalingas prisijungti prie sistemos (visi vaidmenys)'}
              </p>
            </div>
          </div>

          <div className="relative">
            <input
              type={showAppPassword ? 'text' : 'password'}
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder="Введите пароль приложения"
              className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono"
            />
            <button
              type="button"
              onClick={() => setShowAppPassword(!showAppPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showAppPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          
          <div className="mt-3 text-xs text-gray-500">
            {lang === 'ru' 
              ? 'По умолчанию: drytrack2024' 
              : 'Numatytasis: drytrack2024'}
          </div>
        </div>

        {/* Пароль администратора */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <Lock className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {lang === 'ru' ? 'Пароль администратора' : 'Administratoriaus slaptažodis'}
              </h2>
              <p className="text-sm text-gray-600">
                {lang === 'ru' 
                  ? 'Дополнительная защита для панели администратора' 
                  : 'Papildoma apsauga administratoriaus skydeliui'}
              </p>
            </div>
          </div>

          <div className="relative">
            <input
              type={showAdminPassword ? 'text' : 'password'}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Введите пароль администратора"
              className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-lg font-mono"
            />
            <button
              type="button"
              onClick={() => setShowAdminPassword(!showAdminPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showAdminPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          
          <div className="mt-3 text-xs text-gray-500">
            {lang === 'ru' 
              ? 'По умолчанию: admin2024' 
              : 'Numatytasis: admin2024'}
          </div>
        </div>
      </div>

      {/* Инструкция */}
      <div className="mt-6 bg-gray-50 rounded-xl p-6 border border-gray-200">
        <h3 className="font-bold text-gray-900 mb-3">
          {lang === 'ru' ? 'Уровни защиты:' : 'Apsaugos lygiai:'}
        </h3>
        <ol className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="font-bold text-blue-600">1.</span>
            <span>
              <strong>{lang === 'ru' ? 'Общий пароль' : 'Bendras slaptažodis'}:</strong>{' '}
              {lang === 'ru' 
                ? 'Защищает вход в приложение для всех пользователей (Оператор, Лидер, Водитель, Администратор)' 
                : 'Apsaugo įėjimą į programą visiems vartotojams (Operatorius, Lyderis, Vairuotojas, Administratorius)'}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-red-600">2.</span>
            <span>
              <strong>{lang === 'ru' ? 'Пароль администратора' : 'Administratoriaus slaptažodis'}:</strong>{' '}
              {lang === 'ru' 
                ? 'Дополнительная защита для доступа к админ-панели (создание/редактирование циклов, настройки)' 
                : 'Papildoma apsauga administratoriaus skydeliui (ciklų kūrimas/redagavimas, nustatymai)'}
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}
