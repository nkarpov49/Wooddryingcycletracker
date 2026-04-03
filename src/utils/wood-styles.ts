/**
 * Централизованная логика определения цветов для пород дерева.
 * Поддерживает как литовские, так и английские названия.
 */
export const getWoodStyle = (woodType: string) => {
  const type = (woodType || '').toLowerCase();
  
  // Береза / Beržas
  if (type.includes('birch') || type.includes('beržas')) {
    return 'bg-blue-100 text-blue-800 border-blue-200';
  }
  
  // Дуб / Ąžuolas
  if (type.includes('oak') || type.includes('ąžuolas')) {
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }
  
  // Ольха / Alksnis
  if (type.includes('alder') || type.includes('alksnis')) {
    return 'bg-gray-100 text-gray-800 border-gray-200';
  }
  
  // Клен / Klevas или Ясень / Uosis
  if (
    type.includes('maple') || 
    type.includes('klevas') || 
    type.includes('ash') || 
    type.includes('uosis')
  ) {
    return 'bg-green-100 text-green-800 border-green-200';
  }
  
  // Граб / Skroblas
  if (type.includes('scroblas') || type.includes('skroblas')) {
    return 'bg-white text-gray-800 border-gray-300 shadow-sm';
  }
  
  // По умолчанию (другие породы)
  return 'bg-amber-50 text-amber-800 border-amber-100';
};
