import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BLEManager, ESP32Device } from '../services/BLEManager';

interface DeviceDetailsProps {
  device: ESP32Device;
  onBack: () => void;
  onDeviceAdded: () => void;
}

const DeviceDetails: React.FC<DeviceDetailsProps> = ({
  device,
  onBack,
  onDeviceAdded,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Connected');
  const [wifiList, setWifiList] = useState<string[]>([]);
  const [isWaitingForWifiOK, setIsWaitingForWifiOK] = useState(false);

  useEffect(() => {
    loadDeviceInfo();
    
    // Cleanup khi component unmount
    return () => {
      if (isWaitingForWifiOK) {
        setIsWaitingForWifiOK(false);
      }
    };
  }, []);

  const loadDeviceInfo = async () => {
    try {
      setIsLoading(true);
      setConnectionStatus('Loading device info...');
      
      // Bước 1: Kiểm tra Serial Number với backend
      if (device.serialNumber) {
        setConnectionStatus('Checking device registration...');
        console.log('Checking SN with backend:', device.serialNumber);
        
        const isRegistered = await BLEManager.checkSerialNumberWithBackend(device.serialNumber);
        if (!isRegistered) {
          Alert.alert(
            'Device Not Registered', 
            'This device is not registered or belongs to another user.',
            [{ text: 'OK', onPress: onBack }]
          );
          return;
        }
      }

      // Bước 2: Đọc danh sách WiFi từ characteristic CE01
      setConnectionStatus('Loading WiFi networks...');
      const wifiNetworks = await BLEManager.readWiFiList();
      setWifiList(wifiNetworks);
      
      setConnectionStatus('Ready for WiFi configuration');

    } catch (error) {
      console.error('Load device info failed:', error);
      Alert.alert('Error', 'Failed to load device information');
      setConnectionStatus('Error loading device info');
    } finally {
      setIsLoading(false);
    }
  };

  const configureWiFi = async (ssid: string) => {
    Alert.prompt(
      'WiFi Password',
      `Enter password for "${ssid}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Connect',
          onPress: async (password?: string) => {
            if (password) {
              await performWiFiSetup(ssid, password);
            }
          },
        },
      ],
      'secure-text'
    );
  };

  const performWiFiSetup = async (ssid: string, password: string) => {
    try {
      setIsLoading(true);
      setConnectionStatus('Configuring WiFi...');

      // Bước 1: Setup notification listener để nhận "Wifi_OK"
      await BLEManager.setupWiFiNotification((message: string) => {
        console.log('Received BLE notification:', message);
        
        if (message.includes('Wifi_OK')) {
          console.log('WiFi connection successful!');
          setIsWaitingForWifiOK(false);
          handleWiFiSuccess();
        }
      });

      // Bước 2: Gửi cấu hình WiFi vào characteristic CE02
      const configSuccess = await BLEManager.configureWiFi(ssid, password);
      if (!configSuccess) {
        throw new Error('Failed to send WiFi configuration');
      }

      // Bước 3: Chờ thiết bị kết nối WiFi và gửi "Wifi_OK"
      setConnectionStatus('Waiting for WiFi connection...');
      setIsWaitingForWifiOK(true);
      
      // Timeout sau 40 giây nếu không nhận được Wifi_OK
      setTimeout(() => {
        if (isWaitingForWifiOK) {
          setIsWaitingForWifiOK(false);
          setIsLoading(false);
          setConnectionStatus('WiFi connection timeout');
          Alert.alert(
            'Connection Timeout', 
            'Device could not connect to WiFi within 40 seconds. Please check your WiFi credentials and try again.'
          );
        }
      }, 40000);

    } catch (error) {
      console.error('WiFi setup failed:', error);
      Alert.alert('Setup Failed', 'Failed to configure WiFi. Please try again.');
      setConnectionStatus('Setup failed');
      setIsLoading(false);
      setIsWaitingForWifiOK(false);
    }
  };

  const handleWiFiSuccess = async () => {
    try {
      setConnectionStatus('Finalizing setup...');

      // Bước 4: Gửi lệnh END sau khi nhận được Wifi_OK
      const endSuccess = await BLEManager.sendEndCommand();
      if (!endSuccess) {
        throw new Error('Failed to send END command');
      }

      setConnectionStatus('Setup completed!');

      // Bước 5: Hiển thị thông báo thành công và yêu cầu xác nhận
      Alert.alert(
        'WiFi Configuration Successful',
        'Your device has been configured successfully and is now connected to WiFi. Please confirm to complete the setup.',
        [
          {
            text: 'Finish',
            onPress: () => {
              // Bước 6: Disconnect và báo hoàn thành
              BLEManager.disconnectDevice();
              Alert.alert(
                'Device Added Successfully',
                'Your device has been added to your account and is ready to use.',
                [
                  {
                    text: 'OK',
                    onPress: onDeviceAdded,
                  },
                ]
              );
            },
          },
        ]
      );

    } catch (error) {
      console.error('Finalize setup failed:', error);
      Alert.alert('Setup Error', 'Failed to finalize setup. Please try again.');
      setConnectionStatus('Finalization failed');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = async () => {
    await BLEManager.disconnectDevice();
    onBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={disconnect}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Device Setup</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.deviceCard}>
          <Text style={styles.deviceName}>{device.name}</Text>
          {device.serialNumber && (
            <Text style={styles.serialNumber}>SN: {device.serialNumber}</Text>
          )}
          <Text style={styles.status}>{connectionStatus}</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>
              {isWaitingForWifiOK 
                ? 'Connecting to WiFi... (up to 40 seconds)' 
                : 'Setting up device...'
              }
            </Text>
          </View>
        ) : (
          <View style={styles.wifiSection}>
            <Text style={styles.sectionTitle}>Available WiFi Networks</Text>
            {wifiList.length > 0 ? (
              wifiList.map((ssid, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.wifiItem}
                  onPress={() => configureWiFi(ssid)}
                >
                  <Text style={styles.wifiName}>{ssid}</Text>
                  <Text style={styles.wifiArrow}>→</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyWifiContainer}>
                <Text style={styles.noWifiText}>No WiFi networks found</Text>
                <TouchableOpacity 
                  style={styles.refreshButton}
                  onPress={loadDeviceInfo}
                >
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
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
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  deviceCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  deviceName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  serialNumber: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  status: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  wifiSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  wifiItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  wifiName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  wifiArrow: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  emptyWifiContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  noWifiText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeviceDetails;