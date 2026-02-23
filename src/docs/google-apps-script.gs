/**
 * Google Apps Script для автоматической синхронизации Google Sheets с приложением
 * 
 * Этот скрипт отслеживает новые строки в таблице и автоматически:
 * 1. Закрывает старый цикл сушки
 * 2. Создаёт новый цикл для той же камеры
 * 
 * Установка:
 * 1. Откройте вашу Google Таблицу
 * 2. Меню: Расширения → Apps Script
 * 3. Вставьте этот код
 * 4. Измените URL_WEBHOOK на URL вашего сервера
 * 5. Настройте триггер (onEdit или по времени)
 */

// ============================================================================
// НАСТРОЙКИ - ИЗМЕНИТЕ ЭТИ ЗНАЧЕНИЯ
// ============================================================================

// URL вашего Supabase Edge Function
const URL_WEBHOOK = 'https://[ваш-project-id].supabase.co/functions/v1/make-server-c5bcdb1f/sheets/process-row';

// Токен авторизации (SUPABASE_ANON_KEY)
const AUTH_TOKEN = 'ваш_anon_key_здесь';

// Номера столбцов в вашей таблице
const COLUMNS = {
  CHAMBER_NUMBER: 1,        // Столбец A: Номер камеры (1-21)
  OLD_SEQUENTIAL: 2,        // Столбец B: 4-значный номер старого цикла
  NEW_SEQUENTIAL: 3,        // Столбец C: 4-значный номер нового цикла
  WOOD_TYPE_LITHUANIAN: 4,  // Столбец D: Литовское название породы
  OLD_END_DATE: 5,          // Столбец E: Дата завершения старого цикла
  NEW_START_DATE: 6         // Столбец F: Дата начала нового цикла
};

// Название листа для отслеживания
const SHEET_NAME = 'Лист1'; // Измените на название вашего листа

// ============================================================================
// ОСНОВНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Триггер при изменении таблицы
 * Автоматически вызывается когда добавляется новая строка
 */
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  
  // Проверяем, что это нужный лист
  if (sheet.getName() !== SHEET_NAME) {
    Logger.log('Изменения не на целевом листе, пропускаем');
    return;
  }
  
  const row = e.range.getRow();
  
  // Пропускаем заголовок (первую строку)
  if (row === 1) {
    Logger.log('Изменения в заголовке, пропускаем');
    return;
  }
  
  // Проверяем, добавлена ли новая строка с данными
  if (isNewRowComplete(sheet, row)) {
    Logger.log(`Обнаружена новая полная строка ${row}, запускаем обработку`);
    processNewRow(sheet, row);
  }
}

/**
 * Ручная синхронизация (для тестирования)
 * Запустите эту функцию вручную из редактора Apps Script
 */
function manualSync() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  
  Logger.log(`Ручная синхронизация последней строки: ${lastRow}`);
  
  if (lastRow > 1) { // Пропускаем заголовок
    processNewRow(sheet, lastRow);
  } else {
    Logger.log('Нет данных для синхронизации');
  }
}

/**
 * Синхронизация всех необработанных строк
 * Полезно при первом запуске или после сбоя
 */
function syncAllRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  
  Logger.log(`Синхронизация всех строк с 2 по ${lastRow}`);
  
  for (let row = 2; row <= lastRow; row++) {
    if (isNewRowComplete(sheet, row)) {
      Logger.log(`Обработка строки ${row}`);
      processNewRow(sheet, row);
      
      // Задержка между запросами чтобы не перегрузить сервер
      Utilities.sleep(2000); // 2 секунды
    }
  }
  
  Logger.log('Синхронизация всех строк завершена');
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Проверяет, содержит ли строка все необходимые данные
 */
function isNewRowComplete(sheet, row) {
  const chamberNumber = sheet.getRange(row, COLUMNS.CHAMBER_NUMBER).getValue();
  const oldSequential = sheet.getRange(row, COLUMNS.OLD_SEQUENTIAL).getValue();
  const newSequential = sheet.getRange(row, COLUMNS.NEW_SEQUENTIAL).getValue();
  const woodType = sheet.getRange(row, COLUMNS.WOOD_TYPE_LITHUANIAN).getValue();
  
  // Проверяем, что все обязательные поля заполнены
  return chamberNumber !== '' && 
         oldSequential !== '' && 
         newSequential !== '' && 
         woodType !== '';
}

/**
 * Получает данные из строки и форматирует для отправки
 */
