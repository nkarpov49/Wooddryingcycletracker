# 📊 АВТОМАТИЧЕСКИЙ ПЕРЕНОС ВЛАЖНОСТИ ИЗ GOOGLE SHEETS

## 🎯 Описание

Этот скрипт автоматически переносит данные о влажности из таблицы "Džiūvimo ataskaitos" в Supabase для соответствующих циклов сушки.

**Особенности вашей таблицы:**
- Строки 1-3: Заголовки
- Строка 4: Самый новый цикл (последнее добавление)
- Строка 5 и далее: Более старые циклы

---

## 📋 НАСТРОЙКА

### Шаг 1: Добавить колонку для отметки обработанных строк

1. Откройте лист **"Džiūvimo ataskaitos"**
2. В колонке **L** (или любой свободной после K) добавьте заголовок: **"Synced"** (в строке 3, где остальные заголовки)
3. Эта колонка будет содержать отметку "✓" для обработанных строк

---

### Шаг 2: Открыть редактор скриптов

1. В Google Sheets откройте: **Расширения → Apps Script**
2. Создайте новый файл: **syncMoisture.gs**
3. Вставьте код из секции ниже

---

## 💻 КОД СКРИПТА

```javascript
/**
 * АВТОМАТИЧЕСКИЙ ПЕРЕНОС ВЛАЖНОСТИ В SUPABASE
 * 
 * Этот скрипт:
 * 1. Читает данные из листа "Džiūvimo ataskaitos" (начиная со строки 4)
 * 2. Проверяет наличие влажности (колонка K)
 * 3. Находит цикл по порядковому номеру (колонка B)
 * 4. Обновляет finalMoisture в Supabase
 * 5. Отмечает строку как обработанную
 */

// ============================================
// КОНСТАНТЫ - НЕ ИЗМЕНЯТЬ
// ============================================

const SHEET_NAME = 'Džiūvimo ataskaitos';
const COLUMN_SEQUENTIAL_NUMBER = 2;  // B - Порядковый номер (9934, 9935...)
const COLUMN_MOISTURE = 11;           // K - Влажность
const COLUMN_SYNCED = 12;             // L - Отметка синхронизации

const SUPABASE_URL = 'https://mgntxxfxasvxkbyxtqfj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nbnR4eGZ4YXN2eGtieXh0cWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5NTgxNTEsImV4cCI6MjA1MjUzNDE1MX0.VqRUUZ18CZq4I5M1sZA8HI0nZe-JCL_1HuqH4SsMw_s';
const API_ENDPOINT = `${SUPABASE_URL}/functions/v1/make-server-c5bcdb1f`;

// ============================================
// ГЛАВНАЯ ФУНКЦИЯ - СИНХРОНИЗАЦИЯ ВЛАЖНОСТИ
// ============================================

function syncMoisture() {
  const startTime = new Date();
  console.log(`[${startTime.toISOString()}] 🚀 Запуск синхронизации влажности...`);
  
  try {
    // Получаем лист
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      console.error(`❌ Лист "${SHEET_NAME}" не найден!`);
      return;
    }
    
    // Получаем все данные (начинаем со строки 4)
    const lastRow = sheet.getLastRow();
    if (lastRow < 4) {
      console.log('ℹ️ Нет данных для обработки');
      return;
    }
    
    const dataRange = sheet.getRange(4, 1, lastRow - 3, COLUMN_SYNCED);
    const data = dataRange.getValues();
    
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Обрабатываем каждую строку
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 4; // +4 потому что строки начинаются с 4 (1-3 - заголовки)
      
      const sequentialNumber = String(row[COLUMN_SEQUENTIAL_NUMBER - 1]).trim();
      const moisture = row[COLUMN_MOISTURE - 1];
      const synced = row[COLUMN_SYNCED - 1];
      
      // Пропускаем если уже обработано
      if (synced === '✓') {
        skippedCount++;
        continue;
      }
      
      // Пропускаем если нет порядкового номера
      if (!sequentialNumber || sequentialNumber === '') {
        continue;
      }
      
      // Пропускаем если влажность не измерена
      if (!moisture || moisture === 'Nepamatuota' || moisture === '') {
        continue;
      }
      
      // Проверяем что влажность - это число
      const moistureValue = parseFloat(moisture);
      if (isNaN(moistureValue)) {
        console.log(`⚠️ Строка ${rowNumber}: Влажность "${moisture}" не является числом`);
        continue;
      }
      
      console.log(`📋 Обработка строки ${rowNumber}: Номер=${sequentialNumber}, Влажность=${moistureValue}%`);
      
      // Отправляем в Supabase
      const success = updateMoistureInSupabase(sequentialNumber, moistureValue);
      
      if (success) {
        // Отмечаем как обработанное
        sheet.getRange(rowNumber, COLUMN_SYNCED).setValue('✓');
        processedCount++;
        console.log(`✅ Строка ${rowNumber}: Успешно обновлено`);
      } else {
        errorCount++;
        console.log(`❌ Строка ${rowNumber}: Ошибка обновления`);
      }
      
      // Небольшая задержка чтобы не перегружать API
      Utilities.sleep(100);
    }
    
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    
    console.log('');
    console.log('═'.repeat(50));
    console.log(`✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА`);
    console.log(`⏱️ Время выполнения: ${duration.toFixed(2)} сек`);
    console.log(`📊 Обработано: ${processedCount}`);
    console.log(`⏭️ Пропущено: ${skippedCount}`);
    console.log(`❌ Ошибок: ${errorCount}`);
    console.log('═'.repeat(50));
    
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
    console.error('Stack trace:', error.stack);
  }
}

// ============================================
// ОБНОВЛЕНИЕ ВЛАЖНОСТИ В SUPABASE
// ============================================

function updateMoistureInSupabase(sequentialNumber, moistureValue) {
  try {
    // 1. Ищем цикл по sequentialNumber
    const searchUrl = `${API_ENDPOINT}/cycles?sequentialNumber=${encodeURIComponent(sequentialNumber)}`;
    
    const searchOptions = {
      method: 'get',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };
    
    const searchResponse = UrlFetchApp.fetch(searchUrl, searchOptions);
    const searchCode = searchResponse.getResponseCode();
    
    if (searchCode !== 200) {
      console.error(`❌ Ошибка поиска цикла: HTTP ${searchCode}`);
      return false;
    }
    
    const cycles = JSON.parse(searchResponse.getContentText());
    
    if (!cycles || cycles.length === 0) {
      console.warn(`⚠️ Цикл с номером ${sequentialNumber} не найден в базе`);
      return false;
    }
    
    const cycleId = cycles[0].id;
    console.log(`🔍 Найден цикл: ID=${cycleId}`);
    
    // 2. Обновляем влажность
    const updateUrl = `${API_ENDPOINT}/cycles/${cycleId}`;
    
    const updatePayload = {
      finalMoisture: moistureValue
    };
    
    const updateOptions = {
      method: 'put',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(updatePayload),
      muteHttpExceptions: true
    };
    
    const updateResponse = UrlFetchApp.fetch(updateUrl, updateOptions);
    const updateCode = updateResponse.getResponseCode();
    
    if (updateCode === 200) {
      console.log(`✅ Влажность ${moistureValue}% успешно обновлена для цикла ${sequentialNumber}`);
      return true;
    } else {
      console.error(`❌ Ошибка обновления: HTTP ${updateCode}`);
      console.error(`Response: ${updateResponse.getContentText()}`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Ошибка при обновлении цикла ${sequentialNumber}:`, error);
    return false;
  }
}

