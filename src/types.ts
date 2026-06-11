export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  isPopular?: boolean;
  options?: string[];
}

export interface Kiosk {
  id: string;
  storeName: string;
  branchName: string;
  category: 'cafeteria' | 'cafe' | 'korean_food';
  distance: string; // e.g., "3m", "15m"
  rssi: number; // signal strength
  menu: MenuItem[];
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export interface FavoriteStore {
  id: string;
  storeName: string;
  branchName: string;
  category: string;
}
