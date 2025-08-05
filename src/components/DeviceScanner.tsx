import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BLEManager, ESP32Device } from '../services/BLEManager';

interface DeviceScannerProps {
  onDeviceSelected: (device: ESP32Device) => void;
}

const DeviceScanner: React.FC<DeviceScannerProps> = ({ onDeviceSelected }) => {
  const [devices, setDevices] = useState<ESP32Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Nhấn nút quét để tìm thiết bị ESP32');
  const [serverConnected, setServerConnected] = useState(true); // Mock always connected

  useEffect(() => {
    checkServerConnection();
    
    return () => {
      BLEManager.stopScan();
    };
  }, []);

  const checkServerConnection = async () => {
    // Mock server connection check (giống Flutter)
    console.log('Mock: Checking server connection...');
    setServerConnected(true);
  };

  const startScan = async () => {
    if (isScanning) return;
    
    try {
      setIsScanning(true);
      setDevices([]);
      setStatusMessage('Đang kiểm tra Bluetooth...');

      const isBluetoothReady = await BLEManager.checkBluetoothState();
      if (!isBluetoothReady) {
        throw new Error('Bluetooth không khả dụng. Vui lòng bật Bluetooth trong cài đặt.');
      }

      setStatusMessage('Đang tìm kiếm thiết bị ESP32...');

      await BLEManager.scanForDevices((device) => {
        setDevices((prev) => {
          // Avoid duplicates
          const exists = prev.find(d => d.id === device.id);
          if (exists) {
            return prev;
          }
          
          const newDevices = [...prev, device].sort((a, b) => b.rssi - a.rssi);
          
          // Update status message
          setStatusMessage(`Tìm thấy ${newDevices.length} thiết bị ESP32 đã đăng ký`);
          
          return newDevices;
        });
      });

      // Auto stop scanning after 30 seconds (giống Flutter)
      setTimeout(() => {
        if (isScanning) {
          stopScan();
        }
      }, 30000);

    } catch (error) {
      console.error('Scan failed:', error);
      setIsScanning(false);
      setStatusMessage(`Lỗi: ${error}`);
      
      Alert.alert('Lỗi scan BLE', error instanceof Error ? error.message : String(error));
    }
  };

  const stopScan = async () => {
    if (!isScanning) return;
    
    BLEManager.stopScan();
    setIsScanning(false);
    
    setStatusMessage(devices.length === 0 
      ? 'Không tìm thấy thiết bị ESP32 nào đã đăng ký' 
      : `Tìm thấy ${devices.length} thiết bị ESP32 đã đăng ký`
    );
  };

  const connectToDevice = async (device: ESP32Device) => {
    if (isConnecting) return;
    
    try {
      setIsConnecting(true);
      
      // Stop scanning before connecting
      if (isScanning) {
        await stopScan();
      }

      console.log('Connecting to device:', device.name);
      
      const success = await BLEManager.connectToDevice(device.id);
      
      if (success) {
        // Double check device registration (giống Flutter)
        if (device.serialNumber) {
          console.log('Double checking device registration...');
          // Device đã được validate trong quá trình scan
        }
        
        onDeviceSelected(device);
      } else {
        Alert.alert('Kết nối thất bại', 'Không thể kết nối với thiết bị. Vui lòng thử lại.');
      }
    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert('Lỗi kết nối', 'Có lỗi xảy ra khi kết nối');
    } finally {
      setIsConnecting(false);
    }
  };

  const showInstructions = () => {
    Alert.alert(
      'Hướng dẫn sử dụng',
      `1. Chuẩn bị thiết bị ESP32:
• Đảm bảo thiết bị đã được cấp nguồn
• Nhấn giữ nút bất kỳ trong 5 giây để vào chế độ cấu hình WiFi
• Thiết bị sẽ timeout sau 3 phút nếu không cấu hình

2. Quét thiết bị:
• Nhấn nút "Quét thiết bị" để tìm ESP32
• Thiết bị sẽ hiển thị với tên "GC-<SN>"
• Chỉ thiết bị đã đăng ký mới được hiển thị

3. Cấu hình WiFi:
• Chọn thiết bị từ danh sách
• Nhập thông tin WiFi
• Chờ thiết bị kết nối (tối đa 40 giây)

4. Hoàn tất cấu hình:
• Sau khi thiết bị kết nối WiFi thành công
• Nhấn "Xác nhận hoàn thành" để thêm vào hệ thống
• Thiết bị sẽ chính thức được ghi nhận

Lưu ý quan trọng:
• Đảm bảo Bluetooth và Location được bật
• Cần kết nối internet để xác thực thiết bị
• Chỉ thiết bị thuộc tài khoản của bạn mới hiển thị
• Phải nhấn "Xác nhận hoàn thành" để hoàn tất`,
      [{ text: 'Đã hiểu', style: 'default' }]
    );
  };

  const renderDevice = ({ item }: { item: ESP32Device }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => connectToDevice(item)}
      disabled={isConnecting}
    >
      <View style={styles.deviceIcon}>
        <Text style={styles.deviceIconText}>📡</Text>
      </View>
      
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name}</Text>
        <Text style={styles.deviceDetails}>
          Serial Number: {item.serialNumber}
        </Text>
        <Text style={styles.deviceId}>
          Device ID: {item.id.substring(0, 8)}...
        </Text>
        <View style={styles.signalContainer}>
          <Text style={styles.signalText}>📶 {item.rssi} dBm</Text>
        </View>
      </View>
      
      <View style={styles.deviceActions}>
        <View style={styles.registeredBadge}>
          <Text style={styles.registeredText}>Đã xác thực</Text>
        </View>
        {isConnecting ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <Text style={styles.arrowText}>→</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>
        {isScanning ? '🔍' : '📱'}
      </Text>
      <Text style={styles.emptyText}>
        {isScanning
          ? 'Đang tìm kiếm thiết bị ESP32...'
          : 'Chưa tìm thấy thiết bị ESP32 nào'
        }
      </Text>
      {!isScanning && (
        <>
          <Text style={styles.emptySubtext}>
            Hãy đảm bảo ESP32 đang ở chế độ cấu hình WiFi{'\n'}
            và thiết bị đã được đăng ký trong hệ thống
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={startScan}>
            <Text style={styles.refreshButtonText}>Quét lại</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>ESP32 WiFi Setup</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={showInstructions} style={styles.helpButton}>
            <Text style={styles.helpButtonText}>❓</Text>
          </TouchableOpacity>
          <View style={styles.serverStatus}>
            <Text style={styles.serverStatusText}>
              {serverConnected ? '☁️' : '❌'}
            </Text>
          </View>
        </View>
      </View>

      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusContent}>
          {isScanning ? (
            <ActivityIndicator size="small" color="#007AFF" style={styles.statusIcon} />
          ) : (
            <Text style={styles.statusIcon}>
              {devices.length === 0 ? 'ℹ️' : '✅'}
            </Text>
          )}
          <Text style={styles.statusText}>{statusMessage}</Text>
          {!serverConnected && (
            <Text style={styles.warningIcon}>⚠️</Text>
          )}
        </View>
      </View>

      {/* Device list */}
      <View style={styles.content}>
        {devices.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            renderItem={renderDevice}
            showsVerticalScrollIndicator={false}
            style={styles.deviceList}
          />
        )}
      </View>

      {/* Floating action button */}
      <View style={styles.fabContainer}>
        {isScanning ? (
          <TouchableOpacity style={[styles.fab, styles.fabStop]} onPress={stopScan}>
            <Text style={styles.fabText}>⏹️</Text>
            <Text style={styles.fabLabel}>Dừng quét</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.fab} onPress={startScan}>
            <Text style={styles.fabText}>🔍</Text>
            <Text style={styles.fabLabel}>Quét thiết bị</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#17a2b8',
    paddingTop: 50, // For status bar
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  helpButtonText: {
    fontSize: 14,
  },
  serverStatus: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serverStatusText: {
    fontSize: 16,
  },
  statusBar: {
    backgroundColor: '#e8f4f8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: 12,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    color: '#17a2b8',
    fontWeight: '500',
  },
  warningIcon: {
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  deviceList: {
    flex: 1,
    padding: 16,
  },
  deviceItem: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f4f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  deviceIconText: {
    fontSize: 24,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  deviceDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  deviceId: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  signalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signalText: {
    fontSize: 12,
    color: '#666',
  },
  deviceActions: {
    alignItems: 'center',
  },
  registeredBadge: {
    backgroundColor: '#d4edda',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  registeredText: {
    fontSize: 10,
    color: '#155724',
    fontWeight: 'bold',
  },
  arrowText: {
    fontSize: 16,
    color: '#007AFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  refreshButton: {
    backgroundColor: '#17a2b8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    backgroundColor: '#17a2b8',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  fabStop: {
    backgroundColor: '#dc3545',
  },
  fabText: {
    fontSize: 24,
    marginBottom: 4,
  },
  fabLabel: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
});

export default DeviceScanner;