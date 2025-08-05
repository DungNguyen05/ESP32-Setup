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

  // ESP32 Service UUIDs theo specs (giống Flutter)
  private readonly TARGET_SERVICE_UUIDS = ['12CE', '12CF'];
  private readonly DEVICE_NAME_PREFIX = 'GC-';
  
  // Characteristics UUIDs (giống Flutter - 4 ký tự cuối)
  private readonly CHAR_WIFI_LIST = 'CE01';     // Read WiFi list
  private readonly CHAR_WIFI_CONFIG = 'CE02';   // Write WiFi config & receive notifications

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

    console.log('Starting BLE scan for devices with GC- prefix...');
    this.manager.stopDeviceScan();

    const foundDevices = new Set<string>();

    // Scan với service UUIDs filter giống Flutter
    this.manager.startDeviceScan(
      this.TARGET_SERVICE_UUIDS.map(uuid => `0000${uuid}-0000-1000-8000-00805F9B34FB`), 
      null, 
      async (error, device) => {
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

        // Extract serial number from name "GC-<SN>"
        const serialNumber = device.name.replace(this.DEVICE_NAME_PREFIX, '');

        // Validate device registration giống Flutter
        const isValid = await this.validateDeviceRegistration(serialNumber);
        
        if (isValid) {
          const esp32Device: ESP32Device = {
            id: device.id,
            name: device.name,
            rssi: device.rssi || -100,
            serialNumber: serialNumber,
          };

          console.log('Found and validated ESP32 device:', esp32Device);
          onDeviceFound(esp32Device);
        } else {
          console.log('Device not registered or invalid:', device.name);
        }
      }
    );
  }

  // Validate device registration (mock - giống Flutter ApiService)
  private async validateDeviceRegistration(serialNumber: string): Promise<boolean> {
    try {
      console.log('Mock: Checking device registration for', serialNumber);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock logic: Accept all devices with pattern ABC123, DEF456, etc.
      const isValid = serialNumber.length >= 3 && 
                     /^[A-Z0-9]+$/.test(serialNumber);
      
      console.log('Mock: Device', serialNumber, 'validation result:', isValid);
      return isValid;
    } catch (error) {
      console.error('Mock: Error checking device registration:', error);
      return true; // Mock: allow for testing
    }
  }

  stopScan(): void {
    console.log('Stopping BLE scan...');
    this.manager.stopDeviceScan();
  }

  async connectToDevice(deviceId: string): Promise<boolean> {
    try {
      console.log('=== ESP32Handler: Connecting to device:', deviceId, '===');
      
      if (this.connectedDevice) {
        await this.disconnectDevice();
      }

      const device = await this.manager.connectToDevice(deviceId, { timeout: 15000 });
      await device.discoverAllServicesAndCharacteristics();
      
      this.connectedDevice = device;
      console.log('✓ Connected to device successfully:', device.name);
      
      return true;
    } catch (error) {
      console.error('✗ Connection failed:', error);
      return false;
    }
  }

  async disconnectDevice(): Promise<void> {
    if (this.connectedDevice) {
      try {
        await this.connectedDevice.cancelConnection();
        console.log('✓ Disconnected from device');
      } catch (error) {
        console.error('✗ Disconnect error:', error);
      } finally {
        this.connectedDevice = null;
      }
    }
  }

  // Đọc danh sách WiFi từ characteristic CE01 (giống Flutter)
  async readWiFiList(): Promise<string[]> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      console.log('Reading WiFi list from CE01...');
      
      const services = await this.connectedDevice.services();
      
      for (const service of services) {
        const serviceUuid = service.uuid.toUpperCase();
        
        // Check if service contains our target UUIDs
        if (this.TARGET_SERVICE_UUIDS.some(uuid => serviceUuid.includes(uuid))) {
          try {
            const fullCharUuid = `0000${this.CHAR_WIFI_LIST}-0000-1000-8000-00805F9B34FB`;
            
            const characteristic = await this.connectedDevice.readCharacteristicForService(
              service.uuid,
              fullCharUuid
            );
            
            if (characteristic.value) {
              const rawData = atob(characteristic.value);
              console.log('WiFi list raw:', rawData);
              console.log('WiFi list bytes:', Array.from(rawData).map(c => '0x' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '));
              
              const networks = this.parseWiFiNetworks(rawData);
              console.log('✓ Parsed', networks.length, 'networks:', networks);
              return networks;
            }
          } catch (readError) {
            console.log('Could not read CE01 from service:', serviceUuid);
          }
        }
      }
      
      console.log('⚠ No CE01 characteristic found, using mock data');
      return ['TestWiFi_1', 'TestWiFi_2', 'MyRouter'];
      
    } catch (error) {
      console.error('✗ Error reading WiFi list:', error);
      return ['ErrorNetwork_1', 'ErrorNetwork_2'];
    }
  }

  // Parse WiFi networks (simplified từ Flutter logic)
  private parseWiFiNetworks(rawData: string): string[] {
    const networks: string[] = [];
    
    // Parse theo 0x06 separator như Flutter
    if (rawData.includes('\x06')) {
      const parts = rawData.split('\x06');
      for (const part of parts) {
        const cleaned = part.replace(/\x00/g, '').trim();
        if (cleaned.length >= 3 && cleaned.length <= 32) {
          networks.push(cleaned);
        }
      }
    } else if (rawData.includes(',')) {
      const parts = rawData.split(',');
      for (const part of parts) {
        const cleaned = part.trim();
        if (cleaned.length >= 3) {
          networks.push(cleaned);
        }
      }
    } else if (rawData.includes('\n')) {
      const parts = rawData.split('\n');
      for (const part of parts) {
        const cleaned = part.trim();
        if (cleaned.length >= 3) {
          networks.push(cleaned);
        }
      }
    } else if (rawData.trim().length >= 3) {
      networks.push(rawData.trim());
    }
    
    return networks.filter((network, index, arr) => arr.indexOf(network) === index);
  }

  // Setup notification listener giống Flutter
  async setupWiFiNotification(callback: (message: string) => void): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    console.log('=== Starting to listen for notifications ===');
    this.notificationCallback = callback;

    try {
      const services = await this.connectedDevice.services();
      let notificationEnabled = false;
      
      for (const service of services) {
        const serviceUuid = service.uuid.toUpperCase();
        
        if (this.TARGET_SERVICE_UUIDS.some(uuid => serviceUuid.includes(uuid))) {
          const fullCharUuid = `0000${this.CHAR_WIFI_CONFIG}-0000-1000-8000-00805F9B34FB`;
          
          try {
            console.log(`Enabling notifications on ${this.CHAR_WIFI_CONFIG}...`);
            
            // QUAN TRỌNG: Subscribe vào notification TRƯỚC khi gửi credentials
            this.connectedDevice.monitorCharacteristicForService(
              service.uuid,
              fullCharUuid,
              (error, characteristic) => {
                if (error) {
                  console.error('✗ Notification error:', error);
                  return;
                }
                
                if (characteristic?.value) {
                  const message = atob(characteristic.value);
                  console.log('🔔 RAW NOTIFICATION:', `"${message}"`);
                  console.log('   Length:', message.length, 'characters');
                  console.log('   Bytes:', Array.from(message).map(c => '0x' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '));
                  
                  // Check for WiFi_OK patterns (giống Flutter)
                  const lowerMessage = message.toLowerCase().trim();
                  const trimmedMessage = message.trim();
                  
                  const isWifiOk = lowerMessage.includes('wifi_ok') || 
                                lowerMessage.includes('wifi ok') ||
                                lowerMessage.includes('wifiok') ||
                                lowerMessage === 'wifi_ok' ||
                                lowerMessage === 'ok' ||
                                trimmedMessage === 'Wifi_OK' ||
                                trimmedMessage === 'wifi_ok' ||
                                trimmedMessage === 'OK';
                  
                  if (isWifiOk) {
                    console.log('✅ WiFi connection successful! Pattern matched:', `"${message}"`);
                    // QUAN TRỌNG: Gọi callback với message đặc biệt
                    this.notificationCallback?.('WIFI_SUCCESS');
                  } else {
                    console.log('ℹ  Other notification (not WiFi_OK):', `"${message}"`);
                    this.notificationCallback?.(message);
                  }
                }
              }
            );
            
            notificationEnabled = true;
            console.log('✓ Notifications enabled on', this.CHAR_WIFI_CONFIG);
            break;
            
          } catch (setupError) {
            console.log('⚠ Failed to enable notifications on service:', serviceUuid);
          }
        }
      }
      
      if (!notificationEnabled) {
        throw new Error('Could not enable notifications');
      } else {
        console.log('✓ Ready to receive "Wifi_OK" notifications!');
      }
      
    } catch (error) {
      console.error('✗ Setup notification failed:', error);
      throw error;
    }
  }

  // Gửi WiFi credentials giống Flutter format
  async configureWiFi(ssid: string, password: string): Promise<boolean> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      console.log('=== Sending WiFi Credentials ===');
      console.log('SSID:', `"${ssid}"`);
      console.log('Password:', `"${password.replace(/./g, '*')}"`);
      
      // Format theo spec giống Flutter: "_UWF:<ssid>0x06<password>0x04"
      const command = `_UWF:${ssid}\x06${password}\x04`;
      const encodedCommand = btoa(command);
      
      console.log('Data to send:');
      console.log('  String representation:', `"_UWF:${ssid}\\x06${password}\\x04"`);
      console.log('  Hex bytes:', Array.from(command).map(c => '0x' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '));
      console.log('  Length:', command.length, 'bytes');
      
      const services = await this.connectedDevice.services();
      
      for (const service of services) {
        const serviceUuid = service.uuid.toUpperCase();
        
        if (this.TARGET_SERVICE_UUIDS.some(uuid => serviceUuid.includes(uuid))) {
          // Di chuyển dòng này RA NGOÀI try block
          const fullCharUuid = `0000${this.CHAR_WIFI_CONFIG}-0000-1000-8000-00805F9B34FB`;
          
          try {
            console.log('Trying writeWithoutResponse...');
            await this.connectedDevice.writeCharacteristicWithoutResponseForService(
              service.uuid,
              fullCharUuid,  // Bây giờ có thể sử dụng
              encodedCommand
            );
            
            console.log('✓ WiFi credentials sent successfully!');
            console.log('Now waiting for "Wifi_OK" notification...');
            return true;
            
          } catch (writeError) {
            console.log('✗ Write failed for service:', serviceUuid, writeError);
            
            // Try with response as backup
            try {
              console.log('Trying writeWithResponse...');
              await this.connectedDevice.writeCharacteristicWithResponseForService(
                service.uuid,
                fullCharUuid,  // Bây giờ có thể sử dụng được
                encodedCommand
              );
              
              console.log('✓ WiFi credentials sent with response!');
              return true;
            } catch (writeError2) {
              console.log('✗ Write with response also failed:', writeError2);
            }
          }
        }
      }
      
      console.log('✗ All write methods failed');
      return false;
      
    } catch (error) {
      console.error('✗ Error sending WiFi credentials:', error);
      return false;
    }
  }

  // Gửi lệnh END giống Flutter
  async sendEndCommand(): Promise<boolean> {
    if (!this.connectedDevice) {
      throw new Error('No device connected');
    }

    try {
      console.log('=== Sending END Command ===');
      
      const command = '_END.*\x04';
      const encodedCommand = btoa(command);
      
      console.log('END command data:');
      console.log('  String: "_END.*\\x04"');
      console.log('  Hex:', Array.from(command).map(c => '0x' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '));
      console.log('  Length:', command.length, 'bytes');
      
      const services = await this.connectedDevice.services();
      
      for (const service of services) {
        const serviceUuid = service.uuid.toUpperCase();
        
        if (this.TARGET_SERVICE_UUIDS.some(uuid => serviceUuid.includes(uuid))) {
          try {
            const fullCharUuid = `0000${this.CHAR_WIFI_CONFIG}-0000-1000-8000-00805F9B34FB`;
            
            await this.connectedDevice.writeCharacteristicWithoutResponseForService(
              service.uuid,
              fullCharUuid,
              encodedCommand
            );
            
            console.log('✓ END command sent successfully');
            return true;
            
          } catch (writeError) {
            console.log('✗ END command failed for service:', serviceUuid);
          }
        }
      }
      
      return false;
      
    } catch (error) {
      console.error('✗ Error sending END command:', error);
      return false;
    }
  }

  // Add device to system (mock giống Flutter ApiService)
  async addDeviceToSystem(device: ESP32Device): Promise<boolean> {
    try {
      console.log('Mock: Adding device to system:');
      console.log('  - Serial Number:', device.serialNumber);
      console.log('  - Device ID:', device.id);
      console.log('  - Name:', device.name);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      console.log('Mock: Device', device.serialNumber, 'added to system successfully');
      return true;
    } catch (error) {
      console.error('Mock: Error adding device to system:', error);
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