// ============================================
// ТЕСТОВАЯ ФУНКЦИЯ
// ============================================

function testMoistureSync() {
  console.log('🧪 ТЕСТОВЫЙ ЗАПУСК');
  console.log('═'.repeat(50));
  
  // Получаем лист
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    console.error(`❌ Лист "${SHEET_NAME}" не найден!`);
    return;
  }
  
  // Читаем первые 5 строк данных (начиная с строки 4)
  const lastRow = sheet.getLastRow();
  const rowsToRead = Math.min(5, lastRow - 3);
  
  if (rowsToRead <= 0) {
    console.log('ℹ️ Нет данных для тестирования');
    return;
  }
  
  const testRange = sheet.getRange(4, 1, rowsToRead, COLUMN_SYNCED);
  const testData = testRange.getValues();
  
  console.log('📋 Первые 5 строк данных:');
  console.log('');
  
  for (let i = 0; i < testData.length; i++) {
    const row = testData[i];
    const sequentialNumber = String(row[COLUMN_SEQUENTIAL_NUMBER - 1]).trim();
    const moisture = row[COLUMN_MOISTURE - 1];
    const synced = row[COLUMN_SYNCED - 1];
    
    console.log(`Строка ${i + 4}:`);
    console.log(`  Порядковый номер: ${sequentialNumber}`);
    console.log(`  Влажность: ${moisture}`);
    console.log(`  Синхронизировано: ${synced || '(нет)'}`);
    console.log('');
  }
  
  console.log('═'.repeat(50));
  console.log('ℹ️ Для полной синхронизации запустите функцию: syncMoisture()');
}

