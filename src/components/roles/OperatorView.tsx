import React, { useState, useEffect, useRef } from 'react';
import { Camera, Check, Loader2, RefreshCw, X, LogOut, Plus, Trash2 } from 'lucide-react';
import { api, DryingCycle } from '../../utils/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';

export default function OperatorView() {
  const { logout } = useAuth();
  const [cycles, setCycles] = useState<DryingCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedChamber, setSelectedChamber] = useState<number | null>(null);
  
  // Staged Photos
  const [stagedPhotos, setStagedPhotos] = useState<{file: File, url: string}[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chambers 1-21
  const chambers = Array.from({ length: 21 }, (_, i) => i + 1);

  const fetchCycles = async () => {
    try {
      const data = await api.getCycles();
      setCycles(data.filter((c: any) => c.status === 'In Progress' && !c.endDate));
    } catch (e) {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCycles();
    const interval = setInterval(fetchCycles, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleChamberClick = (chamberId: number) => {
    setSelectedChamber(chamberId);
    setStagedPhotos([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setStagedPhotos(prev => [...prev, { file, url }]);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    setStagedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!selectedChamber || stagedPhotos.length === 0) return;
    
    setUploading(true);
    try {
      // 1. Upload all photos
      const newPhotos = [];
      for (const photo of stagedPhotos) {
          const { path } = await api.uploadFile(photo.file);
          newPhotos.push({
              path,
              url: photo.url, // Temporary
              caption: `Recipe photo ${format(new Date(), 'dd.MM HH:mm')}`
          });
      }

      // 2. Find active cycle or create new one
      const existingCycle = cycles.find(c => c.chamberNumber === selectedChamber);
      
      if (existingCycle) {
        // Update existing
        const updatedPhotos = [...(existingCycle.recipePhotos || []), ...newPhotos];
        await api.updateCycle(existingCycle.id, {
          ...existingCycle,
          recipePhotos: updatedPhotos,
          recipePhotoPath: newPhotos[0].path // Legacy sync (first one)
        });
      } else {
        // Create new cycle automatically
        const newCycle = {
          chamberNumber: selectedChamber,
          startDate: new Date().toISOString(),
          status: 'In Progress',
          woodType: 'Не указано', // Default
          sequentialNumber: `${new Date().getFullYear()}-${selectedChamber}-${Math.floor(Math.random() * 1000)}`, // Temp ID
          recipePhotos: newPhotos,
          recipePhotoPath: newPhotos[0].path
        };
        await api.createCycle(newCycle as any);
      }

      toast.success('Фото сохранено!');
      setSelectedChamber(null);
      fetchCycles();
    } catch (e) {
      console.error(e);
      toast.error('Ошибка сохранения');
    } finally {
      setUploading(false);
    }
  };

  const getWoodStyle = (woodType: string) => {
    const type = (woodType || '').toLowerCase();
    if (type.includes('birch')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (type.includes('oak')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (type.includes('alder')) return 'bg-gray-100 text-gray-800 border-gray-200';
    if (type.includes('maple') || type.includes('ash')) return 'bg-green-100 text-green-800 border-green-200';
    if (type.includes('scroblas')) return 'bg-white text-gray-800 border-gray-300 shadow-sm';
    return 'bg-amber-50 text-amber-800 border-amber-100';
  };

  const activeCycle = selectedChamber ? cycles.find(c => c.chamberNumber === selectedChamber) : null;

  if (selectedChamber) {
    // CAMERA / UPLOAD VIEW
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col text-white">
        <div className="flex-1 flex flex-col p-4">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <button 
              onClick={() => setSelectedChamber(null)}
              className="p-3 bg-gray-800 rounded-full hover:bg-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="text-center">
              <span className="text-sm text-gray-400 uppercase tracking-widest">Камера</span>
              <h2 className="text-3xl font-bold">№{selectedChamber}</h2>
            </div>
            <div className="w-12"></div> {/* Spacer */}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            {stagedPhotos.length > 0 ? (
              <div className="w-full max-w-md">
                  {/* Photo Grid / Carousel */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                      {stagedPhotos.map((photo, idx) => (
                          <div key={idx} className="relative aspect-[3/4] bg-black rounded-xl overflow-hidden border border-gray-700 group">
                              <img src={photo.url} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                              <button 
                                  onClick={() => removePhoto(idx)}
                                  className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-full text-white shadow-md hover:bg-red-50"
                              >
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                      ))}
                      
                      {/* Add Button Always Visible */}
                      <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-[3/4] bg-gray-800 rounded-xl border-2 border-dashed border-gray-600 flex flex-col items-center justify-center gap-2 hover:bg-gray-700 transition-colors"
                      >
                          <Plus className="w-8 h-8 text-gray-400" />
                          <span className="text-sm text-gray-400 font-bold">Добавить</span>
                      </button>
                  </div>
                  <p className="text-center text-gray-400 text-sm">
                      Сделано фото: {stagedPhotos.length}
                  </p>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="bg-gray-800 p-6 rounded-2xl inline-block mb-4">
                  <Camera className="w-16 h-16 text-gray-500" />
                </div>
                <p className="text-xl text-gray-300">
                  {activeCycle 
                    ? `Сушка #${activeCycle.sequentialNumber}` 
                    : 'Новый цикл сушки'}
                </p>
                <p className="text-gray-500">Сфотографируйте экран контроллера</p>
              </div>
            )}
          </div>

          <div className="mt-8 pb-8 w-full max-w-md mx-auto">
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {stagedPhotos.length === 0 ? (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-6 bg-green-600 hover:bg-green-500 text-white rounded-3xl font-bold text-xl shadow-lg flex items-center justify-center gap-3 transition-transform active:scale-95"
              >
                <Camera className="w-8 h-8" />
                Сфотографировать рецепт
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleSave}
                  disabled={uploading}
                  className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
                >
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
                  Готово ({stagedPhotos.length})
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // DASHBOARD VIEW
  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Цех сушки</h1>
        <button onClick={logout} className="text-gray-500 hover:text-red-600 flex items-center gap-2 font-medium">
          <LogOut className="w-5 h-5" />
          <span className="hidden sm:inline">Выход</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="w-10 h-10 text-gray-400 animate-spin" />
        </div>
      ) : (
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {chambers.map(chamberNum => {
            const active = cycles.find(c => c.chamberNumber === chamberNum);
            
            return (
              <button
                key={chamberNum}
                onClick={() => handleChamberClick(chamberNum)}
                className={`
                  relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all active:scale-95 min-h-[160px]
                  ${active 
                    ? 'bg-white border-blue-200 shadow-md' 
                    : 'bg-gray-100 border-dashed border-gray-300 text-gray-400'}
                `}
              >
                {/* Large Chamber Number */}
                <div className={`text-6xl font-black mb-3 ${active ? 'text-gray-900' : 'text-gray-300'}`}>
                  {chamberNum}
                </div>
                
                {active ? (
                  <div className="text-center w-full flex flex-col items-center gap-2">
                    {/* Wood Type Badge */}
                    <span className={`px-3 py-1 rounded-lg text-sm font-bold border uppercase tracking-wide shadow-sm ${getWoodStyle(active.woodType)}`}>
                        {active.woodType || 'Не указано'}
                    </span>
                    
                    {/* Date */}
                    <div className="text-xs text-gray-500 font-medium">
                      {format(new Date(active.startDate || ''), 'dd.MM HH:mm')}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-medium text-gray-400 uppercase">
                    Свободно
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
