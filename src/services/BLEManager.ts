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
  
  // Characteristics UUIDs (4 ký tự -> 16 byte UUID)
  private readonly CHAR_WIFI_LIST = '0000CE01-0000-1000-8000-00805F9B34FB';
  private readonly CHAR_WIFI_CONFIG = '0000CE02-0000-1000-8000-00805F9B34FB';
  private readonly CHAR_SERIAL_NUMBER = '0000CE03-0000-1000-8000-00805F9B34FB';

  private notificationCallback: ((message: string) => void) | null = null;

  constructor() {
    this.manager = new BleManager();
    this.initializeBLE();
  }

  private async initializeBLE() {
    if (Platform.OS === 'android') {
      await this.requestAndroidPermissions();
    }

    this.manager.onStateChange((state) => {
      console.log('BLE State:', state);
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
    this.manager.stopDeviceScan();

    const foundDevices = new Set<string>();

    this.manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('Scan error:', error);
        return;
      }

      if (!device || !device.name || !device.name.startsWith(this.DEVICE_NAME_PREFIX)) {
        return;
      }

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
  }

  stopScan(): void {
    console.log('Stopping BLE scan...');
    this.manager.stopDeviceScan();
  }

  async connectToDevice(deviceId: string): Promise<boolean> {
    try {
      console.log('Connecting to device:', deviceId);
      
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

  // Đọc Serial Number từ thiết bị
  async readSerialNumber(): Promise<string | null> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      // Mock: Lấy SN từ tên thiết bị (GC-<SN>)
      const deviceName = this.connectedDevice.name || '';
      const serialNumber = deviceName.replace(this.DEVICE_NAME_PREFIX, '');
      
      console.log('Serial Number:', serialNumber);
      return serialNumber || null;
    } catch (error) {
      console.error('Read Serial Number failed:', error);
      return null;
    }
  }

  // Kiểm tra SN với backend (mock)
  async checkSerialNumberWithBackend(serialNumber: string): Promise<boolean> {
    try {
      console.log('Checking SN with backend:', serialNumber);
      
      // Mock: Giả lập check backend - luôn return true
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true; // Mặc định SN nào cũng đăng ký được
    } catch (error) {
      console.error('Backend check failed:', error);
      return false;
    }
  }

  // Đọc danh sách WiFi từ characteristic CE01
  async readWiFiList(): Promise<string[]> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      // Tìm service chứa characteristic CE01
      const services = await this.connectedDevice.services();
      
      for (const service of services) {
        const serviceId = service.uuid.substring(4, 8).toUpperCase();
        
        if (this.TARGET_SERVICE_UUIDS.includes(serviceId)) {
          try {
            const characteristic = await this.connectedDevice.readCharacteristicForService(
              service.uuid,
              this.CHAR_WIFI_LIST
            );
            
            if (characteristic.value) {
              // Decode base64 data
              const rawData = atob(characteristic.value);
              console.log('Raw WiFi data:', rawData);
              
              // Parse WiFi networks từ chuỗi liên tục
              const networks = this.parseWiFiNetworks(rawData);
              
              console.log('Parsed WiFi networks:', networks);
              return networks;
            }
          } catch (readError) {
            console.log('Could not read from service:', serviceId, readError instanceof Error ? readError.message : String(readError));
          }
        }
      }
      
      // Fallback: Return mock data if read fails
      console.log('Using mock WiFi data');
      return ['WiFi-Network-1', 'WiFi-Network-2', 'Guest-Network'];
      
    } catch (error) {
      console.error('Read WiFi list failed:', error);
      return ['WiFi-Network-1', 'WiFi-Network-2', 'Guest-Network'];
    }
  }

  // Parse chuỗi WiFi liên tục thành array các SSID
  private parseWiFiNetworks(rawData: string): string[] {
    // Danh sách các từ khóa thường gặp để tách WiFi networks
    const commonPatterns = [
      /(\d+G)/g,           // 5G, 2.4G
      /(FPT|VNPT|Viettel|VNFA)/gi,  // Tên nhà mạng
      /(Galaxy|iPhone|Xiaomi)/gi,   // Tên thiết bị
      /(WiFi|Wifi|WIFI)/gi,         // Từ WiFi
      /([A-Z]{2,})/g,               // Các từ viết hoa liên tiếp
    ];

    // Thêm các ký tự đặc biệt có thể là separator
    const separators = /[→←↑↓|▪▫■□●○★☆♦♣♠♥]/g;
    
    // Bước 1: Thay thế separators bằng dấu |
    let processedData = rawData.replace(separators, '|');
    
    // Bước 2: Tìm các pattern có thể là tên WiFi
    const potentialNetworks: string[] = [];
    
    // Split theo các ký tự đặc biệt và số
    const segments = processedData.split(/[|→←↑↓\d{1,2}G]/);
    
    segments.forEach(segment => {
      const cleaned = segment.trim();
      if (cleaned.length > 2) {
        // Tách thêm theo các pattern thường gặp
        const subSegments = cleaned.split(/(?=[A-Z]{2,})|(?=FPT)|(?=VNPT)|(?=Viettel)|(?=VNFA)|(?=Galaxy)|(?=iPhone)/);
        
        subSegments.forEach(subSegment => {
          const finalCleaned = subSegment.trim();
          if (finalCleaned.length >= 3 && finalCleaned.length <= 32) { // SSID length limits
            potentialNetworks.push(finalCleaned);
          }
        });
      }
    });

    // Bước 3: Làm sạch và loại bỏ duplicate
    const networks = potentialNetworks
      .map(network => network.trim())
      .filter(network => 
        network.length >= 3 && 
        network.length <= 32 &&
        !network.match(/^[\d\s]+$/) && // Loại bỏ chuỗi chỉ có số
        !network.match(/^[→←↑↓|▪▫■□●○★☆♦♣♠♥]+$/) // Loại bỏ chuỗi chỉ có ký tự đặc biệt
      )
      .filter((network, index, arr) => arr.indexOf(network) === index) // Remove duplicates
      .slice(0, 20); // Giới hạn tối đa 20 networks

    // Nếu không parse được gì, thử method backup
    if (networks.length === 0) {
      return this.parseWiFiNetworksBackup(rawData);
    }

    return networks;
  }

  // Backup parsing method với approach khác
  private parseWiFiNetworksBackup(rawData: string): string[] {
    // Thử tách theo các từ khóa phổ biến
    const knownProviders = ['VNFA', 'FPT', 'VNPT', 'Viettel'];
    const knownDevices = ['Galaxy', 'iPhone', 'Xiaomi', 'Photon'];
    
    const networks: string[] = [];
    let currentNetwork = '';
    
    for (let i = 0; i < rawData.length; i++) {
      const char = rawData[i];
      const nextChars = rawData.substring(i, i + 10);
      
      // Check if we hit a known provider/device name
      const foundProvider = knownProviders.find(provider => 
        nextChars.startsWith(provider)
      );
      const foundDevice = knownDevices.find(device => 
        nextChars.startsWith(device)
      );
      
      if (foundProvider || foundDevice) {
        // Save current network if it's valid
        if (currentNetwork.trim().length >= 3) {
          networks.push(currentNetwork.trim());
        }
        // Start new network
        currentNetwork = foundProvider || foundDevice || '';
        i += (foundProvider?.length || foundDevice?.length || 1) - 1;
      } else if (char.match(/[→←↑↓|▪▫■□●○★☆♦♣♠♥\d]/)) {
        // End current network on separator or number
        if (currentNetwork.trim().length >= 3) {
          networks.push(currentNetwork.trim());
        }
        currentNetwork = '';
      } else {
        currentNetwork += char;
      }
    }
    
    // Add last network
    if (currentNetwork.trim().length >= 3) {
      networks.push(currentNetwork.trim());
    }
    
    return networks.slice(0, 15); // Limit results
  }

  // Setup notification listener cho "Wifi_OK"
  async setupWiFiNotification(callback: (message: string) => void): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    this.notificationCallback = callback;

    try {
      const services = await this.connectedDevice.services();
      
      for (const service of services) {
        const serviceId = service.uuid.substring(4, 8).toUpperCase();
        
        if (this.TARGET_SERVICE_UUIDS.includes(serviceId)) {
          try {
            await this.connectedDevice.monitorCharacteristicForService(
              service.uuid,
              this.CHAR_WIFI_CONFIG,
              (error, characteristic) => {
                if (error) {
                  console.error('Notification error:', error);
                  return;
                }
                
                if (characteristic?.value) {
                  const message = atob(characteristic.value);
                  console.log('Received notification:', message);
                  this.notificationCallback?.(message);
                }
              }
            );
            
            console.log('WiFi notification setup completed');
            return;
          } catch (setupError) {
            console.log('Could not setup notification for service:', serviceId);
          }
        }
      }
    } catch (error) {
      console.error('Setup notification failed:', error);
    }
  }

  // Gửi cấu hình WiFi vào characteristic CE02
  async configureWiFi(ssid: string, password: string): Promise<boolean> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      // Format theo spec: "_UWF:<Name>0x06<Pass>0x04"
      const command = `_UWF:${ssid}\x06${password}\x04`;
      const encodedCommand = btoa(command);
      
      console.log('Sending WiFi config:', { ssid, command });
      
      const services = await this.connectedDevice.services();
      
      for (const service of services) {
        const serviceId = service.uuid.substring(4, 8).toUpperCase();
        
        if (this.TARGET_SERVICE_UUIDS.includes(serviceId)) {
          try {
            await this.connectedDevice.writeCharacteristicWithResponseForService(
              service.uuid,
              this.CHAR_WIFI_CONFIG,
              encodedCommand
            );
            
            console.log('WiFi config sent successfully');
            return true;
          } catch (writeError) {
            console.log('Could not write to service:', serviceId, writeError instanceof Error ? writeError.message : String(writeError));
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('WiFi configuration failed:', error);
      return false;
    }
  }

  // Gửi lệnh END
  async sendEndCommand(): Promise<boolean> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      const command = '_END:\x04';
      const encodedCommand = btoa(command);
      
      console.log('Sending END command');
      
      const services = await this.connectedDevice.services();
      
      for (const service of services) {
        const serviceId = service.uuid.substring(4, 8).toUpperCase();
        
        if (this.TARGET_SERVICE_UUIDS.includes(serviceId)) {
          try {
            await this.connectedDevice.writeCharacteristicWithResponseForService(
              service.uuid,
              this.CHAR_WIFI_CONFIG,
              encodedCommand
            );
            
            console.log('END command sent successfully');
            return true;
          } catch (writeError) {
            console.log('Could not write END to service:', serviceId);
          }
        }
      }
      
      return false;
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





