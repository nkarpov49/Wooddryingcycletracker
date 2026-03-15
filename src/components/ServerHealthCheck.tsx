import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';
import { projectId } from '../utils/supabase/info';

export default function ServerHealthCheck({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    checkServerHealth();
  }, []);

  const checkServerHealth = async () => {
    try {
      console.log('[Health Check] 🔍 Проверка связи с сервером...');
      console.log(`[Health Check] 📍 URL: https://${projectId}.supabase.co/functions/v1/make-server-c5bcdb1f/health`);
      
      setStatus('checking');
      const result = await api.healthCheck();
      
      console.log('[Health Check] ✅ Сервер доступен!');
      console.log('[Health Check] 📊 Ответ:', result);
      setStatus('ok');
      setRetryCount(0);
    } catch (error: any) {
      console.error('[Health Check] ❌ Сервер недоступен');
      console.error('[Health Check] 🔴 Ошибка:', error);
      console.error('[Health Check] 💬 Сообщение:', error.message);
      console.error('[Health Check] 📋 Stack:', error.stack);
      
      // Автоматическая повторная попытка (до 3 раз с увеличивающейся задержкой)
      if (retryCount < 3) {
        const delay = (retryCount + 1) * 2000; // 2s, 4s, 6s
        console.log(`[Health Check] 🔄 Повторная попытка ${retryCount + 1}/3 через ${delay}ms...`);
        setTimeout(() => {
          setRetryCount(retryCount + 1);
          checkServerHealth();
        }, delay);
      } else {
        setStatus('error');
        setErrorMessage(error.message || 'Failed to fetch');
      }
    }
  };

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-slate-100">
        <div className="text-center glass rounded-3xl p-12 shadow-apple-lg">
          <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto mb-6" />
          <p className="text-xl font-semibold text-foreground mb-2">Подключение к серверу...</p>
          <p className="text-sm text-muted-foreground">
            {retryCount > 0 ? `Попытка ${retryCount + 1}/4` : 'Проверка связи с Supabase Edge Function'}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-slate-100 p-4">
        <div className="max-w-2xl w-full glass rounded-3xl shadow-apple-xl p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-destructive to-red-400 flex items-center justify-center flex-shrink-0 shadow-apple-md">
              <XCircle className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Не удалось подключиться к серверу
              </h1>
              <p className="text-muted-foreground mb-4">
                Приложение не может связаться с backend. Попробуйте обновить страницу.
              </p>
              
              <div className="bg-destructive/10 border-2 border-destructive/30 rounded-2xl p-4 mb-6 backdrop-blur-sm">
                <p className="text-sm font-mono text-destructive break-all">
                  <strong>Ошибка:</strong> {errorMessage}
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="glass rounded-2xl p-4 border border-white/30">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-blue-400 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-apple-sm">1</div>
                    <div>
                      <p className="font-semibold text-foreground">Обновите страницу</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Нажмите <kbd className="bg-muted px-2 py-1 rounded text-xs font-mono">Ctrl+R</kbd> или <kbd className="bg-muted px-2 py-1 rounded text-xs font-mono">⌘+R</kbd>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass rounded-2xl p-4 border border-white/30">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-blue-400 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-apple-sm">2</div>
                    <div>
                      <p className="font-semibold text-foreground">Проверьте интернет-соединение</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Убедитесь что у вас есть подключение к интернету
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass rounded-2xl p-4 border border-white/30">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-blue-400 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-apple-sm">3</div>
                    <div>
                      <p className="font-semibold text-foreground">Edge Function развёрнута?</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Функция <code className="bg-muted px-1.5 py-0.5 rounded text-xs">make-server-c5bcdb1f</code> должна быть развёрнута
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm text-primary hover:text-primary/80 font-medium mb-4 transition-apple"
              >
                {showDetails ? '▼ Скрыть детали' : '▶ Показать технические детали'}
              </button>

              {showDetails && (
                <div className="bg-gray-900 text-gray-100 rounded-2xl p-4 text-xs font-mono overflow-auto mb-4 shadow-apple-md">
                  <div className="mb-2"><strong>Project ID:</strong> {projectId}</div>
                  <div className="mb-2"><strong>Expected URL:</strong> https://{projectId}.supabase.co/functions/v1/make-server-c5bcdb1f</div>
                  <div className="mb-2"><strong>Error Type:</strong> {errorMessage.includes('Failed to fetch') ? 'Network Error (CORS or Function Not Deployed)' : 'Unknown Error'}</div>
                  <div><strong>Full Error:</strong> {errorMessage}</div>
                </div>
              )}

              <button
                onClick={() => {
                  setRetryCount(0);
                  checkServerHealth();
                }}
                className="w-full bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 text-white font-semibold py-4 px-6 rounded-2xl transition-apple flex items-center justify-center gap-3 shadow-apple-md hover:shadow-apple-lg active:scale-[0.98]"
              >
                <RefreshCw className="w-5 h-5" />
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