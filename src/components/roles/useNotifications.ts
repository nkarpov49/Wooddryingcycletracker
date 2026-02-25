import { useEffect, useRef } from 'react';

export function useNotifications(cycles: any[], enabled: boolean = true) {
  const lastAlertTime = useRef<Record<number, number>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Инициализация аудио
  useEffect(() => {
    if (typeof window !== 'undefined' && enabled) {
      // Создаём звуковой сигнал (beep) с помощью Web Audio API
      audioRef.current = new Audio();
      
      // Генерируем простой beep звук
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800; // Частота 800 Hz (приятный звук)
      oscillator.type = 'sine';
      
      // Создаём короткий beep (0.5 секунды)
      const duration = 0.5;
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      // Сохраняем функцию для воспроизведения
      audioRef.current.play = () => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.value = 800;
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + duration);
      };
      
      // Запрашиваем разрешение на уведомления
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [enabled]);
  
  // Проверка критических камер
  useEffect(() => {
    if (!enabled || !cycles || cycles.length === 0) return;
    
    const now = Date.now();
    const TWO_MINUTES = 2 * 60 * 1000;
    
    cycles.forEach((cycle: any) => {
      const progress = cycle.progressPercent ?? 0;
      const hasRecipePhoto = cycle.recipePhotoPath || (cycle.recipePhotos && cycle.recipePhotos.length > 0);
      const chamberNum = cycle.chamberNumber;
      
      // Критическая зона: 99-103% без фото
      const isCritical = progress >= 99 && progress <= 103 && !hasRecipePhoto;
      
      if (isCritical) {
        const lastAlert = lastAlertTime.current[chamberNum] || 0;
        const timeSinceLastAlert = now - lastAlert;
        
        // Показываем уведомление каждые 2 минуты
        if (timeSinceLastAlert >= TWO_MINUTES) {
          showNotification(chamberNum, progress);
          playSound();
          lastAlertTime.current[chamberNum] = now;
        }
      } else {
        // Сбрасываем таймер если камера больше не критична
        delete lastAlertTime.current[chamberNum];
      }
    });
  }, [cycles, enabled]);
  
  const showNotification = (chamberNum: number, progress: number) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('⚠️ Критическое состояние камеры!', {
        body: `Камера №${chamberNum} достигла ${Math.round(progress)}%.\nСфотографируйте рецепт СЕЙЧАС!`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `chamber-${chamberNum}`, // Чтобы не дублировать уведомления
        requireInteraction: true, // Не закрывается автоматически
        vibrate: [200, 100, 200], // Вибрация на мобильных
      });
      
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  };
  
  const playSound = () => {
    if (audioRef.current && audioRef.current.play) {
      try {
        // Воспроизводим 3 коротких beep-а
        audioRef.current.play();
        setTimeout(() => audioRef.current?.play(), 300);
        setTimeout(() => audioRef.current?.play(), 600);
      } catch (e) {
        console.error('Ошибка воспроизведения звука:', e);
      }
    }
  };
  
  return { playSound };
}
