import React, { useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
} from 'react-native';
import DeviceScanner from './src/components/DeviceScanner';
import DeviceDetails from './src/components/DeviceDetails';
import { ESP32Device } from './src/services/BLEManager';

const App: React.FC = () => {
  const [selectedDevice, setSelectedDevice] = useState<ESP32Device | null>(null);

  const handleDeviceSelected = (device: ESP32Device) => {
    setSelectedDevice(device);
  };

  const handleBackToScanner = () => {
    setSelectedDevice(null);
  };

  const handleDeviceAdded = () => {
    // Return to scanner with success feedback
    setSelectedDevice(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#17a2b8"
        translucent={false}
      />
      
      {selectedDevice ? (
        <DeviceDetails
          device={selectedDevice}
          onBack={handleBackToScanner}
          onDeviceAdded={handleDeviceAdded}
        />
      ) : (
        <DeviceScanner onDeviceSelected={handleDeviceSelected} />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
});

export default App;