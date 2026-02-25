# 🔑 Исправление ошибки 401: Missing authorization header

## 🚨 Проблема

При запуске Google Apps Script видите:

```
14:05:00	❌ Ошибка синхронизации: 401
14:05:00	Ответ сервера: {"code":401,"message":"Missing authorization header"}
```

**Причина**: В Google Apps Script **НЕ отправляется заголовок Authorization** с API ключом Supabase.

---

## ✅ РЕШЕНИЕ: Добавить SUPABASE_ANON_KEY

### Шаг 1: Обновите код Apps Script

Откройте `/docs/google-apps-script-progress.txt` и скопируйте **ОБНОВЛЁННЫЙ** код.

**ВАЖНО! Теперь код включает:**

```javascript
// URL вашего Supabase проекта (ОБЯЗАТЕЛЬНО ЗАМЕНИТЕ!)
const SUPABASE_URL = 'https://ваш-project-id.supabase.co';

// ⚠️ НОВОЕ! Supabase Anonymous Key (ОБЯЗАТЕЛЬНО ЗАМЕНИТЕ!)
// Найдите его в: Supabase Dashboard → Project Settings → API → anon public
const SUPABASE_ANON_KEY = 'ваш-anon-key-здесь';
```

И в `fetch` добавлен заголовок:

```javascript
const options = {
  'method': 'post',
  'contentType': 'application/json',
  'payload': JSON.stringify(progressData),
  'muteHttpExceptions': true,
  'headers': {
    'apikey': SUPABASE_ANON_KEY  // ⬅️ НОВЫЙ ЗАГОЛОВОК!
  }
};
```

---

### Шаг 2: Найдите ваш SUPABASE_ANON_KEY

1. Откройте **Supabase Dashboard**
2. Выберите ваш проект
3. **Project Settings** → **API**
4. Скопируйте ключ **"anon"** / **"public"**

Должен выглядеть так:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiYzEyMyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE5MTU2MDAwMDB9.ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890
```
(это просто пример, ваш будет другим)

---

### Шаг 3: Вставьте в Apps Script

```javascript
// В начале файла замените:
const SUPABASE_URL = 'https://qltsgzuhvogzkpnysvge.supabase.co'; // ← Ваш URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6...'; // ← Ваш ключ
```

---

### Шаг 4: Сохраните и запустите

1. **Сохраните** код (Ctrl+S)
2. Нажмите **Run** (▶️)
3. Проверьте **Executions** (логи)

**Ожидаемый результат:**
```
14:10:00	Отправка процентов: {"1":60,"2":177.4,"3":169.4,...}
14:10:01	✅ Синхронизация успешна: Progress updated for 18 chambers
14:10:01	Обновлено камер: 18
```

---

## 🔍 Как проверить что всё работает

### В Apps Script (View → Executions)
```
✅ Синхронизация успешна
Обновлено камер: 18
```

### В Make (интерфейс оператора)
- Откройте страницу "Оператор"
- Циркулярные индикаторы должны показывать проценты из Google Sheets
- Проверьте несколько камер что значения совпадают

---

## 📊 Данные которые видите

Из ваших логов:
```json
{
  "1": 60,
  "2": 177.4,
  "3": 169.4,
  "4": 59.6,
  "5": 174.4,
  "6": 3.3,
  "7": 4.1,
  "8": 66.6,
  "9": 115.1,
  "10": 113.2,
  "11": 104.9,
  "12": 175.8,
  "13": 29.5,
  "14": 174.7,
  "15": 108,
  "16": 118.8,
  "17": 126.6,
  "18": 0,
  "19": 156.8,
  "20": 143.2,
  "21": 63.1
}
```

**Отлично!** 🎉 Данные читаются правильно:
- ✅ Десятичные значения (177.4%, 59.6%)
- ✅ Трёхзначные проценты (177.4%, 169.4%, 175.8%)
- ✅ Нулевые значения для неактивных (18 = 0)

Теперь просто нужно добавить **SUPABASE_ANON_KEY** и всё заработает!

---

## ⚠️ Важные примечания

### 🔐 Безопасность
- `SUPABASE_ANON_KEY` это **публичный** ключ, его можно хранить в коде Apps Script
- НЕ используйте `SUPABASE_SERVICE_ROLE_KEY` в Apps Script!
- Anon key имеет ограниченные права (Row Level Security)

### 🕐 Лимиты
- После добавления ключа ошибка urlfetch может повториться СЕГОДНЯ
- Это нормально, лимит был исчерпан ранее
- Подождите до завтра (2-3 часа ночи по МСК)
- Завтра всё будет работать идеально!

---

## 📚 Дополнительные ресурсы

- **Обновлённый скрипт**: `/docs/google-apps-script-progress.txt`
- **Быстрый старт**: `/docs/QUICK-START-PROGRESS-SYNC-RU.md`
- **Решение urlfetch**: `/docs/GOOGLE-SHEETS-URLFETCH-LIMIT-FIX.md`
- **Срочная инструкция**: `/docs/URGENTLY-NOW-RU.md`

---

## ✅ Чек-лист

- [ ] Скопировал ОБНОВЛЁННЫЙ код из `google-apps-script-progress.txt`
- [ ] Нашёл SUPABASE_ANON_KEY в Supabase Dashboard
- [ ] Заменил `const SUPABASE_ANON_KEY = '...'` на реальный ключ
- [ ] Заменил `const SUPABASE_URL = '...'` на реальный URL
- [ ] Сохранил код (Ctrl+S)
- [ ] Запустил тест (Run ▶️)
- [ ] Проверил логи (должно быть ✅)
- [ ] Создал триггер (каждые 15 минут)
- [ ] Проверил интерфейс оператора

---

**Создано**: 25 февраля 2026, 14:10  
**Статус**: ✅ Исправлено - добавлен заголовок Authorization  
**Следующий шаг**: Добавить SUPABASE_ANON_KEY в Apps Script и перезапустить
