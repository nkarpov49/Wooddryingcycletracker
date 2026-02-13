import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../utils/i18n';
import { useNavigate } from 'react-router-dom'; // ← добавлено
import { Monitor, ShieldCheck, Package, Globe } from 'lucide-react';
import { motion } from 'motion/react';

export default function LoginScreen() {
  const { login } = useAuth();
  const { lang, setLang } = useLanguage();
  const navigate = useNavigate(); // ← добавлено

  const toggleLang = () => {
    setLang(lang === 'ru' ? 'lt' : 'ru');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="max-w-md w-full flex flex-col items-center z-10">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleLang}
          className="mb-12 flex items-center gap-3 px-8 py-4 bg-white border-2 border-amber-400 rounded-full shadow-lg hover:shadow-xl hover:bg-amber-50 transition-all group"
        >
          <span className="text-3xl">{lang === 'ru' ? '🇷🇺' : '🇱🇹'}</span>
          <span className="font-bold text-gray-800 text-xl group-hover:text-amber-800">
            {lang === 'ru' ? 'Русский Язык' : 'Lietuvių Kalba'}
          </span>
          <Globe className="w-6 h-6 text-amber-500 ml-2" />
        </motion.button>

        <div className="w-full space-y-4">
          <button
            onClick={() => {
              login('operator');
              navigate('/operator');
            }}
            className="group relative w-full flex items-center p-6 text-left bg-white border-2 border-transparent rounded-2xl shadow-sm hover:border-green-500 hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div className="flex-shrink-0 p-4 bg-green-100 rounded-full group-hover:bg-green-200 transition-colors">
              <Monitor className="w-8 h-8 text-green-700" />
            </div>
            <div className="ml-5">
              <h3 className="text-xl font-bold text-gray-900">
                {lang === 'ru' ? 'Оператор' : 'Operatorius'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {lang === 'ru' ? 'Цех сушки • Фото рецептов' : 'Džiovinimo cechas • Receptų nuotraukos'}
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              login('packer');
              navigate('/packer');
            }}
            className="group relative w-full flex items-center p-6 text-left bg-white border-2 border-transparent rounded-2xl shadow-sm hover:border-amber-500 hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div className="flex-shrink-0 p-4 bg-amber-100 rounded-full group-hover:bg-amber-200 transition-colors">
              <Package className="w-8 h-8 text-amber-700" />
            </div>
            <div className="ml-5">
              <h3 className="text-xl font-bold text-gray-900">
                {lang === 'ru' ? 'Лидер' : 'Lyderis'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {lang === 'ru' ? 'Упаковка • Фото результатов' : 'Pakavimas • Rezultatų nuotraukos'}
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              login('admin');
              navigate('/admin');
            }}
            className="group relative w-full flex items-center p-6 text-left bg-white border-2 border-transparent rounded-2xl shadow-sm hover:border-gray-400 hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div className="flex-shrink-0 p-4 bg-gray-100 rounded-full group-hover:bg-gray-200 transition-colors">
              <ShieldCheck className="w-8 h-8 text-gray-700" />
            </div>
            <div className="ml-5">
              <h3 className="text-xl font-bold text-gray-900">
                {lang === 'ru' ? 'Администратор' : 'Administratorius'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {lang === 'ru' ? 'Полный доступ' : 'Pilna prieiga'}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