// ============================================
// ФУНКЦИЯ ДЛЯ СБРОСА ОТМЕТОК (ОПЦИОНАЛЬНО)
// ============================================

function resetSyncedMarks() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    console.error(`❌ Лист "${SHEET_NAME}" не найден!`);
    return;
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 4) {
    console.log('ℹ️ Нет данных');
    return;
  }
  
  const syncedRange = sheet.getRange(4, COLUMN_SYNCED, lastRow - 3, 1);
  syncedRange.clearContent();
  
  console.log(`✅ Сброшено ${lastRow - 3} отметок синхронизации`);
}
```

---

## 🧪 ТЕСТИРОВАНИЕ

### Шаг 1: Проверка данных

1. В редакторе Apps Script выберите функцию: **`testMoistureSync`**
2. Нажмите **▶️ Выполнить**
3. Проверьте логи (Ctrl+Enter или View → Logs)

Вы должны увидеть:
```
🧪 ТЕСТОВЫЙ ЗАПУСК
═══════════════════════════════════════
📋 Первые 5 строк данных:

Строка 4:
  Порядковый номер: 9936
  Влажность: 8.5
  Синхронизировано: (нет)

Строка 5:
  Порядковый номер: 9935
  Влажность: Nepamatuota
  Синхронизировано: (нет)
...
```

---

### Шаг 2: Тестовая синхронизация

1. Выберите функцию: **`syncMoisture`**
2. Нажмите **▶️ Выполнить**
3. **При первом запуске** разрешите доступ к Google Sheets
4. Проверьте логи

Вы должны увидеть:
```
🚀 Запуск синхронизации влажности...
📋 Обработка строки 4: Номер=9936, Влажность=8.5%
🔍 Найден цикл: ID=abc123
✅ Влажность 8.5% успешно обновлена для цикла 9936
✅ Строка 4: Успешно обновлено

═══════════════════════════════════════
✅ СИНХРОНИЗАЦИЯ ЗАВЕРШЕНА
⏱️ Время выполнения: 1.23 сек
📊 Обработано: 5
⏭️ Пропущено: 10
❌ Ошибок: 0
═══════════════════════════════════════
```

---

### Шаг 3: Проверка в приложении

1. Откройте веб-приложение
2. Найдите цикл с порядковым номером (например, 9936)
3. Проверьте что влажность обновилась

---

## ⏰ НАСТРОЙКА АВТОМАТИЧЕСКОГО ЗАПУСКА

### Создание триггера

1. В редакторе Apps Script откройте: **Триггеры** (иконка часов ⏰)
2. Нажмите **+ Добавить триггер**
3. Настройте:
   - **Функция:** `syncMoisture`
   - **Источник события:** На основе времени
   - **Тип триггера:** Таймер минут
   - **Интервал:** Каждую минуту
4. Нажмите **Сохранить**

---

## 🎯 КАК ЭТО РАБОТАЕТ

### Логика работы

```
Каждую минуту (триггер):
    ↓
