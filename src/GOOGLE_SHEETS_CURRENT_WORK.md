# 📋 Интеграция Google Sheets: Текущие работы

## 🎯 Цель
Передавать данные из ячеек **C3, E3, G3** в приложение каждую минуту для отображения текущих работ на линиях.

---

## 📝 КОД ДЛЯ APPS SCRIPT

Добавьте эти функции в ваш проект Apps Script:

```javascript
// ==============================================
// ФУНКЦИЯ 1: Отправка текущих работ в приложение
// ==============================================
function sendCurrentWorkToApp() {
  const MAKE_APP_URL = 'https://zzteuolgibfbulqdavof.supabase.co/functions/v1/make-server-c5bcdb1f/sheets/update-current-work';
  
  try {
    const ss = SpreadsheetApp.openById('1SME_1kyiCIduqTlclc9w2c7DyBK4rCCGbzY3TWMZrPc');
    const sheet = ss.getSheetByName('Sausos malkos');
    
    if (!sheet) {
      Logger.log('ERROR: Sheet "Sausos malkos" not found');
      return;
    }
    
    // Читаем ячейки C3, E3, G3
    const c3Value = sheet.getRange('C3').getValue().toString().trim();
    const e3Value = sheet.getRange('E3').getValue().toString().trim();
    const g3Value = sheet.getRange('G3').getValue().toString().trim();
    
    Logger.log('C3: ' + c3Value);
    Logger.log('E3: ' + e3Value);
    Logger.log('G3: ' + g3Value);
    
    // Функция для извлечения 4-значного порядкового номера
    function extractSequentialNumber(text) {
      if (!text) return null;
      
      // Паттерн: число / текст / ЧЕТЫРЕХЗНАЧНОЕ ЧИСЛО / число
      // Пример: "19 / Beržas235 / 9919 / 24"
      const match = text.match(/\/\s*(\d{4})\s*\//);
      if (match) {
        return match[1];
      }
      
      // Альтернативный паттерн: просто ищем 4-значное число
      const simpleMatch = text.match(/\b(\d{4})\b/);
      if (simpleMatch) {
        return simpleMatch[1];
      }
      
      return null;
    }
    
    // Формируем данные
    const payload = {
      line3: {
        rawText: c3Value,
        sequentialNumber: extractSequentialNumber(c3Value)
      },
      line2: {
        rawText: e3Value,
        sequentialNumber: extractSequentialNumber(e3Value)
      },
      line1: {
        rawText: g3Value,
        sequentialNumber: extractSequentialNumber(g3Value)
      }
    };
    
    Logger.log('Sending payload:', JSON.stringify(payload));
    
    // Отправляем данные в приложение
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6dGV1b2xnaWJmYnVscWRhdm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NTA0NjgsImV4cCI6MjA4NTQyNjQ2OH0.mXYRfFM9csWjPXirW0nY10vz5hhDTj4EAeugrwRp_5A'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(MAKE_APP_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log('Response code: ' + responseCode);
    Logger.log('Response: ' + responseText);
    
    if (responseCode === 200) {
      Logger.log('✅ Текущие работы успешно отправлены');
    } else {
      Logger.log('❌ Ошибка отправки: ' + responseText);
    }
    
  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
  }
}

// ==============================================
// ФУНКЦИЯ 2: Создание триггера (запустить ОДИН РАЗ)
// ==============================================
function createCurrentWorkTrigger() {
  // Удаляем старые триггеры для этой функции (если есть)
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendCurrentWorkToApp') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Создаём новый триггер: каждую минуту
  ScriptApp.newTrigger('sendCurrentWorkToApp')
    .timeBased()
    .everyMinutes(1)
    .create();
  
  Logger.log('✅ Триггер создан! Функция будет запускаться каждую минуту.');
}

// ==============================================
// ФУНКЦИЯ 3: Тестирование (запустить вручную)
// ==============================================
function testCurrentWork() {
  Logger.log('=== ТЕСТ: Отправка текущих работ ===');
  sendCurrentWorkToApp();
  Logger.log('=== ТЕСТ ЗАВЕРШЁН ===');
}
```

---

## 🚀 ИНСТРУКЦИЯ ПО НАСТРОЙКЕ

### **Шаг 1: Скопируйте код**

1. Откройте ваш проект Apps Script
2. Скопируйте весь код выше
3. Вставьте в редактор
4. URL уже правильный: `https://zzteuolgibfbulqdavof.supabase.co/...`

### **Шаг 2: Запустите тест**

1. В Apps Script выберите функцию `testCurrentWork`
2. Нажмите **Run** (▶️)
3. Разрешите доступ к Google Sheets
4. Проверьте **Execution log**:
   - Должны появиться значения C3, E3, G3
   - Response code: 200
   - "✅ Текущие работы успешно отправлены"

### **Шаг 3: Создайте триггер**

1. Выберите функцию `createCurrentWorkTrigger`
2. Нажмите **Run** (▶️)
3. Триггер создан! Теперь данные отправляются **каждую минуту**

### **Шаг 4: Проверьте триггер**

1. В Apps Script откройте ⏰ **Triggers** (слева)
2. Должен появиться триггер:
   - Function: `sendCurrentWorkToApp`
   - Event: Time-driven
   - Frequency: Every minute

---

## 📊 ФОРМАТ ДАННЫХ

### **Ячейки в Google Sheets:**

| Ячейка | Линия | Пример значения |
|--------|-------|----------------|
| **G3** | Линия 1 | `18 / Uosis200 / 9918 / 25` |
| **E3** | Линия 2 | `20 / Ąžuolas150 / 9920 / 30` |
| **C3** | Линия 3 | `19 / Beržas235 / 9919 / 24` |

### **Извлечение порядкового номера:**

Из строки `19 / Beržas235 / 9919 / 24` скрипт извлекает **4-значное число**: `9919`

### **JSON отправляется в приложение:**

```json
{
  "line1": {
    "rawText": "18 / Uosis200 / 9918 / 25",
    "sequentialNumber": "9918"
  },
  "line2": {
    "rawText": "20 / Ąžuolas150 / 9920 / 30",
    "sequentialNumber": "9920"
  },
  "line3": {
    "rawText": "19 / Beržas235 / 9919 / 24",
    "sequentialNumber": "9919"
  }
}
```

---

## 🔍 ОТЛАДКА

### **Проблема: Response code 404**
- **Причина:** Неправильный URL
- **Решение:** Проверьте Project ID в URL

### **Проблема: Порядковый номер = null**
- **Причина:** Формат данных в ячейке не соответствует паттерну
- **Решение:** Убедитесь, что в ячейке есть 4-значное число, например: `... / 9919 / ...`

### **Проблема: "Sheet not found"**
- **Причина:** Название листа не "Sausos malkos"
- **Решение:** Проверьте название листа в Google Sheets

---

## ✅ ЧТО ПРОИЗОЙДЁТ ПОСЛЕ НАСТРОЙКИ

1. **Каждую минуту** Apps Script читает C3, E3, G3
2. Извлекает порядковые номера (4 цифры)
3. Отправляет данные в приложение Make
4. Приложение сохраняет данные в KV store
5. Фронтенд показывает **"Сейчас в работе"** с этими данными
6. Если цикл найден в базе → показывается полная карточка
7. Если не найден → показывается оранжевая карточка "Не найдено в базе"

---

## 🎉 ГОТОВО!

После настройки данные о текущих работах будут автоматически обновляться в приложении каждую минуту!