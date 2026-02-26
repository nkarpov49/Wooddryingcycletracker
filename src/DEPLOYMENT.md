# 🚀 Инструкции по развёртыванию Edge Function

## ❌ Проблема: "Failed to fetch"

Если вы видите ошибку **"TypeError: Failed to fetch"**, это означает что Supabase Edge Function не развёрнута или неправильно настроена.

## ✅ Решение: Развернуть Edge Function

### Шаг 1: Установить Supabase CLI

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows (через Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Шаг 2: Войти в Supabase

```bash
supabase login
```

### Шаг 3: Связать проект

```bash
supabase link --project-ref zzteuolgibfbulqdavof
```

### Шаг 4: Развернуть Edge Function

```bash
supabase functions deploy make-server-c5bcdb1f --no-verify-jwt
```

**ВАЖНО:** Флаг `--no-verify-jwt` необходим, так как приложение не использует JWT-аутентификацию!

### Шаг 5: Установить переменные окружения

Через Supabase Dashboard или CLI:

```bash
supabase secrets set SUPABASE_URL=https://zzteuolgibfbulqdavof.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<ваш_service_role_key>
supabase secrets set SUPABASE_DB_URL=<ваш_db_url>
```

## 🔍 Проверка развёртывания

После развёртывания проверьте доступность:

```bash
curl https://zzteuolgibfbulqdavof.supabase.co/functions/v1/make-server-c5bcdb1f/health
```

Должен вернуть:
```json
{"status":"ok"}
```

## 📂 Структура Edge Function

```
/supabase/functions/server/
├── index.tsx              # Основной файл сервера (Hono)
├── kv_store.tsx          # Утилиты для работы с KV таблицей
├── google-sheets-sync.ts # Логика синхронизации с Google Sheets
└── wood-type-mapping.ts  # Маппинг пород древесины
```

## 🔧 Альтернативный способ: Через Supabase Dashboard

1. Откройте Supabase Dashboard
2. Перейдите в раздел **Edge Functions**
3. Нажмите **"New Function"**
4. Имя: `make-server-c5bcdb1f`
5. Скопируйте код из `/supabase/functions/server/index.tsx`
6. Добавьте остальные файлы (kv_store.tsx, google-sheets-sync.ts, wood-type-mapping.ts)
7. Настройте переменные окружения
8. Нажмите **"Deploy"**

## ⚠️ Важные замечания

1. **CORS настроен** - Edge Function отвечает с заголовками `Access-Control-Allow-Origin: *`
2. **Авторизация** - Используется `publicAnonKey` (не требуется JWT)
3. **Роуты префиксированы** - Все эндпоинты начинаются с `/make-server-c5bcdb1f`
4. **KV таблица** - Используется таблица `kv_store_c5bcdb1f` в Postgres

## 🧪 Тестирование эндпоинтов

### Health Check
```bash
curl https://zzteuolgibfbulqdavof.supabase.co/functions/v1/make-server-c5bcdb1f/health
```

### Получить циклы
```bash
curl -H "Authorization: Bearer <publicAnonKey>" \
  https://zzteuolgibfbulqdavof.supabase.co/functions/v1/make-server-c5bcdb1f/cycles
```

### Текущая работа
```bash
curl -H "Authorization: Bearer <publicAnonKey>" \
  https://zzteuolgibfbulqdavof.supabase.co/functions/v1/make-server-c5bcdb1f/sheets/current-work
```

## 📞 Поддержка

Если проблема сохраняется:

1. Проверьте логи в Supabase Dashboard → Edge Functions → Logs
2. Откройте консоль браузера (F12) и проверьте детальные логи
3. Убедитесь что переменные окружения установлены правильно
4. Проверьте что KV таблица `kv_store_c5bcdb1f` существует в базе данных

---

✅ После успешного развёртывания приложение автоматически подключится к серверу!
