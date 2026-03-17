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
  completed: { ru: "Завершено", lt: "Užbaigta" },
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
  qualityRating: { ru: "Оценка Качества (0-5)", lt: "Kokybės įvertinimas (0-5)" },
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
  duration: { ru: "Длитеность", lt: "Trukmė" },
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
  // Operator View
  operatorTitle: { ru: "Оператор. Фото рецептов", lt: "Operatorius. Recepto nuotraukos" },
  free: { ru: "Свободно", lt: "Laisva" },
  takeSettingsPhoto: { ru: "Сфотографируйте экран настроек", lt: "Nufotografuokite nustatymų ekraną" },
  takePhoto: { ru: "Сфотографировать рецепт", lt: "Nufotografuoti receptą" },
  chooseFromGallery: { ru: "Выбрать из галереи", lt: "Pasirinkti iš galerijos" },
  photosTaken: { ru: "Сделано фото", lt: "Padaryta nuotraukų" },
  done: { ru: "Готово", lt: "Atlikta" },
  addMore: { ru: "Добавить", lt: "Pridėti" },
  existingPhotos: { ru: "Существующие фото", lt: "Esamos nuotraukos" },
  newPhotos: { ru: "Новые фото", lt: "Naujos nuotraukos" },
  photoAddedFromClipboard: { ru: "Фото добавлено из буфера обмена! 📋✨", lt: "Nuotrauka pridėta iš mainų srities! 📋✨" },
  pasteHint: { ru: "Нажмите Ctrl+V для ставки скриншота", lt: "Paspauskite Ctrl+V nuotraukos įkėlimui" },
  keyboardReminder: { ru: "Напоминание о клавишах", lt: "Klavišų priminimas" },
  tipLabel: { ru: "Совет", lt: "Patarimas" },
  logout: { ru: "Выход", lt: "Atsijungti" },
  search: { ru: "Поиск", lt: "Paieška" },
  // Packer/Leader Line Selection
  selectLine: { ru: "Выберите линию", lt: "Pasirinkite liniją" },
  line1And2: { ru: "1 и 2 линия", lt: "1 ir 2 linija" },
  line3: { ru: "3 линия", lt: "3 linija" },
  line1: { ru: "1 линия", lt: "1 linija" },
  line2: { ru: "2 линия", lt: "2 linija" },
  leaderLine1And2Title: { ru: "Лидер • 1 и 2 линия", lt: "Lyderis • 1 ir 2 linija" },
  leaderLine3Title: { ru: "Лидер • 3 линия", lt: "Lyderis • 3 linija" },
  activeChambers: { ru: "Активные камеры", lt: "Aktyvios džiovyklos" },
  completedCycles: { ru: "Завершённые циклы", lt: "Užbaigti ciklai" },
  leaderInstructions: { ru: "Просматривайте активные сушки и завершённые циклы", lt: "Peržiūrėkite aktyvius džiovinimus ir užbaigtus ciklus" },
  filterByDate: { ru: "По дате выгрузки", lt: "Pagal iškrovimo datą" },
  filterByWood: { ru: "По породе", lt: "Pagal medieną" },
  unloadDate: { ru: "Дата выгрузки", lt: "Iškrovimo data" },
  allWoodTypes: { ru: "Все породы", lt: "Visos rūšys" },
  currentWork: { ru: "Сейчас в работе", lt: "Dabar vyksta" },
  currentWorkEmpty: { ru: "Нет активных работ", lt: "Nėra aktyvių darbų" },
  addComment: { ru: "Добавить комментарий", lt: "Pridėti komentarą" },
  addResultPhoto: { ru: "Добавить фото результата", lt: "Pridėti rezultato nuotrauką" },
  viewDetails: { ru: "Смотреть детали", lt: "Peržiūrėti detales" },
  notFoundInDatabase: { ru: "Не найдено в базе", lt: "Nerasta duomenų bazėje" },
  cancel: { ru: "Отмена", lt: "Atšaukti" },
  dataUpdated: { ru: "Данные обновлены", lt: "Duomenys atnaujinti" },
  // Role Selection
  operator: { ru: "Оператор", lt: "Operatorius" },
  packer: { ru: "Лидер", lt: "Lyderis" },
  admin: { ru: "Администратор", lt: "Administratorius" },
  driver: { ru: "Логист/Водитель", lt: "Logistas/Vairuotojas" },
  // Driver View
  driverTitle: { ru: "Контроль веса", lt: "Svorio kontrolė" },
  weighingProcess: { ru: "Процесс взвешивания", lt: "Svėrimo procesas" },
  takeWeightPhoto: { ru: "Сфотографируйте весы", lt: "Nufotografuokite svarstykles" },
  boxNumber: { ru: "Ящик", lt: "Dėžė" },
  analyzing: { ru: "Анализ изображения...", lt: "Analizuojama nuotrauka..." },
  weightDetected: { ru: "Обнаружен вес", lt: "Aptiktas svoris" },
  approvedForShipment: { ru: "✓ РАЗРЕШЕНО ВЫВОЗИТЬ", lt: "✓ LEIDŽIAMA VEŽTI" },
  overweight: { ru: "✗ ПЕРЕГРУЗ", lt: "✗ PERKROVA" },
  additionalDrying: { ru: "Рекомендуется досушить", lt: "Rekomenduojama papildomai džiovinti" },
  currentTime: { ru: "Сейчас", lt: "Dabar" },
  recommendedEnd: { ru: "Рекомендуемое окончание", lt: "Rekomenduojamas pabaigos laikas" },
  avgOverweight: { ru: "Средний перегруз", lt: "Vidutinė perkrova" },
  confirmResult: { ru: "Подтвердить результат", lt: "Patvirtinti rezultatą" },
  retake: { ru: "Переснять", lt: "Perfotografuoti" },
  boxesWeighed: { ru: "Взвешено ящиков", lt: "Pasvertų dėžių" },
  weightLimit: { ru: "Лимит веса", lt: "Svorio limitas" },
  startWeighing: { ru: "Начать взвешивание", lt: "Pradėti svėrimą" },
  calculate: { ru: "Рассчитать", lt: "Apskaičiuoti" },
  // Weight Progress Chart
  weightProgressChart: { ru: "График снижния веса", lt: "Svorio mažėjimo grafikas" },
  weightDynamics: { ru: "Динамика сушки по времени", lt: "Džiovinimo dinamika laike" },
  weightReduction: { ru: "Снижение веса", lt: "Svorio mažėjimas" },
  targetWeight: { ru: "Целевой вес", lt: "Tikslo svoris" },
  totalWeight: { ru: "Общий вес", lt: "Bendras svoris" },
  avgBoxWeight: { ru: "Средний вес ящика", lt: "Vidutinis dėžės svoris" },
  sumOfAllBoxes: { ru: "Сумма всех ящиков", lt: "Visų dėžių suma" },
  avgValue: { ru: "Среднее значение ящика", lt: "Vidutinė dėžės vertė" },
  acceptableLimit: { ru: "Допустимый лимит", lt: "Leistinas limitas" },
  targetReached: { ru: "Цель достигнута!", lt: "Tikslas pasiektas!" },
  readyForPacking: { ru: "Древесина готова к упаковке", lt: "Mediena paruošta pakavimui" },
  hoursFromStart: { ru: "Часы с начала цикла", lt: "Valandos nuo ciklo pradžios" },
  weightTons: { ru: "Вес (тонны)", lt: "Svoris (tonos)" },
  // Advanced Photo Gallery
  of: { ru: "/", lt: "/" },
  zoomHint: { ru: "Используйте +/- для зума, стрелки для навигации", lt: "Naudokite +/- masteliui, rodykles navigacijai" },
  mobileZoomHint: { ru: "Swipe для перехода, pinch для зума", lt: "Braukite keitimui, plėskite masteliui" },
  // Weighing History
  weighingHistory: { ru: "История взвешиваний", lt: "Svėrimo istorija" },
  clearHistory: { ru: "Очистить историю", lt: "Išvalyti istoriją" },
  clearHistoryConfirm: { ru: "Очистить историю?", lt: "Išvalyti istoriją?" },
  clearHistoryWarning: { ru: "Вы уверены, что хотите удалить всю историю взвешиваний для этого цикла?", lt: "Ar tikrai norite ištrinti visą šio ciklo svėrimo istoriją?" },
  cannotUndo: { ru: "Это действие нельзя отменить.", lt: "Šis veiksmas negali būti atšauktas." },
  historyCleared: { ru: "История взвешиваний очищена", lt: "Svėrimo istorija išvalyta" },
  deleteRecord: { ru: "Удалить запись", lt: "Ištrinti įrašą" },
  recordDeleted: { ru: "Запись удалена", lt: "Įrašas ištrintas" },
  recordNotFound: { ru: "Запись не найдена", lt: "Įrašas nerastas" },
  fromCycleStart: { ru: "От начала цикла", lt: "Nuo ciklo pradžios" },
  sinceLastCheck: { ru: "С последней проверки", lt: "Nuo paskutinio patikrinimo" },
  boxWeights: { ru: "Вес ящиков", lt: "Dėžių svoris" },
  recommendation: { ru: "Рекомендация", lt: "Rekomendacija" },
  ready: { ru: "Готово", lt: "Paruošta" },
  collectWood: { ru: "Забрать дерево", lt: "Paimti medieną" },
  readyToCollect: { ru: "Готово, забрать дерево", lt: "Paruošta, paimti medieną" },
  continueDrying: { ru: "Продолжить сушку", lt: "Tęsti džiovinimą" },
  until: { ru: "до", lt: "iki" },
  // Failed cycles
  wet: { ru: "СЫРОЕ", lt: "ŠLAPIAS" },
  markAsFailed: { ru: "Отметить как неудачный", lt: "Pažymėti kaip nesėkmingą" },
  markAsSuccess: { ru: "Отметить как успешный", lt: "Pažymėti kaip sėkmingą" },
  markedAsWet: { ru: "Помечено как СЫРОЕ", lt: "Pažymėta kaip ŠLAPIAS" },
  markedAsSuccess: { ru: "Помечено как успешный", lt: "Pažymėta kaip sėkmingas" },
  markAsWet: { ru: "Отметить как СЫРОЕ", lt: "Pažymėti kaip ŠLAPIAS" },
  failedCycle: { ru: "Неудачный цикл", lt: "Nesėkmingas ciklas" },
  searchByChamber: { ru: "Поиск по камере", lt: "Ieškoti pagal džiovyklą" },
  searchBySeqNumber: { ru: "Поиск по номеру сушки", lt: "Ieškoti pagal džiovinimo numerį" },
  viewRecipe: { ru: "Просмотр рецепта", lt: "Peržiūrėti receptą" },
};

type LanguageContextType = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    // Load saved language from localStorage or default to 'ru'
    return (localStorage.getItem('wood_app_lang') as Language) || 'ru';
  });

  const handleSetLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('wood_app_lang', newLang);
  };

  const t = (key: string) => {
    return translations[key]?.[lang] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t }}>
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