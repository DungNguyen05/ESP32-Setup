import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { BLEManager, ESP32Device } from '../services/BLEManager';

interface DeviceDetailsProps {
  device: ESP32Device;
  onBack: () => void;
  onDeviceAdded: () => void;
}

enum SetupState {
  connecting = 'connecting',
  readingWiFiList = 'readingWiFiList',
  configuringWiFi = 'configuringWiFi',
  waitingForConnection = 'waitingForConnection',
  success = 'success',
  error = 'error',
}

const DeviceDetails: React.FC<DeviceDetailsProps> = ({
  device,
  onBack,
  onDeviceAdded,
}) => {
  const [currentState, setCurrentState] = useState<SetupState>(SetupState.connecting);
  const [statusMessage, setStatusMessage] = useState('Đang kết nối với thiết bị...');
  const [availableNetworks, setAvailableNetworks] = useState<string[]>([]);
  const [selectedSSID, setSelectedSSID] = useState('');
  const [password, setPassword] = useState('');
  const [isObscured, setIsObscured] = useState(true);
  const [isCompletingSetup, setIsCompletingSetup] = useState(false);
  const [timeoutTimer, setTimeoutTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    connectToDevice();
    
    return () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
      BLEManager.disconnectDevice();
    };
  }, []);

    const connectToDevice = async () => {
      try {
        setCurrentState(SetupState.connecting);
        setStatusMessage(`Đang kết nối với ${device.name}...`);
    
        console.log('✓ Connected to device, setting up notifications...');
        
        // Step 1: Setup notification listener NGAY LẬP TỨC
        setStatusMessage('Đang thiết lập notifications...');
        
        await BLEManager.setupWiFiNotification((message: string) => {
          console.log('🔔 Received notification:', message);
          
          // QUAN TRỌNG: Check cho message đặc biệt
          if (message === 'WIFI_SUCCESS') {
            console.log('✅ WiFi connection successful notification received!');
            
            // Hiển thị thông báo cho user
            Alert.alert(
              'Thành công! 🎉',
              'Đã nhận được thông báo "Wifi_OK" từ thiết bị!\n\nThiết bị đã kết nối WiFi thành công.',
              [{ text: 'OK' }]
            );
            
            if (timeoutTimer) {
              clearTimeout(timeoutTimer);
              setTimeoutTimer(null);
            }
            onWiFiConnected();
          } else {
            console.log('ℹ  Other notification:', message);
            // Có thể hiển thị notification khác nếu cần
          }
        });
    
        // Step 2: Small delay to ensure notifications are ready
        await new Promise(resolve => setTimeout(resolve, 1000));
    
        // Step 3: Read WiFi list
        setStatusMessage('Notifications đã sẵn sàng, đang đọc WiFi list...');
        readWiFiList();
    
      } catch (error) {
        console.error('Connection setup failed:', error);
        setCurrentState(SetupState.error);
        setStatusMessage('Không thể kết nối với thiết bị. Vui lòng thử lại.');
      }
    };

  const readWiFiList = async () => {
    try {
      setCurrentState(SetupState.readingWiFiList);
      setStatusMessage('Đang đọc danh sách WiFi có sẵn...');

      // Add delay for better UX
      await new Promise(resolve => setTimeout(resolve, 1000));

      const networks = await BLEManager.readWiFiList();

      setAvailableNetworks(networks);
      setCurrentState(SetupState.configuringWiFi);
      setStatusMessage('Vui lòng nhập thông tin WiFi để cấu hình cho thiết bị');
    } catch (error) {
      console.error('Read WiFi list failed:', error);
      setCurrentState(SetupState.error);
      setStatusMessage('Không thể đọc danh sách WiFi từ thiết bị.');
    }
  };

  const selectNetworkFromList = (network: string) => {
    setSelectedSSID(network);
  };

  const sendWiFiCredentials = async () => {
    if (!selectedSSID.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên WiFi');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập mật khẩu WiFi');
      return;
    }

    console.log('=== User clicked Send WiFi Credentials ===');
    console.log('SSID:', `"${selectedSSID}"`);
    console.log('Password:', `"${password.replace(/./g, '*')}"`);

    setCurrentState(SetupState.waitingForConnection);
    setStatusMessage('Đang chuẩn bị gửi thông tin WiFi...');

    try {
      // Small delay to ensure notifications are ready
      await new Promise(resolve => setTimeout(resolve, 500));

      setStatusMessage('Đang gửi thông tin WiFi cho thiết bị...');

      console.log('Step 2: Sending WiFi credentials...');
      const sent = await BLEManager.configureWiFi(selectedSSID, password);

      if (sent) {
        setStatusMessage('Thiết bị đang kết nối WiFi...\n(Đang chờ thông báo "Wifi_OK", tối đa 40 giây)');

        console.log('✓ WiFi credentials sent, starting 40s timeout timer...');

        // Start timeout timer (40 seconds as per spec)
        const timer = setTimeout(() => {
          if (currentState === SetupState.waitingForConnection) {
            console.log('⏰ TIMEOUT: No Wifi_OK received after 40 seconds');
            showManualProceedDialog();
          }
        }, 40000);
        
        setTimeoutTimer(timer);
      } else {
        setCurrentState(SetupState.error);
        setStatusMessage('Không thể gửi thông tin WiFi. Vui lòng thử lại.');
      }
    } catch (error) {
      console.error('Send WiFi credentials failed:', error);
      setCurrentState(SetupState.error);
      setStatusMessage('Lỗi khi gửi thông tin WiFi. Vui lòng thử lại.');
    }
  };

  const showManualProceedDialog = () => {
    Alert.alert(
      'Timeout - Không nhận được thông báo',
      'Không nhận được thông báo "Wifi_OK" sau 40 giây.\n\nCó thể thiết bị đã kết nối WiFi thành công nhưng không gửi được thông báo qua BLE.\n\nBạn có muốn tiếp tục hoàn tất cấu hình không?',
      [
        {
          text: 'Hủy',
          onPress: () => {
            setCurrentState(SetupState.error);
            setStatusMessage('Timeout: Thiết bị không thể kết nối WiFi sau 40 giây.\nVui lòng kiểm tra lại thông tin WiFi.');
          },
        },
        {
          text: 'Tiếp tục',
          onPress: () => {
            console.log('📱 User chose to proceed manually after timeout');
            onWiFiConnected();
          },
          style: 'default',
        },
      ]
    );
  };

  const onWiFiConnected = () => {
    console.log('=== WiFi Connected Successfully! ===');
    
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      setTimeoutTimer(null);
    }

    setCurrentState(SetupState.success);
    setStatusMessage('Thiết bị đã kết nối WiFi thành công! 🎉\nVui lòng nhấn "Xác nhận hoàn thành" để thêm thiết bị vào hệ thống.');

    console.log('✓ Moved to success state, waiting for user confirmation...');
  };

  const completeSetup = async () => {
    if (isCompletingSetup) return;

    console.log('=== User clicked Complete Setup ===');

    setIsCompletingSetup(true);
    setStatusMessage('Đang hoàn tất cấu hình...');

    try {
      // Step 1: Send END command
      console.log('Step 1: Sending END command...');
      const endSent = await BLEManager.sendEndCommand();

      if (!endSent) {
        throw new Error('Không thể gửi lệnh kết thúc đến thiết bị');
      }
      console.log('✓ END command sent successfully');

      // Step 2: Add device to system
      console.log('Step 2: Adding device to system...');
      const deviceAdded = await BLEManager.addDeviceToSystem(device);

      if (!deviceAdded) {
        throw new Error('Không thể thêm thiết bị vào hệ thống');
      }
      console.log('✓ Device added to system successfully');

      // Step 3: Disconnect from device
      console.log('Step 3: Disconnecting from device...');
      await BLEManager.disconnectDevice();
      console.log('✓ Disconnected successfully');

      // Step 4: Success
      console.log('✓ Setup completed successfully!');
      
      Alert.alert(
        'Thành công!',
        `Thêm thiết bị ${device.name} thành công!`,
        [
          {
            text: 'OK',
            onPress: onDeviceAdded,
          },
        ]
      );

    } catch (error) {
      console.error('✗ Error completing setup:', error);
      setIsCompletingSetup(false);
      setStatusMessage('Thiết bị đã kết nối WiFi thành công! 🎉\nVui lòng nhấn "Xác nhận hoàn thành" để thêm thiết bị vào hệ thống.');

      Alert.alert(
        'Lỗi hoàn tất cấu hình',
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const retryConnection = () => {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      setTimeoutTimer(null);
    }
    connectToDevice();
  };

  const testNotification = () => {
    console.log('=== TEST: Simulating Wifi_OK notification ===');
    onWiFiConnected();
  };

  const renderStateContent = () => {
    switch (currentState) {
      case SetupState.connecting:
      case SetupState.readingWiFiList:
      case SetupState.waitingForConnection:
        return renderLoadingState();
      case SetupState.configuringWiFi:
        return renderWiFiConfigForm();
      case SetupState.success:
        return renderSuccessState();
      case SetupState.error:
        return renderErrorState();
    }
  };

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#17a2b8" style={styles.loadingIndicator} />
      <Text style={styles.statusText}>{statusMessage}</Text>
      
      {currentState === SetupState.waitingForConnection && (
        <>
          <View style={styles.progressBar}>
            <View style={styles.progressBarFill} />
          </View>
          <Text style={styles.progressText}>Đang chờ thông báo "Wifi_OK"...</Text>
          
          {__DEV__ && (
            <TouchableOpacity style={styles.debugButton} onPress={testNotification}>
              <Text style={styles.debugButtonText}>DEBUG: Simulate Wifi_OK</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );

  const renderWiFiConfigForm = () => (
    <ScrollView style={styles.formContainer} contentContainerStyle={styles.formContent}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cấu hình WiFi</Text>
        <Text style={styles.headerSubtitle}>Thiết bị: {device.name}</Text>
      </View>

      {/* Available networks */}
      {availableNetworks.length > 0 && (
        <View style={styles.networksSection}>
          <Text style={styles.sectionTitle}>Mạng WiFi có sẵn:</Text>
          <ScrollView style={styles.networksList} showsVerticalScrollIndicator={true}>
            {availableNetworks.map((network, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.networkItem,
                  selectedSSID === network && styles.networkItemSelected
                ]}
                onPress={() => selectNetworkFromList(network)}
              >
                <Text style={styles.networkIcon}>📶</Text>
                <Text style={[
                  styles.networkName,
                  selectedSSID === network && styles.networkNameSelected
                ]}>
                  {network}
                </Text>
                {selectedSSID === network && (
                  <Text style={styles.checkIcon}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* WiFi SSID input */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Tên WiFi (SSID)</Text>
        <TextInput
          style={styles.textInput}
          value={selectedSSID}
          onChangeText={setSelectedSSID}
          placeholder="Nhập tên mạng WiFi"
          placeholderTextColor="#999"
        />
      </View>

      {/* WiFi Password input */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Mật khẩu WiFi</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
            placeholder="Nhập mật khẩu WiFi"
            placeholderTextColor="#999"
            secureTextEntry={isObscured}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setIsObscured(!isObscured)}
          >
            <Text style={styles.eyeIcon}>{isObscured ? '👁️' : '🙈'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Submit button */}
      <TouchableOpacity style={styles.submitButton} onPress={sendWiFiCredentials}>
        <Text style={styles.submitButtonIcon}>📡</Text>
        <Text style={styles.submitButtonText}>Gửi thông tin WiFi</Text>
      </TouchableOpacity>

      {/* Info card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoIcon}>ℹ️</Text>
        <Text style={styles.infoText}>
          Thiết bị sẽ thử kết nối WiFi trong 40 giây. Bạn sẽ nhận được thông báo "Wifi_OK" khi hoàn tất.
        </Text>
      </View>
    </ScrollView>
  );

  const renderSuccessState = () => (
    <View style={styles.successContainer}>
      <View style={styles.successIcon}>
        <Text style={styles.successIconText}>✅</Text>
      </View>
      
      <Text style={styles.successTitle}>Thành công!</Text>
      <Text style={styles.successMessage}>{statusMessage}</Text>

      {/* Warning box */}
      <View style={styles.warningCard}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <Text style={styles.warningText}>
          Chỉ khi bạn nhấn "Xác nhận hoàn thành", thiết bị mới được thêm chính thức vào hệ thống.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.completeButton, isCompletingSetup && styles.completeButtonDisabled]}
        onPress={completeSetup}
        disabled={isCompletingSetup}
      >
        {isCompletingSetup ? (
          <>
            <ActivityIndicator size="small" color="white" style={styles.buttonLoader} />
            <Text style={styles.completeButtonText}>Đang xử lý...</Text>
          </>
        ) : (
          <>
            <Text style={styles.completeButtonIcon}>✓</Text>
            <Text style={styles.completeButtonText}>Xác nhận hoàn thành</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <View style={styles.errorIcon}>
        <Text style={styles.errorIconText}>❌</Text>
      </View>
      
      <Text style={styles.errorTitle}>Có lỗi xảy ra</Text>
      <Text style={styles.errorMessage}>{statusMessage}</Text>

      <View style={styles.errorActions}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonIcon}>←</Text>
          <Text style={styles.backButtonText}>Quay lại</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.retryButton} onPress={retryConnection}>
          <Text style={styles.retryButtonIcon}>🔄</Text>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backIcon} onPress={onBack}>
          <Text style={styles.backIconText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Cấu hình WiFi</Text>
        <View style={styles.appBarSpacer} />
      </View>
      
      {renderStateContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#17a2b8',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIconText: {
    fontSize: 24,
    color: 'white',
  },
  appBarTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
  appBarSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingIndicator: {
    marginBottom: 32,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#e9ecef',
    borderRadius: 2,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#17a2b8',
    width: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  debugButton: {
    backgroundColor: '#fd7e14',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  debugButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#17a2b8',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  networksSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#17a2b8',
    marginBottom: 12,
  },
  networksList: {
    maxHeight: 150,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 12,
    backgroundColor: 'white',
  },
  networkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  networkItemSelected: {
    backgroundColor: '#e8f4f8',
  },
  networkIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  networkName: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  networkNameSelected: {
    fontWeight: 'bold',
    color: '#17a2b8',
  },
  checkIcon: {
    fontSize: 16,
    color: '#17a2b8',
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
    color: '#333',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 12,
    backgroundColor: 'white',
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#333',
  },
  eyeButton: {
    padding: 16,
  },
  eyeIcon: {
    fontSize: 20,
  },
  submitButton: {
    backgroundColor: '#17a2b8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  submitButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#cce7ff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#b3d9ff',
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#0056b3',
    lineHeight: 20,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#d4edda',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  successIconText: {
    fontSize: 60,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 16,
  },
  successMessage: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 32,
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#fff3cd',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffeaa7',
    marginBottom: 24,
    width: '100%',
  },
  warningIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
    fontWeight: '500',
    lineHeight: 20,
  },
  completeButton: {
    backgroundColor: '#28a745',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
  },
  completeButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  buttonLoader: {
    marginRight: 12,
  },
  completeButtonIcon: {
    fontSize: 20,
    color: 'white',
    marginRight: 8,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f8d7da',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  errorIconText: {
    fontSize: 60,
  },
  errorTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  errorActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  backButton: {
    backgroundColor: '#6c757d',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonIcon: {
    fontSize: 16,
    color: 'white',
    marginRight: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#17a2b8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonIcon: {
    fontSize: 16,
    color: 'white',
    marginRight: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeviceDetails;