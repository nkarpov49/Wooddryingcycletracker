import React from 'react';
import { motion } from 'motion/react';
import { Factory, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../utils/i18n';

interface LineSelectionScreenProps {
  onSelectLine: (line: '1-2' | '3') => void;
}

export default function LineSelectionScreen({ onSelectLine }: LineSelectionScreenProps) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <motion.div 
          className="text-center mb-6 sm:mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-amber-500 rounded-xl mb-4 sm:mb-5 shadow-lg">
            <Factory className="w-8 h-8 sm:w-9 sm:h-9 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3 sm:mb-4">
            {t('selectLine')}
          </h1>
          <p className="text-base sm:text-base text-gray-500">
            {t('leaderInstructions')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Line 1-2 */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectLine('1-2')}
            className="group bg-white rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-2xl transition-all border-2 border-transparent hover:border-amber-500 active:border-amber-600"
          >
            <div className="flex flex-col items-center text-center">
              <div className="text-5xl sm:text-6xl font-black text-amber-500 mb-3 sm:mb-4">
                1 & 2
              </div>
              <div className="text-lg sm:text-xl font-black text-gray-900 mb-2 sm:mb-3">
                {t('line1And2')}
              </div>
              <div className="flex items-center gap-2 text-amber-600 group-hover:text-amber-700 font-medium text-sm">
                <span>{t('selectLine')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </motion.button>

          {/* Line 3 */}
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectLine('3')}
            className="group bg-white rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-2xl transition-all border-2 border-transparent hover:border-amber-500 active:border-amber-600"
          >
            <div className="flex flex-col items-center text-center">
              <div className="text-5xl sm:text-6xl font-black text-amber-500 mb-3 sm:mb-4">
                3
              </div>
              <div className="text-lg sm:text-xl font-black text-gray-900 mb-2 sm:mb-3">
                {t('line3')}
              </div>
              <div className="flex items-center gap-2 text-amber-600 group-hover:text-amber-700 font-medium text-sm">
                <span>{t('selectLine')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}