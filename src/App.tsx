import React, { useState, useCallback, useEffect, useMemo, useRef, Component, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft,
  ChevronsRight,
  Maximize2, 
  Minimize2, 
  Menu, 
  X,
  Bookmark,
  BookmarkPlus,
  Search,
  History,
  LayoutGrid,
  Columns,
  Square,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Languages,
  Play,
  Pause,
  PlayCircle,
  Loader2,
  Save,
  Trash2,
  AlertCircle,
  Library as LibraryIcon,
  Sun,
  Moon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  RefreshCw
} from 'lucide-react';
import { Document, Page, Outline, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { GoogleGenAI, Modality } from "@google/genai";
import { User } from 'firebase/auth';
import { 
  auth, 
  signInWithGoogle, 
  logout, 
  db, 
  storage,
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

import { cn } from './lib/utils';
import { HistoryItem } from './types';
import { saveFile, getAllFiles, deleteFile, getFile, SavedFile, getCache, saveCache } from './lib/db';

import { CustomSelect } from './components/CustomSelect';

// Helper to get the latest Gemini instance
const getGenAI = () => {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
};

const VOICE_OPTIONS = [
  { id: 'zephyr_north', name: 'Zephyr', label: 'Nữ miền Bắc (Thanh thoát)', desc: 'giọng nữ miền Bắc Việt Nam, thanh thoát, rõ ràng' },
  { id: 'zephyr_young_north', name: 'Zephyr', label: 'Nữ miền Bắc (Trẻ trung)', desc: 'giọng nữ miền Bắc Việt Nam, trẻ trung, năng động' },
  { id: 'kore_cute_south', name: 'Kore', label: 'Nữ miền Nam (Dễ thương)', desc: 'giọng nữ miền Nam Việt Nam, dễ thương, ngọt ngào' },
  { id: 'kore_south', name: 'Kore', label: 'Nữ miền Nam (Nhẹ nhàng)', desc: 'giọng nữ miền Nam Việt Nam, nhẹ nhàng, truyền cảm' },
  { id: 'zephyr_teen', name: 'Zephyr', label: 'Nữ thiếu niên (Trong sáng)', desc: 'giọng nữ thiếu niên, trong sáng, hồn nhiên' },
  { id: 'kore_central', name: 'Kore', label: 'Nữ miền Trung (Ấm áp)', desc: 'giọng nữ miền Trung Việt Nam, ấm áp, chân thành' },
  { id: 'kore_gentle_central', name: 'Kore', label: 'Nữ miền Trung (Dịu dàng)', desc: 'giọng nữ miền Trung Việt Nam, dịu dàng, sâu lắng' },
  { id: 'puck_south', name: 'Puck', label: 'Nam miền Nam (Trẻ trung)', desc: 'giọng nam miền Nam Việt Nam, trẻ trung, năng động' },
  { id: 'charon_north', name: 'Charon', label: 'Nam miền Bắc (Trầm ấm)', desc: 'giọng nam miền Bắc Việt Nam, trầm ấm, chững chạc' },
  { id: 'fenrir_central', name: 'Fenrir', label: 'Nam miền Trung (Mạnh mẽ)', desc: 'giọng nam miền Trung Việt Nam, mạnh mẽ, quyết đoán' },
  { id: 'puck_teen', name: 'Puck', label: 'Nam thiếu niên (Hào hứng)', desc: 'giọng nam thiếu niên, hào hứng, vui vẻ' },
  { id: 'zephyr_mature', name: 'Zephyr', label: 'Nữ trung niên (Điềm đạm)', desc: 'giọng nữ trung niên, điềm đạm, sâu sắc' },
];

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Đã xảy ra lỗi không mong muốn.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = `Lỗi Firestore: ${parsed.error}`;
      } catch (e) {}

      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-paper p-8 text-center">
          <AlertCircle size={48} className="text-red-500 mb-6" />
          <h2 className="text-2xl font-display uppercase mb-4">Rất tiếc, đã có lỗi xảy ra</h2>
          <p className="text-ink/60 mb-8 max-w-md">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-accent text-paper rounded-full font-bold uppercase tracking-widest hover:scale-105 transition-all"
          >
            Tải lại trang
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'index' | 'bookmarks' | 'history' | 'library'>('index');
  const [isSpreadView, setIsSpreadView] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{page: number, index: number}[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);

  // Bookmarks and History state
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [readingHistory, setReadingHistory] = useState<HistoryItem[]>([]);
  const [savedLibrary, setSavedLibrary] = useState<SavedFile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // AI Features state
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiMode, setAiMode] = useState<'translation' | 'summary' | 'reading'>('translation');
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [aiPanelSize, setAiPanelSize] = useState({ width: 600, height: 500 });
  const [isResizing, setIsResizing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAiPanelMinimized, setIsAiPanelMinimized] = useState(false);
  const [isDocumentLoaded, setIsDocumentLoaded] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('litreader_dark_mode');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState('Vietnamese');
  const [voiceId, setVoiceId] = useState<string>('zephyr_north');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const currentOffsetRef = useRef<number>(0);
  const currentPlayIdRef = useRef(0);

  // Customization state
  const [fontFamily, setFontFamily] = useState<'font-sans' | 'font-serif' | 'font-mono'>('font-sans');
  const [translationStyle, setTranslationStyle] = useState<'magazine' | 'normal' | 'casual'>('casual');
  const [playbackRate, setPlaybackRate] = useState<number>(1.15);
  const [isPageRendering, setIsPageRendering] = useState(false);
  const [hasOutline, setHasOutline] = useState<boolean | null>(null);
  const [autoRead, setAutoRead] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isContinuousReading, setIsContinuousReading] = useState(false);
  
  // Pre-extracted text for the current page to speed up AI
  const [currentPageText, setCurrentPageText] = useState<string | null>(null);
  
  // Cache for PDF document to avoid re-parsing
  const pdfDocRef = useRef<any>(null);
  
  // Cache for AI results to save quota
  const translationCache = useRef<Record<string, string>>({});
  const summaryCache = useRef<Record<string, string>>({});
  const ttsCache = useRef<Record<string, string>>({});
  
  const isContinuousReadingRef = useRef(isContinuousReading);
  const pageNumberRef = useRef(pageNumber);
  const numPagesRef = useRef(numPages);

  useEffect(() => {
    isContinuousReadingRef.current = isContinuousReading;
    pageNumberRef.current = pageNumber;
    numPagesRef.current = numPages;
  }, [isContinuousReading, pageNumber, numPages]);

  const [pageTimes, setPageTimes] = useState<Record<number, number>>({});
  const [isAppActive, setIsAppActive] = useState(true);

  // Timer state
  const [sessionTime, setSessionTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Persistence key based on file name and size
  const persistenceKey = useMemo(() => {
    if (!file) return '';
    return `vogue_reader_${file.name}_${file.size}`;
  }, [file]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync library with Firestore when user logs in
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users', user.uid, 'files'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cloudFiles = snapshot.docs.map(doc => doc.data() as SavedFile);
      
      // Merge with local library (prefer local if exists, but add missing from cloud)
      setSavedLibrary(prev => {
        const merged = [...prev];
        cloudFiles.forEach(cloudFile => {
          if (!merged.some(f => f.id === cloudFile.id)) {
            merged.push(cloudFile);
          }
        });
        return merged;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/files`);
    });

    return () => unsubscribe();
  }, [user]);

  // Load global history and library
  useEffect(() => {
    const savedHistory = localStorage.getItem('vogue_reader_history');
    if (savedHistory) {
      setReadingHistory(JSON.parse(savedHistory));
    }
    
    // Load AI settings
    const savedSettings = localStorage.getItem('vogue_reader_ai_settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.targetLang) setTargetLang(settings.targetLang);
        if (settings.voiceId) setVoiceId(settings.voiceId);
        if (settings.translationStyle) setTranslationStyle(settings.translationStyle);
        if (settings.playbackRate) setPlaybackRate(settings.playbackRate);
        if (settings.isContinuousReading !== undefined) setIsContinuousReading(settings.isContinuousReading);
      } catch (e) {
        console.error("Failed to parse AI settings", e);
      }
    }
    
    loadLibrary();
  }, []);

  // Save AI settings when they change
  useEffect(() => {
    localStorage.setItem('litreader_dark_mode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    const settings = {
      targetLang,
      voiceId,
      translationStyle,
      playbackRate,
      autoRead,
      isAudioEnabled,
      isContinuousReading
    };
    localStorage.setItem('vogue_reader_ai_settings', JSON.stringify(settings));
  }, [targetLang, voiceId, translationStyle, playbackRate, autoRead, isAudioEnabled, isContinuousReading]);

  // AI TTS Logic
  const stopTts = useCallback(() => {
    currentPlayIdRef.current += 1;
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        // Source might have already stopped
      }
      audioSourceRef.current = null;
    }
    setIsPlaying(false);
    setIsTtsLoading(false);
    currentOffsetRef.current = 0;
    playbackStartTimeRef.current = 0;
    audioBufferRef.current = null;
  }, []);

  const changePage = useCallback((offset: number) => {
    const step = isSpreadView ? offset * 2 : offset;
    setPageNumber(prevPageNumber => {
      let next = prevPageNumber + step;
      if (isSpreadView) {
        if (next % 2 === 0) next -= 1;
      }
      return Math.min(Math.max(1, next), numPages);
    });
    // Reset AI panel on page change
    setTranslatedText(null);
    setSummaryText(null);
    setAiError(null);
    stopTts();
  }, [isSpreadView, numPages, stopTts]);

  const goToPage = useCallback((page: number) => {
    setPageNumber(Math.min(Math.max(1, page), numPages));
    // Reset AI panel on page change
    setTranslatedText(null);
    setSummaryText(null);
    setAiError(null);
    stopTts();
  }, [numPages, stopTts]);

  // Clear cache when a new file is loaded
  useEffect(() => {
    translationCache.current = {};
    summaryCache.current = {};
    ttsCache.current = {};
  }, [file]);

  // Stop audio when changing settings or unmounting
  useEffect(() => {
    stopTts();
  }, [voiceId, targetLang, aiMode, stopTts]);

  useEffect(() => {
    return () => stopTts();
  }, [stopTts]);

  const playTts = useCallback(async (textToRead?: string) => {
    let text = textToRead;
    if (!text) {
      if (aiMode === 'translation') text = translatedText || undefined;
      else if (aiMode === 'summary') text = summaryText || undefined;
      else if (aiMode === 'reading') text = currentPageText || undefined;
    }
    
    if (!text && aiMode === 'reading' && !textToRead) {
      // Try to extract text if it's missing
      setIsTtsLoading(true);
      try {
        let pdf = pdfDocRef.current;
        if (!pdf && file) {
          const data = await file.arrayBuffer();
          pdf = await pdfjs.getDocument({ data }).promise;
          pdfDocRef.current = pdf;
        }
        if (pdf) {
          const page = await pdf.getPage(pageNumber);
          const textContent = await page.getTextContent();
          // Batching: Join all text items into a single clean string to minimize API calls
          text = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          setCurrentPageText(text);
        }
      } catch (err) {
        console.error("TTS text extraction error:", err);
      } finally {
        setIsTtsLoading(false);
      }
    }

    if (!text || !isAudioEnabled) return;

    // Clean text for better TTS quality and batching
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length === 0) return;
    
    // If already playing or loading and we're toggling (no new text passed), stop it.
    if ((isPlaying || isTtsLoading) && !textToRead) {
      stopTts();
      return;
    }

    if (isTtsLoading && !textToRead) return;

    // If starting a new generation, stop any existing playback first
    stopTts();
    const myPlayId = currentPlayIdRef.current;
    setAiError(null);

    // Check cache first
    const cacheKey = `${voiceId}_${text.substring(0, 100)}_${text.length}`;
    const cachedAudio = ttsCache.current[cacheKey];

    const playAudio = (base64Data: string, offset = 0) => {
      if (myPlayId !== currentPlayIdRef.current) return;
      
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const audioContext = audioContextRef.current;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const int16Data = new Int16Array(bytes.buffer);
      const float32Data = new Float32Array(int16Data.length);
      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0;
      }

      const audioBuffer = audioContext.createBuffer(1, float32Data.length, 24000);
      audioBuffer.copyToChannel(float32Data, 0);
      audioBufferRef.current = audioBuffer;
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = playbackRate;
      source.connect(audioContext.destination);
      
      const startOffset = Math.max(0, Math.min(offset, audioBuffer.duration));
      source.start(0, startOffset);
      
      if (myPlayId !== currentPlayIdRef.current) {
        source.stop();
        return;
      }
      
      audioSourceRef.current = source;
      playbackStartTimeRef.current = audioContext.currentTime;
      currentOffsetRef.current = startOffset;
      setIsPlaying(true);
      
      source.onended = () => {
        if (audioSourceRef.current === source) {
          setIsPlaying(false);
          audioSourceRef.current = null;
          if (isContinuousReadingRef.current && pageNumberRef.current < numPagesRef.current) {
            setTimeout(() => {
              changePage(1);
            }, 1000);
          }
        }
      };
    };

    if (cachedAudio) {
      playAudio(cachedAudio);
      return;
    }

    setIsTtsLoading(true);
    try {
      const ai = getGenAI();
      const selectedVoice = VOICE_OPTIONS.find(v => v.id === voiceId) || VOICE_OPTIONS[0];
      const voiceDescription = selectedVoice.desc;
      const voiceNameForApi = selectedVoice.name as 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

      const generateWithRetry = async (retries = 4, initialDelay = 1000): Promise<any> => {
        let currentDelay = initialDelay;
        for (let i = 0; i <= retries; i++) {
          try {
            return await ai.models.generateContent({
              model: "gemini-2.5-flash-preview-tts",
              contents: [{ parts: [{ text: `Đọc nội dung sau đây bằng ${voiceDescription}: ${text}` }] }],
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceNameForApi },
                  },
                },
              },
            });
          } catch (error: any) {
            const errorMsg = error?.message || "";
            const isRetryable = 
              errorMsg.includes('429') || 
              errorMsg.includes('RESOURCE_EXHAUSTED') || 
              errorMsg.includes('quota') ||
              errorMsg.includes('500') || 
              errorMsg.includes('xhr') || 
              errorMsg.includes('Rpc failed');

            if (isRetryable && i < retries) {
              console.warn(`TTS API error (retry ${i+1}/${retries}): ${errorMsg}. Retrying in ${currentDelay}ms...`);
              await new Promise(resolve => setTimeout(resolve, currentDelay));
              currentDelay *= 2; // Exponential backoff: 1s, 2s, 4s, 8s...
              continue;
            }
            throw error;
          }
        }
      };

      const response = await generateWithRetry();

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        ttsCache.current[cacheKey] = base64Audio;
        playAudio(base64Audio);
      }
    } catch (error: any) {
      handleAiError(error, 'tts');
    } finally {
      if (myPlayId === currentPlayIdRef.current) {
        setIsTtsLoading(false);
      }
    }
  }, [aiMode, translatedText, summaryText, currentPageText, pageNumber, file, isTtsLoading, isAudioEnabled, isPlaying, stopTts, voiceId, playbackRate, changePage]);

  const seekTts = useCallback((seconds: number) => {
    if (!audioBufferRef.current || !audioContextRef.current) return;
    
    const audioContext = audioContextRef.current;
    const buffer = audioBufferRef.current;
    
    // Calculate current position
    const elapsed = (audioContext.currentTime - playbackStartTimeRef.current) * playbackRate;
    const newOffset = Math.max(0, Math.min(currentOffsetRef.current + elapsed + seconds, buffer.duration));
    
    // Stop current
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
      audioSourceRef.current = null;
    }
    
    // Start new source at offset
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    source.connect(audioContext.destination);
    source.start(0, newOffset);
    
    audioSourceRef.current = source;
    playbackStartTimeRef.current = audioContext.currentTime;
    currentOffsetRef.current = newOffset;
    setIsPlaying(true);
    
    source.onended = () => {
      if (audioSourceRef.current === source) {
        setIsPlaying(false);
        audioSourceRef.current = null;
        if (isContinuousReadingRef.current && pageNumberRef.current < numPagesRef.current) {
          setTimeout(() => {
            changePage(1);
          }, 1000);
        }
      }
    };
  }, [playbackRate, changePage]);

  const loadLibrary = async () => {
    try {
      const files = await getAllFiles();
      setSavedLibrary(files);
    } catch (err) {
      console.error("Failed to load library:", err);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!file || isSaving) return;
    setIsSaving(true);
    try {
      const savedFile = {
        id: persistenceKey,
        name: file.name,
        data: file,
        timestamp: Date.now(),
        size: file.size
      };
      await saveFile(savedFile);
      
      // Sync to Firestore and Storage if logged in
      if (user) {
        const { data: _, ...metadata } = savedFile;
        
        // Upload to Storage
        const fileRef = ref(storage, `users/${user.uid}/files/${persistenceKey}`);
        await uploadBytes(fileRef, file);
        
        // Save metadata to Firestore
        await setDoc(doc(db, 'users', user.uid, 'files', persistenceKey), {
          ...metadata,
          ownerUid: user.uid
        });
      }
      
      await loadLibrary();
    } catch (err) {
      console.error("Failed to save to library:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFromLibrary = async (id: string) => {
    try {
      await deleteFile(id);
      
      // Sync to Firestore and Storage if logged in
      if (user) {
        await deleteDoc(doc(db, 'users', user.uid, 'files', id));
        try {
          const fileRef = ref(storage, `users/${user.uid}/files/${id}`);
          await deleteObject(fileRef);
        } catch (storageErr) {
          console.error("Failed to delete from storage:", storageErr);
        }
      }
      
      setReadingHistory(prev => {
        const updated = prev.filter(item => item.id !== id);
        localStorage.setItem('vogue_reader_history', JSON.stringify(updated));
        return updated;
      });
      await loadLibrary();
    } catch (err) {
      console.error("Failed to delete from library:", err);
    }
  };

  const downloadFromCloud = async (saved: SavedFile) => {
    if (!user) {
      alert("Vui lòng đăng nhập để tải file từ Cloud.");
      return;
    }
    
    try {
      setIsDownloading(true);
      const fileRef = ref(storage, `users/${user.uid}/files/${saved.id}`);
      const url = await getDownloadURL(fileRef);
      
      // Fetch the actual file data
      const response = await fetch(url);
      const blob = await response.blob();
      
      // Create a File object
      const downloadedFile = new File([blob], saved.name, { type: 'application/pdf' });
      
      // Save it locally to IndexedDB
      const newSavedFile = {
        ...saved,
        data: downloadedFile
      };
      await saveFile(newSavedFile);
      
      // Update local state
      setSavedLibrary(prev => prev.map(f => f.id === saved.id ? newSavedFile : f));
      
      // Load it
      await loadFromLibrary(newSavedFile);
    } catch (err) {
      console.error("Failed to download from cloud:", err);
      alert("Không thể tải file từ Cloud. Có thể file đã bị xóa hoặc lỗi mạng.");
    } finally {
      setIsDownloading(false);
    }
  };

  const loadFromLibrary = async (saved: SavedFile) => {
    // Convert Blob back to File
    const loadedFile = new File([saved.data], saved.name, { type: 'application/pdf' });
    pdfDocRef.current = null;
    setFile(loadedFile);
    setPageNumber(1);
    setBookmarks([]);
    setPageTimes({});
    setSearchQuery('');
    setSearchResults([]);
    setTranslatedText(null);
    setSummaryText(null);
    setCurrentPageText(null);
    setIsDocumentLoaded(false);
    setIsAiPanelOpen(false);
  };

  const handleOpenFromHistory = async (item: HistoryItem) => {
    try {
      let savedFile = await getFile(item.id);
      
      // If not in local DB, check if it's a cloud file
      if (!savedFile) {
        const cloudFile = savedLibrary.find(f => f.id === item.id);
        if (cloudFile) {
          await downloadFromCloud(cloudFile);
          setTimeout(() => {
            setPageNumber(item.lastReadPage);
          }, 100);
          return;
        }
      }

      if (savedFile) {
        await loadFromLibrary(savedFile);
        // Explicitly set page number after loading to ensure it's not overwritten
        setTimeout(() => {
          setPageNumber(item.lastReadPage);
        }, 100);
      } else {
        alert("Không tìm thấy file trong thư viện. Vui lòng tải lên lại.");
      }
    } catch (err) {
      console.error("Failed to load from history:", err);
      alert("Đã xảy ra lỗi khi mở file.");
    }
  };

  // Update playback rate dynamically
  useEffect(() => {
    if (audioSourceRef.current) {
      audioSourceRef.current.playbackRate.value = playbackRate;
    }
  }, [playbackRate]);

  // Handle page rendering state
  useEffect(() => {
    setIsPageRendering(true);
  }, [pageNumber, scale, file]);

  // Robust Reading Time Tracker
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsAppActive(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!file || !isAppActive) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSessionTime(prev => prev + 1);
      setPageTimes(prev => ({
        ...prev,
        [pageNumber]: (prev[pageNumber] || 0) + 1
      }));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [file, isAppActive, pageNumber]);

  // Load saved state for current file
  useEffect(() => {
    if (persistenceKey) {
      const saved = localStorage.getItem(persistenceKey);
      if (saved) {
        try {
          const { lastPage, savedBookmarks, savedPageTimes } = JSON.parse(saved);
          if (lastPage) setPageNumber(lastPage);
          if (savedBookmarks) setBookmarks(savedBookmarks);
          if (savedPageTimes) setPageTimes(savedPageTimes);
        } catch (e) {
          console.error("Failed to load saved state", e);
        }
      }
    }
  }, [persistenceKey]);

  // Save state on changes and update history
  useEffect(() => {
    if (persistenceKey && file) {
      localStorage.setItem(persistenceKey, JSON.stringify({
        lastPage: pageNumber,
        savedBookmarks: bookmarks,
        savedPageTimes: pageTimes
      }));

      // Update history
      setReadingHistory(prev => {
        const existingItem = prev.find(item => item.id === persistenceKey);
        const previousTime = existingItem?.totalReadingTime || 0;
        
        const newItem: HistoryItem = {
          id: persistenceKey,
          name: file.name,
          lastReadPage: pageNumber,
          totalPages: numPages,
          timestamp: Date.now(),
          fileSize: file.size,
          totalReadingTime: previousTime
        };
        const filtered = prev.filter(item => item.id !== persistenceKey);
        const updated = [newItem, ...filtered].slice(0, 10);
        localStorage.setItem('vogue_reader_history', JSON.stringify(updated));
        return updated;
      });
    }
  }, [pageNumber, bookmarks, persistenceKey, file, numPages]);

  // Refined timer update to history
  useEffect(() => {
    if (persistenceKey && file && sessionTime > 0 && sessionTime % 5 === 0) {
      setReadingHistory(prev => {
        const updated = prev.map(item => {
          if (item.id === persistenceKey) {
            return { ...item, totalReadingTime: (item.totalReadingTime || 0) + 5 };
          }
          return item;
        });
        localStorage.setItem('vogue_reader_history', JSON.stringify(updated));
        return updated;
      });
    }
  }, [sessionTime, persistenceKey, file]);

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files[0]) {
      const newFile = files[0];
      pdfDocRef.current = null;
      setFile(newFile);
      setPageNumber(1);
      setBookmarks([]);
      setPageTimes({});
      setSearchQuery('');
      setSearchResults([]);
      setTranslatedText(null);
      setSummaryText(null);
      setCurrentPageText(null);
      setIsDocumentLoaded(false);
      setIsAiPanelOpen(false);

      // Automatically save to library to ensure "Recently Read" works
      const key = `vogue_reader_${newFile.name}_${newFile.size}`;
      try {
        await saveFile({
          id: key,
          name: newFile.name,
          data: newFile,
          timestamp: Date.now(),
          size: newFile.size
        });
        await loadLibrary();
        
        // Explicitly update history here as well to be safe
        setReadingHistory(prev => {
          const newItem: HistoryItem = {
            id: key,
            name: newFile.name,
            lastReadPage: 1,
            totalPages: 0, // Will be updated by onDocumentLoadSuccess
            timestamp: Date.now(),
            fileSize: newFile.size,
            totalReadingTime: 0
          };
          const filtered = prev.filter(item => item.id !== key);
          const updated = [newItem, ...filtered].slice(0, 10);
          localStorage.setItem('vogue_reader_history', JSON.stringify(updated));
          return updated;
        });
      } catch (err) {
        console.error("Failed to auto-save to library:", err);
      }
    }
  };

  const onDocumentLoadSuccess = useCallback(async (pdf: any) => {
    setNumPages(pdf.numPages);
    pdfDocRef.current = pdf;
    setIsDocumentLoaded(true);
    try {
      const outline = await pdf.getOutline();
      setHasOutline(!!outline && outline.length > 0);
    } catch (e) {
      setHasOutline(false);
    }
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullScreen(false);
      }
    }
  };

  const toggleBookmark = () => {
    setBookmarks(prev => 
      prev.includes(pageNumber) 
        ? prev.filter(p => p !== pageNumber) 
        : [...prev, pageNumber].sort((a, b) => a - b)
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !file) return;

    setIsSearching(true);
    const results: {page: number, index: number}[] = [];
    
    try {
      const data = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data }).promise;
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item: any) => item.str).join(' ');
        
        if (text.toLowerCase().includes(searchQuery.toLowerCase())) {
          results.push({ page: i, index: results.length });
        }
      }
      
      setSearchResults(results);
      if (results.length > 0) {
        setCurrentSearchIndex(0);
        setPageNumber(results[0].page);
      } else {
        setCurrentSearchIndex(-1);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const navigateSearch = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;
    let nextIndex = direction === 'next' ? currentSearchIndex + 1 : currentSearchIndex - 1;
    if (nextIndex >= searchResults.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = searchResults.length - 1;
    
    setCurrentSearchIndex(nextIndex);
    setPageNumber(searchResults[nextIndex].page);
  };

  const textRenderer = useCallback((textItem: any) => {
    if (!searchQuery) return textItem.str;
    const parts = textItem.str.split(new RegExp(`(${searchQuery})`, 'gi'));
    return parts.map((part: string, i: number) => 
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={i} className="bg-accent/40 text-ink rounded-sm px-0.5">{part}</mark>
      ) : part
    );
  }, [searchQuery]);

  const handleAiError = useCallback((error: any, context: 'translation' | 'summary' | 'tts') => {
    console.error(`${context} error:`, error);
    
    let message = "Đã xảy ra lỗi không xác định.";
    let suggestion = "Vui lòng thử lại sau hoặc làm mới trang.";

    const errorMsg = error?.message || "";
    
    if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota')) {
      message = "Đã hết hạn mức sử dụng AI (Quota exceeded).";
      suggestion = "Hệ thống đang quá tải hoặc bạn đã dùng hết lượt miễn phí trong lúc này. Vui lòng đợi 1-2 phút rồi thử lại.";
    } else if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('NetworkError')) {
      message = "Lỗi kết nối mạng.";
      suggestion = "Vui lòng kiểm tra lại đường truyền internet của bạn và thử lại.";
    } else if (errorMsg.includes('400') || errorMsg.includes('INVALID_ARGUMENT')) {
      message = "Nội dung không hợp lệ hoặc quá lớn.";
      suggestion = "Trang này có thể chứa quá nhiều dữ liệu hoặc định dạng không hỗ trợ. Thử chuyển sang trang khác xem sao.";
    } else if (errorMsg.includes('500') || errorMsg.includes('INTERNAL') || errorMsg.includes('xhr') || errorMsg.includes('Rpc failed')) {
      message = "Lỗi máy chủ AI hoặc kết nối.";
      suggestion = "Máy chủ Google Gemini đang gặp sự cố tạm thời hoặc kết nối bị gián đoạn. Vui lòng thử lại sau vài giây.";
    } else if (errorMsg.includes('SAFETY')) {
      message = "Nội dung bị chặn do chính sách an toàn.";
      suggestion = "AI từ chối xử lý nội dung này vì lý do bảo mật hoặc nhạy cảm.";
    }

    setAiError(`${message}\n\n💡 Gợi ý: ${suggestion}`);
  }, []);

  // Continuous Reading Logic
  useEffect(() => {
    if (isContinuousReading && isDocumentLoaded && currentPageText && !isPlaying && !isTtsLoading && aiMode === 'reading') {
      // If we are in continuous mode and reading mode, start playing
      const timer = setTimeout(() => {
        playTts();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [pageNumber, isContinuousReading, isDocumentLoaded, currentPageText, aiMode, isPlaying, isTtsLoading, playTts]);

  // Pre-extract text for the current page to speed up AI features
  useEffect(() => {
    const extractText = async () => {
      if (!pdfDocRef.current || !pageNumber) return;
      try {
        const page = await pdfDocRef.current.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item: any) => item.str).join(' ');
        setCurrentPageText(text);
      } catch (err) {
        console.error("Text extraction error:", err);
      }
    };
    extractText();
  }, [pageNumber, file, isDocumentLoaded]); // Re-run when page, file or document load changes

  // AI Translation Logic
  const translatePage = useCallback(async () => {
    if (!file || isTranslating) return;
    
    // Check cache first
    const cacheKey = `trans_${persistenceKey}_${pageNumber}_${targetLang}_${translationStyle}`;
    
    // Check in-memory cache
    if (translationCache.current[cacheKey]) {
      setTranslatedText(translationCache.current[cacheKey]);
      setIsAiPanelOpen(true);
      setAiError(null);
      if (autoRead && isAudioEnabled) {
        setTimeout(() => playTts(translationCache.current[cacheKey]), 100);
      }
      return;
    }

    // Check persistent cache
    try {
      const cached = await getCache(cacheKey);
      if (cached) {
        translationCache.current[cacheKey] = cached;
        setTranslatedText(cached);
        setIsAiPanelOpen(true);
        setAiError(null);
        if (autoRead && isAudioEnabled) {
          setTimeout(() => playTts(cached), 100);
        }
        return;
      }
    } catch (err) {
      console.error("Cache read error:", err);
    }

    setIsAiPanelOpen(true);
    setIsTranslating(true);
    setTranslatedText(null);
    setAiError(null);
    stopTts();

    try {
      const ai = getGenAI();
      let originalText = currentPageText;
      
      // Fallback if currentPageText is not available yet
      if (!originalText) {
        let pdf = pdfDocRef.current;
        if (!pdf && file) {
          const data = await file.arrayBuffer();
          pdf = await pdfjs.getDocument({ data }).promise;
          pdfDocRef.current = pdf;
        }
        if (!pdf) throw new Error("Could not load PDF document.");
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        originalText = textContent.items.map((item: any) => item.str).join(' ');
      }
      
      if (!originalText) throw new Error("Could not extract text from page.");

      let systemInstruction = `Bạn là một biên tập viên dịch thuật chuyên nghiệp. Dịch chính xác, mượt mà và tự nhiên sang ${targetLang}.`;
      if (translationStyle === 'magazine') {
        systemInstruction = `Bạn là một biên tập viên dịch thuật chuyên nghiệp cho các tạp chí cao cấp. Nhiệm vụ của bạn là dịch các bài báo sang ${targetLang}. Hãy sử dụng ngôn từ tinh tế, hiện đại và phù hợp với ngữ cảnh thời trang, nghệ thuật và lối sống. Tránh dịch quá sát nghĩa đen nếu nó làm mất đi sự sang trọng của văn bản gốc.`;
      } else if (translationStyle === 'casual') {
        systemInstruction = `Bạn là một GenZ content creator. Dịch nội dung sang ${targetLang} một cách gần gũi, thân thiện, sử dụng ngôn ngữ hiện đại, trẻ trung, có thể dùng một số từ lóng phổ biến của giới trẻ nếu phù hợp để tạo cảm giác tự nhiên và thú vị.`;
      }

      systemInstruction += "\n\nQUAN TRỌNG: CHỈ trả về nội dung đã dịch. KHÔNG thêm bất kỳ lời chào, giải thích, hay bình luận nào khác (ví dụ: tuyệt đối không dùng 'Dưới đây là bản dịch...').";

      const response = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: `Dịch nội dung sau đây sang ${targetLang}. Đây là văn bản từ một tài liệu có tên "${file.name}": \n\n ${originalText}`,
        config: {
          systemInstruction
        }
      });

      let fullText = "";
      for await (const chunk of response) {
        const chunkText = chunk.text || "";
        fullText += chunkText;
        setTranslatedText(fullText);
      }

      const translated = fullText || "Không thể dịch nội dung.";
      
      // Save to cache
      if (translated !== "Không thể dịch nội dung." && translated !== "Đã xảy ra lỗi khi dịch.") {
        translationCache.current[cacheKey] = translated;
        await saveCache(cacheKey, translated);
      }

      // Auto-read if enabled
      if (autoRead && isAudioEnabled && translated !== "Không thể dịch nội dung.") {
        setTimeout(() => {
          playTts(translated);
        }, 100);
      }
    } catch (error: any) {
      handleAiError(error, 'translation');
      setTranslatedText("Đã xảy ra lỗi khi dịch.");
    } finally {
      setIsTranslating(false);
    }
  }, [file, isTranslating, pageNumber, translationStyle, targetLang, stopTts, persistenceKey, autoRead, isAudioEnabled, playTts]);

  // AI Summarization Logic
  const summarizePage = useCallback(async () => {
    if (!file || isSummarizing) return;

    // Check cache first
    const cacheKey = `summ_${persistenceKey}_${pageNumber}_${targetLang}`;
    
    // Check in-memory cache
    if (summaryCache.current[cacheKey]) {
      setSummaryText(summaryCache.current[cacheKey]);
      setIsAiPanelOpen(true);
      setAiMode('summary');
      setAiError(null);
      if (autoRead && isAudioEnabled) {
        setTimeout(() => playTts(summaryCache.current[cacheKey]), 100);
      }
      return;
    }

    // Check persistent cache
    try {
      const cached = await getCache(cacheKey);
      if (cached) {
        summaryCache.current[cacheKey] = cached;
        setSummaryText(cached);
        setIsAiPanelOpen(true);
        setAiMode('summary');
        setAiError(null);
        if (autoRead && isAudioEnabled) {
          setTimeout(() => playTts(cached), 100);
        }
        return;
      }
    } catch (err) {
      console.error("Cache read error:", err);
    }

    setIsAiPanelOpen(true);
    setAiMode('summary');
    setIsSummarizing(true);
    setSummaryText(null);
    setAiError(null);
    stopTts();

    try {
      const ai = getGenAI();
      let originalText = currentPageText;

      // Fallback if currentPageText is not available yet
      if (!originalText) {
        let pdf = pdfDocRef.current;
        if (!pdf && file) {
          const data = await file.arrayBuffer();
          pdf = await pdfjs.getDocument({ data }).promise;
          pdfDocRef.current = pdf;
        }
        if (!pdf) throw new Error("Could not load PDF document.");
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        originalText = textContent.items.map((item: any) => item.str).join(' ');
      }

      if (!originalText) throw new Error("Could not extract text from page.");

      const systemInstruction = `Bạn là một trợ lý đọc sách thông minh. Hãy tóm tắt nội dung của trang sách này một cách súc tích, nêu bật các ý chính bằng ${targetLang}. Trình bày dưới dạng các gạch đầu dòng nếu cần thiết.`;

      const response = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: `Tóm tắt nội dung sau đây bằng ${targetLang}: \n\n ${originalText}`,
        config: {
          systemInstruction
        }
      });

      let fullText = "";
      for await (const chunk of response) {
        const chunkText = chunk.text || "";
        fullText += chunkText;
        setSummaryText(fullText);
      }

      const summary = fullText || "Không thể tóm tắt nội dung.";
      
      // Save to cache
      if (summary !== "Không thể tóm tắt nội dung." && summary !== "Đã xảy ra lỗi khi tóm tắt.") {
        summaryCache.current[cacheKey] = summary;
        await saveCache(cacheKey, summary);
      }

      // Auto-read if enabled
      if (autoRead && isAudioEnabled && summary !== "Không thể tóm tắt nội dung.") {
        setTimeout(() => {
          playTts(summary);
        }, 100);
      }
    } catch (error: any) {
      handleAiError(error, 'summary');
      setSummaryText("Đã xảy ra lỗi khi tóm tắt.");
    } finally {
      setIsSummarizing(false);
    }
  }, [file, isSummarizing, pageNumber, targetLang, stopTts, persistenceKey, autoRead, isAudioEnabled, playTts]);

  // Effect for Continuous Reading: Trigger translation when page changes
  useEffect(() => {
    if (isContinuousReading && !translatedText && !summaryText && !isTranslating && !isSummarizing && file && isAiPanelOpen) {
      if (aiMode === 'translation') {
        translatePage();
      } else {
        summarizePage();
      }
    }
  }, [pageNumber, isContinuousReading, translatedText, summaryText, isTranslating, isSummarizing, file, isAiPanelOpen, aiMode, translatePage, summarizePage]);

  // Resize logic for AI Panel
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isResizing) return;
      
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      // Calculate new width and height based on mouse position
      // Panel is anchored at bottom-right (bottom-28, right-8 on desktop)
      // bottom-28 = 7rem = 112px
      // right-8 = 2rem = 32px
      
      const rightEdge = window.innerWidth - 32;
      const bottomEdge = window.innerHeight - 112;
      
      let newWidth = rightEdge - clientX;
      let newHeight = bottomEdge - clientY;
      
      // Snap to grid (50px increments)
      const snapGrid = 50;
      newWidth = Math.round(newWidth / snapGrid) * snapGrid;
      newHeight = Math.round(newHeight / snapGrid) * snapGrid;
      
      // Min/Max constraints
      newWidth = Math.max(300, Math.min(newWidth, window.innerWidth - 64));
      newHeight = Math.max(300, Math.min(newHeight, window.innerHeight - 150));
      
      setAiPanelSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchend', handleMouseUp);
      
      // Add a class to body to prevent text selection while resizing
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'nwse-resize';
    } else {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing]);

  if (!file) {
    return (
      <div className={cn("min-h-screen bg-paper flex flex-col items-center justify-center p-6 overflow-hidden relative transition-colors duration-500", fontFamily, !isDarkMode && "light")}>
        {/* Theme Toggle for Welcome Screen */}
        <div className="absolute top-8 right-8 z-50">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-3 bg-ink/5 hover:bg-ink/10 text-ink rounded-full transition-all border border-ink/10 backdrop-blur-md"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <div className="absolute inset-0 opacity-5 pointer-events-none overflow-hidden flex items-center justify-center">
          <h1 className="text-[24vw] font-display uppercase leading-[0.82] -tracking-[0.02em] whitespace-nowrap rotate-[-10deg]">
            LITREADER LITREADER
          </h1>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex flex-col items-center w-full max-w-4xl mx-auto gap-12"
        >
          <div className="text-center">
            <span className="font-mono text-xs uppercase tracking-widest text-accent mb-6 block">
              The Future of Digital Reading
            </span>
            <h2 className="text-7xl md:text-9xl font-display uppercase leading-[0.85] relative z-20">
              LIT <br />
              <span className="text-accent italic font-serif lowercase text-8xl md:text-[11rem] block mt-[-2rem]">Reader</span>
            </h2>
          </div>
          
          {/* Library and History Grid */}
          {(savedLibrary.length > 0 || readingHistory.length > 0) && (
            <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl justify-center bg-ink/5 p-6 rounded-3xl border border-ink/5 backdrop-blur-sm relative z-10 mt-[-6rem]">
              {savedLibrary.length > 0 && (
                <div className="flex-1">
                  <h3 className="text-[10px] font-mono uppercase tracking-widest font-bold text-ink/40 mb-3 flex items-center gap-2">
                    <LibraryIcon size={12} /> Your Library
                  </h3>
                  <div className="flex flex-col gap-2">
                    {savedLibrary.slice(0, 2).map(saved => (
                      <button 
                        key={saved.id} 
                        onClick={() => {
                          if (saved.data) {
                            loadFromLibrary(saved);
                          } else {
                            downloadFromCloud(saved);
                          }
                        }}
                        className="flex items-center justify-between p-3 bg-paper/50 rounded-xl border border-ink/5 hover:border-accent/30 hover:bg-accent/5 transition-all text-left w-full group"
                      >
                        <span className="text-xs font-bold truncate max-w-[160px] group-hover:text-accent transition-colors">{saved.name}</span>
                        <span className="text-[10px] font-mono text-ink/40">{(saved.size / 1024 / 1024).toFixed(1)} MB</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {readingHistory.length > 0 && (
                <div className="flex-1">
                  <h3 className="text-[10px] font-mono uppercase tracking-widest font-bold text-ink/40 mb-3 flex items-center gap-2">
                    <History size={12} /> Recently Read
                  </h3>
                  <div className="flex flex-col gap-2">
                    {readingHistory.slice(0, 2).map(item => (
                      <button 
                        key={item.id} 
                        onClick={() => handleOpenFromHistory(item)}
                        className="flex items-center justify-between p-3 bg-paper/50 rounded-xl border border-ink/5 hover:border-accent/30 hover:bg-accent/5 transition-all text-left w-full group"
                      >
                        <span className="text-xs font-bold truncate max-w-[160px] group-hover:text-accent transition-colors">{item.name}</span>
                        <span className="text-[10px] font-mono text-ink/40 shrink-0">Pg {item.lastReadPage}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col items-center gap-4 relative z-30">
            <label className="group relative cursor-pointer overflow-hidden bg-accent text-paper px-10 py-4 rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_var(--color-accent-glow)] hover:shadow-[0_0_50px_var(--color-accent-glow-hover)]">
              <input type="file" className="hidden" accept=".pdf" onChange={onFileChange} />
              <div className="flex items-center gap-3 font-bold uppercase tracking-wider text-sm">
                <Upload size={18} />
                <span>Upload</span>
              </div>
            </label>
            <p className="text-ink/30 font-mono text-[10px] uppercase tracking-widest">Supported format: PDF</p>
          </div>
        </motion.div>

        <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end pointer-events-none hidden md:flex">
          <div className="max-w-xs">
            <p className="text-[10px] font-mono uppercase tracking-widest font-bold text-ink/30 mb-2">About</p>
            <p className="text-xs font-mono text-ink/50 leading-relaxed">
              A curated digital experience designed for the modern GenZ enthusiast. 
              Immersive, precise, and beautifully rendered.
            </p>
          </div>
          <div className="flex gap-12">
            <div className="text-right">
              <p className="text-[10px] font-mono uppercase tracking-widest font-bold text-ink/30 mb-1">Issue</p>
              <p className="text-2xl font-display uppercase leading-none">No. 01</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono uppercase tracking-widest font-bold text-ink/30 mb-1">Year</p>
              <p className="text-2xl font-display uppercase leading-none">2026</p>
            </div>
          </div>
        </div>

        {isDownloading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-paper/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <Loader2 size={32} className="animate-spin text-accent" />
              <p className="font-mono text-xs uppercase tracking-widest font-bold text-accent">Downloading from Cloud...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={cn("h-screen bg-paper flex flex-col overflow-hidden transition-colors duration-500", fontFamily, !isDarkMode && "light")}>
      {/* Header */}
      <header className="h-16 border-b border-ink/10 flex items-center justify-between px-6 z-50 bg-paper/80 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-ink/5 rounded-full transition-colors"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="h-4 w-[1px] bg-ink/10 mx-2" />
          <h1 className="font-display uppercase text-xl tracking-tighter">LITREADER</h1>
          
          <div className="hidden lg:flex items-center gap-2 ml-4 bg-ink/5 rounded-full px-2 py-1">
            <button
              onClick={() => setFontFamily('font-sans')}
              className={cn("px-3 py-1 text-xs font-bold rounded-full transition-colors", fontFamily === 'font-sans' ? "bg-ink text-paper" : "hover:bg-ink/10")}
            >
              Sans
            </button>
            <button
              onClick={() => setFontFamily('font-serif')}
              className={cn("px-3 py-1 text-xs font-bold rounded-full transition-colors", fontFamily === 'font-serif' ? "bg-ink text-paper" : "hover:bg-ink/10")}
            >
              Serif
            </button>
            <button
              onClick={() => setFontFamily('font-mono')}
              className={cn("px-3 py-1 text-xs font-bold rounded-full transition-colors", fontFamily === 'font-mono' ? "bg-ink text-paper" : "hover:bg-ink/10")}
            >
              Mono
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md mx-2 sm:mx-8 relative">
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-4 text-ink/40" />
            <input 
              type="text"
              placeholder="Tìm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-ink/5 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-accent/20 transition-all"
            />
            {isSearching && (
              <div className="absolute right-4 w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          {searchResults.length > 0 && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-paper border border-ink/10 rounded-xl shadow-xl p-2 flex items-center justify-between z-50">
              <span className="text-xs font-mono px-2">
                {currentSearchIndex + 1}/{searchResults.length}
              </span>
              <div className="flex gap-1">
                <button 
                  type="button"
                  onClick={() => navigateSearch('prev')}
                  className="p-1.5 hover:bg-ink/5 rounded-lg transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button 
                  type="button"
                  onClick={() => navigateSearch('next')}
                  className="p-1.5 hover:bg-ink/5 rounded-lg transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
                <button 
                  type="button"
                  onClick={() => {setSearchResults([]); setSearchQuery('');}}
                  className="p-1.5 hover:bg-ink/5 rounded-lg transition-colors text-ink/40"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={() => {
              setAiMode('reading');
              setIsAiPanelOpen(true);
              playTts();
            }}
            className={cn(
              "p-2 rounded-full transition-all flex items-center gap-2 px-3 sm:px-4 border shadow-sm",
              isAiPanelOpen && aiMode === 'reading'
                ? "text-paper bg-accent border-accent shadow-[0_0_20px_var(--color-accent-glow)]" 
                : "bg-surface text-ink border-ink/10 hover:border-accent/50 hover:text-accent"
            )}
            title="Read original text"
          >
            <PlayCircle size={18} />
            <span className="text-[10px] uppercase font-black tracking-widest hidden sm:inline">Đọc</span>
          </button>

          <button 
            onClick={translatePage}
            className={cn(
              "p-2 rounded-full transition-all flex items-center gap-2 px-3 sm:px-4 border shadow-md group relative overflow-hidden",
              isAiPanelOpen && aiMode === 'translation' 
                ? "text-paper bg-accent border-accent shadow-[0_0_20px_var(--color-accent-glow)]" 
                : "bg-surface text-ink border-ink/10 hover:border-accent/50 hover:text-accent"
            )}
            title="Translate to Vietnamese"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0]
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Sparkles size={18} />
            </motion.div>
            <span className="text-[10px] uppercase font-black tracking-widest hidden sm:inline">Dịch</span>
            <div className="absolute inset-0 bg-ink/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </button>

          <button 
            onClick={summarizePage}
            className={cn(
              "p-2 rounded-full transition-all flex items-center gap-2 px-3 border shadow-sm",
              isAiPanelOpen && aiMode === 'summary' 
                ? "text-paper bg-accent border-accent shadow-[0_0_20px_var(--color-accent-glow)]" 
                : "bg-surface text-ink border-ink/10 hover:border-accent/50 hover:text-accent"
            )}
            title="Summarize current page"
          >
            <LayoutGrid size={18} />
            <span className="text-[10px] uppercase font-bold tracking-widest hidden sm:inline">Tóm</span>
          </button>

          <button 
            onClick={() => setIsSpreadView(!isSpreadView)}
            className={cn(
              "p-2 rounded-full transition-all flex items-center gap-2 px-3 border shadow-sm hidden md:flex",
              isSpreadView 
                ? "text-paper bg-accent border-accent shadow-[0_0_20px_var(--color-accent-glow)]" 
                : "bg-surface text-ink border-ink/10 hover:border-accent/50 hover:text-accent"
            )}
            title="Toggle Spread View"
          >
            {isSpreadView ? <Columns size={18} /> : <Square size={18} />}
          </button>

          <button 
            onClick={toggleBookmark}
            className={cn(
              "p-2 rounded-full transition-all border shadow-sm hidden sm:flex",
              bookmarks.includes(pageNumber) 
                ? "text-paper bg-accent border-accent shadow-[0_0_20px_var(--color-accent-glow)]" 
                : "bg-surface text-ink border-ink/10 hover:border-accent/50 hover:text-accent"
            )}
          >
            {bookmarks.includes(pageNumber) ? <Bookmark size={20} fill="currentColor" /> : <BookmarkPlus size={20} />}
          </button>

          <div className="hidden sm:flex items-center gap-2 bg-ink/5 px-4 py-1.5 rounded-full">
            <button 
              onClick={() => changePage(-1)}
              disabled={pageNumber <= 1}
              className="disabled:opacity-20 hover:text-accent transition-colors p-1"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-1">
              <input 
                type="text"
                defaultValue={pageNumber}
                key={pageNumber}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseInt((e.target as HTMLInputElement).value);
                    if (!isNaN(val)) {
                      goToPage(val);
                    }
                  }
                }}
                onBlur={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) {
                    goToPage(val);
                  }
                }}
                className="w-10 bg-transparent text-sm font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-accent/30 rounded"
              />
              <span className="text-sm font-mono font-medium text-ink/40">/ {numPages}</span>
            </div>
            <button 
              onClick={() => changePage(1)}
              disabled={pageNumber >= numPages || (isSpreadView && pageNumber + 1 >= numPages)}
              className="disabled:opacity-20 hover:text-accent transition-colors p-1"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="hidden xl:flex items-center gap-3 bg-ink/5 px-4 py-1.5 rounded-full">
            <ZoomOut size={14} className="text-ink/40" />
            <input 
              type="range" 
              min="0.5" 
              max="2.5" 
              step="0.1" 
              value={scale} 
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-24 h-1 bg-ink/10 rounded-lg appearance-none cursor-pointer accent-accent"
            />
            <ZoomIn size={14} className="text-ink/40" />
            <button 
              onClick={() => setScale(1.0)}
              className="text-[10px] font-mono font-bold w-8 hover:text-accent transition-colors"
              title="Reset Zoom"
            >
              {Math.round(scale * 100)}%
            </button>
          </div>

          <button 
            onClick={handleSaveToLibrary}
            disabled={isSaving || savedLibrary.some(s => s.id === persistenceKey)}
            className={cn(
              "p-2 rounded-full transition-all flex items-center gap-2 px-3 border border-ink/10 shadow-sm hidden lg:flex",
              savedLibrary.some(s => s.id === persistenceKey) 
                ? "text-green-500 bg-green-500/10 border-green-500/30" 
                : "hover:bg-accent/10 hover:border-accent/30 text-ink/80"
            )}
            title="Save to Library"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            <span className="text-[10px] uppercase font-bold tracking-widest">
              {savedLibrary.some(s => s.id === persistenceKey) ? "Saved" : "Save"}
            </span>
          </button>

          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 hover:bg-ink/5 rounded-full transition-colors"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button 
            onClick={toggleFullScreen}
            className="p-2 hover:bg-ink/5 rounded-full transition-colors hidden sm:flex"
          >
            {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          <div className="h-4 w-[1px] bg-ink/10 mx-2" />

          {user ? (
            <div className="flex items-center gap-3">
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}`} 
                alt="Profile" 
                className="w-8 h-8 rounded-full border border-ink/10"
              />
              <button 
                onClick={logout}
                className="text-[10px] uppercase font-bold tracking-widest text-ink/40 hover:text-accent transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <button 
              onClick={signInWithGoogle}
              disabled={isAuthLoading}
              className="flex items-center gap-2 px-4 py-2 bg-ink text-paper rounded-full text-[10px] uppercase font-bold tracking-widest hover:bg-accent transition-all shadow-sm"
            >
              {isAuthLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Login
            </button>
          )}
          
          <button 
            onClick={() => setFile(null)}
            className="text-xs uppercase tracking-widest font-bold text-accent hover:underline ml-2"
          >
            Đóng
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.aside 
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              className="absolute inset-y-0 left-0 w-80 sm:relative sm:w-80 border-r border-ink/10 bg-paper z-[60] sm:z-40 flex flex-col shadow-2xl sm:shadow-none"
            >
              <div className="flex border-b border-ink/10">
                <button 
                  onClick={() => setSidebarTab('index')}
                  className={cn(
                    "flex-1 py-4 text-[10px] uppercase tracking-widest font-bold flex flex-col items-center gap-1 transition-all border-b-2",
                    sidebarTab === 'index' ? "text-accent border-accent bg-accent/10" : "text-ink/40 border-transparent hover:text-ink hover:bg-ink/5"
                  )}
                >
                  <LayoutGrid size={14} />
                  Mục lục
                </button>
                <button 
                  onClick={() => setSidebarTab('bookmarks')}
                  className={cn(
                    "flex-1 py-4 text-[10px] uppercase tracking-widest font-bold flex flex-col items-center gap-1 transition-all border-b-2",
                    sidebarTab === 'bookmarks' ? "text-accent border-accent bg-accent/10" : "text-ink/40 border-transparent hover:text-ink hover:bg-ink/5"
                  )}
                >
                  <Bookmark size={14} />
                  Dấu trang
                </button>
                <button 
                  onClick={() => setSidebarTab('history')}
                  className={cn(
                    "flex-1 py-4 text-[10px] uppercase tracking-widest font-bold flex flex-col items-center gap-1 transition-all border-b-2",
                    sidebarTab === 'history' ? "text-accent border-accent bg-accent/10" : "text-ink/40 border-transparent hover:text-ink hover:bg-ink/5"
                  )}
                >
                  <History size={14} />
                  Lịch sử
                </button>
                <button 
                  onClick={() => setSidebarTab('library')}
                  className={cn(
                    "flex-1 py-4 text-[10px] uppercase tracking-widest font-bold flex flex-col items-center gap-1 transition-all border-b-2",
                    sidebarTab === 'library' ? "text-accent border-accent bg-accent/10" : "text-ink/40 border-transparent hover:text-ink hover:bg-ink/5"
                  )}
                >
                  <LibraryIcon size={14} />
                  Thư viện
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {sidebarTab === 'index' && (
                  <div className="space-y-2">
                    {hasOutline === true ? (
                      <Document file={file}>
                        <Outline 
                          onItemClick={({ pageNumber }) => setPageNumber(pageNumber)}
                          className="custom-outline text-sm font-serif"
                        />
                      </Document>
                    ) : hasOutline === false ? (
                      <div className="flex flex-col gap-1">
                        {Array.from(new Array(numPages), (el, index) => (
                          <button
                            key={`page_link_${index}`}
                            onClick={() => setPageNumber(index + 1)}
                            className={cn(
                              "text-left py-2 px-3 rounded-lg transition-colors text-sm font-serif",
                              pageNumber === index + 1 ? "bg-accent/10 text-accent font-bold" : "hover:bg-ink/5 text-ink/80"
                            )}
                          >
                            Trang {index + 1}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-ink/40 text-xs flex flex-col items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        <span>Loading outline...</span>
                      </div>
                    )}
                  </div>
                )}

                {sidebarTab === 'bookmarks' && (
                  <div className="space-y-4">
                    {bookmarks.length === 0 ? (
                      <div className="text-center py-12">
                        <Bookmark size={32} className="mx-auto text-ink/10 mb-4" />
                        <p className="text-sm font-serif italic text-ink/40">No bookmarks yet</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {bookmarks.map((page) => (
                          <button
                            key={`bookmark_${page}`}
                            onClick={() => setPageNumber(page)}
                            className={cn(
                              "group relative aspect-[3/4] bg-ink/5 rounded-sm overflow-hidden transition-all",
                              pageNumber === page && "ring-2 ring-accent ring-offset-2"
                            )}
                          >
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-ink/40 transition-opacity z-10">
                              <span className="text-paper font-mono text-xs">{page}</span>
                            </div>
                            <Document file={file}>
                              <Page 
                                pageNumber={page} 
                                width={140} 
                                renderAnnotationLayer={false}
                                renderTextLayer={false}
                              />
                            </Document>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                 {sidebarTab === 'history' && (
                  <div className="space-y-3">
                    {readingHistory.length === 0 ? (
                      <div className="text-center py-12">
                        <History size={32} className="mx-auto text-ink/10 mb-4" />
                        <p className="text-sm font-serif italic text-ink/40">No history yet</p>
                      </div>
                    ) : (
                      readingHistory.map((item) => (
                        <div 
                          key={item.id} 
                          className="w-full p-3 bg-ink/5 rounded-xl border border-ink/5 hover:border-accent/20 hover:bg-accent/5 transition-all group relative"
                        >
                          <div 
                            className="cursor-pointer"
                            onClick={() => handleOpenFromHistory(item)}
                          >
                            <p className="text-sm font-bold truncate mb-1 group-hover:text-accent transition-colors">{item.name}</p>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-mono text-ink/40">Page {item.lastReadPage} / {item.totalPages}</span>
                              <span className="text-[10px] text-ink/30 italic">{new Date(item.timestamp).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-ink/40 font-mono">
                              <Clock size={10} />
                              <span>{Math.floor((item.totalReadingTime || 0) / 60)}m {(item.totalReadingTime || 0) % 60}s spent reading</span>
                            </div>
                          </div>
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              await handleOpenFromHistory(item);
                            }}
                            className="absolute top-3 right-3 px-2 py-1 bg-ink text-paper text-[9px] font-bold uppercase tracking-widest rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-accent"
                          >
                            Go to Page {item.lastReadPage}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {sidebarTab === 'library' && (
                  <div className="space-y-3">
                    {savedLibrary.length === 0 ? (
                      <div className="text-center py-12">
                        <LibraryIcon size={32} className="mx-auto text-ink/10 mb-4" />
                        <p className="text-sm font-serif italic text-ink/40">Library is empty</p>
                      </div>
                    ) : (
                      savedLibrary.map((saved) => (
                        <div key={saved.id} className="group p-3 bg-ink/5 rounded-xl border border-ink/5 hover:border-accent/20 transition-all relative">
                          <div 
                            className="cursor-pointer"
                            onClick={() => {
                              if (saved.data) {
                                loadFromLibrary(saved);
                              } else {
                                downloadFromCloud(saved);
                              }
                            }}
                          >
                            <p className="text-sm font-bold truncate mb-1 pr-6 group-hover:text-accent transition-colors">{saved.name}</p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-ink/40">{(saved.size / 1024 / 1024).toFixed(2)} MB</span>
                                {!saved.data && (
                                  <span className="text-[9px] font-bold text-accent uppercase tracking-tighter bg-accent/10 px-1.5 py-0.5 rounded">Cloud</span>
                                )}
                              </div>
                              <span className="text-[10px] text-ink/30 italic">{new Date(saved.timestamp).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFromLibrary(saved.id);
                            }}
                            className="absolute top-3 right-3 text-ink/20 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Reader View */}
        <main className="flex-1 overflow-auto bg-ink/5 flex justify-center p-8 custom-scrollbar relative">
          
          {/* Subtle Loading Indicator */}
          <AnimatePresence>
            {isPageRendering && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-paper/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-ink/10 shadow-sm"
              >
                <Loader2 size={12} className="animate-spin text-accent" />
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-ink/60">Rendering</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={cn(
            "flex gap-4 transition-all duration-500",
            isSpreadView ? "max-w-none" : "max-w-full justify-center"
          )}>
            <motion.div 
              key={`page_${pageNumber}`}
              initial={{ opacity: 0, x: isSpreadView ? -20 : 0 }}
              animate={{ opacity: 1, x: 0 }}
              className="shadow-2xl shadow-ink/20 bg-surface"
            >
              <Document
                file={file}
                onLoadSuccess={onDocumentLoadSuccess}
                onItemClick={({ pageNumber }) => setPageNumber(pageNumber)}
                loading={
                  <div className="w-[600px] aspect-[3/4] flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <p className="font-display uppercase text-xs tracking-widest">Rendering...</p>
                  </div>
                }
              >
                <Page 
                  pageNumber={pageNumber} 
                  scale={scale}
                  className="max-w-full"
                  renderAnnotationLayer={true}
                  renderTextLayer={true}
                  customTextRenderer={textRenderer}
                  onRenderSuccess={() => setIsPageRendering(false)}
                />
              </Document>
            </motion.div>

            {isSpreadView && pageNumber + 1 <= numPages && (
              <motion.div 
                key={`page_${pageNumber + 1}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="shadow-2xl shadow-ink/20 bg-surface"
              >
                <Document 
                  file={file}
                  onItemClick={({ pageNumber }) => setPageNumber(pageNumber)}
                >
                  <Page 
                    pageNumber={pageNumber + 1} 
                    scale={scale}
                    className="max-w-full"
                    renderAnnotationLayer={true}
                    renderTextLayer={true}
                    customTextRenderer={textRenderer}
                    onRenderSuccess={() => setIsPageRendering(false)}
                  />
                </Document>
              </motion.div>
            )}
          </div>

          {/* AI Panel Overlay */}
          <AnimatePresence>
            {isAiPanelOpen && (
              <motion.div 
                initial={{ opacity: 0, y: isAiPanelMinimized ? -50 : 50 }}
                animate={{ 
                  opacity: 1, 
                  y: 0,
                  height: isAiPanelMinimized ? 'auto' : aiPanelSize.height,
                  width: isAiPanelMinimized ? undefined : aiPanelSize.width
                }}
                exit={{ opacity: 0, y: isAiPanelMinimized ? -50 : 50 }}
                transition={{ duration: isResizing ? 0 : 0.3 }} // Disable animation during resize
                className={cn(
                  "absolute right-4 sm:right-8 bg-panel border border-glass-border rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-50 flex flex-col backdrop-blur-xl",
                  !isResizing && "transition-all duration-500 ease-in-out",
                  isAiPanelMinimized 
                    ? "top-4 w-64 sm:w-72 max-h-16" 
                    : "bottom-28 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-8rem)]"
                )}
              >
                {!isAiPanelMinimized && (
                  <div 
                    className="absolute top-0 left-0 w-8 h-8 cursor-nwse-resize z-50 flex items-start justify-start p-2 group"
                    onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
                    onTouchStart={(e) => { e.preventDefault(); setIsResizing(true); }}
                  >
                    <div className="w-3 h-3 border-t-2 border-l-2 border-ink/20 group-hover:border-accent transition-colors rounded-tl-sm" />
                  </div>
                )}

                {isResizing && (
                  <div className="absolute inset-0 pointer-events-none z-0 opacity-10"
                       style={{
                         backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
                         backgroundSize: '50px 50px'
                       }}
                  />
                )}
                
                <div className="p-4 sm:p-5 border-b border-glass-border flex items-center justify-between bg-glass shrink-0 pl-8 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-6 bg-accent rounded-full shadow-[0_0_10px_var(--color-accent-glow)]" />
                    <span className="text-xs sm:text-sm uppercase font-display font-bold text-ink tracking-widest">Trợ lý AI</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsAiPanelMinimized(!isAiPanelMinimized)} 
                      className="text-ink/40 hover:text-accent transition-all duration-300 p-1"
                      title={isAiPanelMinimized ? "Maximize" : "Minimize"}
                    >
                      {isAiPanelMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                    </button>
                    <button onClick={() => setIsAiPanelOpen(false)} className="text-ink/40 hover:text-accent transition-all duration-300 hover:rotate-90 p-1">
                      <X size={18} />
                    </button>
                  </div>
                </div>
                
                {!isAiPanelMinimized && (
                  <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar relative z-10">
                  {isTranslating || isSummarizing ? (
                    <div className="flex flex-col items-center justify-center py-16 sm:py-20 gap-6 sm:gap-8">
                      <div className="relative">
                        <Loader2 size={40} className="text-accent animate-spin sm:w-12 sm:h-12" />
                        <div className="absolute inset-0 blur-xl bg-accent/20 animate-pulse" />
                      </div>
                      <p className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.2em] text-accent/70 animate-pulse text-center px-4">
                        {isTranslating ? "Đang chuyển ngữ..." : "Đang chắt lọc ý chính..."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6 sm:space-y-8">
                      <div className="flex p-1 bg-glass rounded-xl border border-glass-border">
                        <button 
                          onClick={() => setAiMode('translation')}
                          className={cn(
                            "flex-1 py-2 text-[9px] uppercase font-bold tracking-widest rounded-lg transition-all duration-300",
                            aiMode === 'translation' ? "bg-accent text-paper shadow-md" : "text-ink/40 hover:text-ink/70"
                          )}
                        >
                          Dịch
                        </button>
                        <button 
                          onClick={() => setAiMode('summary')}
                          className={cn(
                            "flex-1 py-2 text-[9px] uppercase font-bold tracking-widest rounded-lg transition-all duration-300",
                            aiMode === 'summary' ? "bg-accent text-paper shadow-md" : "text-ink/40 hover:text-ink/70"
                          )}
                        >
                          Tóm tắt
                        </button>
                        <button 
                          onClick={() => setAiMode('reading')}
                          className={cn(
                            "flex-1 py-2 text-[9px] uppercase font-bold tracking-widest rounded-lg transition-all duration-300",
                            aiMode === 'reading' ? "bg-accent text-paper shadow-md" : "text-ink/40 hover:text-ink/70"
                          )}
                        >
                          Đọc gốc
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {aiMode === 'reading' && (
                          <div className="space-y-3">
                            <div className="p-4 bg-accent/5 border border-accent/10 rounded-xl flex items-center gap-3">
                              <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center text-accent">
                                <Volume2 size={16} />
                              </div>
                              <div className="text-left">
                                <h3 className="text-[10px] font-bold text-ink uppercase tracking-wider">Đọc gốc</h3>
                                <p className="text-[9px] text-ink/50 italic">Nghe nội dung trực tiếp</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => changePage(-1)}
                                disabled={pageNumber <= 1}
                                className="p-2 bg-ink/5 rounded-lg hover:bg-ink/10 disabled:opacity-30 transition-all"
                              >
                                <ChevronLeft size={14} />
                              </button>
                              <div className="flex-1 bg-surface border border-glass-border rounded-lg py-1.5 text-center font-mono text-[10px] font-bold">
                                Trang {pageNumber} / {numPages}
                              </div>
                              <button 
                                onClick={() => changePage(1)}
                                disabled={pageNumber >= numPages}
                                className="p-2 bg-ink/5 rounded-lg hover:bg-ink/10 disabled:opacity-30 transition-all"
                              >
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {aiMode === 'translation' && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[9px] uppercase font-bold text-ink/30 tracking-widest">Ngôn ngữ</label>
                              <CustomSelect
                                value={targetLang}
                                onChange={setTargetLang}
                                options={[
                                  { value: 'Vietnamese', label: 'Tiếng Việt' },
                                  { value: 'English', label: 'Tiếng Anh' },
                                  { value: 'French', label: 'Tiếng Pháp' },
                                  { value: 'Japanese', label: 'Tiếng Nhật' },
                                  { value: 'Korean', label: 'Tiếng Hàn' },
                                ]}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] uppercase font-bold text-ink/30 tracking-widest">Phong cách</label>
                              <CustomSelect
                                value={translationStyle}
                                onChange={(val) => setTranslationStyle(val as any)}
                                options={[
                                  { value: 'magazine', label: 'Tạp chí' },
                                  { value: 'normal', label: 'Chuẩn' },
                                  { value: 'casual', label: 'Gần gũi' },
                                ]}
                              />
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-bold text-ink/30 tracking-widest">Giọng đọc</label>
                            <CustomSelect
                              value={voiceId}
                              onChange={(val) => setVoiceId(val)}
                              options={VOICE_OPTIONS.map(v => ({ value: v.id, label: v.label }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[9px] uppercase font-bold text-ink/30 tracking-widest">Tốc độ</label>
                            <div className="flex gap-1">
                              {[1, 1.1, 1.15, 1.2].map((rate) => (
                                <button
                                  key={rate}
                                  onClick={() => setPlaybackRate(rate)}
                                  className={cn(
                                    "flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all border",
                                    playbackRate === rate 
                                      ? "bg-accent text-paper border-accent shadow-sm" 
                                      : "bg-ink/5 text-ink/60 border-ink/5 hover:bg-ink/10"
                                  )}
                                >
                                  {rate}x
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4 pt-6 border-t border-ink/5">
                        {aiMode === 'reading' && (
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <PlayCircle size={14} className={cn(isContinuousReading ? "text-accent" : "text-ink/30")} />
                                <span className="text-xs font-bold text-ink/70">Đọc liên tục</span>
                              </div>
                              <span className="text-[10px] text-ink/30 italic ml-5">Tự động chuyển trang khi đọc xong</span>
                            </div>
                            <button 
                              onClick={() => setIsContinuousReading(!isContinuousReading)}
                              className={cn(
                                "w-12 h-6 rounded-full transition-all duration-300 relative",
                                isContinuousReading ? "bg-accent" : "bg-ink/10"
                              )}
                            >
                              <div className={cn(
                                "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm",
                                isContinuousReading ? "right-1" : "left-1"
                              )} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="pt-6 border-t border-ink/5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] uppercase font-bold text-ink/30 tracking-widest">
                            {aiMode === 'translation' ? 'Bản dịch' : aiMode === 'summary' ? 'Tóm tắt' : 'Gốc'}
                          </h4>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => seekTts(-15)}
                              disabled={!isPlaying}
                              className="p-2 text-ink/40 hover:text-accent disabled:opacity-20 transition-colors"
                              title="Lùi 15s"
                            >
                              <RotateCcw size={14} />
                            </button>
                            
                            <button 
                              onClick={() => playTts()}
                              disabled={(!isTtsLoading && (aiMode === 'translation' ? !translatedText : aiMode === 'summary' ? !summaryText : !currentPageText))}
                              className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90",
                                isPlaying ? "bg-accent text-paper shadow-lg shadow-accent/20" : "bg-ink/10 text-ink hover:bg-ink hover:text-paper"
                              )}
                            >
                              {isTtsLoading ? <Loader2 size={16} className="animate-spin" /> : isPlaying ? <Pause size={16} /> : <Play size={16} />}
                            </button>

                            <button 
                              onClick={() => seekTts(15)}
                              disabled={!isPlaying}
                              className="p-2 text-ink/40 hover:text-accent disabled:opacity-20 transition-colors"
                              title="Tiến 15s"
                            >
                              <RotateCw size={14} />
                            </button>
                            
                            {aiMode !== 'reading' && (
                              <button 
                                onClick={aiMode === 'translation' ? translatePage : summarizePage}
                                className="ml-2 p-2 text-ink/40 hover:text-accent transition-colors"
                                title="Tạo lại"
                              >
                                <RefreshCw size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {aiError && (
                          <div className="p-5 bg-red-500/5 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 text-xs font-medium flex flex-col gap-4 shadow-sm">
                            <div className="flex items-start gap-3">
                              <div className="p-1.5 bg-red-500/10 rounded-lg shrink-0">
                                <AlertCircle size={14} className="text-red-500" />
                              </div>
                              <div className="space-y-1.5">
                                <p className="font-bold uppercase tracking-wider text-[10px] text-red-500/70">Thông báo lỗi</p>
                                <div className="whitespace-pre-wrap leading-relaxed opacity-90">
                                  {aiError}
                                </div>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                setAiError(null);
                                if (aiMode === 'translation') translatePage();
                                else if (aiMode === 'summary') summarizePage();
                                else playTts();
                              }}
                              className="bg-red-500 text-white hover:bg-red-600 px-6 py-2.5 rounded-xl self-start transition-all duration-300 font-bold shadow-lg shadow-red-500/20 active:scale-95"
                            >
                              Thử lại ngay
                            </button>
                          </div>
                        )}

                        <motion.div 
                          key={aiMode + (aiMode === 'translation' ? translatedText : aiMode === 'summary' ? summaryText : currentPageText)}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className={cn(
                            "bg-surface border border-glass-border rounded-2xl p-4 sm:p-6 prose prose-sm font-serif leading-relaxed text-ink/90 italic-quotes shadow-inner",
                            isDarkMode && "prose-invert"
                          )}
                        >
                          {aiMode === 'translation' 
                            ? (translatedText || <span className="italic text-ink/30">Nhấn dịch để bắt đầu...</span>) 
                            : aiMode === 'summary'
                            ? (summaryText || <span className="italic text-ink/30">Nhấn tóm tắt để bắt đầu...</span>)
                            : (currentPageText || <span className="italic text-ink/30">Đang trích xuất văn bản...</span>)}
                        </motion.div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </main>

        {/* Page Controls Overlay */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none z-50">
          <button 
            onClick={() => goToPage(1)}
            disabled={pageNumber <= 1}
            className="p-3 bg-ink/80 text-paper rounded-full shadow-xl pointer-events-auto disabled:opacity-50 hover:bg-accent transition-colors"
            title="Về trang đầu"
          >
            <ChevronsLeft size={20} />
          </button>
          <button 
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1}
            className="p-4 bg-ink text-paper rounded-full shadow-xl pointer-events-auto disabled:opacity-50 hover:bg-accent transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="px-6 py-3 bg-paper/90 backdrop-blur-md rounded-full shadow-xl border border-ink/5 pointer-events-auto flex items-center gap-3">
            <div className="flex items-center gap-1">
              <input 
                type="text"
                defaultValue={pageNumber}
                key={pageNumber}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = parseInt((e.target as HTMLInputElement).value);
                    if (!isNaN(val)) {
                      goToPage(val);
                    }
                  }
                }}
                onBlur={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) {
                    goToPage(val);
                  }
                }}
                className="w-10 bg-transparent font-mono text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-accent/30 rounded"
              />
              <span className="font-mono text-sm font-bold text-ink/40">/ {numPages}</span>
            </div>
            <div className="h-4 w-[1px] bg-ink/10" />
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-ink/60">
              <Clock size={12} className="text-accent" />
              <span>{Math.floor((pageTimes[pageNumber] || 0) / 60)}m {(pageTimes[pageNumber] || 0) % 60}s</span>
            </div>
            <div className="h-4 w-[1px] bg-ink/10" />
            <History size={14} className="text-ink/40" />
          </div>
          <button 
            onClick={() => changePage(1)}
            disabled={pageNumber >= numPages || (isSpreadView && pageNumber + 1 >= numPages)}
            className="p-4 bg-ink text-paper rounded-full shadow-xl pointer-events-auto disabled:opacity-50 hover:bg-accent transition-colors"
          >
            <ChevronRight size={24} />
          </button>
          <button 
            onClick={() => goToPage(numPages)}
            disabled={pageNumber >= numPages || (isSpreadView && pageNumber + 1 >= numPages)}
            className="p-3 bg-ink/80 text-paper rounded-full shadow-xl pointer-events-auto disabled:opacity-50 hover:bg-accent transition-colors"
            title="Đến trang cuối"
          >
            <ChevronsRight size={20} />
          </button>
        </div>
      </div>

      {isDownloading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-paper/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={32} className="animate-spin text-accent" />
            <p className="font-mono text-xs uppercase tracking-widest font-bold text-accent">Downloading from Cloud...</p>
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}