Читаем все строки из "Džiūvimo ataskaitos" (начиная с строки 4)
    ↓
Для каждой строки:
    ├─ Есть отметка "✓" в колонке L? → ПРОПУСТИТЬ
    ├─ Нет порядкового номера (B)? → ПРОПУСТИТЬ
    ├─ Влажность = "Nepamatuota" (K)? → ПРОПУСТИТЬ
    └─ Влажность есть (число)?
        ↓
        Ищем цикл по sequentialNumber в Supabase
            ↓
        Найден?
            ├─ ДА → Обновляем finalMoisture
            │       Ставим отметку "✓" в колонке L
            │       ✅ Готово!
            └─ НЕТ → Предупреждение в логах
```

---

## 📊 ПРИМЕР РАБОТЫ

### **До синхронизации:**

| Строка | B (Номер) | K (Влажність) | L (Synced) |
|--------|-----------|---------------|------------|
| 1-3    | Заголовки | ...           | ...        |
| 4      | 9936      | 7.2           |            |
| 5      | 9935      | Nepamatuota   |            |
| 6      | 9934      | 8.5           |            |

**Примечание:** Строка 4 - это самый новый цикл (последнее добавление)

### **Скрипт выполняется:**

```
📋 Обработка строки 4: Номер=9936, Влажность=7.2%
🔍 Найден цикл: ID=def456
✅ Влажность 7.2% успешно обновлена
✅ Строка 4: Успешно обработано

📋 Обработка строки 5: Номер=9935, Влажность=Nepamatuota
⏭️ Пропускаем (влажность не измерена)

