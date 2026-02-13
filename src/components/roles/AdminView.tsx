import React from 'react'
import CalendarView from '../ui/CalendarView.tsx'
import CycleList from '../ui/CycleList.tsx'
import CycleForm from '../ui/CycleForm.tsx'
import CycleDetail from '../ui/CycleDetail.tsx' // если нужно детали
import PhotoUpload from '../ui/PhotoUpload.tsx'
import WeatherWidget from '../ui/WeatherWidget.tsx'
import ScrollToTop from '../ui/ScrollToTop.tsx'

const AdminView: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <ScrollToTop />
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold">Администратор — Полный доступ</h1>
        <div className="mt-4">
          <WeatherWidget /> {/* Погода */}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Календарь сушильных камер</h2>
          <CalendarView /> {/* Твой красивый календарь с лентами */}
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Список циклов</h2>
          <CycleList /> {/* Карточки текущих и завершённых */}

          <h2 className="text-2xl font-semibold mt-8 mb-4">Создать / редактировать цикл</ […]```tsx
          <CycleForm /> {/* Форма с фото, рейтингом, влажностью */}

          <h2 className="text-2xl font-semibold mt-8 mb-4">Загрузка фото</h2>
          <PhotoUpload /> {/* Если нужно отдельно */}
        </section>
      </div>
    </div>
  )
}

export default AdminView
