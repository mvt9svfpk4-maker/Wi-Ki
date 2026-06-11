import React, { useState, useEffect, useRef } from 'react';
import { 
  Bluetooth, 
  BluetoothConnected, 
  Volume2, 
  VolumeX, 
  Star, 
  RotateCcw, 
  Plus, 
  Minus, 
  Trash2, 
  HelpCircle, 
  Activity, 
  Check, 
  MapPin, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  Store,
  ChevronRight,
  ShoppingBag,
  BellRing,
  Info,
  Fingerprint
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Kiosk, MenuItem, CartItem, FavoriteStore } from './types';
import { PRESET_KIOSKS } from './data';
import { playSound, triggerVibration, speakText, cancelSpeech } from './audioHelper';

export default function App() {
  // --- App State ---
  const [appInitialized, setAppInitialized] = useState<boolean>(false);
  
  // Bluetooth Kiosk states
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedKiosks, setScannedKiosks] = useState<Kiosk[]>(PRESET_KIOSKS);
  const [connectedKiosk, setConnectedKiosk] = useState<Kiosk | null>(null);
  const [activeKioskIdx, setActiveKioskIdx] = useState<number>(0);
  
  // Menu navigation states
  const [activeSubView, setActiveSubView] = useState<'categories' | 'items' | 'cart'>('categories');
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategoryIdx, setActiveCategoryIdx] = useState<number>(0);
  const [activeItemIdx, setActiveItemIdx] = useState<number>(0);
  
  // Cart & Order
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isOrdered, setIsOrdered] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  // Favorites (persisted)
  const [favorites, setFavorites] = useState<FavoriteStore[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem('kiosk_favorites');
      return saved ? JSON.parse(saved) : [
        { id: "mcdonalds_seocho", storeName: "맥도날드", branchName: "서초점", category: "cafeteria" }
      ];
    }
    return [];
  });

  // Settings
  const [isTtsEnabled, setIsTtsEnabled] = useState<boolean>(true);
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.1);
  const [speechLog, setSpeechLog] = useState<string[]>(["어플리케이션을 준비 중입니다."]);
  const [lastVibration, setLastVibration] = useState<{ direction: string; pulseCount: number; id: number } | null>(null);

  // Keyboard accessibility helper focus target
  const controllerRef = useRef<HTMLDivElement>(null);

  // Keep a unique ID for vibration trigger animations
  const vibrationIdCounter = useRef<number>(0);

  // --- Helper to log speech visually ---
  const handleSpeak = (text: string, rate: number = ttsSpeed) => {
    setSpeechLog(prev => [text, ...prev].slice(0, 8)); // keep last 8
    if (isTtsEnabled) {
      speakText(text, rate);
    }
  };

  // --- Persist Favorites ---
  useEffect(() => {
    localStorage.setItem('kiosk_favorites', JSON.stringify(favorites));
  }, [favorites]);

  // --- Initialize App ---
  const handleStartApp = () => {
    setAppInitialized(true);
    playSound('connected');
    const msg = "키오스크 도우미 시작. 키오스크를 탐색하거나 즐겨찾기를 선택하세요. 방향 제어 및 스와이프 모듈 패드 사용 방법. 화면의 패드 중심을 누른 채로 상하좌우로 끌어서 스와이프 하거나, 패드의 상하좌우 방향 버튼을 터치하여 화면을 제어합니다. 키보드의 방향키로도 조작이 가능합니다. 오른쪽 방향 키는 선택 및 확인, 왼쪽 방향 키는 장바구니 취소 및 이전 단계, 위, 아래 키는 메뉴 이동입니다.";
    handleSpeak(msg);
    // Auto start discovery for friendly UX
    setImmediateScan();
  };

  const setImmediateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      // Ensure nearby kiosks are populated
      // Slightly scramble values representing live readings
      const kiosks = PRESET_KIOSKS.map(k => ({
        ...k,
        rssi: -50 - Math.floor(Math.random() * 30),
        distance: `${Math.floor(Math.random() * 8) + 2}m`
      })).sort((a, b) => parseInt(a.distance) - parseInt(b.distance));
      
      setScannedKiosks(kiosks);

      const foundCount = kiosks.length;
      const kioskNames = kiosks.map(k => `${k.storeName} ${k.branchName}`).join(', ');
      handleSpeak(`매장 ${foundCount}곳 감지. 목록: ${kioskNames}.`);
    }, 2000);
  };

  // --- Scan Kiosks ---
  const handleScan = () => {
    if (isScanning) return;
    playSound('beep');
    setIsScanning(true);
    handleSpeak("키오스크를 찾고 있습니다.");
    
    // Simulate finding kiosks
    setTimeout(() => {
      setIsScanning(false);
      setActiveKioskIdx(0);
      playSound('connected');
      const foundCount = PRESET_KIOSKS.length;
      const kioskNames = PRESET_KIOSKS.map(k => `${k.storeName} ${k.branchName}`).join(', ');
      handleSpeak(`탐색 완료. 매장 ${foundCount}곳 감지. 가장 가까운 곳: ${PRESET_KIOSKS[0].storeName}.`);
    }, 2500);
  };

  // --- Add/Remove Favorites ---
  const toggleFavorite = (kiosk: Kiosk | FavoriteStore, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playSound('beep');
    const isFav = favorites.some(f => f.id === kiosk.id);
    if (isFav) {
      setFavorites(prev => prev.filter(f => f.id !== kiosk.id));
      handleSpeak(`${kiosk.storeName} 즐겨찾기 해제.`);
    } else {
      const newFav: FavoriteStore = {
        id: kiosk.id,
        storeName: kiosk.storeName,
        branchName: kiosk.branchName,
        category: kiosk.category
      };
      setFavorites(prev => [...prev, newFav]);
      handleSpeak(`${kiosk.storeName} 즐겨찾기 등록.`);
    }
  };

  // --- Connect to Kiosk ---
  const handleConnect = (kiosk: Kiosk) => {
    playSound('connected');
    setConnectedKiosk(kiosk);
    
    // Extract unique categories for this kiosk
    const uniqueCats = Array.from(new Set(kiosk.menu.map(item => item.category)));
    setCategories(uniqueCats);
    
    // Reset indices and views
    setActiveCategoryIdx(0);
    setActiveItemIdx(0);
    setActiveSubView('categories');
    setCart([]);
    setIsOrdered(false);

    // Speak announcement
    const announceText = `${kiosk.storeName} 연결됨. 대분류 ${uniqueCats.length}개. 방향키로 탐색하세요.`;
    handleSpeak(announceText);

    // Auto-focus controller for direct keyboard triggers
    setTimeout(() => {
      controllerRef.current?.focus();
    }, 300);
  };

  // --- Disconnect Kiosk ---
  const handleDisconnect = () => {
    playSound('disconnected');
    const name = connectedKiosk ? `${connectedKiosk.storeName} ${connectedKiosk.branchName}` : "키오스크";
    setConnectedKiosk(null);
    setCategories([]);
    setActiveSubView('categories');
    setCart([]);
    setIsOrdered(false);
    handleSpeak(`${name} 연결 해제.`);
  };

  // --- Menu Navigation Items for active Category ---
  const getActiveMenuItems = (): MenuItem[] => {
    if (!connectedKiosk || categories.length === 0) return [];
    const activeCat = categories[activeCategoryIdx];
    return connectedKiosk.menu.filter(item => item.category === activeCat);
  };

  // --- Accessibility Navigation Control Core ---
  const handleAction = (direction: 'up' | 'down' | 'left' | 'right') => {
    vibrationIdCounter.current += 1;
    
    // Trigger physical vibration simulation & play customized distinct chime
    triggerVibration(direction, (pulses) => {
      setLastVibration({
        direction,
        pulseCount: pulses,
        id: vibrationIdCounter.current
      });
    });
    playSound(direction);

    if (!connectedKiosk) {
      if (scannedKiosks.length === 0) {
        handleSpeak("검색된 키오스크가 없습니다.");
        return;
      }
      if (direction === 'up') {
        if (activeKioskIdx > 0) {
          const nextIdx = activeKioskIdx - 1;
          setActiveKioskIdx(nextIdx);
          handleSpeak(`이전: ${scannedKiosks[nextIdx].storeName} ${scannedKiosks[nextIdx].branchName}`);
        } else {
          handleSpeak("첫 키오스크입니다.");
        }
      } else if (direction === 'down') {
        if (activeKioskIdx < scannedKiosks.length - 1) {
          const nextIdx = activeKioskIdx + 1;
          setActiveKioskIdx(nextIdx);
          handleSpeak(`다음: ${scannedKiosks[nextIdx].storeName} ${scannedKiosks[nextIdx].branchName}`);
        } else {
          handleSpeak("마지막 키오스크입니다.");
        }
      } else if (direction === 'right') {
        handleConnect(scannedKiosks[activeKioskIdx]);
      } else if (direction === 'left') {
        handleSpeak("키오스크를 선택하려면 오른쪽 키를 누르세요.");
      }
      return;
    }

    const currentItems = getActiveMenuItems();

    switch (direction) {
      case 'up': // Vibrate 3 times - Previous Item
        if (activeSubView === 'categories') {
          // Navigate up through categories
          if (activeCategoryIdx > 0) {
            const nextIdx = activeCategoryIdx - 1;
            setActiveCategoryIdx(nextIdx);
            handleSpeak(`이전: ${categories[nextIdx]}`);
          } else {
            handleSpeak("첫 대분류입니다.");
          }
        } else if (activeSubView === 'items') {
          // Navigate up through items
          if (activeItemIdx > 0) {
            const nextIdx = activeItemIdx - 1;
            setActiveItemIdx(nextIdx);
            const food = currentItems[nextIdx];
            handleSpeak(`${food.name}. ${food.price.toLocaleString()}원.`);
          } else {
            handleSpeak(`첫 메뉴: ${currentItems[0].name}.`);
          }
        } else if (activeSubView === 'cart') {
          // Navigate through cart items
          if (cart.length > 0 && activeItemIdx > 0) {
            const nextIdx = activeItemIdx - 1;
            setActiveItemIdx(nextIdx);
            const cartItem = cart[nextIdx];
            handleSpeak(`장바구니 ${nextIdx + 1}번. ${cartItem.menuItem.name} ${cartItem.quantity}개.`);
          } else {
            handleSpeak("장바구니 처음입니다.");
          }
        }
        break;

      case 'down': // Vibrate 4 times - Next Item
        if (activeSubView === 'categories') {
          // Navigate down through categories
          if (activeCategoryIdx < categories.length - 1) {
            const nextIdx = activeCategoryIdx + 1;
            setActiveCategoryIdx(nextIdx);
            handleSpeak(`다음: ${categories[nextIdx]}`);
          } else {
            handleSpeak("마지막 대분류입니다.");
          }
        } else if (activeSubView === 'items') {
          // Navigate down through items
          if (activeItemIdx < currentItems.length - 1) {
            const nextIdx = activeItemIdx + 1;
            setActiveItemIdx(nextIdx);
            const food = currentItems[nextIdx];
            handleSpeak(`${food.name}. ${food.price.toLocaleString()}원.`);
          } else {
            handleSpeak(`마지막 메뉴: ${currentItems[currentItems.length - 1].name}.`);
          }
        } else if (activeSubView === 'cart') {
          // Navigate down through cart items
          if (cart.length > 0 && activeItemIdx < cart.length - 1) {
            const nextIdx = activeItemIdx + 1;
            setActiveItemIdx(nextIdx);
            const cartItem = cart[nextIdx];
            handleSpeak(`장바구니 ${nextIdx + 1}번. ${cartItem.menuItem.name} ${cartItem.quantity}개.`);
          } else {
            handleSpeak("장바구니 끝입니다.");
          }
        }
        break;

      case 'left': // Vibrate 2 times - Go Back / Cancel
        if (isAuthenticating) {
          setIsAuthenticating(false);
          handleSpeak("결제 취소. 장바구니로 이동.");
          return;
        }
        if (isOrdered) {
          resetOrder();
          return;
        }
        if (activeSubView === 'items') {
          // Go back from items to categories
          setActiveSubView('categories');
          setActiveItemIdx(0);
          handleSpeak(`취소. 현재 대분류: ${categories[activeCategoryIdx]}`);
        } else if (activeSubView === 'cart') {
          // Go back from cart to categories or items
          setActiveSubView('items');
          setActiveItemIdx(0);
          handleSpeak("장바구니 취소. 메뉴 리스트로 이동.");
        } else if (activeSubView === 'categories') {
          // Disconnect on double left
          handleSpeak("한 번 더 뒤로가면 연결 해제됩니다.");
          // Trigger a lightweight warning and let user disconnect manually via UI
        }
        break;

      case 'right': // Vibrate 1 time - Select / Confirm / Add to Cart
        if (activeSubView === 'categories') {
          // Enter items in selected category
          if (currentItems.length > 0) {
            setActiveSubView('items');
            setActiveItemIdx(0);
            const firstFood = currentItems[0];
            handleSpeak(`${categories[activeCategoryIdx]} 진입. 항목 ${currentItems.length}개. 첫메뉴: ${firstFood.name}, ${firstFood.price.toLocaleString()}원.`);
          } else {
            handleSpeak("상품이 없습니다.");
          }
        } else if (activeSubView === 'items') {
          // Add focused item to cart
          const targetFood = currentItems[activeItemIdx];
          if (targetFood) {
            addToCart(targetFood);
          }
        } else if (activeSubView === 'cart') {
          // Checkout Trigger
          if (cart.length > 0) {
            handleCheckout();
          } else {
            handleSpeak("장바구니가 빔.");
          }
        }
        break;
    }
  };

  // --- Add a product to cart ---
  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id);
      if (existing) {
        return prev.map(c => c.menuItem.id === item.id 
          ? { ...c, quantity: c.quantity + 1 }
          : c
        );
      } else {
        return [...prev, { menuItem: item, quantity: 1 }];
      }
    });

    const totalCount = cart.reduce((acc, c) => acc + c.quantity, 0) + 1;
    const totalPrice = cart.reduce((acc, c) => acc + (c.menuItem.price * c.quantity), 0) + item.price;
    
    handleSpeak(`${item.name} 담김. 총 ${totalCount}개, ${totalPrice.toLocaleString()}원.`);
  };

  const updateCartQty = (itemId: string, change: number) => {
    playSound('beep');
    setCart(prev => {
      return prev.map(c => {
        if (c.menuItem.id === itemId) {
          const nextQty = c.quantity + change;
          if (nextQty <= 0) return null;
          return { ...c, quantity: nextQty };
        }
        return c;
      }).filter(Boolean) as CartItem[];
    });
    
    setTimeout(() => {
      handleSpeak(`수량 변경됨.`);
    }, 100);
  };

  const removeCartItem = (itemId: string, name: string) => {
    playSound('left');
    setCart(prev => prev.filter(c => c.menuItem.id !== itemId));
    handleSpeak(`${name} 삭제됨.`);
  };

  const removeLastCartItem = () => {
    if (cart.length > 0) {
      playSound('left');
      const lastItem = cart[cart.length - 1];
      setCart(prev => prev.slice(0, -1));
      handleSpeak(`${lastItem.menuItem.name} 취소됨.`);
    } else {
      playSound('beep');
      handleSpeak("장바구니가 비었습니다.");
    }
  };

  const handleFingerprintCheckout = () => {
    if (cart.length === 0) {
      handleSpeak("장바구니가 비었습니다.");
      return;
    }
    playSound('beep');
    setIsAuthenticating(true);
    handleSpeak("결제를 위해 화면 오른쪽을 두 번 터치하세요.");
  };

  const executeCheckoutAfterFingerprint = () => {
    setIsAuthenticating(false);
    playSound('connected');
    setIsOrdered(true);
    const totalPrice = cart.reduce((acc, c) => acc + (c.menuItem.price * c.quantity), 0);
    const orderDetails = cart.map(c => `${c.menuItem.name} ${c.quantity}개`).join(', ');
    handleSpeak(`결제 완료. ${orderDetails}. 총 ${totalPrice.toLocaleString()}원. 영수증이 발행됩니다.`);
  };

  const handleCheckout = () => {
    handleFingerprintCheckout();
  };

  const resetOrder = () => {
    playSound('beep');
    setCart([]);
    setIsOrdered(false);
    setActiveSubView('categories');
    setActiveCategoryIdx(0);
    setActiveItemIdx(0);
    handleSpeak("주문 완료. 처음으로 돌아갑니다.");
  };

  // --- Keyboard Event Handler ---
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!appInitialized) {
      if (e.key === 'Enter' || e.key === ' ') {
        handleStartApp();
        e.preventDefault();
      }
      return;
    }
    
    let handled = false;
    if (e.key === 'ArrowUp') {
      handleAction('up');
      handled = true;
    } else if (e.key === 'ArrowDown') {
      handleAction('down');
      handled = true;
    } else if (e.key === 'ArrowLeft') {
      handleAction('left');
      handled = true;
    } else if (e.key === 'ArrowRight') {
      handleAction('right');
      handled = true;
    }

    if (handled) {
      e.preventDefault();
    }
  };

  // --- Gesture & Double Tap Detection ---
  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTapTimeRef = useRef<number>(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const doubleTapOccurredRef = useRef<boolean>(false);

  const handleClickAction = (action: 'up' | 'down' | 'left' | 'right') => {
    if (doubleTapOccurredRef.current) return;
    
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    
    clickTimeoutRef.current = setTimeout(() => {
      if (!doubleTapOccurredRef.current) {
        handleAction(action);
      }
    }, 250);
  };
  
  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY
    };
    
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch(err) {}
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch(err) {}
    
    const diffX = e.clientX - pointerStartRef.current.x;
    const diffY = e.clientY - pointerStartRef.current.y;
    const minThreshold = 50; // min swipe distance in px

    // Check if it's a tap instead of a swipe
    if (Math.abs(diffX) < minThreshold && Math.abs(diffY) < minThreshold) {
      if (!appInitialized) {
        handleStartApp();
        return;
      }
      
      const now = Date.now();
      if (now - lastTapTimeRef.current < 400) {
        // Double tap detected
        lastTapTimeRef.current = 0;
        doubleTapOccurredRef.current = true;
        
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current);
          clickTimeoutRef.current = null;
        }
        
        setTimeout(() => {
          doubleTapOccurredRef.current = false;
        }, 500);
        
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const isRightTap = e.clientX > centerX;
        
        if (isRightTap) {
          if (isOrdered) {
            resetOrder();
            return;
          }

          if (isAuthenticating) {
            executeCheckoutAfterFingerprint();
            return;
          }

          if (activeSubView !== 'cart' && connectedKiosk) {
            triggerVibration('right', () => {}); 
            playSound('beep');
            setActiveSubView('cart');
            setActiveItemIdx(0);
            handleSpeak("장바구니 진입. 화면 오른쪽 두 번 터치시 결제.");
          } else if (activeSubView === 'cart' && connectedKiosk) {
            handleFingerprintCheckout();
          }
        } else {
          if (activeSubView === 'categories') {
            handleDisconnect();
          } else {
            removeLastCartItem();
          }
        }
      } else {
        lastTapTimeRef.current = now;
      }
      return;
    }

    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Horizontal swipe
      if (Math.abs(diffX) > minThreshold) {
        if (diffX > 0) {
          handleAction('right');
        } else {
          handleAction('left');
        }
      }
    } else {
      // Vertical swipe
      if (Math.abs(diffY) > minThreshold) {
        if (diffY > 0) {
          handleAction('down');
        } else {
          handleAction('up');
        }
      }
    }
  };

  // Speaks info when connecting/disconnecting
  const explainTactileRules = () => {
    playSound('connected');
    const rulesMsg = "안내: 화면 오른쪽 더블터치시 장바구니, 또 터치시 결제. 왼쪽 더블터치시 취소. 방향키 또는 스와이프로 제어합니다.";
    handleSpeak(rulesMsg);
  };

  return (
    <div 
      className="h-[100dvh] bg-[#DCF5AC] text-black font-sans selection:bg-black selection:text-white flex flex-col overflow-hidden outline-none touch-none"
      ref={controllerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="pointer-events-none select-none flex flex-col h-full w-full overflow-hidden">
      
      {/* HEADER BAR */}
      <header className="shrink-0 bg-[#DCF5AC] px-5 py-3 lg:py-4 max-w-7xl mx-auto w-full flex items-center justify-between relative z-30">
        <div className="flex items-center gap-3">
          <div className="bg-black text-[#DCF5AC] p-3 rounded-full font-bold flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-black rounded-full animate-ping"></span>
              <h1 className="text-lg font-extrabold tracking-tight text-black sm:text-xl">Wi-Ki</h1>
            </div>
            <p className="text-xs font-mono text-black/40 tracking-wider">BARRIER-FREE KIOSK HELPER</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* TTS Toggle Button with Voice Description */}
          <button
            onClick={() => {
              setIsTtsEnabled(!isTtsEnabled);
              playSound('beep');
              const nextState = !isTtsEnabled ? "켜졌습니다." : "꺼졌습니다.";
              speakText(`음성 안내 서비스가 ${nextState}`, ttsSpeed);
            }}
            className={`p-2.5 rounded-full transition-all duration-200 border ${
              isTtsEnabled 
                ? 'bg-black text-white border-neutral-800 font-bold ' 
                : 'bg-white text-black/60 border-black hover:bg-white'
            }`}
            title="음성 안내 온오프"
            aria-label="음성 도우미 전환 버튼"
            id="tts_toggle_btn"
          >
            {isTtsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Quick Voice Speed Switcher */}
          <button
            onClick={() => {
              playSound('beep');
              const nextSpeed = ttsSpeed >= 1.4 ? 0.9 : ttsSpeed + 0.15;
              setTtsSpeed(nextSpeed);
              setTimeout(() => {
                speakText(`음성 안내 배속을 ${nextSpeed.toFixed(2)} 비율로 설정했습니다.`, nextSpeed);
              }, 120);
            }}
            className="hidden sm:flex bg-white border border-black px-3 py-2.5 rounded-full text-xs font-mono font-bold text-black hover:bg-white transition"
            id="speed_control_btn"
          >
            속도: {ttsSpeed.toFixed(2)}x
          </button>
        </div>
      </header>

      {/* SPLASH OR INIT OVERLAY FOR USER ENGAGEMENT AND VOICE UNLOCK */}
      {!appInitialized ? (
        <main className="max-w-md mx-auto px-4 py-16 flex flex-col items-center justify-center text-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-white border border-black rounded-[2rem] p-8 shadow-none max-w-full"
          >
            <div className="w-20 h-20 bg-lime-100 border-2 border-lime-200 mx-auto rounded-full flex items-center justify-center text-black mb-6 font-bold text-3xl">
              🔊
            </div>

            <h2 className="text-2xl font-black mb-3 text-black tracking-tight">Wi-Ki</h2>
            <p className="text-sm text-black/60 leading-relaxed mb-6">
              이 애플리케이션은 시각장애인이 매장에 들어섰을 때 블루투스 비콘으로 자동 연동하여 키오스크 탑재 메뉴를 진동 주파수와 음성으로 편안히 탐색하도록 지원합니다.
            </p>

            <button
              onClick={handleStartApp}
              className="w-full bg-black hover:bg-neutral-800 text-white transition duration-150 py-5 px-6 rounded-full font-extrabold text-lg flex items-center justify-center gap-2.5  "
              id="start_assistant_btn"
              aria-label="안내 도우미 시작하기 버튼"
            >
              <span>시작하기 (도움 음성 실행)</span>
            </button>
          </motion.div>
        </main>
      ) : (
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 grid md:grid-cols-12 gap-4 relative z-10 overflow-hidden pb-4">
          
          {/* LEFT PANEL: SCANNING & BOOKMARKED STORES (md:col-span-4) */}
          <section className="md:col-span-5 lg:col-span-4 flex flex-col gap-4 overflow-hidden min-h-0">
            
            {/* Quick Favorites Section (즐겨찾기 수집함) */}
            <div className="bg-white border border-black/80 rounded-[2rem] p-4 shrink-0">
              <h2 className="text-base font-extrabold text-black flex items-center justify-between mb-4 pb-2 border-b border-black/5">
                <span className="flex items-center gap-2 text-black">
                  <Star className="w-5 h-5 text-black fill-amber-400" />
                  자주 가는 매장 (즐겨찾기)
                </span>
                <span className="text-xs font-mono font-bold text-black/60 bg-lime-200 px-3 py-1 rounded-full">
                  {favorites.length}개
                </span>
              </h2>

              {favorites.length === 0 ? (
                <div className="text-center py-4 text-black/40 text-xs font-medium">
                  등록된 자주가는 매장이 없습니다.<br />
                  매장 카드 우측 별표를 누르면 즐겨찾기에 추가됩니다.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-32 overflow-y-auto pr-1">
                  {favorites.map((fav) => {
                    const mappedKiosk = PRESET_KIOSKS.find(pk => pk.id === fav.id) || PRESET_KIOSKS[0];
                    const isConnected = connectedKiosk?.id === fav.id;

                    return (
                      <div 
                        key={fav.id}
                        onClick={() => handleConnect(mappedKiosk)}
                        className={`group relative p-3.5 rounded-full border transition-all duration-150 cursor-pointer flex items-center justify-between ${
                          isConnected 
                            ? 'bg-black text-white border-neutral-800 font-semibold ' 
                            : 'bg-white hover:bg-lime-200/50 text-black border-black/5'
                        }`}
                        role="button"
                        id={`favorite_store_${fav.id}`}
                        aria-label={`${fav.storeName} ${fav.branchName} 즐겨찾기 매장 연결`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-full text-xs flex items-center justify-center font-bold ${
                            isConnected ? 'bg-white/20 text-white' : 'bg-white text-black shadow-xs border border-black/5'
                          }`}>
                            <Store className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-bold flex items-center gap-1.5">
                              {fav.storeName}
                              <span className={`text-xs ${isConnected ? 'text-lime-200 font-bold' : 'text-black/60 font-normal'}`}>
                                {fav.branchName}
                              </span>
                            </div>
                            <div className={`text-[11px] mt-0.5 ${isConnected ? 'text-lime-200/80' : 'text-black/40'}`}>
                              {fav.category === 'cafeteria' ? '패스트푸드' : fav.category === 'cafe' ? '카페' : '일반한식/분식'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => toggleFavorite(fav, e)}
                            className={`p-1.5 rounded-lg transition-colors duration-150 ${
                              isConnected 
                                ? 'text-white hover:bg-white/20' 
                                : 'text-black hover:bg-lime-100'
                            }`}
                            id={`remove_fav_btn_${fav.id}`}
                            aria-label="즐겨찾기 지우기"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className={`w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity ${
                            isConnected ? 'text-white' : 'text-black/40'
                          }`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bluetooth Scanner Simulator Panel */}
            {!connectedKiosk && (
            <div className="bg-white border border-black/80 rounded-[2rem] p-4 flex flex-col flex-1 min-h-0">
              <h2 className="text-base font-extrabold text-black flex items-center justify-between mb-4 pb-2 border-b border-black/5 shrink-0">
                <span className="flex items-center gap-2 text-black">
                  <Bluetooth className={`w-5 h-5 text-black ${isScanning ? 'animate-bounce' : ''}`} />
                  주변 블루투스 키오스크
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleScan}
                    disabled={isScanning}
                    className="text-xs bg-white border border-black text-black font-extrabold px-3 py-1.5 rounded-full hover:bg-lime-200 transition disabled:opacity-40"
                    id="scan_trigger_btn"
                  >
                    {isScanning ? "검색 중..." : "새로고침"}
                  </button>
                </div>
              </h2>

              {isScanning ? (
                <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
                  <div className="relative flex items-center justify-center w-16 h-16 bg-lime-100 border border-lime-300 rounded-full mb-4 shrink-0">
                    <span className="absolute animate-ping inline-flex h-full w-full rounded-full bg-lime-400 opacity-20"></span>
                    <Bluetooth className="w-7 h-7 text-black" />
                  </div>
                  <p className="text-sm font-semibold text-black/80 animate-pulse">
                    근처 저전력 블루투스(BLE) 장치 탐색 중...
                  </p>
                  <p className="text-[11px] text-black/40 mt-1.5">
                    키오스크 발신 비콘 감지 거리: 15m 이내
                  </p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-0">
                  {scannedKiosks.map((kiosk, idx) => {
                    const isFav = favorites.some(f => f.id === kiosk.id);
                    const isConnected = connectedKiosk?.id === kiosk.id;
                    const isActiveFocus = (!connectedKiosk && activeKioskIdx === idx);

                    return (
                      <div 
                        key={kiosk.id}
                        onClick={() => handleConnect(kiosk)}
                        className={`group p-4 border transition-all duration-150 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                          isConnected 
                            ? 'bg-gradient-to-br from-black to-neutral-900 text-white border-neutral-800 font-semibold rounded-full' 
                            : isActiveFocus
                            ? 'bg-white text-black border-4 border-lime-400 rounded-3xl scale-[1.02] shadow-sm'
                            : 'bg-white text-black border-black/80 hover:border-black/20 hover:bg-white/50 rounded-full border'
                        }`}
                        id={`scanned_kiosk_${kiosk.id}`}
                        role="button"
                        aria-label={`${kiosk.storeName} ${kiosk.branchName}, 거리 ${kiosk.distance}`}
                      >
                        {/* Connected blue tag overlay */}
                        {isConnected && (
                          <div className="absolute right-0 top-0 text-[10px] bg-black text-lime-400 font-extrabold tracking-wider py-1 px-3.5 rounded-bl-xl shadow-xs">
                            연동 활성화
                          </div>
                        )}
                        {isActiveFocus && (
                          <div className="absolute right-0 top-0 text-[10px] bg-lime-400 text-black font-extrabold tracking-wider py-1 px-3.5 rounded-bl-xl shadow-xs border-b border-l border-lime-500">
                            연결 대기 (오른쪽 스와이프)
                          </div>
                        )}

                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className={`text-base font-extrabold ${isConnected ? 'text-white' : 'text-black'}`}>
                              {kiosk.storeName}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-md ${
                              isConnected ? 'bg-white/20 text-white font-semibold' : 'bg-lime-200 text-black/60 font-normal'
                            }`}>
                              {kiosk.branchName}
                            </span>
                          </div>

                          <button
                            onClick={(e) => toggleFavorite(kiosk, e)}
                            className={`p-1.5 rounded-full transition-colors duration-200 ${
                              isConnected 
                                ? 'text-white hover:bg-white/20' 
                                : isFav ? 'text-black' : 'text-black/20 hover:text-black/60'
                            }`}
                            title="즐겨찾기 추가/삭제"
                            id={`fav_toggle_${kiosk.id}`}
                            aria-label={`${kiosk.storeName} 즐겨찾기 변경`}
                          >
                            <Star className={`w-5 h-5 ${isFav ? 'fill-current' : 'fill-none'}`} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-2 border-t border-dashed border-black/5">
                          {/* Distance & RSSI Status */}
                          <div className="flex items-center gap-3.5 text-xs text-black/60">
                            <span className={`flex items-center gap-1 font-mono ${isConnected ? 'text-lime-200' : 'text-black/60'}`}>
                              <MapPin className="w-3.5 h-3.5" />
                              {kiosk.distance}
                            </span>
                            <span className={`flex items-center gap-1 font-mono text-[10px] opacity-80 ${isConnected ? 'text-lime-200/90' : 'text-black/40'}`}>
                              <Activity className="w-3 h-3" />
                              {kiosk.rssi} dBm
                            </span>
                          </div>

                          <div className="text-xs font-semibold flex items-center gap-1">
                            {isConnected ? (
                              <span className="bg-white text-black px-2.5 py-0.5 rounded-md font-extrabold flex items-center gap-1 shadow-xs border border-neutral-800/10">
                                <BluetoothConnected className="w-3.5 h-3.5 text-black" />
                                연동 중
                              </span>
                            ) : (
                              <span className="text-black group-hover:underline flex items-center gap-1 font-extrabold">
                                기기 선택 <ChevronRight className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}
          </section>

          {/* ACTIVE CONTENT WORKSPACE (md:col-span-8) */}

          <section className="md:col-span-7 lg:col-span-8 flex flex-col gap-4 overflow-hidden min-h-0">
            
            {connectedKiosk && (
              <div className="bg-white border border-black rounded-[2rem] p-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-black  ">
                      ON
                    </div>
                    <div>
                      <div className="text-xs text-black/40 font-mono tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-neutral-800 animate-pulse"></span>
                        BLUETOOTH ACTIVE • 연동 거리: {connectedKiosk.distance}
                      </div>
                      <h3 className="text-lg font-extrabold text-black">
                        {connectedKiosk.storeName} <span className="text-black font-bold text-sm">[{connectedKiosk.branchName}]</span>
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Explain tactile controller buttons via audio */}
                    <button
                      onClick={explainTactileRules}
                      className="bg-white hover:bg-lime-200 border border-black px-4 py-2.5 rounded-full text-xs font-bold text-black flex items-center gap-1.5 transition"
                      id="tactile_rules_audio_btn"
                    >
                      <BellRing className="w-3.5 h-3.5 text-black animate-bounce" />
                      진동신호 규칙 안내음성
                    </button>

                    <button
                      onClick={handleDisconnect}
                      className="bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 px-4 py-2.5 rounded-full text-xs font-bold transition"
                      id="disconnect_btn"
                    >
                      연동 종료
                    </button>
                  </div>
                </div>
            )}

            <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
                  {connectedKiosk && (
                    <div className="flex-1 bg-white border-2 border-black rounded-[2rem] p-6 shadow-md relative overflow-y-auto text-black flex flex-col min-h-0">
                      
                      {/* Backdrop subtle layout icon background */}
                      <div className="absolute right-3 top-3 text-black/5 pointer-events-none">
                    <Activity className="w-24 h-24 stroke-[1]" />
                  </div>

                  <div className="text-xs text-black tracking-wider font-extrabold uppercase mb-2">
                    현재 가상 포커스 상태 • {activeSubView === 'categories' ? '대분류 카테고리' : activeSubView === 'items' ? '상세 메뉴 선택' : '장바구니 확인'}
                  </div>

                  {activeSubView === 'categories' && (
                    <div className="space-y-1">
                      <div className="text-xs text-black/40">전체 카테고리 {categories.length}개 중 {activeCategoryIdx + 1}번째 대분류</div>
                      <div className="text-2xl font-black text-black tracking-tight flex items-center gap-3">
                        {categories[activeCategoryIdx]}
                        <span className="text-xs bg-lime-100 text-black border border-lime-200 font-bold px-3 py-1 rounded-full uppercase">
                          진입하려면 오른쪽 키
                        </span>
                      </div>
                    </div>
                  )}

                  {activeSubView === 'items' && (
                    <div className="space-y-2">
                      <div className="text-xs text-black/40">
                        {categories[activeCategoryIdx]} &gt; 상품 목록 {getActiveMenuItems().length}개 중 {activeItemIdx + 1}번째
                      </div>
                      <div className="text-2xl font-black text-black tracking-tight">
                        {getActiveMenuItems()[activeItemIdx]?.name}
                      </div>
                      <div className="text-xl font-bold text-black">
                        {getActiveMenuItems()[activeItemIdx]?.price.toLocaleString()}원
                      </div>
                      <p className="text-xs text-black/60 leading-relaxed max-w-xl bg-white p-4 rounded-full border border-black/5 mt-2">
                        {getActiveMenuItems()[activeItemIdx]?.description}
                      </p>
                      <div className="text-[11px] text-black font-bold flex items-center gap-1.5 pt-1">
                        <Check className="w-3.5 h-3.5 text-black" />
                        오른쪽 제어 동작(오른쪽 버튼/가로 스와이프)을 실행하면 장바구니에 해당 품목을 추가합니다 (진동 1회)
                      </div>
                    </div>
                  )}

                  {activeSubView === 'cart' && (
                    <div className="space-y-1">
                      <div className="text-xs text-black/40">장바구니 영수증 정보</div>
                      {cart.length === 0 ? (
                        <div className="text-lg font-bold text-black/40">현재 장바구니가 비어 있습니다.</div>
                      ) : (
                        <div>
                          <div className="text-2xl font-black text-black">
                            총 {cart.reduce((a, c) => a + c.quantity, 0)}개 아이템 선택 완료
                          </div>
                          <div className="text-lg font-bold text-black mt-1">
                            합계 금액: {cart.reduce((a, c) => a + (c.menuItem.price * c.quantity), 0).toLocaleString()}원
                          </div>
                          <div className="text-xs text-black/40 mt-2">
                            주문을 전송하고 결제하시려면 오른쪽 스와이프, 이전 상세 메뉴 리스트로 돌아가려면 왼쪽 스와이프 하세요.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                    </div>
                  )}
            </div>
          </section>

        </main>
      )}
      
      </div>

      {/* MODAL SIMULATED FINGERPRINT AUTH */}
      <AnimatePresence>
        {isAuthenticating && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 touch-none"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-2 border-black max-w-sm w-full p-8 rounded-[2rem] text-center shadow-2xl relative"
            >
              <div className="w-24 h-24 bg-lime-100 text-black mx-auto rounded-full flex items-center justify-center mb-6 border-4 border-lime-200 relative overflow-hidden">
                <motion.div 
                  initial={{ top: '-100%' }}
                  animate={{ top: '200%' }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  className="absolute inset-x-0 h-1/2 bg-black/10 shadow-[0_0_15px_rgba(0,0,0,0.2)] blur-[2px]" 
                />
                <Fingerprint className="w-12 h-12 font-black relative z-10" />
              </div>
              
              <h3 className="text-xl font-black text-black">지문 인식 결제</h3>
              <p className="text-sm font-bold text-black mt-2 mb-6">
                화면 오른쪽을 빠르게 두 번 터치하여 인증하세요
              </p>

              <button
                onClick={executeCheckoutAfterFingerprint}
                className="w-full bg-black text-white rounded-full py-4 font-bold active:bg-black transition"
                aria-label="지문 인식 완료 (화면 더블 터치 시 동일 기능)"
              >
                가상 지문 인식 터치
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL SIMULATED RECEIPT ON SUCCESSFUL CHECKOUT */}
      <AnimatePresence>
        {isOrdered && (
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 touch-none"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-2 border-black max-w-sm w-full p-6 py-8 rounded-[2rem] text-center shadow-2xl relative text-black"
            >
              <div className="w-14 h-14 bg-lime-100 text-lime-600 mx-auto rounded-full flex items-center justify-center mb-4 border border-lime-200">
                <Check className="w-7 h-7 font-black" />
              </div>
              
              <h3 className="text-lg font-black text-black">결제가 완료되었습니다!</h3>
              <p className="text-xs text-black/40 mt-1 leading-relaxed">
                Wi-Ki 가상 연동 영수증
              </p>

              {/* Receipt details */}
              <div className="bg-white rounded-full p-4 my-5 text-left text-xs font-mono border border-black/5 text-black/80 space-y-2.5">
                <div className="text-center font-extrabold text-black border-b border-dashed border-black pb-2 mb-2">
                  {connectedKiosk?.storeName} {connectedKiosk?.branchName}
                </div>
                
                {cart.map(c => (
                  <div key={c.menuItem.id} className="flex justify-between">
                    <span className="font-medium text-black/70">{c.menuItem.name} x {c.quantity}</span>
                    <span className="font-extrabold text-black">{(c.menuItem.price * c.quantity).toLocaleString()}원</span>
                  </div>
                ))}

                <div className="border-t border-dashed border-black pt-2 mt-2 flex justify-between font-extrabold text-black text-sm">
                  <span>총 결제액</span>
                  <span>{cart.reduce((a, c) => a + (c.menuItem.price * c.quantity), 0).toLocaleString()}원</span>
                </div>
                
                <div className="text-[10px] text-black/40 text-center pt-2 leading-relaxed">
                  인증방식: NFC 주파수 연동 가상 주문 전송<br />
                  승인일자: {new Date().toLocaleString('ko-KR')}
                </div>
              </div>

              <p className="text-[11px] text-black/60 mb-4 font-medium">
                결제용 임시 코드가 무선으로 전송되었습니다.<br />
                기기 전면 부근에서 제품 조리를 기다려 주십시오.
              </p>

              <button
                onClick={resetOrder}
                className="w-full bg-black hover:bg-neutral-800 text-white font-extrabold py-3.5 rounded-full transition shadow-md "
                id="receipt_dismiss_btn"
              >
                닫기 및 초기화 (왼쪽 방향)
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