📋 Обработка строки 6: Номер=9934, Влажность=8.5%
🔍 Найден цикл: ID=abc123
✅ Влажность 8.5% успешно обновлена
✅ Строка 6: Успешно обработано
```

### **После синхронизации:**

| Строка | B (Номер) | K (Влажність) | L (Synced) |
|--------|-----------|---------------|------------|
| 1-3    | Заголовки | ...           | ...        |
| 4      | 9936      | 7.2           | ✓          |
| 5      | 9935      | Nepamatuota   |            |
| 6      | 9934      | 8.5           | ✓          |

### **Когда добавляется новый цикл:**

1. Новая строка вставляется на позицию 4
2. Старые строки сдвигаются вниз (4→5, 5→6, 6→7...)
3. При следующем запуске скрипта обрабатывается только новая строка 4 (без отметки ✓)

| Строка | B (Номер) | K (Влажність) | L (Synced) | Комментарий |
|--------|-----------|---------------|------------|-------------|
| 1-3    | Заголовки | ...           | ...        | Заголовки   |
| 4      | 9937      | 6.8           |            | 🆕 НОВЫЙ!   |
| 5      | 9936      | 7.2           | ✓          | Сдвинулся вниз |
| 6      | 9935      | Nepamatuota   |            | Сдвинулся вниз |
| 7      | 9934      | 8.5           | ✓          | Сдвинулся вниз |

---

## 📊 СТРУКТУРА ТАБЛИЦЫ

### Google Sheets ("Džiūvimo ataskaitos")

| Строка | A | B (Номер) | C | ... | K (Влажність) | L (Synced) |
|--------|---|-----------|---|-----|---------------|------------|
| 1      | Партия | ... | № | ... | Влажность | Synced |
| 2      | ...    | ... | ... | ... | ...       | ...    |
| 3      | ...    | ... | ... | ... | ...       | ...    |
| 4      | ...    | 9936 | ... | ... | 8.5      | ✓      |
| 5      | ...    | 9935 | ... | ... | Nepamatuota |      |
| 6      | ...    | 9934 | ... | ... | 7.2      | ✓      |

**Важно:** 
- Строки 1-3: Заголовки
- Строка 4: Самый новый цикл (последнее добавление)
- Строки 5+: Более старые циклы

---

## 🔧 НАСТРОЙКИ

### Изменить колонки

Если у вас другие номера колонок, измените константы в начале скрипта:

```javascript
const COLUMN_SEQUENTIAL_NUMBER = 2;  // B - Порядковый номер
const COLUMN_MOISTURE = 11;           // K - Влажность
const COLUMN_SYNCED = 12;             // L - Отметка синхронизации
```

### Изменить интервал обновления

В настройках триггера выберите другой интервал:
- Каждые 5 минут
- Каждые 10 минут
- Каждый час

---

## 🛠️ ОТЛАДКА

### Если скрипт не работает

1. **Проверьте логи:**
   - В редакторе: View → Logs (Ctrl+Enter)
   - Ищите ошибки и предупреждения

2. **Проверьте права доступа:**
   - Скрипт должен иметь доступ к Google Sheets
   - При первом запуске разрешите доступ

3. **Проверьте URL и ключи:**
   - `SUPABASE_URL` должен быть правильным
   - `SUPABASE_ANON_KEY` должен быть актуальным

4. **Проверьте данные:**
   - Запустите `testMoistureSync()` чтобы увидеть первые 5 строк
   - Убедитесь что номера колонок правильные
   - Убедитесь что строка 4 существует

5. **Проверьте структуру:**
   - Данные должны начинаться со строки 4
   - Строки 1-3 - это заголовки

---

## 🔄 СБРОС ОТМЕТОК (ОПЦИОНАЛЬНО)

Если нужно заново синхронизировать все строки:

1. Выберите функцию: **`resetSyncedMarks`**
2. Нажмите **▶️ Выполнить**
3. Все отметки "✓" будут удалены
4. Запустите `syncMoisture()` для повторной синхронизации

---

## ✅ ГОТОВО!

Теперь скрипт будет автоматически:
- ✅ Проверять новые строки каждую минуту
- ✅ Переносить влажность в Supabase
- ✅ Отмечать обработанные строки
- ✅ Не обрабатывать повторно

---

## ✨ ИТОГ

Теперь у вас полностью автоматизированная система:

📊 **Google Sheets (строка 4)** → Новый цикл добавлен  
⏰ **Триггер (каждую минуту)** → Запускает скрипт  
🔍 **Apps Script** → Ищет строки без отметки ✓  
📡 **API** → Отправляет влажность в Supabase  
💾 **Supabase** → Сохраняет в базу  
🔄 **Frontend** → Автообновление каждые 10 сек  
✅ **Пользователь** → Видит актуальные данные!

### **Как это работает в реальности:**

```
1. Оператор завершает сушку
   ↓
2. Google Sheets: Формула вычисляет влажность → 8.5%
   ↓
3. Новая строка вставляется на позицию 4
   ↓
4. Через 1 минуту: Apps Script запускается автоматически
   ↓
5. Скрипт находит строку 4 (без отметки ✓)
   ↓
6. API запрос: GET /cycles?sequentialNumber=9937
   ↓
7. Найден цикл в Supabase
   ↓
8. API запрос: PUT /cycles/{id} с finalMoisture=8.5
   ↓
9. Отметка ✓ ставится в колонке L строки 4
   ↓
10. Через 10 секунд: Frontend обновляется автоматически
   ↓
11. Лидер/Админ видит обновлённую влажность на карточке!
```

---

## 📞 ПОДДЕРЖКА

Если возникли проблемы:
1. Проверьте логи в Apps Script (View → Logs)
2. Убедитесь что триггер активен (Триггеры → должен быть виден syncMoisture)
3. Проверьте что колонка L существует и имеет заголовок "Synced"
4. Запустите `testMoistureSync()` для диагностики
5. Убедитесь что данные начинаются со строки 4

---

**Следуйте инструкциям выше для настройки!** 📋✨🎉
