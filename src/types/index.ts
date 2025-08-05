export interface ESP32Device {
  id: string;
  name: string;
  rssi: number;
  serialNumber?: string;
}

export interface WiFiNetwork {
  ssid: string;
  signalStrength?: number;
  isSecured?: boolean;
}

export interface BLECharacteristic {
  uuid: string;
  canRead: boolean;
  canWrite: boolean;
  canNotify: boolean;
}

export interface BLEService {
  uuid: string;
  characteristics: BLECharacteristic[];
}

export type SetupState = 
  | 'connecting'
  | 'readingWiFiList'
  | 'configuringWiFi'
  | 'waitingForConnection'
  | 'success'
  | 'error';

export interface DeviceSetupStep {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isActive: boolean;
}

export interface WiFiSetupData {
  ssid: string;
  password: string;
}

export interface BLENotificationMessage {
  type: 'wifi_ok' | 'wifi_failed' | 'unknown';
  message: string;
  timestamp: number;
}

// Mock API response types (giống Flutter)
export interface DeviceRegistrationResponse {
  isValid: boolean;
  serialNumber: string;
  message?: string;
}

export interface AddDeviceResponse {
  success: boolean;
  deviceId: string;
  message?: string;
}