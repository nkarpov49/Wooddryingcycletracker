import React, { createContext, useState, useContext, ReactNode } from 'react';

type Language = 'ru' | 'lt';

type Translations = {
  [key: string]: {
    ru: string;
    lt: string;
  };
};

const translations: Translations = {
  appTitle: { ru: "Сушка Древесины", lt: "Medienos Džiovinimas" },
  newCycle: { ru: "Новый цикл", lt: "Naujas ciklas" },
  allCycles: { ru: "Все циклы", lt: "Visi ciklai" },
  baseRecipes: { ru: "Базовые рецепты", lt: "Baziniai receptai" },
  searchPlaceholder: { ru: "Поиск по номеру...", lt: "Ieškoti pagal numerį..." },
  chamber: { ru: "Камера", lt: "Džiovykla" },
  chamberShort: { ru: "Кам", lt: "Džiov" },
  inProgress: { ru: "В процессе", lt: "Vyksta" },
  completed: { ru: "Завершено", lt: "Baigta" },
  ratingFilter: { ru: "Оценка ≥ 4.0", lt: "Įvertinimas ≥ 4.0" },
  recentFilter: { ru: "За 30 дней", lt: "Per 30 dienų" },
  statusFilter: { ru: "Все статусы", lt: "Visi statusai" },
  recipeDetails: { ru: "Детали Рецепта", lt: "Recepto Detalės" },
  sequentialNumber: { ru: "Порядковый №", lt: "Eilės Nr." },
  recipeCode: { ru: "Код рецепта", lt: "Recepto kodas" },
  woodType: { ru: "Порода древесины", lt: "Mediena" },
  other: { ru: "Другое", lt: "Kita" },
  recipePhoto: { ru: "Фото рецепта", lt: "Recepto nuotrauka" },
  saveAsBase: { ru: "Сохранить как Базовый Рецепт", lt: "Išsaugoti kaip bazinį receptą" },
  resultsAndQuality: { ru: "Результаты и Качество", lt: "Rezultatai ir Kokybė" },
  finalMoisture: { ru: "Конечная Влажность (%)", lt: "Galutinė Drėgmė (%)" },
  qualityRating: { ru: "Оценка Качества (0-5)", lt: "Kokybės Įvertinimas (0-5)" },
  resultPhoto: { ru: "Фото Результата", lt: "Rezultato Nuotrauka" },
  addPhoto: { ru: "Добавить фото", lt: "Pridėti nuotrauką" },
  overallComment: { ru: "Общий комментарий", lt: "Bendras komentaras" },
  saveCycle: { ru: "Сохранить цикл", lt: "Išsaugoti ciklą" },
  updateCycle: { ru: "Обновить цикл", lt: "Atnaujinti ciklą" },
  createCycle: { ru: "Создать цикл", lt: "Sukurti ciklą" },
  gallery: { ru: "Галерея", lt: "Galerija" },
  delete: { ru: "Удалить", lt: "Ištrinti" },
  edit: { ru: "Редактировать", lt: "Redaguoti" },
  copy: { ru: "Создать копию", lt: "Kopijuoti" },
  weather: { ru: "Погода при создании", lt: "Oras sukūrimo metu" },
  loading: { ru: "Загрузка...", lt: "Kraunama..." },
  cyclesNotFound: { ru: "Циклы не найдены", lt: "Ciklų nerasta" },
  tapToRate: { ru: "Нажмите для оценки", lt: "Paspauskite vertinimui" },
  commentPlaceholder: { ru: "Опишите процесс сушки...", lt: "Aprašykite džiovinimo procesą..." },
  requiredField: { ru: "обязательно", lt: "privaloma" },
  saved: { ru: "Сохранено", lt: "Išsaugota" },
  save: { ru: "Сохранить", lt: "Išsaugoti" },
  error: { ru: "Ошибка", lt: "Klaida" },
  home: { ru: "На главный экран", lt: "Į pagrindinį" },
  analytics: { ru: "Аналитика", lt: "Analitika" },
  successRate: { ru: "Успешность", lt: "Sėkmės rodiklis" },
  topRecipes: { ru: "Лучшие рецепты", lt: "Geriausi receptai" },
  startDate: { ru: "Дата загрузки", lt: "Pakrovimo data" },
  temperature: { ru: "Температура", lt: "Temperatūra" },
  sortBySeq: { ru: "Сорт: Номер", lt: "Rikiuoti: Nr." },
  sortNewest: { ru: "Сорт: Новые", lt: "Rikiuoti: Naujausi" },
  settings: { ru: "Настройки", lt: "Nustatymai" },
  endDate: { ru: "Дата завершения", lt: "Pabaigos data" },
  duration: { ru: "Длительность", lt: "Trukmė" },
  testMode: { ru: "Тестовый режим", lt: "Testinis režimas" },
  test: { ru: "ТЕСТ", lt: "TEST" },
  hoursShort: { ru: "ч", lt: "val" },
  avgTemp: { ru: "Средняя темп.", lt: "Vid. temp." },
  dayTemp: { ru: "День", lt: "Diena" },
  nightTemp: { ru: "Ночь", lt: "Naktis" },
  minMax: { ru: "Мин/Макс", lt: "Min/Maks" },
  noRecipePhoto: { ru: "нет фото рецепта", lt: "nėra recepto nuotraukos" },
  notEntered: { ru: "Не внесено в систему", lt: "Neįvesta į sistemą" },
  seqNumberExists: { ru: "Этот номер рецепта уже существует", lt: "Šis recepto numeris jau egzistuoja" },
  // New List Filters & Tabs
  tabActual: { ru: "Актуальные", lt: "Aktualūs" },
  tabArchive: { ru: "Архив", lt: "Archyvas" },
  tabCalendar: { ru: "Календарь", lt: "Kalendorius" },
  filterAll: { ru: "Все", lt: "Visi" },
  filterSuccess: { ru: "Успешные", lt: "Sėkmingi" },
  filterProblem: { ru: "Проблемные", lt: "Probleminiai" },
  filter7Days: { ru: "7 дней", lt: "7 dienos" },
  filterWood: { ru: "По породе", lt: "Pagal medieną" },
  sortDate: { ru: "По дате", lt: "Pagal datą" },
  sortQuality: { ru: "По качеству", lt: "Pagal kokybę" },
  sortDuration: { ru: "По длительности", lt: "Pagal trukmę" },
  noPhotoShort: { ru: "Нет фото", lt: "Nėra foto" },
  notEnteredShort: { ru: "Не внесено", lt: "Neįvesta" },
  hasComment: { ru: "Есть комментарий", lt: "Yra komentaras" },
};

type LanguageContextType = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>('ru');

  const t = (key: string) => {
    return translations[key]?.[lang] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
