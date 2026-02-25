import React from 'react';
import { useLanguage } from '../../utils/i18n';
import { ArrowRight, Factory } from 'lucide-react';
import { motion } from 'motion/react';

interface LineSelectionScreenProps {
  onSelectLine: (line: '1-2' | '3') => void;
}

export default function LineSelectionScreen({ onSelectLine }: LineSelectionScreenProps) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-blue-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-10 w-64 h-64 bg-amber-500 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-md w-full flex flex-col items-center z-10">
        {/* Title */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <Factory className="w-16 h-16 text-amber-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('selectLine')}
          </h1>
          <p className="text-gray-500">
            {t('leaderInstructions')}
          </p>
        </motion.div>

        {/* Line Options */}
        <div className="w-full space-y-4">
          {/* Line 1 and 2 */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectLine('1-2')}
            className="group relative w-full flex items-center justify-between p-6 text-left bg-white border-2 border-transparent rounded-2xl shadow-lg hover:border-amber-500 hover:shadow-xl transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 p-4 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl group-hover:from-amber-200 group-hover:to-amber-300 transition-all">
                <div className="text-2xl font-black text-amber-800">1-2</div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {t('line1And2')}
                </h3>
              </div>
            </div>
            <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-amber-600 transition-colors" />
          </motion.button>

          {/* Line 3 */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectLine('3')}
            className="group relative w-full flex items-center justify-between p-6 text-left bg-white border-2 border-transparent rounded-2xl shadow-lg hover:border-blue-500 hover:shadow-xl transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 p-4 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl group-hover:from-blue-200 group-hover:to-blue-300 transition-all">
                <div className="text-2xl font-black text-blue-800">3</div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {t('line3')}
                </h3>
              </div>
            </div>
            <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-blue-600 transition-colors" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}