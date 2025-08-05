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

  useEffect(() => {
    loadDeviceInfo();
  }, []);

  const loadDeviceInfo = async () => {
    try {
      setIsLoading(true);
      
      // Kiểm tra Serial Number với backend (mock)
      if (device.serialNumber) {
        console.log('Checking SN with backend:', device.serialNumber);
        // TODO: Implement backend check
        // const isRegistered = await checkSerialNumberWithBackend(device.serialNumber);
      }

      // Đọc danh sách WiFi
      const wifiNetworks = await BLEManager.readWiFiList();
      setWifiList(wifiNetworks);

    } catch (error) {
      console.error('Load device info failed:', error);
      Alert.alert('Error', 'Failed to load device information');
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

      // Gửi cấu hình WiFi
      const configSuccess = await BLEManager.configureWiFi(ssid, password);
      if (!configSuccess) {
        throw new Error('Failed to send WiFi configuration');
      }

      setConnectionStatus('Waiting for WiFi connection...');
      
      // Mock: Chờ thiết bị kết nối WiFi và gửi "Wifi_OK"
      // TODO: Implement BLE notification subscription để nhận "Wifi_OK"
      await new Promise(resolve => setTimeout(resolve, 3000));

      setConnectionStatus('Finalizing setup...');

      // Gửi lệnh END
      const endSuccess = await BLEManager.sendEndCommand();
      if (!endSuccess) {
        throw new Error('Failed to send END command');
      }

      setConnectionStatus('Setup completed!');

      // Hiển thị thông báo thành công
      Alert.alert(
        'Success',
        'Device has been configured successfully!',
        [
          {
            text: 'Finish',
            onPress: () => {
              BLEManager.disconnectDevice();
              onDeviceAdded();
            },
          },
        ]
      );

    } catch (error) {
      console.error('WiFi setup failed:', error);
      Alert.alert('Setup Failed', 'Failed to configure WiFi. Please try again.');
      setConnectionStatus('Setup failed');
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
            <Text style={styles.loadingText}>Setting up device...</Text>
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
              <Text style={styles.noWifiText}>No WiFi networks found</Text>
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
  noWifiText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
  },
});

export default DeviceDetails;