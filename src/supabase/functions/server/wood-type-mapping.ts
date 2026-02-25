// Маппинг литовских названий пород древесины в английский формат приложения
// Lithuanian wood type names → App internal format

export const LITHUANIAN_TO_ENGLISH: Record<string, string> = {
  // Береза
  'Beržas235': 'Birch235',
  'Beržas285': 'Birch285',
  'Berzas235': 'Birch235',  // без диакритики
  'Berzas285': 'Birch285',
  
  // Ольха
  'Alksnis235': 'Alder235',
  'JAlksnis235': 'Alder235',  // J = желтая ольха
  'BAlksnis235': 'Alder235',  // B = белая ольха
  
  // Дуб
  'Ąžuolas235': 'Oak235',
  'Azuolas235': 'Oak235',  // без диакритики
  
  // Ясень
  'Uosis235': 'Ash235',
  
  // Клён
  'Klevas235': 'Maple235',
  
  // Скробла (граб?)
  'Skroblas235': 'Scroblas235',
};

// Обратный маппинг для отображения
export const ENGLISH_TO_LITHUANIAN: Record<string, string> = {
  'Birch235': 'Beržas235',
  'Birch285': 'Beržas285',
  'Alder235': 'Alksnis235',
  'Oak235': 'Ąžuolas235',
  'Ash235': 'Uosis235',
  'Maple235': 'Klevas235',
  'Scroblas235': 'Skroblas235',
};

// Все допустимые английские типы для валидации
export const VALID_WOOD_TYPES = [
  'Birch235',
  'Birch285',
  'Alder235',
  'Oak235',
  'Ash235',
  'Maple235',
  'Scroblas235',
] as const;

export type WoodType = typeof VALID_WOOD_TYPES[number];

/**
 * Конвертирует литовское название породы в английский формат
 * @param lithuanianName - Название на литовском языке
 * @returns Название в английском формате или null если не найдено
 */
export function convertLithuanianToEnglish(lithuanianName: string): string | null {
  // Убираем лишние пробелы и нормализуем
  const normalized = lithuanianName?.trim();
  
  if (!normalized) return null;
  
  // Проверяем прямое совпадение
  if (LITHUANIAN_TO_ENGLISH[normalized]) {
    return LITHUANIAN_TO_ENGLISH[normalized];
  }
  
  // Проверяем case-insensitive
  const lowerName = normalized.toLowerCase();
  for (const [key, value] of Object.entries(LITHUANIAN_TO_ENGLISH)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }
  
  // Если уже на английском - проверяем валидность
  if (VALID_WOOD_TYPES.includes(normalized as WoodType)) {
    return normalized;
  }
  
  return null;
}

/**
 * Конвертирует английский формат в литовское название
 * @param englishName - Название на английском
 * @returns Название на литовском или исходное если не найдено
 */
export function convertEnglishToLithuanian(englishName: string): string {
  return ENGLISH_TO_LITHUANIAN[englishName] || englishName;
}

/**
 * Валидирует тип древесины
 * @param woodType - Тип древесины (английский или литовский)
 * @returns true если валиден
 */
export function isValidWoodType(woodType: string): boolean {
  if (!woodType) return false;
  
  // Проверяем английский формат
  if (VALID_WOOD_TYPES.includes(woodType as WoodType)) {
    return true;
  }
  
  // Проверяем литовский формат
  const englishFormat = convertLithuanianToEnglish(woodType);
  return englishFormat !== null;
}

/**
 * Нормализует тип древесины к английскому формату
 * Поддерживает как литовские, так и английские названия
 */
export function normalizeWoodType(woodType: string): string | null {
  if (!woodType) return null;
  
  // Если уже на английском и валиден
  if (VALID_WOOD_TYPES.includes(woodType as WoodType)) {
    return woodType;
  }
  
  // Пытаемся конвертировать из литовского
  return convertLithuanianToEnglish(woodType);
}

// Экспорт для использования в логах
export function getWoodTypeDisplayName(woodType: string, language: 'en' | 'lt' = 'en'): string {
  if (language === 'lt') {
    return convertEnglishToLithuanian(woodType);
  }
  return woodType;
}