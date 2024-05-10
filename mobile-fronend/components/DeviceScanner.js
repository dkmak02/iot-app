/* eslint-disable prettier/prettier */
import React, {useState, useEffect} from 'react';
import {BleManager} from 'react-native-ble-plx';
import {View, Text, FlatList, TouchableOpacity, StyleSheet} from 'react-native';
import DeviceConnectionForm from './DeviceConnectionForm';
import {btoa, atob} from 'react-native-quick-base64';
import {decode} from 'base-64';
const bleManager = new BleManager();

function DeviceScanner({onDeviceConnect, token}) {
  const [deviceList, setDeviceList] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [assignedDevices, setAssignedDevices] = useState([]);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [header, payload, signature] = token.split('.');
  const decodedPayload = JSON.parse(decode(payload));
  const email = decodedPayload.email;

  const xorEncrypt = (data, key) => {
    const keyLen = key.length;
    let encryptedData = '';

    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % keyLen);
      encryptedData += String.fromCharCode(charCode);
    }

    return encryptedData;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          'https://data-esp32-api.azurewebsites.net/api/getDevices?code=2wEzjUqlpYsKuxWnL_Khl6vICPv4er_AFmQv-hvRm21wAzFuoyuJ_g==',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }

        const data = await response.json();
        data.forEach(device => {
          setAssignedDevices(prevDevices => [...prevDevices, device]);
        });
      } catch (error) {
        console.error('Error getting user devices from the database:', error);
      }
    };

    fetchData();
  }, []);
  useEffect(() => {
    const searchForDevices = () => {
      bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error(error);
          return;
        }
        if (device.name && device.name.includes('esp32')) {
          if (
            !deviceList.some(d => d.id === device.id) &&
            !assignedDevices.some(d => d.id === device.id)
          ) {
            setDeviceList(prevList => [...prevList, device]);
          }
        }
      });
    };

    searchForDevices();

    return () => {
      bleManager.stopDeviceScan();
    };
  }, [deviceList, assignedDevices]);

  const handleDeviceSelect = device => {
    setSelectedDevice(device);
  };
  const checkIfTwinIsConnected = async () => {
    try {
      const response = await fetch(
        'https://data-esp32-api.azurewebsites.net/api/getConnectionState?code=4tQD-5loqODitJS4cSSAAlzc1Jri1ZkEXza59CVDPSUhAzFuExlbeg==',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceId: selectedDevice.name,
          }),
        },
      );
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const data = await response.json();
      const connectionState = data.connectionState;
      return connectionState === 'Connected';
    } catch (error) {
      console.error('Error getting user devices from the database:', error);
    }
  };
  const handleConnect = async (deviceToConnect, ssid, password) => {
    const serviceUUID = '19b10000-e8f2-537e-4f6c-d104768a1214';
    const writeCharacteristicUUID = '19b10002-e8f2-537e-4f6c-d104768a1214';
    const writePasswordCharacteristicUUID =
      '19b10001-e8f2-537e-4f6c-d104768a1214';
    const writeKeyCharacteristicUUID = '19b10003-e8f2-537e-4f6c-d104768a1214';
    const writeKeyLenCharacteristicUUID =
      '19b10004-e8f2-537e-4f6c-d104768a1214';
    const ssidLenUUID = '19b10005-e8f2-537e-4f6c-d104768a1214';
    const passwordLenUUID = '19b10006-e8f2-537e-4f6c-d104768a1214';
    const writeEmailCharacteristicUUID = '19b10007-e8f2-537e-4f6c-d104768a1214';
    const writeEmailLenCharacteristicUUID =
      '19b10008-e8f2-537e-4f6c-d104768a1214';

    let connedtedToWifi = false;
    try {
      setButtonDisabled(true);
      const connectedDevice = await bleManager
        .connectToDevice(deviceToConnect.id)
        .then(d => d.discoverAllServicesAndCharacteristics())
        .then(d => d.services())
        .then(services => services.find(s => s.uuid === serviceUUID))
        .then(service => service.characteristics());

      const ssidChars = connectedDevice.find(
        c => c.uuid === writeCharacteristicUUID,
      );
      const passwordChars = connectedDevice.find(
        c => c.uuid === writePasswordCharacteristicUUID,
      );
      const keyChars = connectedDevice.find(
        c => c.uuid === writeKeyCharacteristicUUID,
      );
      const keyLenChars = connectedDevice.find(
        c => c.uuid === writeKeyLenCharacteristicUUID,
      );
      const ssidLenChars = connectedDevice.find(c => c.uuid === ssidLenUUID);
      const passwordLenChars = connectedDevice.find(
        c => c.uuid === passwordLenUUID,
      );
      const emailChars = connectedDevice.find(
        c => c.uuid === writeEmailCharacteristicUUID,
      );
      const emailLenChars = connectedDevice.find(
        c => c.uuid === writeEmailLenCharacteristicUUID,
      );
      function generateRandomKey(length) {
        const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let key = '';

        for (let i = 0; i < length; i++) {
          const randomIndex = Math.floor(Math.random() * letters.length);
          key += letters.charAt(randomIndex);
        }

        return key;
      }
      const key = generateRandomKey(16);

      console.log('key', key);
      console.log('ssid', ssid);
      console.log('password', password);
      const newSsid = ssid + '';
      const newPassword = password + '';
      const encryptedSSID = xorEncrypt(newSsid, '-=[;//.,;-=/.]][;;]]');
      const encryptedPassword = xorEncrypt(newPassword, '-=[;//.,;-=/.]][;;]]');
      const encryptedEmail = xorEncrypt(email, '-=[;//.,;-=/.]][;;]]');
      const encryptedKey = xorEncrypt(key, '-=[;//.,;-=/.]][;;]]');

      const ssidData = `${encryptedSSID}`;
      const passwordData = `${encryptedPassword}`;
      const keyData = `${encryptedKey}`;
      const keyLenData = `${encryptedKey.length}`;
      const ssidLenData = `${encryptedSSID.length}`;
      const passwordLenData = `${encryptedPassword.length}`;
      const emailData = `${encryptedEmail}`;
      const emailLenData = `${encryptedEmail.length}`;
      const ssidLenBase64Data = btoa(ssidLenData);
      const passwordLenBase64Data = btoa(passwordLenData);
      const ssidBase64Data = btoa(ssidData);
      const passwordBase64Data = btoa(passwordData);
      const keyBase64Data = btoa(keyData);
      const keyLenBase64Data = btoa(keyLenData);
      const email64Data = btoa(emailData);
      const emailLenBase64Data = btoa(emailLenData);
      await ssidLenChars.writeWithResponse(ssidLenBase64Data);
      await passwordLenChars.writeWithResponse(passwordLenBase64Data);
      await keyLenChars.writeWithResponse(keyLenBase64Data);
      await emailLenChars.writeWithResponse(emailLenBase64Data);

      await ssidChars.writeWithResponse(ssidBase64Data);
      await passwordChars.writeWithResponse(passwordBase64Data);
      await emailChars.writeWithResponse(email64Data);
      await keyChars.writeWithResponse(keyBase64Data);
      console.log(encryptedSSID, encryptedPassword);
      const startTime = Date.now();
      await new Promise(resolve => {
        const intervalId = setInterval(async () => {
          try {
            const isConnected = await checkIfTwinIsConnected();

            if (isConnected) {
              alert('Device connected');
              connedtedToWifi = true;
              onDeviceConnect(deviceToConnect);
              clearInterval(intervalId);
              resolve();
            }
          } catch (error) {
            console.error('Error checking connection status', error);
          }

          if (Date.now() - startTime >= 30000) {
            clearInterval(intervalId);
            resolve();
          }
        }, 500);
      });
    } catch (error) {
      console.error('Error connecting to the device', error);
    } finally {
      setButtonDisabled(false);
    }
    if (!connedtedToWifi) {
      alert('Device not connected');
    }
    console.log(
      `Connecting to ${deviceToConnect.name} with SSID: ${ssid} and Password: ${password}`,
    );
  };

  const handleClose = () => {
    setSelectedDevice(null);
  };

  return (
    <View style={styles.container}>
      {selectedDevice ? (
        <DeviceConnectionForm
          device={selectedDevice}
          onConnect={handleConnect}
          onClose={handleClose}
          disabled={buttonDisabled}
        />
      ) : deviceList.length === 0 ? (
        <Text style={styles.noDevicesText}>No devices found</Text>
      ) : (
        <FlatList
          data={deviceList}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.device}
              onPress={() => handleDeviceSelect(item)}>
              <Text>
                {item.name} (ID: {item.id})
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
  },
  device: {
    backgroundColor: 'lightgrey',
    padding: 10,
    marginVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    width: '90%',
  },
  noDevicesText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default DeviceScanner;
