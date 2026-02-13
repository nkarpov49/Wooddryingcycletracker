import React, { useState, useEffect, useRef } from 'react';
import { Camera, Check, Loader2, Search, X, LogOut, Package, MessageSquare, Droplets, Image as ImageIcon, Calendar, Clock, Plus, Trash2 } from 'lucide-react';
import { api, DryingCycle } from '../../utils/api';
import { toast } from 'sonner@2.0.3';
import { format, parseISO, differenceInHours } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../utils/i18n';

export default function PackerView() {
  const { logout } = useAuth();
  const { t, lang } = useLanguage();
  const [cycles, setCycles] = useState<DryingCycle[]>([]);
  const [filteredCycles, setFilteredCycles] = useState<DryingCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedCycle, setSelectedCycle] = useState<DryingCycle | null>(null);
  const [uploading, setUploading] = useState(false);
  const [comment, setComment] = useState('');
  
  // Staged Photos
  const [stagedPhotos, setStagedPhotos] = useState<{file: File, url: string}[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCycles = async () => {
    try {
      const data = await api.getCycles();
      // Filter for completed or ended cycles
      const finished = data.filter((c: any) => c.endDate || c.status === 'Completed');
      // Sort by newest end date
      finished.sort((a, b) => new Date(b.endDate || b.createdAt).getTime() - new Date(a.endDate || a.createdAt).getTime());
      
      setCycles(finished);
    } catch (e) {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCycles();
  }, []);

  useEffect(() => {
    let result = cycles;

    const q = searchQuery.trim().toLowerCase();
    if (q) {
        if (/^\d+$/.test(q)) {
            // If numeric
            if (q.length <= 2) {
                // 1-2 digits: Search by Chamber Number
                result = result.filter(c => String(c.chamberNumber) === q);
            } else {
                // 3+ digits: Search by Sequential Number
                result = result.filter(c => (c.sequentialNumber || '').includes(q));
            }
        } else {
             // Text search
             result = result.filter(c => 
                c.woodType?.toLowerCase().includes(q)
             );
        }
    }
    
    setFilteredCycles(result);
  }, [searchQuery, cycles]);

  const handleCycleClick = (cycle: DryingCycle) => {
    setSelectedCycle(cycle);
    setStagedPhotos([]);
    setComment(cycle.overallComment || '');
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
    if (!selectedCycle || (stagedPhotos.length === 0 && !comment)) {
        if (selectedCycle && comment && stagedPhotos.length === 0) {
             toast.error(t('addPhoto'));
             return;
        }
        return;
    }
    
    setUploading(true);
    try {
      const newPhotos = [];
      for (const photo of stagedPhotos) {
          const { path } = await api.uploadFile(photo.file);
          newPhotos.push({
              path,
              url: photo.url,
              caption: `Result photo ${format(new Date(), 'dd.MM HH:mm')}`
          });
      }

      const updatedPhotos = [...(selectedCycle.resultPhotos || []), ...newPhotos];
      
      await api.updateCycle(selectedCycle.id, {
        ...selectedCycle,
        resultPhotos: updatedPhotos,
        overallComment: comment
      });

      toast.success(t('saved'));
      setSelectedCycle(null);
      fetchCycles();
    } catch (e) {
      console.error(e);
      toast.error(t('error'));
    } finally {
      setUploading(false);
    }
  };

  const getWoodColor = (woodType: string) => {
    const type = (woodType || '').toLowerCase();
    if (type.includes('birch')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (type.includes('oak')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (type.includes('alder')) return 'bg-gray-100 text-gray-800 border-gray-200';
    if (type.includes('maple') || type.includes('ash')) return 'bg-green-100 text-green-800 border-green-200';
    if (type.includes('scroblas')) return 'bg-white text-gray-800 border-gray-300 shadow-sm';
    return 'bg-amber-50 text-amber-800 border-amber-100';
  };

  const getDuration = (cycle: DryingCycle) => {
      if (!cycle.startDate || !cycle.endDate) return null;
      return differenceInHours(parseISO(cycle.endDate), parseISO(cycle.startDate));
  };

  // Render specific detail view if selected
  if (selectedCycle) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Detail Header */}
        <div className="bg-white p-4 shadow-sm flex items-center justify-between sticky top-0 z-10">
           <button onClick={() => setSelectedCycle(null)} className="p-2 hover:bg-gray-100 rounded-full">
             <X className="w-6 h-6 text-gray-600" />
           </button>
           <div className="text-center">
             <h2 className="font-bold text-gray-900">#{selectedCycle.sequentialNumber}</h2>
             <span className="text-xs text-gray-500">
                {lang === 'ru' ? 'Камера' : 'Kamera'} {selectedCycle.chamberNumber} • {selectedCycle.woodType}
             </span>
           </div>
           <div className="w-10" />
        </div>

        <div className="flex-1 p-4 flex flex-col gap-6 max-w-lg mx-auto w-full">
           {/* Previously Uploaded Photos */}
           {selectedCycle.resultPhotos && selectedCycle.resultPhotos.length > 0 && stagedPhotos.length === 0 && (
               <div className="space-y-2">
                   <p className="text-xs font-bold text-gray-500 uppercase">{lang === 'ru' ? 'Загружено ранее' : 'Įkelta anksčiau'}</p>
                   <div className="grid grid-cols-3 gap-2">
                       {selectedCycle.resultPhotos.map((p, i) => (
                           <img key={i} src={p.url} className="w-full aspect-square object-cover rounded-lg border" alt="Result" />
                       ))}
                   </div>
               </div>
           )}

           {/* Staged Photos (New) */}
           {stagedPhotos.length > 0 ? (
              <div className="w-full">
                  <div className="grid grid-cols-2 gap-3 mb-2">
                      {stagedPhotos.map((photo, idx) => (
                          <div key={idx} className="relative aspect-[3/4] bg-black rounded-xl overflow-hidden shadow-sm group">
                              <img src={photo.url} alt={`New ${idx}`} className="w-full h-full object-cover" />
                              <button 
                                  onClick={() => removePhoto(idx)}
                                  className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-full text-white shadow hover:bg-red-500"
                              >
                                  <Trash2 className="w-4 h-4" />
                              </button>
                          </div>
                      ))}
                      
                      {/* Add Button Always Visible */}
                      <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="aspect-[3/4] bg-amber-50 rounded-xl border-2 border-dashed border-amber-300 flex flex-col items-center justify-center gap-2 hover:bg-amber-100 transition-colors"
                      >
                          <Plus className="w-8 h-8 text-amber-400" />
                          <span className="text-xs text-amber-600 font-bold">{lang === 'ru' ? 'Добавить' : 'Pridėti'}</span>
                      </button>
                  </div>
              </div>
           ) : (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-amber-300 bg-amber-50 text-amber-700 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-amber-100 transition-colors"
              >
                <div className="bg-white p-4 rounded-full shadow-sm">
                    <Camera className="w-8 h-8" />
                </div>
                <span className="font-semibold">
                    {lang === 'ru' ? 'Сфотографировать результат' : 'Nufotografuoti rezultatą'}
                </span>
              </button>
           )}

           {/* Comment */}
           <div>
               <label className="block text-sm font-bold text-gray-700 mb-2">
                   {lang === 'ru' ? 'Комментарий' : 'Komentaras'}
               </label>
               <textarea 
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={lang === 'ru' ? 'Качество доски, дефекты...' : 'Lentos kokybė, defektai...'}
                  className="w-full p-4 border border-gray-300 rounded-xl h-32 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-base"
               />
           </div>

           {/* Save Button */}
           <div className="mt-auto">
               <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
               />
               <button 
                  onClick={handleSave}
                  disabled={uploading || (stagedPhotos.length === 0 && !comment)}
                  className="w-full py-4 bg-green-600 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
               >
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
                  {lang === 'ru' ? 'Сохранить результат' : 'Išsaugoti rezultatą'} 
                  {stagedPhotos.length > 0 && ` (${stagedPhotos.length})`}
               </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="px-4 py-3 flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-6 h-6 text-amber-500" />
                {lang === 'ru' ? 'Лидер' : 'Lyderis'}
            </h1>
            <button onClick={logout} className="text-gray-500 hover:text-red-600">
                <LogOut className="w-5 h-5" />
            </button>
          </div>
          
          {/* Search */}
          <div className="px-4 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder={lang === 'ru' ? 'ID (3+) или Камера (1-2)...' : 'ID (3+) arba Kamera (1-2)...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-100 border-transparent focus:bg-white focus:border-amber-500 focus:ring-0 rounded-lg text-sm"
                />
              </div>
          </div>

          {/* Legend & Instructions */}
          <div className="px-4 pb-3 border-t border-gray-100 pt-2 bg-gray-50/50">
             <div className="flex items-center gap-6 text-xs text-gray-500 font-bold justify-between sm:justify-start">
                 <div className="flex items-center gap-2">
                     <Droplets className="w-5 h-5 text-blue-500" />
                     {lang === 'ru' ? 'Влажность' : 'Drėgmė'}
                 </div>
                 <div className="flex items-center gap-2">
                     <MessageSquare className="w-5 h-5 text-amber-500" />
                     {lang === 'ru' ? 'Коммент' : 'Koment.'}
                 </div>
                 <div className="flex items-center gap-2">
                     <ImageIcon className="w-5 h-5 text-green-500" />
                     {lang === 'ru' ? 'Фото' : 'Nuotr.'}
                 </div>
             </div>
          </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-[30vh]">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : (
        <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredCycles.length === 0 ? (
              <div className="col-span-full text-center py-10 text-gray-400 text-sm">
                  {lang === 'ru' ? 'Циклы не найдены' : 'Ciklai nerasti'}
              </div>
          ) : (
              filteredCycles.map(cycle => {
                const duration = getDuration(cycle);
                const woodStyle = getWoodColor(cycle.woodType);
                const hasPhotos = cycle.resultPhotos && cycle.resultPhotos.length > 0;
                const hasComment = cycle.overallComment && cycle.overallComment.length > 0;
                const hasMoisture = cycle.finalMoisture !== undefined && cycle.finalMoisture !== null;
                
                return (
                  <button
                      key={cycle.id}
                      onClick={() => handleCycleClick(cycle)}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 hover:border-amber-300 text-left active:scale-[0.98] transition-all overflow-hidden flex flex-col h-full"
                  >
                      {/* Top Bar: Chamber & ID */}
                      <div className="p-3 pb-2 flex justify-between items-center border-b border-gray-50">
                          <div className="flex flex-col">
                              <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">
                                  {lang === 'ru' ? 'Камера' : 'Kamera'}
                              </span>
                              <span className="text-xl font-black text-gray-900">
                                  {cycle.chamberNumber}
                              </span>
                          </div>
                          <div className="text-right">
                               <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider block">
                                  ID
                               </span>
                               <span className="font-mono font-bold text-gray-700 text-sm">
                                  #{cycle.sequentialNumber?.split('-').pop() || cycle.sequentialNumber}
                               </span>
                          </div>
                      </div>

                      {/* Middle: Wood Type */}
                      <div className={`px-3 py-2 text-center font-bold text-sm truncate flex-1 flex items-center justify-center ${woodStyle}`}>
                          {cycle.woodType}
                      </div>

                      {/* Bottom: Date & Indicators */}
                      <div className="p-2 pt-2 bg-gray-50 flex items-center justify-between border-t border-gray-100">
                          <div className="flex flex-col leading-none">
                              <span className="text-[10px] font-bold text-gray-500">
                                  {cycle.endDate ? format(new Date(cycle.endDate), 'dd.MM') : '-'}
                              </span>
                              {duration && (
                                  <span className="text-[9px] text-gray-400 mt-0.5">
                                      {duration}h
                                  </span>
                              )}
                          </div>
                          
                          <div className="flex items-center gap-1">
                              {/* Moisture */}
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${hasMoisture ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400'}`}>
                                  <Droplets className="w-3 h-3" />
                              </div>
                              {/* Comment */}
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${hasComment ? 'bg-amber-100 text-amber-600' : 'bg-gray-200 text-gray-400'}`}>
                                  <MessageSquare className="w-3 h-3" />
                              </div>
                              {/* Photo */}
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${hasPhotos ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                                  <ImageIcon className="w-3 h-3" />
                              </div>
                          </div>
                      </div>
                  </button>
                );
              })
          )}
        </div>
      )}
    </div>
  );
}
