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

  useEffect(() => {
    return () => {
      BLEManager.stopScan();
    };
  }, []);

  const startScan = async () => {
    try {
      setDevices([]);
      setIsScanning(true);

      const isBluetoothReady = await BLEManager.checkBluetoothState();
      if (!isBluetoothReady) {
        Alert.alert('Bluetooth Error', 'Please enable Bluetooth to scan for devices');
        setIsScanning(false);
        return;
      }

      await BLEManager.scanForDevices((device) => {
        setDevices((prev) => {
          // Tránh duplicate devices
          const exists = prev.find(d => d.id === device.id);
          if (exists) {
            return prev;
          }
          return [...prev, device].sort((a, b) => b.rssi - a.rssi); // Sort by signal strength
        });
      });

      // Auto stop scanning after 10 seconds
      setTimeout(() => {
        setIsScanning(false);
      }, 10000);

    } catch (error) {
      console.error('Scan failed:', error);
      Alert.alert('Scan Error', 'Failed to scan for devices');
      setIsScanning(false);
    }
  };

  const connectToDevice = async (device: ESP32Device) => {
    try {
      setIsConnecting(true);
      BLEManager.stopScan();
      setIsScanning(false);

      const success = await BLEManager.connectToDevice(device.id);
      
      if (success) {
        // Đọc Serial Number để verify device
        const serialNumber = await BLEManager.readSerialNumber();
        
        const deviceWithSN = {
          ...device,
          serialNumber: serialNumber || undefined,
        };

        onDeviceSelected(deviceWithSN);
      } else {
        Alert.alert('Connection Failed', 'Could not connect to the device');
      }
    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert('Connection Error', 'An error occurred while connecting');
    } finally {
      setIsConnecting(false);
    }
  };

  const renderDevice = ({ item }: { item: ESP32Device }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => connectToDevice(item)}
      disabled={isConnecting}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name}</Text>
        <Text style={styles.deviceDetails}>
          ID: {item.id.substring(0, 8)}... | Signal: {item.rssi} dBm
        </Text>
      </View>
      {isConnecting && (
        <ActivityIndicator size="small" color="#007AFF" />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ESP32 Devices</Text>
        <TouchableOpacity
          style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
          onPress={startScan}
          disabled={isScanning || isConnecting}
        >
          {isScanning ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.scanButtonText}>
              {devices.length > 0 ? 'Refresh' : 'Start Scan'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {isScanning && devices.length === 0 && (
        <View style={styles.scanningContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.scanningText}>Scanning for ESP32 devices...</Text>
        </View>
      )}

      {devices.length > 0 && (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.id}
          renderItem={renderDevice}
          style={styles.deviceList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {!isScanning && devices.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No ESP32 devices found</Text>
          <Text style={styles.emptySubtext}>
            Make sure your device is in pairing mode and try scanning again
          </Text>
        </View>
      )}
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
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  scanButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  scanButtonDisabled: {
    backgroundColor: '#ccc',
  },
  scanButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  scanningContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  scanningText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  deviceList: {
    flex: 1,
    padding: 16,
  },
  deviceItem: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  deviceDetails: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default DeviceScanner;