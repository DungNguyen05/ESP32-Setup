export interface ESP32Device {
    id: string;
    name: string;
    rssi: number;
    serialNumber?: string;
  }
  
  export interface WiFiNetwork {
    ssid: string;
    signalStrength: number;
    isSecured: boolean;
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
  
  export type ConnectionStatus = 
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'configuring'
    | 'completed'
    | 'failed';
  
  export interface DeviceSetupStep {
    id: string;
    title: string;
    description: string;
    isCompleted: boolean;
    isActive: boolean;
  }