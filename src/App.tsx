import React, { useState, useCallback, useEffect, useMemo, useRef, Component, ReactNode } from 'react';
import Markdown from 'react-markdown';
import * as lamejs from 'lamejs';
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
  PlaySquare,
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
  RefreshCw,
  LogIn,
  Gauge,
  Repeat,
  FileText,
  UploadCloud,
  Download
} from 'lucide-react';
import { Document, Page, Outline, pdfjs } from 'react-pdf';
import JSZip from 'jszip';
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
  getDocs,
  getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadString } from 'firebase/storage';

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
  { id: 'zephyr_student', name: 'Zephyr', label: 'Nữ sinh viên (Nhí nhảnh)', desc: 'giọng nữ sinh viên Việt Nam, nhí nhảnh, vui tươi' },
  { id: 'kore_cute_south', name: 'Kore', label: 'Nữ miền Nam (Dễ thương)', desc: 'giọng nữ miền Nam Việt Nam, dễ thương, ngọt ngào' },
  { id: 'kore_south', name: 'Kore', label: 'Nữ miền Nam (Nhẹ nhàng)', desc: 'giọng nữ miền Nam Việt Nam, nhẹ nhàng, truyền cảm' },
  { id: 'kore_genz', name: 'Kore', label: 'Nữ GenZ (Hiện đại)', desc: 'giọng nữ GenZ Việt Nam, hiện đại, cá tính' },
  { id: 'zephyr_teen', name: 'Zephyr', label: 'Nữ thiếu niên (Trong sáng)', desc: 'giọng nữ thiếu niên, trong sáng, hồn nhiên' },
  { id: 'kore_central', name: 'Kore', label: 'Nữ miền Trung (Ấm áp)', desc: 'giọng nữ miền Trung Việt Nam, ấm áp, chân thành' },
  { id: 'kore_young_central', name: 'Kore', label: 'Nữ miền Trung (Trẻ trung)', desc: 'giọng nữ miền Trung Việt Nam, trẻ trung, năng động' },
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
  const [bookmarkTranslations, setBookmarkTranslations] = useState<Record<number, string>>({});
  const [isTranslatingBookmarks, setIsTranslatingBookmarks] = useState<Record<number, boolean>>({});
  const [readingHistory, setReadingHistory] = useState<HistoryItem[]>([]);
  const [savedLibrary, setSavedLibrary] = useState<SavedFile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // AI Features state
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [aiMode, setAiMode] = useState<'translation' | 'advanced' | 'reading'>('translation');
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [aiPanelSize, setAiPanelSize] = useState({ width: 600, height: 500 });
  const [isResizing, setIsResizing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAiPanelMinimized, setIsAiPanelMinimized] = useState(false);
  const [isDocumentLoaded, setIsDocumentLoaded] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('litreader_dark_mode');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [isServedFromCache, setIsServedFromCache] = useState(false);
  const [aiFontSize, setAiFontSize] = useState<number>(() => parseInt(localStorage.getItem('litreader_ai_font_size') || '14'));
  const [isAudioDownloading, setIsAudioDownloading] = useState(false);
  const [currentTtsCacheKey, setCurrentTtsCacheKey] = useState<string | null>(null);

  // Partial translation & selection state
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selectionPosition, setSelectionPosition] = useState<{ x: number, y: number } | null>(null);
  const selectionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Batch Translation state
  const [isBatchTranslating, setIsBatchTranslating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchRange, setBatchRange] = useState({ start: 1, end: 1 });
  const batchAbortRef = useRef<AbortController | null>(null);
  const [isBatchTtsing, setIsBatchTtsing] = useState(false);
  const [batchTtsProgress, setBatchTtsProgress] = useState({ current: 0, total: 0 });
  const [batchTranslatedResult, setBatchTranslatedResult] = useState<{title: string, text: string, range: {start: number, end: number}} | null>(null);
  const [pdfOutline, setPdfOutline] = useState<any[] | null>(null);
  const [renderQuality, setRenderQuality] = useState<'fast' | 'high'>(() => {
    const saved = localStorage.getItem('litreader_render_quality');
    return (saved as 'fast' | 'high') || 'high';
  });

  // Handle Text Selection
  const handleSelection = useCallback((e: MouseEvent | TouchEvent) => {
    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    
    selectionTimerRef.current = setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      
      if (text && text.length > 5 && text.length < 5000) {
        const range = selection?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        
        if (rect) {
          setSelectedText(text);
          setSelectionPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 10
          });
        }
      } else {
        setSelectedText(null);
        setSelectionPosition(null);
      }
    }, 200);
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, [handleSelection]);

  const translatePartial = async (text: string) => {
    if (!text || isTranslating) return;
    
    setIsAiPanelOpen(true);
    setAiMode('translation');
    setIsTranslating(true);
    setTranslatedText(null);
    setAiError(null);
    setSelectedText(null);
    setSelectionPosition(null);
    
    try {
      const ai = getGenAI();
      const systemInstruction = `Bạn là một biên tập viên dịch thuật. Dịch đoạn văn bản sau đây sang ${targetLang}. CHỈ trả về bản dịch.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: `Dịch đoạn này sang ${targetLang}: ${text}` }] }],
        config: { systemInstruction }
      });
      
      const translated = response.candidates?.[0]?.content?.parts?.[0]?.text || "Không thể dịch.";
      setTranslatedText(translated);
    } catch (error: any) {
      handleAiError(error, 'translation');
    } finally {
      setIsTranslating(false);
    }
  };

  const translateBookmarkPage = async (p: number) => {
    if (!file || isTranslatingBookmarks[p]) return;
    
    setIsTranslatingBookmarks(prev => ({ ...prev, [p]: true }));
    
    try {
      // Extract text for this page
      let pdf = pdfDocRef.current;
      if (!pdf) {
        const data = await file.arrayBuffer();
        pdf = await pdfjs.getDocument({ data }).promise;
        pdfDocRef.current = pdf;
      }
      
      const page = await pdf.getPage(p);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      
      if (!pageText.trim()) throw new Error("No text on page");

      const ai = getGenAI();
      const systemInstruction = `Bạn là một biên tập viên dịch thuật. Dịch đoạn văn bản sau đây sang ${targetLang}. CHỈ trả về bản dịch.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: `Dịch nội dung trang sách này sang ${targetLang}: ${pageText.substring(0, 5000)}` }] }],
        config: { systemInstruction }
      });
      
      const translated = response.candidates?.[0]?.content?.parts?.[0]?.text || "Không thể dịch.";
      
      const newTranslations = { ...bookmarkTranslations, [p]: translated };
      setBookmarkTranslations(newTranslations);
      
      if (user) {
        const docRef = doc(db, 'users', user.uid, 'translations', `bookmarks_${persistenceKey}`);
        await setDoc(docRef, newTranslations, { merge: true });
      }
    } catch (error) {
      console.error("Bookmark translation error:", error);
      alert("Lỗi khi dịch dấu trang.");
    } finally {
      setIsTranslatingBookmarks(prev => ({ ...prev, [p]: false }));
    }
  };

  const translateAllBookmarks = async () => {
    if (bookmarks.length === 0) return;
    for (const p of bookmarks) {
      if (!bookmarkTranslations[p]) {
        await translateBookmarkPage(p);
        // Small delay
        await new Promise(r => setTimeout(r, 500));
      }
    }
  };

  const startBatchTranslation = async () => {
    if (!file || isBatchTranslating) return;
    
    const { start, end } = batchRange;
    const total = end - start + 1;
    if (total <= 0) return;
    
    setIsBatchTranslating(true);
    setBatchProgress({ current: 0, total });
    batchAbortRef.current = new AbortController();
    
    try {
      for (let p = start; p <= end; p++) {
        if (batchAbortRef.current?.signal.aborted) break;
        
        setBatchProgress(prev => ({ ...prev, current: p - start + 1 }));
        
        // Check cache first to avoid redundant API calls
        const cacheKey = `trans_${user ? user.uid : 'guest'}_${persistenceKey}_${p}_${targetLang}_${translationStyle}`;
        const cached = await getCache(cacheKey);
        
        if (!cached) {
          // Extract text for this page
          let pdf = pdfDocRef.current;
          if (!pdf) {
            const data = await file.arrayBuffer();
            pdf = await pdfjs.getDocument({ data }).promise;
            pdfDocRef.current = pdf;
          }
          
          const page = await pdf.getPage(p);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          
          if (pageText.trim()) {
            const ai = getGenAI();
            const systemInstruction = `Bạn là một biên tập viên dịch thuật chuyên nghiệp cho các tạp chí cao cấp. Dịch sang ${targetLang}. CHỈ trả về bản dịch.`;
            
            const response = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: [{ parts: [{ text: pageText }] }],
              config: { systemInstruction }
            });
            
            const translated = response.candidates?.[0]?.content?.parts?.[0]?.text;
            if (translated) {
              await saveCache(cacheKey, translated);
              if (user) {
                setDoc(doc(db, 'users', user.uid, 'translations', cacheKey), {
                  text: translated,
                  timestamp: Date.now()
                }).catch(e => console.error("Cloud cache error", e));
              }
            }
          }
        }
        
        // Small delay to prevent rate issues
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (error) {
      console.error("Batch translation error:", error);
    } finally {
      setIsBatchTranslating(false);
      // If we are on one of the translated pages, refresh UI
      if (pageNumber >= start && pageNumber <= end) {
        const cacheKey = `trans_${user ? user.uid : 'guest'}_${persistenceKey}_${pageNumber}_${targetLang}_${translationStyle}`;
        const cached = await getCache(cacheKey);
        if (cached) setTranslatedText(cached);
      }
      
      // Collect all text and show modal if it completed partially or fully
      let fullText = "";
      for (let p = start; p <= end; p++) {
        const cacheKey = `trans_${user ? user.uid : 'guest'}_${persistenceKey}_${p}_${targetLang}_${translationStyle}`;
        const cached = await getCache(cacheKey);
        if (cached) fullText += cached + "\n\n";
      }
      if (fullText.trim()) {
        setBatchTranslatedResult({ title: `Bản dịch trang ${start} - ${end}`, text: fullText.trim(), range: { start, end } });
      }
    }
  };

  const openSeamlessTextForRange = async () => {
    const { start, end } = batchRange;
    let fullText = "";
    for (let p = start; p <= end; p++) {
      const cacheKey = `trans_${user ? user.uid : 'guest'}_${persistenceKey}_${p}_${targetLang}_${translationStyle}`;
      const cached = await getCache(cacheKey);
      if (cached) fullText += cached + "\n\n";
    }
    if (fullText.trim()) {
      setBatchTranslatedResult({ title: `Bản dịch trang ${start} - ${end}`, text: fullText.trim(), range: { start, end } });
    } else {
      alert("Chưa có dữ liệu dịch cho các trang này.");
    }
  };

  const startBatchTts = async () => {
    if (!file || isBatchTtsing) return;
    
    const { start, end } = batchRange;
    const total = end - start + 1;
    if (total <= 0) return;
    
    setIsBatchTtsing(true);
    setBatchTtsProgress({ current: 0, total });
    batchAbortRef.current = new AbortController();
    
    try {
      const audioChunks: AudioBuffer[] = [];
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      for (let p = start; p <= end; p++) {
        if (batchAbortRef.current?.signal.aborted) break;
        setBatchTtsProgress(prev => ({ ...prev, current: p - start + 1 }));
        
        // 1. Get Text (Prefer translated, then original)
        const transKey = `trans_${user ? user.uid : 'guest'}_${persistenceKey}_${p}_${targetLang}_${translationStyle}`;
        let text = await getCache(transKey);
        
        if (!text) {
          let pdf = pdfDocRef.current;
          if (!pdf) {
            const data = await file.arrayBuffer();
            pdf = await pdfjs.getDocument({ data }).promise;
            pdfDocRef.current = pdf;
          }
          const page = await pdf.getPage(p);
          const textContent = await page.getTextContent();
          text = textContent.items.map((item: any) => item.str).join(' ');
        }

        if (text?.trim()) {
          const ttsKey = `tts_${user ? user.uid : 'guest'}_${persistenceKey}_${p}_${voiceId}_${playbackRate}_${targetLang}`;
          let base64Audio = await getCache(ttsKey);
          
          if (!base64Audio) {
            // Generate TTS if not cached
            const ai = getGenAI();
            const response = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: [{ parts: [{ text }] }],
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } } }
              }
            });
            
            base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              await saveCache(ttsKey, base64Audio);
            }
          }

          if (base64Audio) {
            const binary = atob(base64Audio);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            let buffer = await ctx.decodeAudioData(bytes.buffer);
            
            // Resample if speed is not 1.0 (Nearest Neighbor for simplicity)
            if (playbackRate !== 1.0) {
              const newLength = Math.floor(buffer.length / playbackRate);
              const resampledBuffer = ctx.createBuffer(buffer.numberOfChannels, newLength, buffer.sampleRate);
              for (let c = 0; c < buffer.numberOfChannels; c++) {
                const oldData = buffer.getChannelData(c);
                const newData = resampledBuffer.getChannelData(c);
                for (let j = 0; j < newLength; j++) {
                  newData[j] = oldData[Math.floor(j * playbackRate)] || 0;
                }
              }
              buffer = resampledBuffer;
            }
            
            audioChunks.push(buffer);
          }
        }
        
        await new Promise(r => setTimeout(r, 800)); // Rate limit buffer
      }

      if (audioChunks.length > 0) {
        // Concatenate buffers with small gaps
        const gapSeconds = 0.5;
        const gapFrames = Math.floor(gapSeconds * audioChunks[0].sampleRate);
        const totalLength = audioChunks.reduce((acc, buf) => acc + buf.length + gapFrames, 0);
        
        const finalBuffer = ctx.createBuffer(
          audioChunks[0].numberOfChannels,
          totalLength,
          audioChunks[0].sampleRate
        );

        let offset = 0;
        for (const buf of audioChunks) {
          for (let channel = 0; channel < buf.numberOfChannels; channel++) {
            finalBuffer.getChannelData(channel).set(buf.getChannelData(channel), offset);
          }
          offset += buf.length + gapFrames;
        }

        // Convert AudioBuffer to MP3
        const mp3Blob = audioBufferToMp3(finalBuffer);
        const url = URL.createObjectURL(mp3Blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Audiobook_${file.name.replace(/\.[^/.]+$/, "")}_Pages_${start}-${end}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Batch TTS error:", error);
      alert("Lỗi khi tạo Audio hàng loạt. Vui lòng thử lại.");
    } finally {
      setIsBatchTtsing(false);
    }
  };

  // Helper to convert AudioBuffer to MP3
  const audioBufferToMp3 = (buffer: AudioBuffer): Blob => {
    // @ts-ignore
    const mp3encoder = new lamejs.Mp3Encoder(buffer.numberOfChannels, buffer.sampleRate, 128);
    const mp3Data: Int8Array[] = [];

    const left = buffer.getChannelData(0);
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : new Float32Array(0);

    const sampleBlockSize = 1152;
    const leftInt16 = new Int16Array(left.length);
    const rightInt16 = new Int16Array(right.length);

    for (let i = 0; i < left.length; i++) {
      leftInt16[i] = left[i] < 0 ? left[i] * 32768 : left[i] * 32767;
      if (buffer.numberOfChannels > 1) {
        rightInt16[i] = right[i] < 0 ? right[i] * 32768 : right[i] * 32767;
      }
    }

    for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
      const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
      let mp3buf;
      
      if (buffer.numberOfChannels > 1) {
        const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
        mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      } else {
        mp3buf = mp3encoder.encodeBuffer(leftChunk);
      }
      
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }

    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }

    return new Blob(mp3Data, { type: 'audio/mp3' });
  };

  // Helper to parse AI errors and provide user-friendly messages
  const handleAiError = useCallback((error: any, context: 'translation' | 'summary' | 'tts') => {
    const errorMsg = error?.message || String(error);
    console.error(`AI Error (${context}):`, error);

    let message = "Đã xảy ra lỗi không xác định.";
    let suggestion = "Vui lòng thử lại sau.";

    if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      message = "Hết hạn mức sử dụng (Quota Exceeded).";
      suggestion = "Bạn đã đạt giới hạn yêu cầu. Vui lòng đợi một lát rồi thử lại hoặc kiểm tra cài đặt thanh toán của bạn.";
    } else if (errorMsg.includes('SAFETY') || errorMsg.includes('blocked')) {
      message = "Nội dung bị chặn bởi bộ lọc an toàn.";
      suggestion = "Trình AI không thể xử lý nội dung này vì lý do an toàn. Thử chọn trang khác hoặc nội dung khác.";
    } else if (errorMsg.includes('500') || errorMsg.includes('INTERNAL')) {
      message = "Lỗi máy chủ AI.";
      suggestion = "Máy chủ đang gặp sự cố tạm thời. Vui lòng thử lại sau vài giây.";
    } else if (errorMsg.includes('xhr') || errorMsg.includes('fetch') || errorMsg.includes('network')) {
      message = "Lỗi kết nối mạng.";
      suggestion = "Không thể kết nối với máy chủ AI. Vui lòng kiểm tra kết nối internet của bạn.";
    } else if (errorMsg.includes('API key')) {
      message = "Lỗi xác thực API.";
      suggestion = "Khóa API không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại cấu hình.";
    }

    setAiError(message);
    setAiSuggestion(suggestion);
  }, []);

  const [targetLang, setTargetLang] = useState(() => localStorage.getItem('litreader_target_lang') || 'Vietnamese');
  const [voiceId, setVoiceId] = useState<string>(() => localStorage.getItem('litreader_voice_id') || 'zephyr_north');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const currentOffsetRef = useRef<number>(0);
  const currentPlayIdRef = useRef(0);

  // Customization state
  const [fontFamily, setFontFamily] = useState<'font-sans' | 'font-serif' | 'font-mono'>('font-sans');
  const [translationStyle, setTranslationStyle] = useState<'magazine' | 'normal' | 'casual'>(() => (localStorage.getItem('litreader_trans_style') as any) || 'casual');
  const [playbackRate, setPlaybackRate] = useState<number>(() => parseFloat(localStorage.getItem('litreader_playback_rate') || '1.2'));
  const [isPageRendering, setIsPageRendering] = useState(false);
  const [hasOutline, setHasOutline] = useState<boolean | null>(null);
  const [autoRead, setAutoRead] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isContinuousReading, setIsContinuousReading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Pre-extracted text for the current page to speed up AI
  const [currentPageText, setCurrentPageText] = useState<string | null>(null);
  
  // Cache for PDF document to avoid re-parsing
  const pdfDocRef = useRef<any>(null);
  
  // Cache for AI results to save quota
  const translationCache = useRef<Record<string, string>>({});
  const ttsCache = useRef<Record<string, string>>({});
  
  const isContinuousReadingRef = useRef(isContinuousReading);
  const pageNumberRef = useRef(pageNumber);
  const numPagesRef = useRef(numPages);

  useEffect(() => {
    isContinuousReadingRef.current = isContinuousReading;
    pageNumberRef.current = pageNumber;
    numPagesRef.current = numPages;
  }, [isContinuousReading, pageNumber, numPages]);

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

    const q = query(collection(db, 'users', user.uid, 'library'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cloudFiles = snapshot.docs.map(doc => doc.data() as SavedFile);
      
      setSavedLibrary(prev => {
        // Keep only local files (those with data property)
        const localFiles = prev.filter(f => f.data);
        
        // Combine with cloud files, avoiding duplicates (local takes precedence)
        const merged = [...localFiles];
        cloudFiles.forEach(cloudFile => {
          if (!merged.some(f => f.id === cloudFile.id)) {
            merged.push(cloudFile);
          }
        });
        return merged;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/library`);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync bookmark translations from Firestore
  useEffect(() => {
    if (!user || !persistenceKey) return;

    const docRef = doc(db, 'users', user.uid, 'translations', `bookmarks_${persistenceKey}`);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setBookmarkTranslations(snapshot.data() as Record<number, string>);
      }
    }, (error) => {
      console.error("Bookmark translations sync error", error);
    });

    return () => unsubscribe();
  }, [user, persistenceKey]);
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users', user.uid, 'progress'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Ignore local writes to prevent echo
      if (snapshot.metadata.hasPendingWrites) return;

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          const { id, lastPage, savedBookmarks, timestamp, name, fileSize, totalPages, totalReadingTime } = data;
          if (!id) return;

          // Merge to readingHistory
          setReadingHistory(prev => {
            const index = prev.findIndex(item => item.id === id);
            
            // Only update history if cloud timestamp is strictly greater, or it is a new item
            const localTimestamp = index !== -1 ? prev[index].timestamp : 0;
            if (timestamp > localTimestamp) {
               const newItem: HistoryItem = {
                 id,
                 name: name || (index !== -1 ? prev[index].name : 'Unknown'),
                 lastReadPage: lastPage,
                 totalPages: totalPages || (index !== -1 ? prev[index].totalPages : 0),
                 timestamp,
                 fileSize: fileSize || (index !== -1 ? prev[index].fileSize : 0),
                 totalReadingTime: totalReadingTime || (index !== -1 ? prev[index].totalReadingTime : 0)
               };
               
               const filtered = prev.filter(item => item.id !== id);
               const updated = [newItem, ...filtered].sort((a,b) => b.timestamp - a.timestamp).slice(0, 10);
               localStorage.setItem('vogue_reader_history', JSON.stringify(updated));
               
               // Update individual local storage cache
               localStorage.setItem(id, JSON.stringify({
                 lastPage,
                 savedBookmarks,
                 timestamp
               }));

               // If it's the current file, update state so it updates live
               if (id === persistenceKey) {
                 // only update if the page/bookmark is really different
                 setPageNumber(prev => prev !== lastPage ? lastPage : prev);
                 setBookmarks(prev => JSON.stringify(prev) !== JSON.stringify(savedBookmarks || []) ? (savedBookmarks || []) : prev);
               }

               return updated;
            }
            return prev;
          });
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/progress`);
    });

    return () => unsubscribe();
  }, [user, persistenceKey]);

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
        if (settings.autoRead !== undefined) setAutoRead(settings.autoRead);
        if (settings.isAudioEnabled !== undefined) setIsAudioEnabled(settings.isAudioEnabled);
        if (settings.aiFontSize !== undefined) setAiFontSize(settings.aiFontSize);
      } catch (e) {
        console.error("Failed to parse AI settings", e);
      }
    }
    
    loadLibrary();
  }, []);

  // Save AI settings when they change
  useEffect(() => {
    localStorage.setItem('litreader_target_lang', targetLang);
  }, [targetLang]);

  useEffect(() => {
    localStorage.setItem('litreader_voice_id', voiceId);
  }, [voiceId]);

  useEffect(() => {
    localStorage.setItem('litreader_trans_style', translationStyle);
  }, [translationStyle]);

  useEffect(() => {
    localStorage.setItem('litreader_playback_rate', playbackRate.toString());
  }, [playbackRate]);

  useEffect(() => {
    localStorage.setItem('litreader_ai_font_size', aiFontSize.toString());
  }, [aiFontSize]);

  useEffect(() => {
    const settings = {
      targetLang,
      voiceId,
      translationStyle,
      playbackRate,
      autoRead,
      isAudioEnabled,
      isContinuousReading,
      aiFontSize
    };
    localStorage.setItem('vogue_reader_ai_settings', JSON.stringify(settings));
  }, [targetLang, voiceId, translationStyle, playbackRate, autoRead, isAudioEnabled, isContinuousReading, aiFontSize]);

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
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setIsTtsLoading(false);
    currentOffsetRef.current = 0;
    playbackStartTimeRef.current = 0;
    audioBufferRef.current = null;
  }, []);

  const pauseTts = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === 'running') {
      audioContextRef.current.suspend();
      setIsPlaying(false);
      setIsPaused(true);
    }
  }, []);

  const resumeTts = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
      setIsPlaying(true);
      setIsPaused(false);
    } else if (!isPlaying) {
      playTts();
    }
  }, [isPlaying]);

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
    setCurrentPageText(null);
    setAiError(null);
    setIsServedFromCache(false);
    stopTts();
  }, [isSpreadView, numPages, stopTts]);

  const goToPage = useCallback((page: number) => {
    setPageNumber(Math.min(Math.max(1, page), numPages));
    // Reset AI panel on page change
    setTranslatedText(null);
    setCurrentPageText(null);
    setAiError(null);
    setIsServedFromCache(false);
    stopTts();
  }, [numPages, stopTts]);

  // Clear cache when a new file is loaded
  useEffect(() => {
    translationCache.current = {};
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
      else if (aiMode === 'reading') text = currentPageText || undefined;
      else if (aiMode === 'advanced') text = translatedText || undefined;
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
    // Merge multiple lines and sentences into a single clean paragraph to minimize API calls and improve flow
    text = text
      .replace(/\r?\n|\r/g, ' ') // Replace all newlines with spaces
      .replace(/\s+/g, ' ')      // Collapse multiple spaces
      .trim();
    
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
    setAiSuggestion(null);

    // Check cache first
    const cacheKey = `audio_${user ? user.uid : 'guest'}_${voiceId}_${text.substring(0, 100)}_${text.length}`;
    setCurrentTtsCacheKey(cacheKey);
    
    let cachedAudio = ttsCache.current[cacheKey];
    if (!cachedAudio) {
      const persistedAudio = await getCache(cacheKey);
      if (persistedAudio) {
        cachedAudio = persistedAudio;
        ttsCache.current[cacheKey] = cachedAudio;
      }
    }

    const playAudio = (base64Data: string, offset = 0) => {
      // Audio playback implementation remains largely unchanged here
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
              model: "gemini-3.1-flash-tts-preview",
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
        saveCache(cacheKey, base64Audio).catch(e => console.error("Audio cache save error:", e));
        playAudio(base64Audio);
        
        // Upload to Firebase if logged in
        if (user && file) {
          const persistenceKey = `vogue_reader_${file.name}_${file.size}`;
          const storageRef = ref(storage, `users/${user.uid}/audio/${persistenceKey}_page_${pageNumber}_${voiceId}.mp3`);
          
          try {
            await setDoc(doc(db, 'users', user.uid, 'audio', `${persistenceKey}_${pageNumber}_${voiceId}`), {
              url: null, // downloadUrl (Storage not provisioned)
              pageNumber,
              voiceId,
              textPreview: text.substring(0, 100),
              timestamp: Date.now(),
              bookId: persistenceKey,
              bookName: file.name
            });
          } catch (cloudErr) {
             console.error("Audio Firebase upload error", cloudErr);
          }
        }
      }
    } catch (error: any) {
      handleAiError(error, 'tts');
    } finally {
      if (myPlayId === currentPlayIdRef.current) {
        setIsTtsLoading(false);
      }
    }
  }, [aiMode, translatedText, currentPageText, pageNumber, file, isTtsLoading, isAudioEnabled, isPlaying, stopTts, voiceId, playbackRate, changePage]);

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

  const handleDownloadAudio = async () => {
    if (!file || !currentTtsCacheKey) return;
    const base64Audio = ttsCache.current[currentTtsCacheKey];
    if (base64Audio) {
      try {
        setIsAudioDownloading(true);
        // Convert base64 to blob directly
        const byteCharacters = atob(base64Audio);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {type: 'audio/mp3'});
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `Audio_${file.name.substring(0, 20)}_Page${pageNumber}.mp3`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (err) {
        console.error("Download failed:", err);
      } finally {
        setIsAudioDownloading(false);
      }
    }
  };

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
        
        // Upload to Storage (Storage not provisioned, so skip it)
        // const fileRef = ref(storage, `users/${user.uid}/library/${persistenceKey}`);
        // await uploadBytes(fileRef, file);
        // const downloadURL = await getDownloadURL(fileRef);
        
        // Save metadata to Firestore library collection
        await setDoc(doc(db, 'users', user.uid, 'library', persistenceKey), {
          ...metadata,
          url: null, // downloadURL,
          ownerUid: user.uid
        });
      }
      
      await loadLibrary();
    } catch (err) {
      if (user) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/library/${persistenceKey}`);
      } else {
        console.error("Failed to save to library:", err);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFromLibrary = async (id: string) => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteFile(id);
      
      // Sync to Firestore and Storage if logged in
      if (user) {
        await deleteDoc(doc(db, 'users', user.uid, 'library', id));
        try {
          // const fileRef = ref(storage, `users/${user.uid}/library/${id}`);
          // await deleteObject(fileRef);
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
      setDeleteConfirmId(null);
    } catch (err) {
      if (user) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/library/${id}`);
      } else {
        console.error("Failed to delete from library:", err);
        alert("Không thể xóa tài liệu. Vui lòng thử lại.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadFromCloud = async (saved: SavedFile) => {
    if (!user) {
      alert("Vui lòng đăng nhập để tải file từ Cloud.");
      return;
    }
    
    try {
      setIsDownloading(true);
      
      // Since Storage is not provisioned, we can't download from the cloud URL.
      alert("Tải file từ Cloud đang bị vô hiệu hóa vì Firebase Storage không được cấu hình. Ứng dụng hiện chỉ đọc file từ bộ nhớ đệm nội bộ.");
      
      const fileData = await getFile(saved.id);
      if (fileData && fileData.data) {
        setFile(fileData.data as File);
        setIsDocumentLoaded(false);
        setPageNumber(1);
      } else {
        alert("File này chưa có dữ liệu tại bộ nhớ đệm thiết bị.");
      }
    } catch (err) {
      console.error("Failed to download from cloud:", err);
      alert("Không thể tải file từ Cloud. Có thể file đã bị xóa hoặc lỗi mạng.");
    } finally {
      setIsDownloading(false);
    }
  };

  const loadFromLibrary = async (saved: SavedFile) => {
    if (!saved.data) {
      await downloadFromCloud(saved);
      return;
    }

    // Convert Blob back to File
    const loadedFile = new File([saved.data], saved.name, { type: 'application/pdf' });
    pdfDocRef.current = null;
    setFile(loadedFile);
    setPageNumber(1);
    setBookmarks([]);
    setSearchQuery('');
    setSearchResults([]);
    setTranslatedText(null);
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
          const { lastPage, savedBookmarks } = JSON.parse(saved);
          if (lastPage) setPageNumber(lastPage);
          if (savedBookmarks) setBookmarks(savedBookmarks);
        } catch (e) {
          console.error("Failed to load saved state", e);
        }
      }
    }
  }, [persistenceKey]);

  // Save state on changes and update history
  useEffect(() => {
    if (persistenceKey && file) {
      const timestamp = Date.now();
      localStorage.setItem(persistenceKey, JSON.stringify({
        lastPage: pageNumber,
        savedBookmarks: bookmarks,
        timestamp
      }));

      // Update history
      let sessionReadingTime = 0;
      setReadingHistory(prev => {
        const existingItem = prev.find(item => item.id === persistenceKey);
        const previousTime = existingItem?.totalReadingTime || 0;
        sessionReadingTime = previousTime;
        
        const newItem: HistoryItem = {
          id: persistenceKey,
          name: file.name,
          lastReadPage: pageNumber,
          totalPages: numPages,
          timestamp,
          fileSize: file.size,
          totalReadingTime: previousTime
        };
        const filtered = prev.filter(item => item.id !== persistenceKey);
        const updated = [newItem, ...filtered].slice(0, 10);
        localStorage.setItem('vogue_reader_history', JSON.stringify(updated));
        return updated;
      });

      // Sync progress to cloud if user is logged in
      if (user) {
        setDoc(doc(db, 'users', user.uid, 'progress', persistenceKey), {
          id: persistenceKey,
          lastPage: pageNumber,
          savedBookmarks: bookmarks,
          timestamp,
          name: file.name,
          totalPages: numPages,
          fileSize: file.size,
          totalReadingTime: sessionReadingTime
        }).catch(err => {
          console.error("Failed to sync progress to cloud:", err);
          // Don't throw OperationType error here as it runs on every page turn and could crash the UI if flaky
        });
      }
    }
  }, [pageNumber, bookmarks, persistenceKey, file, numPages, user]);

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
      setSearchQuery('');
      setSearchResults([]);
      setTranslatedText(null);
      setCurrentPageText(null);
      setIsDocumentLoaded(false);
      setIsAiPanelOpen(false);

      // Automatically save to library to ensure "Recently Read" works
      const key = `vogue_reader_${newFile.name}_${newFile.size}`;
      try {
        const newSavedFile = {
          id: key,
          name: newFile.name,
          data: newFile,
          timestamp: Date.now(),
          size: newFile.size
        };
        await saveFile(newSavedFile);
        
        // Auto-save to cloud if user is logged in
        if (user) {
          try {
            setIsUploadingPdf(true);
            const { data: _, ...metadata } = newSavedFile;
            
            // Upload to Storage (Storage not provisioned, skip)
            // const fileRef = ref(storage, `users/${user.uid}/library/${key}`);
            // await uploadBytes(fileRef, newFile);
            // const downloadURL = await getDownloadURL(fileRef);
            
            // Save metadata and downloadURL to Firestore library collection
            await setDoc(doc(db, 'users', user.uid, 'library', key), {
              ...metadata,
              url: null, // downloadURL,
              ownerUid: user.uid
            });
          } catch (cloudErr) {
            handleFirestoreError(cloudErr, OperationType.WRITE, `users/${user.uid}/library/${key}`);
          } finally {
            setIsUploadingPdf(false);
          }
        }
        
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
    setBatchRange({ start: 1, end: Math.min(10, pdf.numPages) });
    try {
      const outline = await pdf.getOutline();
      setHasOutline(!!outline && outline.length > 0);
      setPdfOutline(outline);
    } catch (e) {
      setHasOutline(false);
      setPdfOutline(null);
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

  // Auto-play TTS Logic
  useEffect(() => {
    if ((isContinuousReading || autoRead) && isDocumentLoaded && currentPageText && !isPlaying && !isTtsLoading && aiMode === 'reading') {
      // Start playing if autoRead or continuous reading is enabled
      const timer = setTimeout(() => {
        playTts();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [pageNumber, isContinuousReading, autoRead, isDocumentLoaded, currentPageText, aiMode, isPlaying, isTtsLoading, playTts]);

  // Pre-extract text for the current page to speed up AI features
  useEffect(() => {
    let mounted = true;
    const extractText = async () => {
      if (!pdfDocRef.current || !pageNumber || !file) return;
      try {
        // Use a local reference to ensure we're working with the same instance throughout the async flow
        const currentPdf = pdfDocRef.current;
        if (!currentPdf) return;
        
        const page = await currentPdf.getPage(pageNumber);
        if (!mounted || currentPdf !== pdfDocRef.current) return;
        
        const textContent = await page.getTextContent();
        if (!mounted || currentPdf !== pdfDocRef.current) return;
        
        const text = textContent.items.map((item: any) => item.str).join(' ');
        if (mounted) setCurrentPageText(text);
      } catch (err: any) {
        // Ignore internal transport errors that occur during unmounting or document swapping
        if (err?.message?.includes('sendWithPromise') || err?.message?.includes('destroyed')) {
          return;
        }
        console.warn("Text extraction warning:", err);
      }
    };
    extractText();
    return () => { mounted = false; };
  }, [pageNumber, file, isDocumentLoaded]); 

  // AI Translation Logic
  const translatePage = useCallback(async () => {
    if (!file || isTranslating) return;
    
    // Check cache first
    const cacheKey = `trans_${user ? user.uid : 'guest'}_${persistenceKey}_${pageNumber}_${targetLang}_${translationStyle}`;
    
    // Check in-memory cache
    if (translationCache.current[cacheKey]) {
      setTranslatedText(translationCache.current[cacheKey]);
      setIsAiPanelOpen(true);
      setAiError(null);
      setAiSuggestion(null);
      setIsServedFromCache(true);
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
        setAiSuggestion(null);
        setIsServedFromCache(true);
        return;
      }

      if (user) {
        try {
          const cloudDoc = await getDoc(doc(db, 'users', user.uid, 'translations', cacheKey));
          if (cloudDoc.exists()) {
            const data = cloudDoc.data();
            if (data.text) {
               translationCache.current[cacheKey] = data.text;
               saveCache(cacheKey, data.text).catch(e => console.error("Cache sync error:", e));
               setTranslatedText(data.text);
               setIsAiPanelOpen(true);
               setAiError(null);
               setAiSuggestion(null);
               setIsServedFromCache(true);
               return;
            }
          }
        } catch (cloudErr) {
          handleFirestoreError(cloudErr, OperationType.GET, `users/${user.uid}/translations/${cacheKey}`);
        }
      }
    } catch (err) {
      console.error("Cache read error:", err);
    }

    setIsAiPanelOpen(true);
    setIsTranslating(true);
    setTranslatedText(null);
    setAiError(null);
    setAiSuggestion(null);
    setIsServedFromCache(false);
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
      let lastSaveTime = Date.now();
      for await (const chunk of response) {
        if (pageNumberRef.current !== pageNumber) {
          // User navigated to another page, break stream to stop processing
          break;
        }
        const chunkText = chunk.text || "";
        fullText += chunkText;
        setTranslatedText(fullText);
        
        // Caching as we go (incremental save) every 2 seconds
        if (Date.now() - lastSaveTime > 2000) {
          translationCache.current[cacheKey] = fullText;
          saveCache(cacheKey, fullText).catch(e => console.error("Incremental cache save error:", e));
          lastSaveTime = Date.now();
        }
      }

      const translated = fullText || "Không thể dịch nội dung.";
      
      // Save to cache
      if (translated !== "Không thể dịch nội dung." && translated !== "Đã xảy ra lỗi khi dịch.") {
        translationCache.current[cacheKey] = translated;
        await saveCache(cacheKey, translated);
        if (user) {
          setDoc(doc(db, 'users', user.uid, 'translations', cacheKey), {
            text: translated,
            timestamp: Date.now()
          }).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/translations/${cacheKey}`));
        }
      }
    } catch (error: any) {
      handleAiError(error, 'translation');
      setTranslatedText("Đã xảy ra lỗi khi dịch.");
    } finally {
      setIsTranslating(false);
    }
  }, [file, isTranslating, pageNumber, translationStyle, targetLang, stopTts, persistenceKey, autoRead, isAudioEnabled, playTts]);

  // Auto-translate/summarize on page change if panel is open
  useEffect(() => {
    if (isAiPanelOpen && !isTranslating && file) {
      if (aiMode === 'translation' && !translatedText) {
        translatePage();
      }
    }
  }, [pageNumber, translatedText, isTranslating, file, isAiPanelOpen, aiMode, translatePage]);

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

  return (
    <ErrorBoundary>
      <div className={cn("h-screen bg-paper flex flex-col overflow-hidden transition-colors duration-500", fontFamily, !isDarkMode && "light")}>
      {/* Header */}
      <header className="h-14 border-b border-ink/10 flex items-center justify-between px-4 z-50 bg-paper/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {file && (
            <>
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-1.5 hover:bg-ink/5 text-ink rounded-full transition-colors"
                title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <div className="h-4 w-[1px] bg-ink/10 mx-1" />
            </>
          )}
          <h1 className="font-display uppercase text-xl tracking-tight font-black text-accent">LIT.</h1>
          {isUploadingPdf && (
            <div className="flex items-center gap-1.5 ml-2 animate-pulse">
               <Loader2 size={12} className="text-accent animate-spin" />
               <span className="text-[8px] font-black uppercase tracking-tighter text-accent">SYNCING...</span>
            </div>
          )}
        </div>

        {/* Search Bar */}
        {file && (
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
                    className="p-1.5 hover:bg-ink/5 text-ink rounded-lg transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => navigateSearch('next')}
                    className="p-1.5 hover:bg-ink/5 text-ink rounded-lg transition-colors"
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
        )}

        <div className="flex items-center gap-2">
          {file && (
            <>
              <button 
                onClick={() => {
                  setAiMode('reading');
                  setIsAiPanelOpen(true);
                  setAiError(null);
                  setAiSuggestion(null);
                  playTts();
                }}
                className={cn(
                  "p-1.5 rounded-lg transition-all flex items-center gap-1.5 px-2.5 border shadow-sm",
                  isAiPanelOpen && aiMode === 'reading'
                    ? "text-paper bg-accent border-accent shadow-[0_0_15px_var(--color-accent-glow)]" 
                    : "bg-surface text-ink border-ink/10 hover:border-accent/50 hover:text-accent"
                )}
                title="Read original text"
              >
                <PlayCircle size={16} />
                <span className="text-[9px] uppercase font-black tracking-widest hidden sm:inline">ĐỌC</span>
              </button>

              <button 
                onClick={() => {
                  setAiError(null);
                  setAiSuggestion(null);
                  translatePage();
                }}
                className={cn(
                  "p-1.5 rounded-lg transition-all flex items-center gap-1.5 px-2.5 border shadow-sm group relative overflow-hidden",
                  isAiPanelOpen && aiMode === 'translation' 
                    ? "text-paper bg-accent border-accent shadow-[0_0_15px_var(--color-accent-glow)]" 
                    : "bg-surface text-ink border-ink/10 hover:border-accent/50 hover:text-accent"
                )}
                title="Translate to Vietnamese"
              >
                <Sparkles size={16} />
                <span className="text-[9px] uppercase font-black tracking-widest hidden sm:inline">DỊCH</span>
              </button>

              <div className="h-4 w-[1px] bg-ink/10 mx-1" />
            </>
          )}

          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1.5 hover:bg-ink/5 text-ink rounded-lg transition-colors"
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {file && (
            <button 
              onClick={toggleFullScreen}
              className="p-1.5 hover:bg-ink/5 text-ink rounded-lg transition-colors hidden sm:flex"
            >
              {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}

          <div className="h-4 w-[1px] bg-ink/10 mx-1" />

          {user ? (
            <div className="flex items-center gap-2">
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'User'}`} 
                alt="Profile" 
                className="w-6 h-6 rounded-lg border border-ink/10"
              />
              <button 
                onClick={logout}
                className="text-[9px] uppercase font-black tracking-widest text-ink/40 hover:text-accent transition-colors"
              >
                OUT
              </button>
            </div>
          ) : (
            <button 
              onClick={signInWithGoogle}
              disabled={isAuthLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-ink text-paper rounded-xl text-[9px] uppercase font-black tracking-widest hover:bg-accent transition-all shadow-sm"
            >
              {isAuthLoading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
              IN
            </button>
          )}
          
          {file && (
            <button 
              onClick={() => setFile(null)}
              className="flex items-center gap-1.5 px-2 py-1.5 bg-ink/5 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-[9px] uppercase font-black tracking-widest transition-all ml-1"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {!file ? (
          <div className={cn("flex-1 bg-paper flex flex-col items-center justify-start p-6 overflow-y-auto relative transition-colors duration-500", fontFamily, !isDarkMode && "light")}>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-3xl mx-auto flex flex-col items-center gap-10 mt-12"
            >
              {/* Drag & drop upload area */}
              <div className="w-full">
                <label 
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isUploadingPdf) return;
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      const fakeEvent = { target: { files: e.dataTransfer.files } } as any;
                      onFileChange(fakeEvent);
                    }
                  }}
                  className={cn(
                    "group relative cursor-pointer flex flex-col items-center justify-center w-full p-12 lg:p-16 border-2 border-dashed border-ink/20 rounded-[2rem] bg-ink/5 hover:bg-ink/10 hover:border-accent/40 transition-all text-center",
                    isUploadingPdf && "pointer-events-none opacity-60"
                  )}
                >
                  <input type="file" className="hidden" accept=".pdf" onChange={onFileChange} disabled={isUploadingPdf} />
                  {isUploadingPdf ? (
                    <div className="flex flex-col items-center">
                       <Loader2 size={32} className="text-accent animate-spin mb-4" />
                       <h3 className="text-xl font-bold text-ink mb-2 tracking-tight">Đang tải lên Cloud...</h3>
                       <p className="text-sm text-ink/60 font-medium">Vui lòng chờ trong giây lát</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-paper shadow hover:shadow-md flex items-center justify-center text-accent mb-4 group-hover:scale-110 transition-transform">
                        <UploadCloud size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-ink mb-2 tracking-tight">Kéo thả file PDF vào đây</h3>
                      <p className="text-sm text-ink/60 font-medium">hoặc click để chọn file từ máy tính</p>
                    </>
                  )}
                </label>
              </div>

              {/* Library & Reading History */}
              {(savedLibrary.length > 0 || readingHistory.length > 0) && (
                <div className="w-full flex-col gap-8 flex pb-12">
                  {readingHistory.length > 0 && (
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-ink/80 mb-4 flex items-center gap-2 uppercase tracking-wide">
                        <History size={16} /> Đọc gần đây
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {readingHistory.slice(0, 4).map(item => (
                          <button 
                            key={item.id} 
                            onClick={() => handleOpenFromHistory(item)}
                            className="flex items-center gap-4 p-4 bg-paper rounded-2xl border border-ink/10 hover:border-ink/20 hover:bg-ink/5 transition-all text-left w-full group shadow-sm shadow-ink/5"
                          >
                            <div className="w-12 h-12 rounded-xl bg-ink/5 flex items-center justify-center shrink-0 text-ink/50 group-hover:text-accent group-hover:bg-accent/10 transition-colors">
                              <FileText size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-base font-bold text-ink truncate font-sans">{item.name}</h4>
                              <span className="text-xs text-ink/60 mt-0.5 block">Đang đọc...</span>
                            </div>
                            <div className="shrink-0 pl-2">
                               <span className="text-xs font-bold text-ink/80 bg-ink/5 px-2.5 py-1.5 rounded-lg group-hover:bg-accent/10 group-hover:text-accent transition-colors">Pg {item.lastReadPage}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {savedLibrary.length > 0 && (
                    <div className="flex-1 mt-4">
                      <h3 className="text-sm font-bold text-ink/80 mb-4 flex items-center gap-2 uppercase tracking-wide">
                        <LibraryIcon size={16} /> Thư viện của tôi
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {savedLibrary.slice(0, 4).map(saved => (
                          <button 
                            key={saved.id} 
                            onClick={() => {
                              if (saved.data) {
                                loadFromLibrary(saved);
                              } else {
                                downloadFromCloud(saved);
                              }
                            }}
                            className="flex items-center gap-4 p-4 bg-paper rounded-2xl border border-ink/10 hover:border-ink/20 hover:bg-ink/5 transition-all text-left w-full group shadow-sm shadow-ink/5"
                          >
                            <div className="w-12 h-12 rounded-xl bg-ink/5 flex items-center justify-center shrink-0 text-ink/50 group-hover:text-accent group-hover:bg-accent/10 transition-colors">
                              <FileText size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-base font-bold text-ink truncate font-sans">{saved.name}</h4>
                              <span className="text-xs text-ink/60 mt-0.5 block">{(saved.size / 1024 / 1024).toFixed(1)} MB</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {isDownloading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-paper/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 size={32} className="animate-spin text-accent" />
                  <p className="font-mono text-xs uppercase tracking-widest font-bold text-accent">Downloading from Cloud...</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
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
                        <p className="text-sm font-serif italic text-ink/40">Chưa có dấu trang</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-ink/40">Dấu trang ({bookmarks.length})</h3>
                          <button 
                            onClick={translateAllBookmarks}
                            className="bg-accent/10 text-accent text-[9px] font-bold px-2 py-1 rounded hover:bg-accent/20 transition-all flex items-center gap-1"
                          >
                            <Sparkles size={10} />
                            Dịch tất cả
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {bookmarks.map((page) => (
                            <div key={`bookmark_container_${page}`} className="space-y-2">
                              <button
                                onClick={() => setPageNumber(page)}
                                className={cn(
                                  "group relative aspect-[3/4] bg-ink/5 rounded-sm overflow-hidden transition-all w-full",
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
                                    devicePixelRatio={1}
                                  />
                                </Document>
                              </button>
                              
                              <div className="bg-ink/5 rounded-lg p-2 min-h-[40px] relative group/trans">
                                {isTranslatingBookmarks[page] ? (
                                  <div className="flex items-center justify-center p-2">
                                    <Loader2 size={12} className="animate-spin text-accent" />
                                  </div>
                                ) : bookmarkTranslations[page] ? (
                                  <div className="text-[10px] text-ink/70 line-clamp-3 font-serif">
                                    {bookmarkTranslations[page]}
                                  </div>
                                ) : (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      translateBookmarkPage(page);
                                    }}
                                    className="w-full py-1 text-[8px] font-bold text-accent hover:underline uppercase tracking-wider"
                                  >
                                    Xem bản dịch
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
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
                        <p className="text-sm font-serif italic text-ink/40">Thư viện trống</p>
                      </div>
                    ) : (
                      savedLibrary.map((saved) => (
                        <div 
                          key={saved.id} 
                          className={cn(
                            "group p-3 bg-ink/5 rounded-xl border transition-all relative",
                            file?.name === saved.name ? "border-accent/40 bg-accent/5" : "border-ink/5 hover:border-accent/20"
                          )}
                        >
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
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className={cn(
                                "text-sm font-bold truncate transition-colors pr-1",
                                file?.name === saved.name ? "text-accent" : "group-hover:text-accent"
                              )}>
                                {saved.name}
                              </p>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(saved.id);
                                }}
                                className="p-1.5 text-ink/20 hover:text-destructive transition-all opacity-0 group-hover:opacity-100 shrink-0 bg-ink/5 rounded-lg hover:bg-destructive/10"
                                title="Xóa tài liệu"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
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
                  devicePixelRatio={renderQuality === 'high' ? Math.min(2, window.devicePixelRatio || 1) : 1}
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
                    devicePixelRatio={renderQuality === 'high' ? Math.min(2, window.devicePixelRatio || 1) : 1}
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
                
                <div className="p-3 sm:p-4 border-b border-glass-border flex items-center justify-between bg-glass shrink-0 pl-6 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-5 bg-accent rounded-full shadow-[0_0_10px_var(--color-accent-glow)]" />
                    <span className="text-[10px] sm:text-xs uppercase font-display font-bold text-ink tracking-widest">AI Panel</span>
                  </div>

                  {isAiPanelMinimized && (
                    <div className="flex flex-1 items-center justify-end pr-2 overflow-x-auto custom-scrollbar">
                      <div className="flex items-center gap-1 mx-2">
                        <button 
                          onClick={() => changePage(-1)}
                          disabled={pageNumber <= 1}
                          className="p-1.5 text-ink/40 hover:text-accent disabled:opacity-20 transition-colors shrink-0"
                          title="Trang trước"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <button 
                          onClick={() => seekTts(-15)}
                          disabled={!isPlaying}
                          className="p-1.5 text-ink/40 hover:text-accent disabled:opacity-20 transition-colors shrink-0"
                          title="Lùi 15s"
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button 
                          onClick={() => isPlaying ? pauseTts() : resumeTts()}
                          disabled={isTtsLoading}
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0",
                            isTtsLoading ? "bg-ink/5 cursor-wait" : (isPlaying ? "bg-accent text-paper" : "bg-ink/10 text-ink")
                          )}
                          title={isTtsLoading ? "Đang chuẩn bị audio..." : isPlaying ? "Tạm dừng" : "Phát"}
                        >
                          {isTtsLoading ? <Loader2 size={12} className="animate-spin text-accent" /> : isPlaying ? <Pause size={12} /> : <Play size={12} />}
                        </button>
                        <button 
                          onClick={() => seekTts(15)}
                          disabled={!isPlaying}
                          className="p-1.5 text-ink/40 hover:text-accent disabled:opacity-20 transition-colors shrink-0"
                          title="Tiến 15s"
                        >
                          <RotateCw size={14} />
                        </button>
                        <button 
                          onClick={() => changePage(1)}
                          disabled={pageNumber >= numPages}
                          className="p-1.5 text-ink/40 hover:text-accent disabled:opacity-20 transition-colors shrink-0"
                          title="Trang sau"
                        >
                          <ChevronRight size={14} />
                        </button>
                        <div className="w-[1px] h-4 bg-ink/10 mx-1 shrink-0" />
                        <button 
                          onClick={() => setIsContinuousReading(!isContinuousReading)}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors shrink-0",
                            isContinuousReading ? "text-accent bg-accent/10" : "text-ink/40 hover:text-ink/60"
                          )}
                          title="Đọc liên tục"
                        >
                          <PlayCircle size={14} />
                        </button>
                        <button
                          onClick={handleDownloadAudio}
                          disabled={(!currentTtsCacheKey || !ttsCache.current[currentTtsCacheKey]) || isAudioDownloading || isTtsLoading}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors shrink-0 mx-1",
                            (isTtsLoading || isAudioDownloading) ? "text-accent bg-accent/10" :
                            (!currentTtsCacheKey || !ttsCache.current[currentTtsCacheKey]) ? "opacity-40 text-ink/20" : 
                            "text-ink/40 hover:text-accent"
                          )}
                          title="Tải Audio"
                        >
                          {isTtsLoading || isAudioDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        </button>
                        <div className="w-[1px] h-4 bg-ink/10 mx-1 shrink-0" />
                        <button 
                          onClick={() => setAiFontSize(prev => Math.max(12, prev - 2))}
                          className="p-1.5 text-ink/40 hover:text-accent transition-colors font-mono shrink-0"
                          title="Giảm cỡ chữ"
                        >
                          <span className="text-[10px] font-bold">A-</span>
                        </button>
                        <button 
                          onClick={() => setAiFontSize(prev => Math.min(24, prev + 2))}
                          className="p-1.5 text-ink/40 hover:text-accent transition-colors font-mono shrink-0"
                          title="Tăng cỡ chữ"
                        >
                          <span className="text-[12px] font-bold">A+</span>
                        </button>
                        {aiMode === 'translation' && (
                          <>
                            <div className="w-[1px] h-4 bg-ink/10 mx-1 shrink-0" />
                            <select
                              value={translationStyle}
                              onChange={(e) => {
                                setTranslationStyle(e.target.value as any);
                                setTimeout(() => translatePage(), 100);
                              }}
                              className="text-[9px] bg-transparent border-none text-ink/60 font-bold focus:ring-0 cursor-pointer outline-none shrink-0"
                              title="Phong cách dịch"
                            >
                              <option value="magazine">Tạp chí</option>
                              <option value="normal">Chuẩn</option>
                              <option value="casual">GenZ</option>
                            </select>
                          </>
                        )}
                      </div>
                    </div>
                  )}

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
                  {isTranslating ? (
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
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex p-1 bg-glass rounded-xl border border-glass-border">
                        <button 
                          onClick={() => {
                            setAiMode('translation');
                            setAiError(null);
                            setAiSuggestion(null);
                            setIsServedFromCache(false);
                          }}
                          className={cn(
                            "flex-1 py-2 text-[9px] uppercase font-bold tracking-widest rounded-lg transition-all duration-300",
                            aiMode === 'translation' ? "bg-accent text-paper shadow-md" : "text-ink/40 hover:text-ink/70"
                          )}
                        >
                          Dịch
                        </button>
                        <button 
                          onClick={() => {
                            setAiMode('advanced');
                            setAiError(null);
                            setAiSuggestion(null);
                            setIsServedFromCache(false);
                          }}
                          className={cn(
                            "flex-1 py-2 text-[9px] uppercase font-bold tracking-widest rounded-lg transition-all duration-300",
                            aiMode === 'advanced' ? "bg-accent text-paper shadow-md" : "text-ink/40 hover:text-ink/70"
                          )}
                        >
                          Dịch nâng cao
                        </button>
                        <button 
                          onClick={() => {
                            setAiMode('reading');
                            setIsServedFromCache(false);
                          }}
                          className={cn(
                            "flex-1 py-2 text-[9px] uppercase font-bold tracking-widest rounded-lg transition-all duration-300",
                            aiMode === 'reading' ? "bg-accent text-paper shadow-md" : "text-ink/40 hover:text-ink/70"
                          )}
                        >
                          Đọc gốc
                        </button>
                      </div>

                      <div className="space-y-2">
                        {aiMode === 'reading' && (
                          <div className="space-y-2">
                            <div className="p-3 bg-accent/5 border border-accent/10 rounded-xl flex items-center gap-3">
                              <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent shrink-0">
                                <Volume2 size={16} />
                              </div>
                              <div className="text-left flex-1">
                                <h3 className="text-[10px] font-black text-ink uppercase tracking-wider">Đọc gốc</h3>
                                <p className="text-[9px] text-ink/50 italic font-medium">Nghe nội dung trực tiếp</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => changePage(-1)}
                                disabled={pageNumber <= 1}
                                className="p-2 bg-ink/5 rounded-lg hover:bg-ink/10 disabled:opacity-30 transition-all border border-transparent hover:border-ink/10"
                              >
                                <ChevronLeft size={14} />
                              </button>
                              <div className="flex-1 bg-surface border border-glass-border rounded-lg py-1.5 text-center font-mono text-[10px] font-black text-accent">
                                TRANG {pageNumber} / {numPages}
                              </div>
                              <button 
                                onClick={() => {
                                  setAiError(null);
                                  setAiSuggestion(null);
                                  changePage(1);
                                }}
                                disabled={pageNumber >= numPages}
                                className="p-2 bg-ink/5 rounded-lg hover:bg-ink/10 disabled:opacity-30 transition-all border border-transparent hover:border-ink/10"
                              >
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {aiMode === 'translation' && (
                          <div className="flex bg-ink/5 p-1 rounded-xl border border-ink/5 gap-0.5">
                            <div className="flex-1 space-y-1 p-1">
                              <label className="text-[8px] uppercase font-bold text-ink/30 tracking-widest pl-1 hidden sm:block">Ngôn ngữ</label>
                              <CustomSelect
                                value={targetLang}
                                onChange={setTargetLang}
                                options={[
                                  { value: 'Vietnamese', label: 'T.Việt' },
                                  { value: 'English', label: 'T.Anh' },
                                  { value: 'French', label: 'T.Pháp' },
                                  { value: 'Japanese', label: 'T.Nhật' },
                                  { value: 'Korean', label: 'T.Hàn' },
                                ]}
                              />
                            </div>
                            <div className="w-[1px] bg-ink/10 my-2" />
                            <div className="flex-1 space-y-1 p-1">
                              <label className="text-[8px] uppercase font-bold text-ink/30 tracking-widest pl-1 hidden sm:block">Phong cách</label>
                              <CustomSelect
                                value={translationStyle}
                                onChange={(val) => setTranslationStyle(val as any)}
                                options={[
                                  { value: 'magazine', label: 'Tạp chí' },
                                  { value: 'normal', label: 'Chuẩn' },
                                  { value: 'casual', label: 'GenZ' },
                                ]}
                              />
                            </div>
                            <div className="w-[1px] bg-ink/10 my-2" />
                            <div className="flex-1 space-y-1 p-1">
                              <label className="text-[8px] uppercase font-bold text-ink/30 tracking-widest pl-1 hidden sm:block">Giọng đọc</label>
                              <CustomSelect
                                value={voiceId}
                                onChange={(val) => setVoiceId(val)}
                                options={VOICE_OPTIONS.map(v => ({ value: v.id, label: v.label }))}
                              />
                            </div>
                          </div>
                        )}

                        {aiMode !== 'translation' && aiMode !== 'advanced' && (
                          <div className="flex bg-ink/5 p-1 rounded-xl border border-ink/5 gap-0.5">
                            <div className="flex-1 space-y-1 p-1">
                              <label className="text-[8px] uppercase font-bold text-ink/30 tracking-widest pl-1 hidden sm:block">Giọng đọc</label>
                              <CustomSelect
                                value={voiceId}
                                onChange={(val) => setVoiceId(val)}
                                options={VOICE_OPTIONS.map(v => ({ value: v.id, label: v.label }))}
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 bg-ink/5 p-1.5 rounded-xl border border-ink/5">
                          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                            {/* PDF Quality */}
                            <div className="flex bg-paper rounded-lg p-0.5 border border-ink/5 shadow-sm">
                              <button 
                                onClick={() => {
                                  setRenderQuality('fast');
                                  localStorage.setItem('litreader_render_quality', 'fast');
                                }}
                                className={cn(
                                  "px-2 py-1 text-[9px] font-black uppercase tracking-tighter rounded-md transition-all",
                                  renderQuality === 'fast' ? "bg-accent text-paper shadow-sm" : "text-ink/30 hover:text-ink/60"
                                )}
                                title="Chất lượng thấp (Tải nhanh)"
                              >
                                Fast
                              </button>
                              <div className="w-[1px] bg-ink/5 mx-0.5" />
                              <button 
                                onClick={() => {
                                  setRenderQuality('high');
                                  localStorage.setItem('litreader_render_quality', 'high');
                                }}
                                className={cn(
                                  "px-2 py-1 text-[9px] font-black uppercase tracking-tighter rounded-md transition-all",
                                  renderQuality === 'high' ? "bg-accent text-paper shadow-sm" : "text-ink/30 hover:text-ink/60"
                                )}
                                title="Chất lượng cao"
                              >
                                High
                              </button>
                            </div>

                            {/* Font Size */}
                            <div className="flex bg-paper rounded-lg p-0.5 border border-ink/5 shadow-sm">
                              <button 
                                onClick={() => setAiFontSize(prev => Math.max(12, prev - 2))}
                                className="p-1 px-[6px] text-ink/40 hover:text-ink hover:bg-ink/5 rounded-md transition-all font-mono"
                                title="Giảm cỡ chữ"
                              >
                                <span className="text-[9px] font-bold">A-</span>
                              </button>
                              <div className="w-[1px] bg-ink/5 mx-0.5" />
                              <button 
                                onClick={() => setAiFontSize(prev => Math.min(24, prev + 2))}
                                className="p-1 px-[6px] text-ink/40 hover:text-ink hover:bg-ink/5 rounded-md transition-all font-mono"
                                title="Tăng cỡ chữ"
                              >
                                <span className="text-[11px] font-bold">A+</span>
                              </button>
                            </div>

                            {/* Speed */}
                            <div className="flex items-center gap-0.5 bg-paper rounded-lg p-0.5 border border-ink/5 shadow-sm flex-1 sm:flex-none">
                              <Gauge size={12} className="text-ink/30 ml-1.5 mr-0.5 hidden sm:block shrink-0" />
                              {[1.1, 1.2, 1.25, 1.3, 1.35].map((rate) => (
                                <button
                                  key={rate}
                                  onClick={() => setPlaybackRate(rate)}
                                  className={cn(
                                    "flex-1 sm:flex-none px-1.5 py-1 rounded-md text-[9px] font-bold transition-all flex items-center justify-center min-w-[24px]",
                                    playbackRate === rate 
                                      ? "bg-accent text-paper shadow-sm" 
                                      : "text-ink/50 hover:bg-ink/5 text-ink/70"
                                  )}
                                >
                                  {rate}x
                                </button>
                              ))}
                            </div>

                            {/* Auto Read */}
                            <button
                              onClick={() => setAutoRead(!autoRead)}
                              title="Tự động đọc khi mở trang AI"
                              className={cn(
                                "flex items-center justify-center p-[6px] rounded-lg transition-all border shadow-sm shrink-0",
                                autoRead ? "bg-accent/10 border-accent/20 text-accent" : "bg-paper border-ink/5 text-ink/40 hover:bg-ink/5"
                              )}
                            >
                              <PlaySquare size={14} />
                            </button>

                            {/* Continuous Reading */}
                            <button
                              onClick={() => setIsContinuousReading(!isContinuousReading)}
                              title="Đọc liên tục (tự chuyển trang)"
                              className={cn(
                                "flex items-center justify-center p-[6px] rounded-lg transition-all border shadow-sm shrink-0",
                                isContinuousReading ? "bg-accent/10 border-accent/20 text-accent" : "bg-paper border-ink/5 text-ink/40 hover:bg-ink/5"
                              )}
                            >
                              <Repeat size={14} className={cn(isContinuousReading && "animate-[spin_4s_linear_infinite_reverse]")} />
                            </button>
                            
                            {/* Download Audio */}
                            <button
                              onClick={handleDownloadAudio}
                              title="Tải Audio"
                              disabled={(!currentTtsCacheKey || !ttsCache.current[currentTtsCacheKey]) || isAudioDownloading || isTtsLoading}
                              className={cn(
                                "flex items-center justify-center p-[6px] rounded-lg transition-all border shadow-sm shrink-0",
                                isTtsLoading || isAudioDownloading ? "bg-accent/10 border-accent/20 text-accent" :
                                (!currentTtsCacheKey || !ttsCache.current[currentTtsCacheKey]) ? "opacity-40 bg-paper border-ink/5 text-ink/20" : 
                                "bg-paper border-ink/5 text-ink/60 hover:text-accent hover:border-accent/30 hover:bg-accent/5"
                              )}
                            >
                              {isTtsLoading || isAudioDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            </button>
                          </div>

                          {/* Playback Controls */}
                          <div className="flex items-center gap-1.5 justify-end">
                            {isServedFromCache && (
                              <span className="text-[8px] uppercase font-bold bg-accent/10 text-accent px-1.5 py-1 rounded-md tracking-wider">
                                Cached
                              </span>
                            )}
                            
                            <div className="flex items-center gap-0.5 bg-paper border border-ink/10 rounded-full p-0.5 shadow-sm shrink-0">
                              <button 
                                onClick={() => seekTts(-15)}
                                disabled={!isPlaying}
                                className="p-1.5 text-ink/30 hover:text-accent disabled:opacity-10 transition-colors rounded-full hover:bg-ink/5"
                                title="Lùi 15s"
                              >
                                <RotateCcw size={12} />
                              </button>
                              
                              <button 
                                onClick={() => {
                                  if (isPlaying) {
                                    pauseTts();
                                  } else {
                                    setAiError(null);
                                    setAiSuggestion(null);
                                    resumeTts();
                                  }
                                }}
                                disabled={isTtsLoading || (aiMode === 'translation' ? !translatedText : !currentPageText)}
                                className={cn(
                                  "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-sm",
                                  isTtsLoading ? "bg-ink/5 cursor-wait" : (isPlaying 
                                    ? "bg-accent text-paper shadow-accent/20" 
                                    : "bg-ink/90 text-paper hover:bg-accent hover:text-paper")
                                )}
                                title={isTtsLoading ? "Đang chuẩn bị audio..." : isPlaying ? "Tạm dừng" : "Nghe nội dung"}
                              >
                                {isTtsLoading ? <Loader2 size={14} className="animate-spin text-accent" /> : isPlaying ? <Pause size={14} /> : <Play size={14} />}
                              </button>

                              <button 
                                onClick={() => seekTts(15)}
                                disabled={!isPlaying}
                                className="p-1.5 text-ink/30 hover:text-accent disabled:opacity-10 transition-colors rounded-full hover:bg-ink/5"
                                title="Tiến 15s"
                              >
                                <RotateCw size={12} />
                              </button>
                              
                              {aiMode !== 'reading' && aiMode !== 'advanced' && (
                                <button 
                                  onClick={translatePage}
                                  className="p-[5px] text-ink/30 hover:text-accent transition-colors rounded-full hover:bg-ink/5 ml-0.5 border-l border-ink/5"
                                  title="Tạo lại"
                                >
                                  <RefreshCw size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {aiError && (
                          <div className="p-5 bg-red-500/5 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 text-xs font-medium flex flex-col gap-4 shadow-sm">
                            <div className="flex items-start gap-3">
                              <div className="p-1.5 bg-red-500/10 rounded-lg shrink-0">
                                <AlertCircle size={14} className="text-red-500" />
                              </div>
                              <div className="space-y-2">
                                <p className="font-bold uppercase tracking-wider text-[10px] text-red-500/70">Thông báo lỗi</p>
                                <div className="markdown-body whitespace-pre-wrap leading-relaxed font-bold text-sm text-red-600 dark:text-red-400">
                                  <Markdown>{aiError}</Markdown>
                                </div>
                                {aiSuggestion && (
                                  <div className="text-ink/60 dark:text-ink/40 font-normal leading-relaxed border-l-2 border-red-500/20 pl-3 py-1">
                                    <span className="font-bold text-[10px] uppercase tracking-tight block mb-1 opacity-50">Gợi ý khắc phục:</span>
                                    <div className="markdown-body"><Markdown>{aiSuggestion}</Markdown></div>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  setAiError(null);
                                  setAiSuggestion(null);
                                  if (aiMode === 'translation') translatePage();
                                  else playTts();
                                }}
                                className="bg-red-500 text-white hover:bg-red-600 px-6 py-2.5 rounded-xl transition-all duration-300 font-bold shadow-lg shadow-red-500/20 active:scale-95 flex-1 sm:flex-none"
                              >
                                Thử lại ngay
                              </button>
                              <button 
                                onClick={() => {
                                  setAiError(null);
                                  setAiSuggestion(null);
                                }}
                                className="bg-ink/5 hover:bg-ink/10 text-ink/60 px-6 py-2.5 rounded-xl transition-all duration-300 font-bold flex-1 sm:flex-none"
                              >
                                Bỏ qua
                              </button>
                            </div>
                          </div>
                        )}

                        <div 
                          className={cn(
                            "bg-surface border border-glass-border rounded-2xl p-4 sm:p-5 font-serif leading-relaxed text-ink/90 shadow-inner",
                            aiMode === 'advanced' && "hidden"
                          )}
                        >
                          <motion.div 
                            key={aiMode + (aiMode === 'translation' ? translatedText : currentPageText)}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="transition-all duration-300 ease-in-out markdown-wrapper"
                            style={{ fontSize: `${aiFontSize}px` }}
                          >
                            {aiMode === 'translation' 
                              ? (translatedText ? <div className="markdown-body"><Markdown>{translatedText}</Markdown></div> : <span className="italic text-ink/30 font-serif">Nhấn dịch để bắt đầu...</span>) 
                              : (currentPageText ? <div className="markdown-body"><Markdown>{currentPageText}</Markdown></div> : <span className="italic text-ink/30 font-serif">Đang trích xuất văn bản...</span>)}
                          </motion.div>
                        </div>

                        {/* Batch Translation UI - Only visible in Advanced mode */}
                        {aiMode === 'advanced' && (
                        <div className="mt-2 space-y-4">
                          <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-glass-border shadow-sm relative overflow-hidden group/batch">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover/batch:opacity-10 transition-opacity pointer-events-none">
                              <Sparkles size={120} />
                            </div>
                            
                            <div className="relative space-y-5">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="bg-accent/10 px-2 py-0.5 rounded flex items-center justify-center">
                                    <span className="text-[9px] font-black text-accent uppercase tracking-widest">Premium</span>
                                  </div>
                                  <h4 className="text-sm font-bold text-ink">Công cụ Xuất bản</h4>
                                </div>
                                <p className="text-[11px] text-ink/60 leading-relaxed font-medium">Dịch nhiều trang sách liên tiếp, đọc văn bản thành sách nói, và tải về các tập tin PDF, MP3, TXT một cách liền mạch.</p>
                              </div>
                              
                              <div className="space-y-4 pt-4 border-t border-ink/5">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] uppercase font-black text-ink/40 tracking-wider">Phạm vi trang ({batchRange.start} - {batchRange.end})</label>
                                    <div className="flex gap-1.5">
                                      <button 
                                        onClick={() => setBatchRange({ start: pageNumber, end: pageNumber })}
                                        className="text-[9px] font-bold text-ink/60 hover:text-accent hover:bg-accent/10 bg-ink/5 px-2 py-1 rounded transition-colors"
                                      >
                                        Trang này
                                      </button>
                                      <button 
                                        onClick={() => setBatchRange({ start: pageNumber, end: numPages })}
                                        className="text-[9px] font-bold text-ink/60 hover:text-accent hover:bg-accent/10 bg-ink/5 px-2 py-1 rounded transition-colors"
                                      >
                                        Từ trang này
                                      </button>
                                      <button 
                                        onClick={() => setBatchRange({ start: 1, end: numPages })}
                                        className="text-[9px] font-bold text-ink/60 hover:text-accent hover:bg-accent/10 bg-ink/5 px-2 py-1 rounded transition-colors"
                                      >
                                        Toàn bộ
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <button 
                                          onClick={() => setBatchRange(prev => ({ ...prev, start: Math.max(1, prev.start - 1) }))}
                                          className="w-8 h-8 flex items-center justify-center bg-ink/5 rounded-lg hover:bg-ink/10 text-ink/60 transition-colors focus:ring-2 focus:ring-accent/50 outline-none"
                                        >
                                          -
                                        </button>
                                        <div className="relative flex-1">
                                          <input 
                                            type="number" 
                                            value={batchRange.start}
                                            onChange={(e) => setBatchRange(prev => ({ ...prev, start: Math.max(1, parseInt(e.target.value) || 1) }))}
                                            className="w-full bg-paper border border-ink/10 rounded-lg px-2 py-1.5 text-sm font-bold focus:ring-2 focus:ring-accent/50 outline-none text-ink text-center shadow-inner"
                                          />
                                        </div>
                                        <button 
                                          onClick={() => setBatchRange(prev => ({ ...prev, start: Math.min(batchRange.end, prev.start + 1) }))}
                                          className="w-8 h-8 flex items-center justify-center bg-ink/5 rounded-lg hover:bg-ink/10 text-ink/60 transition-colors focus:ring-2 focus:ring-accent/50 outline-none"
                                        >
                                          +
                                        </button>
                                      </div>
                                      <span className="text-[9px] font-bold text-ink/30 uppercase tracking-widest block text-center">Bắt đầu</span>
                                    </div>

                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <button 
                                          onClick={() => setBatchRange(prev => ({ ...prev, end: Math.max(batchRange.start, prev.end - 1) }))}
                                          className="w-8 h-8 flex items-center justify-center bg-ink/5 rounded-lg hover:bg-ink/10 text-ink/60 transition-colors focus:ring-2 focus:ring-accent/50 outline-none"
                                        >
                                          -
                                        </button>
                                        <div className="relative flex-1">
                                          <input 
                                            type="number"
                                            value={batchRange.end}
                                            onChange={(e) => setBatchRange(prev => ({ ...prev, end: Math.min(numPages, Math.max(batchRange.start, parseInt(e.target.value) || batchRange.start)) }))}
                                            className="w-full bg-paper border border-ink/10 rounded-lg px-2 py-1.5 text-sm font-bold focus:ring-2 focus:ring-accent/50 outline-none text-ink text-center shadow-inner"
                                          />
                                        </div>
                                        <button 
                                          onClick={() => setBatchRange(prev => ({ ...prev, end: Math.min(numPages, prev.end + 1) }))}
                                          className="w-8 h-8 flex items-center justify-center bg-ink/5 rounded-lg hover:bg-ink/10 text-ink/60 transition-colors focus:ring-2 focus:ring-accent/50 outline-none"
                                        >
                                          +
                                        </button>
                                      </div>
                                      <span className="text-[9px] font-bold text-ink/30 uppercase tracking-widest block text-center">Kết thúc</span>
                                    </div>
                                  </div>

                                  <div className="pt-2">
                                    <input 
                                      type="range"
                                      min={1}
                                      max={numPages}
                                      value={batchRange.end}
                                      onChange={(e) => setBatchRange(prev => ({ ...prev, end: Math.max(prev.start, parseInt(e.target.value)) }))}
                                      className="w-full accent-accent h-1.5 bg-ink/10 rounded-lg appearance-none cursor-pointer"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1.5 pt-2">
                                  <label className="text-[10px] uppercase font-black text-ink/40 tracking-wider block">Phong cách dịch</label>
                                  <div className="flex bg-ink/5 rounded-xl p-1 gap-1">
                                    {(['normal', 'casual', 'magazine'] as const).map((style) => (
                                      <button
                                        key={style}
                                        onClick={() => setTranslationStyle(style)}
                                        className={cn(
                                          "flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                                          translationStyle === style ? "bg-paper text-accent shadow-sm" : "text-ink/40 hover:bg-ink/10"
                                        )}
                                      >
                                        {style === 'normal' ? 'Chuẩn' : style === 'casual' ? 'Trẻ trung' : 'Tạp chí'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-1.5 pt-2">
                                  <label className="text-[10px] uppercase font-black text-ink/40 tracking-wider block">Giọng đọc (Sách nói)</label>
                                  <CustomSelect
                                    value={voiceId}
                                    onChange={(val) => setVoiceId(val)}
                                    options={VOICE_OPTIONS.map(v => ({ value: v.id, label: v.label }))}
                                  />
                                </div>
                                <div className="space-y-1.5 pt-2">
                                  <label className="text-[10px] uppercase font-black text-ink/40 tracking-wider block">Tốc độ ({playbackRate}x)</label>
                                  <input 
                                    type="range"
                                    min={0.5} max={2.0} step={0.1}
                                    value={playbackRate}
                                    onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                                    className="w-full accent-accent h-1.5 bg-ink/10 rounded-lg appearance-none cursor-pointer"
                                  />
                                </div>
                              </div>

                              <div className="space-y-4 pt-4 border-t border-ink/5">
                                {isBatchTranslating ? (
                                  <div className="space-y-2 bg-accent/5 p-3 rounded-xl border border-accent/10">
                                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-accent">
                                      <span className="flex items-center gap-2">
                                        <Loader2 size={12} className="animate-spin" />
                                        Đang dịch: {batchProgress.current}/{batchProgress.total} trang
                                      </span>
                                      <button 
                                        onClick={() => batchAbortRef.current?.abort()}
                                        className="text-red-500 hover:text-red-600 transition-colors px-2 py-0.5 bg-red-500/10 rounded"
                                      >
                                        Dừng
                                      </button>
                                    </div>
                                    <div className="w-full h-1.5 bg-accent/20 rounded-full overflow-hidden">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                                        className="h-full bg-accent"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <button 
                                      onClick={startBatchTranslation}
                                      className="flex-1 py-3 bg-accent text-paper rounded-xl text-xs font-black uppercase tracking-widest hover:bg-accent/90 focus:ring-4 focus:ring-accent/20 transition-all shadow-md flex items-center justify-center gap-2"
                                    >
                                      <Languages size={14} />
                                      Dịch hàng loạt ({batchRange.start}-{batchRange.end})
                                    </button>
                                    <button 
                                      onClick={openSeamlessTextForRange}
                                      className="flex-1 py-3 bg-paper text-accent border border-accent/20 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-accent/5 focus:ring-4 focus:ring-accent/10 transition-all flex items-center justify-center gap-2 shadow-sm"
                                    >
                                      <FileText size={14} />
                                      Xem liền mạch
                                    </button>
                                  </div>
                                )}

                                {isBatchTtsing ? (
                                  <div className="space-y-2 bg-ink/5 p-3 rounded-xl border border-ink/10">
                                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[#FF4D4D]">
                                      <span className="flex items-center gap-2">
                                        <Loader2 size={12} className="animate-spin" />
                                        Đang tạo Audio: {batchTtsProgress.current}/{batchTtsProgress.total} trang
                                      </span>
                                      <button 
                                        onClick={() => batchAbortRef.current?.abort()}
                                        className="text-red-500 hover:text-red-600 transition-colors px-2 py-0.5 bg-red-500/10 rounded"
                                      >
                                        Hủy
                                      </button>
                                    </div>
                                    <div className="w-full h-1.5 bg-ink/10 rounded-full overflow-hidden">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(batchTtsProgress.current / batchTtsProgress.total) * 100}%` }}
                                        className="h-full bg-[#FF4D4D]"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <button 
                                      onClick={startBatchTts}
                                      className="flex-1 py-3 bg-ink text-paper rounded-xl text-xs font-black uppercase tracking-widest hover:bg-ink/90 focus:ring-4 focus:ring-ink/20 transition-all shadow-md flex items-center justify-center gap-2"
                                    >
                                      <Volume2 size={14} />
                                      Tải xuống {batchRange.end - batchRange.start > 0 ? 'Audiobook (MP3)' : 'Audio (MP3)'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </main>

        {/* Floating Context Menu for Select-to-Translate */}
        <AnimatePresence>
          {selectedText && selectionPosition && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 5 }}
              style={{ 
                left: selectionPosition.x, 
                top: selectionPosition.y,
                transform: 'translateX(-50%) translateY(-100%)'
              }}
              className="fixed z-[100] bg-ink text-paper px-4 py-2.5 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.4)] flex items-center gap-3 backdrop-blur-md border border-paper/10"
            >
              <button
                onClick={() => translatePartial(selectedText)}
                className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:text-accent transition-colors whitespace-nowrap"
              >
                <Sparkles size={14} className="text-accent" />
                Dịch đoạn này
              </button>
              <div className="w-[1px] h-4 bg-paper/20" />
              <button
                onClick={() => {
                  setSelectedText(null);
                  setSelectionPosition(null);
                  window.getSelection()?.removeAllRanges();
                }}
                className="hover:text-accent transition-colors p-0.5"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page Controls Overlay */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none z-50">
          <button 
            onClick={() => goToPage(1)}
            disabled={pageNumber <= 1}
            className="p-2 bg-ink/80 text-paper rounded-full shadow-lg pointer-events-auto disabled:opacity-50 hover:bg-accent transition-colors"
            title="Về trang đầu"
          >
            <ChevronsLeft size={18} />
          </button>
          <button 
            onClick={() => changePage(-1)}
            disabled={pageNumber <= 1}
            className="p-2.5 bg-ink text-paper rounded-full shadow-lg pointer-events-auto disabled:opacity-50 hover:bg-accent transition-colors"
            title="Trang trước"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="px-3 py-2 bg-paper/90 backdrop-blur-md rounded-full shadow-lg border border-ink/5 pointer-events-auto flex items-center gap-2">
            <div className="flex items-center bg-ink/5 rounded-full px-3 py-1">
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
                title="Nhập số trang"
                className="w-8 bg-transparent font-mono text-sm font-bold text-center text-ink focus:outline-none focus:text-accent rounded"
              />
              <span className="font-mono text-sm font-bold text-ink/30 px-1">/</span>
              <span className="font-mono text-sm font-bold text-ink/50">{numPages}</span>
            </div>
            <div className="h-4 w-[1px] bg-ink/10" />
            <button
               onClick={toggleBookmark}
               className={cn("p-1.5 rounded-full transition-colors mr-1", bookmarks.includes(pageNumber) ? "text-accent bg-accent/10" : "text-ink/40 hover:text-ink hover:bg-ink/5")}
               title={bookmarks.includes(pageNumber) ? "Bỏ đánh dấu" : "Đánh dấu trang"}
            >
               <Bookmark size={16} fill={bookmarks.includes(pageNumber) ? "currentColor" : "none"} />
            </button>
          </div>
          <button 
            onClick={() => changePage(1)}
            disabled={pageNumber >= numPages || (isSpreadView && pageNumber + 1 >= numPages)}
            className="p-2.5 bg-ink text-paper rounded-full shadow-lg pointer-events-auto disabled:opacity-50 hover:bg-accent transition-colors"
            title="Trang sau"
          >
            <ChevronRight size={20} />
          </button>
          <button 
            onClick={() => goToPage(numPages)}
            disabled={pageNumber >= numPages || (isSpreadView && pageNumber + 1 >= numPages)}
            className="p-2 bg-ink/80 text-paper rounded-full shadow-lg pointer-events-auto disabled:opacity-50 hover:bg-accent transition-colors"
            title="Đến trang cuối"
          >
            <ChevronsRight size={18} />
          </button>
        </div>
      
      {isDownloading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-paper/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={32} className="animate-spin text-accent" />
            <p className="font-mono text-xs uppercase tracking-widest font-bold text-accent">Downloading from Cloud...</p>
          </div>
        </div>
      )}
          </>
        )}
      </div>

        {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirmId(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-panel border border-glass-border rounded-3xl p-8 max-w-sm w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center text-destructive">
                  <Trash2 size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-display font-bold text-ink">Xóa tài liệu?</h3>
                  <p className="text-sm text-ink/60 font-serif leading-relaxed">
                    Hành động này sẽ xóa vĩnh viễn tài liệu khỏi thư viện của bạn. Bạn có chắc chắn muốn tiếp tục?
                  </p>
                </div>
                <div className="flex gap-3 w-full">
                  <button 
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 py-3 px-4 bg-ink/5 text-ink/60 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-ink/10 transition-all"
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={() => handleDeleteFromLibrary(deleteConfirmId)}
                    disabled={isDeleting}
                    className="flex-1 py-3 px-4 bg-destructive text-paper rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-destructive/90 transition-all shadow-lg shadow-destructive/20 flex items-center justify-center gap-2"
                  >
                    {isDeleting ? <Loader2 size={14} className="animate-spin" /> : "Xóa ngay"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {batchTranslatedResult && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-paper/90 backdrop-blur p-4 sm:p-8"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-paper border border-ink/10 shadow-2xl rounded-2xl w-full max-w-4xl h-full max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-ink/10 bg-ink/5">
                <h2 className="font-bold font-serif text-lg text-ink">{batchTranslatedResult.title}</h2>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      const element = document.createElement("a");
                      const file = new Blob([batchTranslatedResult.text], {type: 'text/plain'});
                      element.href = URL.createObjectURL(file);
                      element.download = `${batchTranslatedResult.title}.txt`;
                      document.body.appendChild(element); // Required for this to work in FireFox
                      element.click();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-ink/10 hover:bg-ink/20 text-ink text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
                  >
                    <Download size={14} /> Tải TXT
                  </button>
                  <button 
                    onClick={() => {
                      setBatchRange(batchTranslatedResult.range);
                      setIsSidebarOpen(true);
                      setBatchTranslatedResult(null);
                      startBatchTts();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent/90 text-paper text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
                  >
                    <Volume2 size={14} /> Tạo Audiobook
                  </button>
                  <button 
                    onClick={() => setBatchTranslatedResult(null)}
                    className="p-1.5 bg-ink/10 hover:bg-ink/20 text-ink rounded-full transition-colors ml-2"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6 sm:p-10 bg-paper">
                <div 
                  className={cn("max-w-3xl mx-auto prose prose-sm sm:prose-base", fontFamily === 'font-serif' ? 'prose-headings:font-serif prose-p:font-serif' : 'prose-headings:font-sans prose-p:font-sans')}
                  style={{ fontSize: `${aiFontSize + 2}px`, lineHeight: '1.8' }}
                >
                  {batchTranslatedResult.text.split('\n\n').map((paragraph, idx) => (
                    <p key={idx} className="mb-4 text-ink/90 whitespace-pre-wrap">{paragraph}</p>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
    </ErrorBoundary>
  );
}
