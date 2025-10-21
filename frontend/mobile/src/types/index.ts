export interface User {
  id: string;
  userId: string;
  name: string;
  role: string;
  vehicleId: string;
}

export interface Position {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number;
    speed?: number;
    heading?: number;
  };
  timestamp: number;
}

export interface OperationInfo {
  id: string;
  vehicleId: string;
  driverId: string;
  startTime: string;
  endTime?: string;
  loadingLocation?: string;
  unloadingLocation?: string;
  cargoInfo?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  totalDistanceKm?: number;
  vehicle?: {
    id: string;
    plateNumber: string;
    model: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}