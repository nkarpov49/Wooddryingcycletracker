import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, Save, Plus, Trash2, Loader2, Star, AlertCircle, Calendar, CloudSun, Clock } from "lucide-react";
import { api, DryingCycle, CyclePhoto } from "../utils/api";
import { toast } from "sonner@2.0.3";
import { useLanguage } from "../utils/i18n";
import { format, differenceInHours } from "date-fns";

const WOOD_TYPES = [
   "Birch235", "Birch285", "Alder235", "Oak235", "Ash235", "Maple235", "Scroblas235"
];

const CHAMBERS = Array.from({ length: 21 }, (_, i) => i + 1);

export default function CycleForm() {
  const navigate = useNavigate();
  const { id } = useParams(); // If present, edit mode
  const isEditMode = !!id;
  const location = useLocation();
  const copyFrom = location.state?.copyFrom as DryingCycle | undefined;
  const { t } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Validation State
  const [allCycles, setAllCycles] = useState<DryingCycle[]>([]);
  const [seqError, setSeqError] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<DryingCycle>>({
    chamberNumber: 1,
    sequentialNumber: "",
    recipeCode: "",
    woodType: WOOD_TYPES[0],
    customWoodType: "",
    recipePhotoPath: "", // Legacy
    recipePhotoUrl: "", // Legacy
    recipePhotos: [], // New
    finalMoisture: undefined,
    qualityRating: undefined,
    resultPhotos: [],
    overallComment: "",
    isBaseRecipe: false,
    status: 'In Progress',
    startDate: new Date().toISOString(),
    endDate: undefined,
    isTest: false,
    startTemperature: undefined,
    startWeatherCode: undefined,
    avgTemp: undefined,
    avgDayTemp: undefined,
    avgNightTemp: undefined,
    minTemp: undefined,
    maxTemp: undefined
  });

  // Photo Upload State
  const [uploadingResult, setUploadingResult] = useState(false);
  const resultInputRef = useRef<HTMLInputElement>(null);
  
  const [uploadingRecipe, setUploadingRecipe] = useState(false);
  const recipeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
       try {
         // Load all cycles for validation
         const cycles = await api.getCycles();
         setAllCycles(cycles);

         if (id) {
           const found = cycles.find((c: any) => c.id === id);
           if (found) {
             // Migration: If recipePhotos is empty/undefined but legacy url exists, populate it
             let rPhotos = found.recipePhotos || [];
             if (rPhotos.length === 0 && found.recipePhotoUrl) {
                 rPhotos = [{
                     path: found.recipePhotoPath || '',
                     url: found.recipePhotoUrl,
                     caption: ''
                 }];
             }
             setFormData({ ...found, recipePhotos: rPhotos });
           } else {
             toast.error(t('cyclesNotFound'));
             navigate("/");
           }
         } else if (copyFrom) {
            // Migration for copy
            let rPhotos = copyFrom.recipePhotos || [];
            if (rPhotos.length === 0 && copyFrom.recipePhotoUrl) {
                rPhotos = [{
                    path: copyFrom.recipePhotoPath || '',
                    url: copyFrom.recipePhotoUrl,
                    caption: ''
                }];
            }
            
            setFormData({
              ...formData,
              chamberNumber: copyFrom.chamberNumber, 
              recipeCode: copyFrom.recipeCode,
              woodType: copyFrom.woodType,
              customWoodType: copyFrom.customWoodType,
              recipePhotoPath: copyFrom.recipePhotoPath,
              recipePhotoUrl: copyFrom.recipePhotoUrl,
              recipePhotos: rPhotos,
              startDate: new Date().toISOString(),
              isTest: copyFrom.isTest,
            });
            toast.info(t('copy'));
            fetchWeatherStats(new Date().toISOString(), undefined);
         } else {
            // New form
            fetchWeatherStats(new Date().toISOString(), undefined);
         }
       } catch (err) {
         console.error(err);
         toast.error(t('error'));
       } finally {
         setInitialLoading(false);
       }
    };
    init();
  }, [id, copyFrom]);

  const handleStartDateChange = (dateStr: string) => {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const iso = date.toISOString();
      setFormData(prev => ({ ...prev, startDate: iso }));
      fetchWeatherStats(iso, formData.endDate);
    }
  };

  const handleEndDateChange = (dateStr: string) => {
    if (!dateStr) {
      setFormData(prev => ({ ...prev, endDate: undefined }));
      if (formData.startDate) fetchWeatherStats(formData.startDate, undefined);
      return;
    }
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const iso = date.toISOString();
      setFormData(prev => ({ ...prev, endDate: iso }));
      if (formData.startDate) fetchWeatherStats(formData.startDate, iso);
    }
  };

  async function fetchWeatherStats(startDateIso: string, endDateIso?: string) {
    const startDate = new Date(startDateIso);
    // Anykščiai coordinates: 55.5264, 25.1027
    const lat = 55.5264;
    const lon = 25.1027;

    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = endDateIso ? format(new Date(endDateIso), 'yyyy-MM-dd') : startStr;
    
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${endStr}&hourly=temperature_2m,weather_code&timezone=Europe%2FVilnius`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.hourly && data.hourly.temperature_2m) {
        const temps = data.hourly.temperature_2m;
        const times = data.hourly.time;
        const codes = data.hourly.weather_code;

        // 1. Get Start Temp (closest hour to start date)
        const startHourIndex = times.findIndex((t: string) => new Date(t).getTime() >= startDate.setMinutes(0,0,0));
        let startTemp = undefined;
        let startCode = undefined;
        if (startHourIndex !== -1 && temps[startHourIndex] !== undefined) {
          startTemp = temps[startHourIndex];
          startCode = codes[startHourIndex];
        }

        // 2. If End Date exists, calculate stats
        if (endDateIso) {
           const endDate = new Date(endDateIso);
           let validTemps: number[] = [];
           let dayTemps: number[] = [];
           let nightTemps: number[] = [];

           for (let i = 0; i < times.length; i++) {
              const time = new Date(times[i]);
              if (time >= startDate && time <= endDate) {
                 const temp = temps[i];
                 if (temp !== null && temp !== undefined) {
                    validTemps.push(temp);
                    const h = time.getHours();
                    if (h >= 6 && h < 22) {
                       dayTemps.push(temp);
                    } else {
                       nightTemps.push(temp);
                    }
                 }
              }
           }

           if (validTemps.length > 0) {
              const avg = validTemps.reduce((a,b) => a+b, 0) / validTemps.length;
              const min = Math.min(...validTemps);
              const max = Math.max(...validTemps);
              const avgDay = dayTemps.length ? dayTemps.reduce((a,b) => a+b, 0) / dayTemps.length : undefined;
              const avgNight = nightTemps.length ? nightTemps.reduce((a,b) => a+b, 0) / nightTemps.length : undefined;

              setFormData(prev => ({
                 ...prev,
                 startTemperature: startTemp,
                 startWeatherCode: startCode,
                 avgTemp: parseFloat(avg.toFixed(1)),
                 minTemp: min,
                 maxTemp: max,
                 avgDayTemp: avgDay !== undefined ? parseFloat(avgDay.toFixed(1)) : undefined,
                 avgNightTemp: avgNight !== undefined ? parseFloat(avgNight.toFixed(1)) : undefined,
              }));
           }
        } else {
           // No end date, reset stats, just keep start temp
           setFormData(prev => ({
             ...prev,
             startTemperature: startTemp,
             startWeatherCode: startCode,
             avgTemp: undefined,
             minTemp: undefined,
             maxTemp: undefined,
             avgDayTemp: undefined,
             avgNightTemp: undefined
           }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch weather", err);
    }
  }

  const validateSeqNumber = (seq: string) => {
    if (!seq) {
        setSeqError(null);
        return;
    }
    const duplicate = allCycles.find(c => 
        c.sequentialNumber && 
        c.sequentialNumber.trim().toLowerCase() === seq.trim().toLowerCase() && 
        c.id !== id
    );
    if (duplicate) {
        setSeqError(t('seqNumberExists'));
    } else {
        setSeqError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Final Validation check
    if (!formData.sequentialNumber) {
      toast.error(t('sequentialNumber') + " " + t('requiredField'));
      return;
    }

    if (seqError) {
        toast.error(t('seqNumberExists'));
        return;
    }

    setLoading(true);
    try {
      // Status Logic: Completed if End Date is present
      const status: 'In Progress' | 'Completed' = formData.endDate ? 'Completed' : 'In Progress';
      
      // Ensure legacy fields are populated from first recipe photo
      const primaryRecipePhoto = formData.recipePhotos?.[0];

      const cycleData = {
        ...formData,
        status,
        recipeCode: formData.recipeCode || "N/A",
        chamberNumber: Number(formData.chamberNumber),
        woodType: formData.woodType === 'Other' ? formData.customWoodType || 'Other' : formData.woodType,
        startDate: formData.startDate || new Date().toISOString(),
        // Sync legacy fields
        recipePhotoPath: primaryRecipePhoto?.path || '',
        recipePhotoUrl: primaryRecipePhoto?.url || '',
      } as DryingCycle;

      if (id) {
        await api.updateCycle(id, cycleData);
        toast.success(status === 'Completed' ? t('completed') : t('saved'));
      } else {
        await api.createCycle(cycleData);
        toast.success(t('saved'));
      }
      navigate("/");
    } catch (err) {
      console.error(err);
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (files: FileList | null, type: 'recipe' | 'result') => {
    if (!files || files.length === 0) return;

    const setUploading = type === 'recipe' ? setUploadingRecipe : setUploadingResult;
    setUploading(true);
    
    try {
      const newPhotos: CyclePhoto[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { path } = await api.uploadFile(file);
        newPhotos.push({
          path,
          url: URL.createObjectURL(file), 
          caption: ""
        });
      }
      
      setFormData(prev => ({
        ...prev,
        [type === 'recipe' ? 'recipePhotos' : 'resultPhotos']: [
            ...(prev[type === 'recipe' ? 'recipePhotos' : 'resultPhotos'] || []), 
            ...newPhotos
        ]
      }));
    } catch (err) {
      toast.error(t('error'));
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number, type: 'recipe' | 'result') => {
    const key = type === 'recipe' ? 'recipePhotos' : 'resultPhotos';
    setFormData(prev => ({
      ...prev,
      [key]: prev[key]?.filter((_, i) => i !== index)
    }));
  };
  
  const updateCaption = (index: number, caption: string, type: 'recipe' | 'result') => {
      const key = type === 'recipe' ? 'recipePhotos' : 'resultPhotos';
      const photos = [...(formData[key] || [])];
      if (photos[index]) {
          photos[index].caption = caption;
          setFormData({ ...formData, [key]: photos });
      }
  };

  if (initialLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;
  }

  const startDateValue = formData.startDate 
    ? format(new Date(formData.startDate), "yyyy-MM-dd'T'HH:mm")
    : format(new Date(), "yyyy-MM-dd'T'HH:mm");

  const endDateValue = formData.endDate 
    ? format(new Date(formData.endDate), "yyyy-MM-dd'T'HH:mm")
    : "";

  return (
    <div className="pb-20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? t('edit') : t('newCycle')}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex justify-between items-center border-b pb-2 mb-4">
             <h2 className="font-semibold text-gray-800">{t('recipeDetails')}</h2>
             
             {/* Test Mode Toggle - Only in Edit Mode */}
             {isEditMode && (
                 <div className="flex items-center gap-2">
                   <input 
                     type="checkbox"
                     id="isTest"
                     checked={formData.isTest}
                     onChange={e => setFormData({...formData, isTest: e.target.checked})}
                     className="w-4 h-4 text-amber-600 rounded border-gray-300"
                   />
                   <label htmlFor="isTest" className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('testMode')}</label>
                 </div>
             )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('chamber')}</label>
              <select 
                value={formData.chamberNumber}
                onChange={e => setFormData({...formData, chamberNumber: Number(e.target.value)})}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {CHAMBERS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('sequentialNumber')}</label>
              <input 
                type="text"
                required
                value={formData.sequentialNumber}
                onChange={e => {
                    setFormData({...formData, sequentialNumber: e.target.value});
                    if (seqError) validateSeqNumber(e.target.value);
                }}
                onBlur={(e) => validateSeqNumber(e.target.value)}
                className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-amber-500 ${seqError ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                placeholder="1045"
              />
              {seqError && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                      <AlertCircle className="w-3 h-3" />
                      {seqError}
                  </p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className={isEditMode ? "" : "col-span-2"}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('startDate')}</label>
              <input 
                type="datetime-local"
                value={startDateValue}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm"
              />
            </div>
            
            {/* End Date - Only in Edit Mode */}
            {isEditMode && (
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">{t('endDate')}</label>
                   <input 
                     type="datetime-local"
                     value={endDateValue}
                     onChange={(e) => handleEndDateChange(e.target.value)}
                     className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm"
                   />
                </div>
            )}
          </div>

          {/* Weather Display */}
          <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
             <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Weather (Anykščiai)</label>
             {formData.endDate ? (
                // Range Stats
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <CloudSun className="w-5 h-5 text-amber-500" />
                      <span className="text-sm text-gray-700">Avg Cycle Temp:</span>
                   </div>
                   <span className="font-bold text-gray-900">{formData.avgTemp !== undefined ? `${formData.avgTemp}°C` : '...'}</span>
                </div>
             ) : (
                // Start Temp
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <CloudSun className="w-5 h-5 text-gray-500" />
                      <span className="text-sm text-gray-700">Start Temp:</span>
                   </div>
                   <span className="font-bold text-gray-900">{formData.startTemperature !== undefined ? `${formData.startTemperature}°C` : '...'}</span>
                </div>
             )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('woodType')}</label>
            <select 
              value={WOOD_TYPES.includes(formData.woodType || '') ? formData.woodType : 'Other'}
              onChange={e => setFormData({...formData, woodType: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-amber-500"
            >
              {WOOD_TYPES.map(w => <option key={w} value={w}>{w}</option>)}
              <option value="Other">{t('other')}</option>
            </select>
            {(formData.woodType === 'Other' || !WOOD_TYPES.includes(formData.woodType || '')) && (
              <input 
                type="text"
                value={formData.customWoodType || (WOOD_TYPES.includes(formData.woodType || '') ? '' : formData.woodType)}
                onChange={e => setFormData({...formData, woodType: 'Other', customWoodType: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                placeholder={t('woodType')}
              />
            )}
          </div>

          {/* RECIPE PHOTOS & SAVE AS BASE - Only in Edit Mode */}
          {isEditMode && (
            <>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('recipePhoto')}</label>
                  <div className="space-y-3 mb-3">
                    {formData.recipePhotos?.map((photo, idx) => (
                      <div key={idx} className="flex gap-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <img src={photo.url} alt="Recipe" className="w-20 h-20 object-cover rounded bg-gray-200" />
                        <div className="flex-1 flex flex-col justify-between">
                          <input 
                            type="text"
                            placeholder={t('commentPlaceholder')}
                            value={photo.caption || ""}
                            onChange={(e) => updateCaption(idx, e.target.value, 'recipe')}
                            className="w-full text-sm bg-transparent border-b border-gray-300 focus:border-amber-500 focus:outline-none pb-1"
                          />
                          <button 
                            type="button"
                            onClick={() => removePhoto(idx, 'recipe')}
                            className="self-end text-red-500 text-xs flex items-center gap-1 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" /> {t('delete')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => recipeInputRef.current?.click()}
                    disabled={uploadingRecipe}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-amber-500 hover:text-amber-600 transition-colors flex items-center justify-center gap-2"
                  >
                    {uploadingRecipe ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {t('addPhoto')}
                  </button>
                  <input 
                    ref={recipeInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e.target.files, 'recipe')}
                  />
              </div>
              
              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox"
                  id="isBase"
                  checked={formData.isBaseRecipe}
                  onChange={e => setFormData({...formData, isBaseRecipe: e.target.checked})}
                  className="w-5 h-5 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                />
                <label htmlFor="isBase" className="text-sm font-medium text-gray-700">{t('saveAsBase')}</label>
              </div>
            </>
          )}
        </div>

        {/* RESULTS SECTION - Only in Edit Mode */}
        {isEditMode && (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
              <h2 className="font-semibold text-gray-800 border-b pb-2 mb-4">{t('resultsAndQuality')}</h2>
              
              <div className="grid grid-cols-1 gap-4">
                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('finalMoisture')}</label>
                  <input 
                    type="number"
                    step="0.1"
                    value={formData.finalMoisture ?? ''}
                    onChange={e => setFormData({...formData, finalMoisture: e.target.value ? parseFloat(e.target.value) : undefined})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    placeholder="8.5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('qualityRating')}</label>
                  <div className="flex items-center gap-2">
                    {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setFormData({...formData, qualityRating: rating})}
                        className="focus:outline-none"
                        title={`${rating} stars`}
                      />
                    ))}
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                           key={star}
                           type="button"
                           onClick={() => setFormData({...formData, qualityRating: star})}
                           className="focus:outline-none transition-transform active:scale-95"
                        >
                          <Star 
                            className={`w-8 h-8 ${
                              (formData.qualityRating || 0) >= star 
                                ? 'fill-amber-400 text-amber-400' 
                                : (formData.qualityRating || 0) >= star - 0.5 
                                  ? 'fill-amber-200 text-amber-400' 
                                  : 'text-gray-300'
                            }`} 
                          />
                        </button>
                      ))}
                      <span className="ml-2 text-lg font-bold text-gray-600">{formData.qualityRating || 0}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{t('tapToRate')}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('resultPhoto')}</label>
                  <div className="space-y-3 mb-3">
                    {formData.resultPhotos?.map((photo, idx) => (
                      <div key={idx} className="flex gap-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <img src={photo.url} alt="Result" className="w-20 h-20 object-cover rounded bg-gray-200" />
                        <div className="flex-1 flex flex-col justify-between">
                          <input 
                            type="text"
                            placeholder="..."
                            value={photo.caption || ""}
                            onChange={(e) => updateCaption(idx, e.target.value, 'result')}
                            className="w-full text-sm bg-transparent border-b border-gray-300 focus:border-amber-500 focus:outline-none pb-1"
                          />
                          <button 
                            type="button"
                            onClick={() => removePhoto(idx, 'result')}
                            className="self-end text-red-500 text-xs flex items-center gap-1 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" /> {t('delete')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => resultInputRef.current?.click()}
                    disabled={uploadingResult}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-amber-500 hover:text-amber-600 transition-colors flex items-center justify-center gap-2"
                  >
                    {uploadingResult ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {t('addPhoto')}
                  </button>
                  <input 
                    ref={resultInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e.target.files, 'result')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('overallComment')}</label>
                  <textarea 
                    rows={4}
                    value={formData.overallComment}
                    onChange={e => setFormData({...formData, overallComment: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    placeholder={t('commentPlaceholder')}
                  />
                </div>
              </div>
            </div>
        )}

        {/* Bottom Save Button */}
        <div className="pt-4 pb-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-amber-700 flex items-center justify-center gap-2 disabled:opacity-50 text-lg transition-all active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {t('save')}
            </button>
        </div>
      </form>
    </div>
  );
}