function getRowData(sheet, row) {
  // Читаем данные из столбцов
  const chamberNumber = sheet.getRange(row, COLUMNS.CHAMBER_NUMBER).getValue();
  const oldSequential = sheet.getRange(row, COLUMNS.OLD_SEQUENTIAL).getValue().toString();
  const newSequential = sheet.getRange(row, COLUMNS.NEW_SEQUENTIAL).getValue().toString();
  const woodTypeLithuanian = sheet.getRange(row, COLUMNS.WOOD_TYPE_LITHUANIAN).getValue().toString();
  
  // Даты
  let oldEndDate = sheet.getRange(row, COLUMNS.OLD_END_DATE).getValue();
  let newStartDate = sheet.getRange(row, COLUMNS.NEW_START_DATE).getValue();
  
  // Конвертируем даты в ISO 8601 формат
  if (oldEndDate instanceof Date) {
    oldEndDate = Utilities.formatDate(oldEndDate, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss'Z'");
  } else if (oldEndDate === '') {
    oldEndDate = new Date().toISOString(); // Если пусто - текущее время
  }
  
  if (newStartDate instanceof Date) {
    newStartDate = Utilities.formatDate(newStartDate, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss'Z'");
  } else if (newStartDate === '') {
    newStartDate = new Date().toISOString(); // Если пусто - текущее время
  }
  
  // Формируем объект данных
  return {
    rowNumber: row,
    chamberNumber: parseInt(chamberNumber),
    oldSequentialNumber: oldSequential,
    newSequentialNumber: newSequential,
    woodTypeLithuanian: woodTypeLithuanian,
    oldCycleEndDate: oldEndDate,
    newCycleStartDate: newStartDate
  };
}

/**
 * Обрабатывает новую строку - отправляет данные на сервер
 */
function processNewRow(sheet, row) {
  try {
    // Получаем данные из строки
    const rowData = getRowData(sheet, row);
    
    Logger.log('Данные строки для отправки:');
    Logger.log(JSON.stringify(rowData, null, 2));
    
    // Проверка валидности данных
    if (rowData.chamberNumber < 1 || rowData.chamberNumber > 21) {
      Logger.log(`Ошибка: некорректный номер камеры ${rowData.chamberNumber}`);
      return;
    }
    
    // Отправляем запрос на сервер
    const response = sendToWebhook(rowData);
    
    if (response.success) {
      Logger.log(`✅ Успех! Строка ${row} отправлена на обработку`);
      Logger.log(`Ожидаемое время обработки: ${response.estimatedTime}`);
      
      // Можно добавить метку в таблице что строка обработана
      // sheet.getRange(row, COLUMNS.CHAMBER_NUMBER + 10).setValue('Обработано');
      
    } else {
      Logger.log(`⚠️ Строка ${row} уже была обработана ранее`);
    }
    
  } catch (error) {
    Logger.log(`❌ Ошибка обработки строки ${row}: ${error.message}`);
    Logger.log(error.stack);
  }
}

/**
 * Отправляет данные на webhook сервера
 */
function sendToWebhook(data) {
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'headers': {
      'Authorization': `Bearer ${AUTH_TOKEN}`
    },
    'payload': JSON.stringify(data),
    'muteHttpExceptions': true
  };
  
  try {
    Logger.log(`Отправка запроса на ${URL_WEBHOOK}`);
    
    const response = UrlFetchApp.fetch(URL_WEBHOOK, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log(`Ответ сервера (код ${responseCode}):`);
    Logger.log(responseText);
    
    if (responseCode === 200) {
      const result = JSON.parse(responseText);
      return result;
    } else {
      throw new Error(`Ошибка HTTP ${responseCode}: ${responseText}`);
    }
    
  } catch (error) {
    Logger.log(`Ошибка при отправке запроса: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// УТИЛИТЫ ДЛЯ НАСТРОЙКИ
// ============================================================================

/**
 * Создаёт триггер для автоматической обработки при изменении таблицы
 * Запустите эту функцию один раз для настройки автоматизации
 */
function setupTrigger() {
  // Удаляем старые триггеры (если есть)
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Создаём новый триггер
  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  
  Logger.log('✅ Триггер onEdit создан успешно');
}

/**
 * Создаёт триггер для периодической проверки (каждые 5 минут)
 * Альтернатива onEdit триггеру - работает по расписанию
 */
function setupTimeTrigger() {
  // Удаляем старые триггеры
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkForNewRows') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Создаём триггер каждые 5 минут
  ScriptApp.newTrigger('checkForNewRows')
    .timeBased()
    .everyMinutes(5)
    .create();
  
  Logger.log('✅ Периодический триггер (каждые 5 минут) создан успешно');
}

/**
 * Проверяет новые строки (вызывается по расписанию)
 */
function checkForNewRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  
  // Получаем номер последней обработанной строки из свойств скрипта
  const scriptProperties = PropertiesService.getScriptProperties();
  const lastProcessedRow = parseInt(scriptProperties.getProperty('lastProcessedRow') || '1');
  
  Logger.log(`Последняя обработанная строка: ${lastProcessedRow}, текущая последняя: ${lastRow}`);
  
  // Обрабатываем новые строки
  for (let row = lastProcessedRow + 1; row <= lastRow; row++) {
    if (isNewRowComplete(sheet, row)) {
      Logger.log(`Найдена новая строка ${row}, обрабатываем`);
      processNewRow(sheet, row);
      
      // Обновляем последнюю обработанную строку
      scriptProperties.setProperty('lastProcessedRow', row.toString());
      
      // Задержка между запросами
      Utilities.sleep(2000);
    }
  }
}

/**
 * Тестовая функция для проверки конфигурации
 */
function testConfiguration() {
  Logger.log('=== ТЕСТ КОНФИГУРАЦИИ ===');
  Logger.log(`URL Webhook: ${URL_WEBHOOK}`);
  Logger.log(`AUTH_TOKEN: ${AUTH_TOKEN.substring(0, 20)}...`);
  Logger.log(`Название листа: ${SHEET_NAME}`);
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    Logger.log(`❌ ОШИБКА: Лист "${SHEET_NAME}" не найден!`);
    return;
  }
  
  Logger.log(`✅ Лист найден`);
  Logger.log(`Последняя строка: ${sheet.getLastRow()}`);
  
  if (sheet.getLastRow() > 1) {
    Logger.log('=== ДАННЫЕ ПОСЛЕДНЕЙ СТРОКИ ===');
    const lastRow = sheet.getLastRow();
    const data = getRowData(sheet, lastRow);
    Logger.log(JSON.stringify(data, null, 2));
  }
  
  Logger.log('=== ТЕСТ ЗАВЕРШЁН ===');
}

// ============================================================================
// ИНСТРУКЦИИ ПО НАСТРОЙКЕ
// ============================================================================

/**
 * ПОШАГОВАЯ ИНСТРУКЦИЯ:
 * 
 * 1. НАСТРОЙКА КОНСТАНТ (вверху файла):
 *    - URL_WEBHOOK: ваш Supabase Edge Function URL
 *    - AUTH_TOKEN: ваш SUPABASE_ANON_KEY
 *    - SHEET_NAME: название листа в вашей таблице
 *    - COLUMNS: номера столбцов (если отличаются)
 * 
 * 2. СТРУКТУРА ТАБЛИЦЫ:
 *    Столбец A: Номер камеры (1-21)
 *    Столбец B: 4-значный номер старого цикла (например: 0123)
 *    Столбец C: 4-значный номер нового цикла (например: 0124)
 *    Столбец D: Литовское название породы (Beržas235, Klevas235 и т.д.)
 *    Столбец E: Дата завершения старого цикла
 *    Столбец F: Дата начала нового цикла
 * 
 * 3. ТЕСТИРОВАНИЕ:
 *    - Запустите функцию testConfiguration() для проверки настроек
 *    - Запустите функцию manualSync() для ручной синхронизации последней строки
 * 
 * 4. АВТОМАТИЗАЦИЯ:
 *    Выберите один из вариантов:
 *    
 *    Вариант A: Триггер onEdit (реагирует на изменения сразу)
 *    - Запустите функцию setupTrigger()
 *    - Каждое изменение в таблице будет автоматически обрабатываться
 *    
 *    Вариант B: Периодический триггер (каждые 5 минут)
 *    - Запустите функцию setupTimeTrigger()
 *    - Новые строки будут проверяться автоматически каждые 5 минут
 * 
 * 5. МАССОВАЯ СИНХРОНИЗАЦИЯ:
 *    - Если нужно обработать много строк сразу, запустите syncAllRows()
 * 
 * 6. МОНИТОРИНГ:
 *    - Смотрите логи: Вид → Журналы (View → Logs)
 *    - Проверяйте логи синхронизации в приложении
 * 
 * ПОДДЕРЖИВАЕМЫЕ ЛИТОВСКИЕ НАЗВАНИЯ:
 * - Beržas235, Berzas235 → Birch235
 * - Beržas285, Berzas285 → Birch285
 * - Alksnis235 → Alder235
 * - Ąžuolas235, Azuolas235 → Oak235
 * - Uosis235 → Ash235
 * - Klevas235 → Maple235
 * - Skroblas235 → Scroblas235
 */
