export const api = {
  getCycles: async () => {
    const { data, error } = await supabase
      .from('kv_store_c5bcdb1f') // ← старый бакет KV
      .select('value')
      .eq('key', 'cycles:all') // ← старый ключ, если был другой — замени на тот, где лежит массив
      .single();

    if (error) {
      console.error("Ошибка чтения KV:", error);
      return [];
    }

    return data?.value || [];
  },

  // deleteCycle и другие методы оставь как были
};
