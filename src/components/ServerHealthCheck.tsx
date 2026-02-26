import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { api } from '../utils/api';
import { projectId } from '../utils/supabase/info';

export default function ServerHealthCheck({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    checkServerHealth();
  }, []);

  const checkServerHealth = async () => {
    try {
      console.log('[Health Check] 🔍 Проверка связи с сервером...');
      console.log(`[Health Check] 📍 URL: https://${projectId}.supabase.co/functions/v1/make-server-c5bcdb1f/health`);
      
      const result = await api.healthCheck();
      
      console.log('[Health Check] ✅ Сервер доступен!');
      console.log('[Health Check] 📊 Ответ:', result);
      setStatus('ok');
    } catch (error: any) {
      console.error('[Health Check] ❌ Сервер недоступен');
      console.error('[Health Check] 🔴 Ошибка:', error);
      console.error('[Health Check] 💬 Сообщение:', error.message);
      console.error('[Health Check] 📋 Stack:', error.stack);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to fetch');
    }
  };

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700">Проверка связи с сервером...</p>
          <p className="text-sm text-gray-500 mt-2">Connecting to Supabase Edge Function</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-start gap-4 mb-6">
            <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900 mb-2">
                ⚠️ Не удалось подключиться к серверу
              </h1>
              <p className="text-gray-600 mb-4">
                Приложение не может связаться с backend сервером. Проверьте следующее:
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-mono text-red-800 break-all">
                  <strong>Ошибка:</strong> {errorMessage}
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
                  <div>
                    <p className="font-medium text-gray-900">Развёрнута ли Edge Function?</p>
                    <p className="text-sm text-gray-600">
                      Убедитесь что функция <code className="bg-gray-100 px-1 rounded">make-server-c5bcdb1f</code> развёрнута в Supabase
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
                  <div>
                    <p className="font-medium text-gray-900">Настроены ли переменные окружения?</p>
                    <p className="text-sm text-gray-600">
                      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL должны быть настроены
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
                  <div>
                    <p className="font-medium text-gray-900">Правильный ли URL?</p>
                    <p className="text-sm text-gray-600 font-mono break-all">
                      https://{projectId}.supabase.co/functions/v1/make-server-c5bcdb1f/health
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium mb-4"
              >
                {showDetails ? '▼ Скрыть детали' : '▶ Показать технические детали'}
              </button>

              {showDetails && (
                <div className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs font-mono overflow-auto mb-4">
                  <div className="mb-2"><strong>Project ID:</strong> {projectId}</div>
                  <div className="mb-2"><strong>Expected URL:</strong> https://{projectId}.supabase.co/functions/v1/make-server-c5bcdb1f</div>
                  <div className="mb-2"><strong>Error Type:</strong> {errorMessage.includes('Failed to fetch') ? 'Network Error (CORS or Function Not Deployed)' : 'Unknown Error'}</div>
                  <div><strong>Full Error:</strong> {errorMessage}</div>
                </div>
              )}

              <button
                onClick={checkServerHealth}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Loader2 className="w-5 h-5" />
                Повторить попытку
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Status is 'ok' - render children
  return <>{children}</>;
}