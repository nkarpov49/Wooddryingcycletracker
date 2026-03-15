import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../utils/i18n';
import { Monitor, ShieldCheck, Package, Globe, Truck, LogOut, Loader2, Eye, EyeOff, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import backgroundImage from 'figma:asset/4302e5b394cc76a9bf6f44ab80c3dd81459ae7f1.png';

export default function LoginScreen() {
  const { login } = useAuth();
  const { lang, setLang } = useLanguage();
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [checking, setChecking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const toggleLang = () => {
    setLang(lang === 'ru' ? 'lt' : 'ru');
  };

  const handleLogout = () => {
    // Очистка общей сессии приложения
    sessionStorage.removeItem('app_authenticated');
    sessionStorage.removeItem('admin_authenticated');
    window.location.reload();
  };

  const handleAdminClick = () => {
    setShowAdminPassword(true);
  };

  const handleAdminPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-c5bcdb1f/check-admin-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ password: adminPassword })
        }
      );

      const data = await response.json();

      if (data.success) {
        sessionStorage.setItem('admin_authenticated', 'true');
        setShowAdminPassword(false);
        setAdminPassword('');
        login('admin');
      } else {
        toast.error(lang === 'ru' ? 'Неверный пароль администратора' : 'Neteisingas administratoriaus slaptažodis');
        setAdminPassword('');
      }
    } catch (err) {
      console.error('Admin password check error:', err);
      toast.error(lang === 'ru' ? 'Ошибка проверки' : 'Klaida');
    } finally {
      setChecking(false);
    }
  };

  const closeAdminPasswordModal = () => {
    setShowAdminPassword(false);
    setAdminPassword('');
    setShowPassword(false);
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-6 overflow-hidden bg-gradient-to-br from-gray-50 via-blue-50 to-slate-100">
      {/* Apple-style Background with Subtle Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(0,122,255,0.1),rgba(255,255,255,0))]"></div>
      </div>

      <div className="max-w-md w-full flex flex-col items-center z-10">
        
        {/* Apple-style Language Selector */}
        <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={toggleLang}
            className="mb-10 flex items-center gap-3 px-6 py-3 glass rounded-full shadow-apple-md hover:shadow-apple-lg transition-apple"
        >
            <span className="text-2xl">{lang === 'ru' ? '🇷🇺' : '🇱🇹'}</span>
            <span className="font-semibold text-foreground text-base">
                {lang === 'ru' ? 'Русский' : 'Lietuvių'}
            </span>
            <Globe className="w-5 h-5 text-primary" />
        </motion.button>

        <div className="w-full space-y-3">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => login('operator')}
            className="group relative w-full flex items-center p-5 text-left glass rounded-2xl shadow-apple hover:shadow-apple-md transition-apple overflow-hidden"
          >
            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 to-green-500/0 group-hover:from-green-500/5 group-hover:to-green-500/10 transition-all"></div>
            
            <div className="relative flex items-center w-full">
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-green-400 to-green-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Monitor className="w-7 h-7 text-white" />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {lang === 'ru' ? 'Оператор' : 'Operatorius'}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {lang === 'ru' ? 'Фото рецептов' : 'Receptų nuotraukos'}
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => login('packer')}
            className="group relative w-full flex items-center p-5 text-left glass rounded-2xl shadow-apple hover:shadow-apple-md transition-apple overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 to-amber-500/0 group-hover:from-amber-500/5 group-hover:to-amber-500/10 transition-all"></div>
            
            <div className="relative flex items-center w-full">
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-amber-400 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Package className="w-7 h-7 text-white" />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {lang === 'ru' ? 'Лидер' : 'Lyderis'}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {lang === 'ru' ? 'Упаковка • Фото результатов' : 'Pakavimas • Rezultatų nuotraukos'}
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => login('driver')}
            className="group relative w-full flex items-center p-5 text-left glass rounded-2xl shadow-apple hover:shadow-apple-md transition-apple overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:to-blue-500/10 transition-all"></div>
            
            <div className="relative flex items-center w-full">
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Truck className="w-7 h-7 text-white" />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {lang === 'ru' ? 'Логист/Водитель' : 'Logistas/Vairuotojas'}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {lang === 'ru' ? 'Контроль веса' : 'Svorio kontrolė'}
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleAdminClick}
            className="group relative w-full flex items-center p-5 text-left glass rounded-2xl shadow-apple hover:shadow-apple-md transition-apple overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 to-red-500/0 group-hover:from-red-500/5 group-hover:to-red-500/10 transition-all"></div>
            
            <div className="relative flex items-center w-full">
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-red-400 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                <ShieldCheck className="w-7 h-7 text-white" />
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {lang === 'ru' ? 'Администратор' : 'Administratorius'}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {lang === 'ru' ? 'Полный доступ • Требуется пароль' : 'Pilna prieiga • Reikalingas slaptažodis'}
                </p>
              </div>
            </div>
          </motion.button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="group relative w-full flex items-center justify-center p-4 text-center bg-white/80 backdrop-blur-sm border-2 border-gray-300 rounded-2xl shadow-md hover:border-gray-400 hover:bg-white/95 transition-all active:scale-[0.98] mt-8"
          >
            <LogOut className="w-6 h-6 text-gray-600 mr-2" />
            <span className="text-lg font-bold text-gray-700">
              {lang === 'ru' ? 'Выход' : 'Atsijungti'}
            </span>
          </button>
        </div>
      </div>

      {/* Admin Password Modal */}
      {showAdminPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8"
          >
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <Shield className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                {lang === 'ru' ? 'Пароль администратора' : 'Administratoriaus slaptažodis'}
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                {lang === 'ru' 
                  ? 'Для доступа к панели администратора введите пароль' 
                  : 'Norėdami pasiekti administratoriaus skydelį, įveskite slaptažodį'}
              </p>
            </div>

            <form onSubmit={handleAdminPasswordSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder={lang === 'ru' ? 'Введите пароль' : 'Įveskite slaptažodį'}
                  className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-lg"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={closeAdminPasswordModal}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-lg py-3 rounded-lg transition-colors"
                >
                  {lang === 'ru' ? 'Отмена' : 'Atšaukti'}
                </button>
                <button
                  type="submit"
                  disabled={checking || !adminPassword}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold text-lg py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {checking ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {lang === 'ru' ? 'Проверка...' : 'Tikrinama...'}
                    </>
                  ) : (
                    lang === 'ru' ? 'Войти' : 'Prisijungti'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}