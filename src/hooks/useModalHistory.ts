import { useEffect } from 'react';

/**
 * useModalHistory — перехватывает кнопку "Назад" в браузере
 * и закрывает модальное окно вместо перехода на предыдущую страницу.
 *
 * @param isOpen    — открыто ли модальное окно прямо сейчас
 * @param onClose   — функция закрытия модального окна
 * @param key       — уникальный ключ для этого типа модала (напр. 'camera', 'lightbox', 'recipe-detail')
 * @returns handleClose — функция, которую нужно вызывать вместо onClose вручную
 */
export function useModalHistory(
  isOpen: boolean,
  onClose: () => void,
  key: string
): () => void {
  useEffect(() => {
    if (!isOpen) return;

    // Добавляем запись в историю браузера при открытии модала
    const state = { modal: key };
    history.pushState(state, '', window.location.href);

    const handlePopState = (event: PopStateEvent) => {
      // Браузер нажал "назад" — закрываем модал вместо перехода
      if (!event.state || event.state.modal !== key) {
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);

      // Если модал закрыли программно (не через кнопку браузера),
      // убираем добавленную запись из истории
      if (history.state && history.state.modal === key) {
        history.back();
      }
    };
  }, [isOpen, key]);

  // Возвращаем функцию закрытия — она просто вызывает onClose,
  // useEffect сам уберёт запись из истории через cleanup
  const handleClose = () => {
    onClose();
  };

  return handleClose;
}
