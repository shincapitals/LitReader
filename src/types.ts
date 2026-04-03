export interface HistoryItem {
  id: string;
  name: string;
  lastReadPage: number;
  totalPages: number;
  timestamp: number;
  fileSize: number;
  totalReadingTime: number; // in seconds
}

export interface Magazine {
  id: string;
  name: string;
  file: File | string;
  thumbnail?: string;
  totalPages: number;
  bookmarks: number[];
  lastReadPage: number;
}

export interface ReaderState {
  currentMagazine: Magazine | null;
  currentPage: number;
  scale: number;
  isSidebarOpen: boolean;
  searchQuery: string;
  searchResults: number[];
  currentSearchResultIndex: number;
  isSpreadView: boolean;
}
