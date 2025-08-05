import React, { useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Alert,
} from 'react-native';
import DeviceScanner from './src/components/DeviceScanner';
import DeviceDetails from './src/components/DeviceDetails';
import { ESP32Device } from './src/services/BLEManager';

type Screen = 'scanner' | 'details';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('scanner');
  const [selectedDevice, setSelectedDevice] = useState<ESP32Device | null>(null);

  const handleDeviceSelected = (device: ESP32Device) => {
    setSelectedDevice(device);
    setCurrentScreen('details');
  };

  const handleBack = () => {
    setSelectedDevice(null);
    setCurrentScreen('scanner');
  };

  const handleDeviceAdded = () => {
    Alert.alert(
      'Success',
      'Device has been added successfully!',
      [
        {
          text: 'OK',
          onPress: () => {
            setSelectedDevice(null);
            setCurrentScreen('scanner');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {currentScreen === 'scanner' && (
        <DeviceScanner onDeviceSelected={handleDeviceSelected} />
      )}
      
      {currentScreen === 'details' && selectedDevice && (
        <DeviceDetails
          device={selectedDevice}
          onBack={handleBack}
          onDeviceAdded={handleDeviceAdded}
        />
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