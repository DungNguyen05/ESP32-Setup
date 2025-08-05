import { BleManager, Device, State } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';

export interface ESP32Device {
  id: string;
  name: string;
  rssi: number;
  serialNumber?: string;
}

class BLEService {
  private manager: BleManager;
  private connectedDevice: Device | null = null;

  // ESP32 Service UUIDs theo specs
  private readonly TARGET_SERVICE_UUIDS = ['12CE', '12CF'];
  private readonly DEVICE_NAME_PREFIX = 'GC-';
  
  // Characteristics
  private readonly CHAR_WIFI_LIST = 'CE01'; // Đọc danh sách WiFi
  private readonly CHAR_WIFI_CONFIG = 'CE02'; // Ghi cấu hình WiFi

  constructor() {
    this.manager = new BleManager();
    this.initializeBLE();
  }

  private async initializeBLE() {
    // Kiểm tra quyền cho Android
    if (Platform.OS === 'android') {
      await this.requestAndroidPermissions();
    }

    // Monitor Bluetooth state
    this.manager.onStateChange((state) => {
      console.log('BLE State:', state);
      if (state === State.PoweredOn) {
        console.log('Bluetooth is ready');
      }
    }, true);
  }

  private async requestAndroidPermissions() {
    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      
      console.log('Android permissions:', granted);
    } catch (error) {
      console.error('Permission request failed:', error);
    }
  }

  async checkBluetoothState(): Promise<boolean> {
    const state = await this.manager.state();
    return state === State.PoweredOn;
  }

  async scanForDevices(onDeviceFound: (device: ESP32Device) => void): Promise<void> {
    const isBluetoothReady = await this.checkBluetoothState();
    if (!isBluetoothReady) {
      throw new Error('Bluetooth is not enabled');
    }

    console.log('Starting BLE scan...');
    
    // Stop any existing scan
    this.manager.stopDeviceScan();

    const foundDevices = new Set<string>();

    this.manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('Scan error:', error);
        return;
      }

      if (!device || !device.name) {
        return;
      }

      // Lọc theo tên thiết bị
      if (!device.name.startsWith(this.DEVICE_NAME_PREFIX)) {
        return;
      }

      // Tránh duplicate
      if (foundDevices.has(device.id)) {
        return;
      }

      foundDevices.add(device.id);

      const esp32Device: ESP32Device = {
        id: device.id,
        name: device.name,
        rssi: device.rssi || -100,
      };

      console.log('Found ESP32 device:', esp32Device);
      onDeviceFound(esp32Device);
    });

    // Auto stop scan after 10 seconds
    setTimeout(() => {
      this.stopScan();
    }, 10000);
  }

  stopScan(): void {
    console.log('Stopping BLE scan...');
    this.manager.stopDeviceScan();
  }

  async connectToDevice(deviceId: string): Promise<boolean> {
    try {
      console.log('Connecting to device:', deviceId);
      
      // Disconnect current device if exists
      if (this.connectedDevice) {
        await this.disconnectDevice();
      }

      const device = await this.manager.connectToDevice(deviceId);
      await device.discoverAllServicesAndCharacteristics();
      
      this.connectedDevice = device;
      console.log('Connected successfully to:', device.name);
      
      return true;
    } catch (error) {
      console.error('Connection failed:', error);
      return false;
    }
  }

  async disconnectDevice(): Promise<void> {
    if (this.connectedDevice) {
      try {
        await this.connectedDevice.cancelConnection();
        console.log('Disconnected from device');
      } catch (error) {
        console.error('Disconnect error:', error);
      } finally {
        this.connectedDevice = null;
      }
    }
  }

  async readSerialNumber(): Promise<string | null> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      // Tìm service có chứa characteristic cần thiết
      const services = await this.connectedDevice.services();
      console.log('Available services:', services.map(s => s.uuid));
      
      // TODO: Implement logic đọc Serial Number từ characteristic phù hợp
      // Hiện tại return mock data
      const serialNumber = this.connectedDevice.name?.replace(this.DEVICE_NAME_PREFIX, '') || null;
      console.log('Serial Number:', serialNumber);
      
      return serialNumber;
    } catch (error) {
      console.error('Read Serial Number failed:', error);
      return null;
    }
  }

  async readWiFiList(): Promise<string[]> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      // TODO: Implement đọc từ characteristic CE01
      // Mock data for now
      return ['WiFi-Network-1', 'WiFi-Network-2', 'Guest-Network'];
    } catch (error) {
      console.error('Read WiFi list failed:', error);
      return [];
    }
  }

  async configureWiFi(ssid: string, password: string): Promise<boolean> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      // Format: "_UWF:<Name>0x06<Pass>0x04"
      const command = `_UWF:${ssid}\x06${password}\x04`;
      console.log('Sending WiFi config:', { ssid, command });
      
      // TODO: Implement ghi vào characteristic CE02
      // Mock success for now
      return true;
    } catch (error) {
      console.error('WiFi configuration failed:', error);
      return false;
    }
  }

  async sendEndCommand(): Promise<boolean> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      const command = '_END:\x04';
      console.log('Sending END command');
      
      // TODO: Implement ghi command
      // Mock success for now
      return true;
    } catch (error) {
      console.error('Send END command failed:', error);
      return false;
    }
  }

  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  getConnectedDeviceName(): string | null {
    return this.connectedDevice?.name || null;
  }

  destroy(): void {
    this.stopScan();
    this.disconnectDevice();
    this.manager.destroy();
  }
}

export const BLEManager = new BLEService();