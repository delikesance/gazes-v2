import { ref, watch, computed, onBeforeUnmount, type Ref } from "vue";

export interface UseSearchOptions {
  debounceMs?: number;
  minLength?: number;
  immediate?: boolean;
}

export interface SearchResult<T = any> {
  loading: Ref<boolean>;
  results: Ref<T[]>;
  error: Ref<string | null>;
  isEmpty: Ref<boolean>;
  hasSearched: Ref<boolean>;
}

export const useSearch = <T = any>(
  searchFn: (query: string) => Promise<T[]>,
  options: UseSearchOptions = {},
): {
  query: Ref<string>;
  search: SearchResult<T>;
  executeSearch: (term?: string) => Promise<void>;
  clearSearch: () => void;
} => {
  const { debounceMs = 300, minLength = 1, immediate = false } = options;

  const query = ref("");
  const loading = ref(false);
  const results = ref<T[]>([]);
  const error = ref<string | null>(null);
  const hasSearched = ref(false);

  const isEmpty = computed(
    () => hasSearched.value && results.value.length === 0,
  );

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;

  const executeSearch = async (searchTerm?: string) => {
    const term = searchTerm ?? query.value;

    if (!term || term.length < minLength) {
      results.value = [];
      hasSearched.value = false;
      error.value = null;
      return;
    }

    // Cancel previous request
    if (abortController) {
      abortController.abort();
    }

    abortController = new AbortController();
    loading.value = true;
    error.value = null;

    try {
      const searchResults = await searchFn(term);

      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      results.value = searchResults;
      hasSearched.value = true;
    } catch (err) {
      if (!abortController.signal.aborted) {
        error.value = err instanceof Error ? err.message : "Search failed";
        results.value = [];
      }
    } finally {
      if (!abortController.signal.aborted) {
        loading.value = false;
      }
    }
  };

  const debouncedSearch = (searchTerm: string) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      executeSearch(searchTerm);
    }, debounceMs);
  };

  const clearSearch = () => {
    query.value = "";
    results.value = [];
    hasSearched.value = false;
    error.value = null;
    loading.value = false;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  };

  // Watch query changes and trigger debounced search
  watch(
    query,
    (newQuery) => {
      if (newQuery && newQuery.length >= minLength) {
        debouncedSearch(newQuery);
      } else if (!newQuery) {
        clearSearch();
      }
    },
    { immediate },
  );

  // Cleanup on unmount
  onBeforeUnmount(() => {
    clearSearch();
  });

  return {
    query,
    search: {
      loading,
      results: results as Ref<T[]>,
      error,
      isEmpty,
      hasSearched,
    },
    executeSearch,
    clearSearch,
  };
};
