/* eslint-disable prettier/prettier */
import React, {useState, useEffect} from 'react';
import {View, StyleSheet, Alert} from 'react-native';
import DeviceScanner from '../components/DeviceScanner';
import TemperatureDisplay from '../components/TemperatureDisplay';
import {jwtDecode} from 'jwt-decode';
import {decode as atob} from 'base-64';
import checkTokenValidity from '../services/checkTokenValid';
import {useNavigation} from '@react-navigation/native';
export default function BluetoothComponent({route}) {
  const {token} = route.params;
  const [header, payload, signature] = token.split('.');
  const decodedPayload = JSON.parse(atob(payload));
  const email = decodedPayload.email;
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isTokenValid, setIsTokenValid] = useState();
  const navigation = useNavigation();
  useEffect(() => {
    const validateToken = async () => {
      try {
        const isValid = await checkTokenValidity(token);
        console.log('Is token valid:', isValid);
        setIsTokenValid(isValid);
      } catch (error) {
        console.error('Error checking token validity:', error);
        setIsTokenValid(false);
      }
    };

    validateToken();
  }, [token]);
  useEffect(() => {
    console.log('Token validity changed:', isTokenValid);

    if (isTokenValid !== undefined && !isTokenValid) {
      Alert.alert('Invalid token', 'Please log in again.');
      navigation.navigate('Login');
    }
  }, [isTokenValid, navigation]);
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
            body: JSON.stringify({
              email,
            }),
          },
        );

        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        const data = await response.json();
        console.log('Data from API:', data);
        data.forEach(device => {
          if (device.owner === email) {
            setSelectedDevice(device);
          }
        });
      } catch (error) {
        console.error('Error getting user devices from the database:', error);
      }
    };

    fetchData();
  }, []);
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
      return connectionState;
    } catch (error) {
      console.error('Error getting user devices from the database:', error);
    }
  };
  const checkIfRestedButtonPressed = async () => {
    if (!selectedDevice) {
      return;
    }
    try {
      const response = await fetch(
        'https://data-esp32-api.azurewebsites.net/api/deleteByButton?code=KjMoMVZKUbyKh9H4z8iHQEDP8jX38aAkc9UPXWugrJJYAzFuM6sOPQ==',
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
      const buttonPressed = data.connectionState;
      if (buttonPressed === true) {
        await handleDeviceDisconnect(selectedDevice.name);
      }
    } catch (error) {
      console.error('Error getting user devices from the database:', error);
    }
  };
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedDevice) {
        checkIfRestedButtonPressed();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedDevice]);

  const handleDeviceDisconnect = async device => {
    console.log('Device disconnected:', device);
    // const twinConnected = await checkIfTwinIsConnected(device.name);
    try {
      await fetch(
        'https://data-esp32-api.azurewebsites.net/api/updateDeviceTwin?code=_V5s61BrUro6npiTF4rwa2b2zYdlp5n5MxPh839-0CxLAzFuR54SDg==',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceId: device,
            desiredRestart: 'true',
          }),
        },
      );
    } catch (error) {
      console.error('Error setting restart to true:', error);
    }
    try {
      await fetch(
        'https://data-esp32-api.azurewebsites.net/api/removeDevice?code=uU4bR1oNHLbmZTjqBUGNcI72tXWaUe5IP19cT0qjRUdVAzFuWDYlyA==',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
          }),
        },
      );
    } catch (error) {
      console.error('Error removing user device from the database:', error);
    }
    try {
      await fetch(
        'https://data-esp32-api.azurewebsites.net/api/setDesiredOnReported?code=wLvwqkFijfVtpV3Z3Sw3wwil-wye4oNA4ZnuVStiueHIAzFuVWbgbA==',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceId: device,
          }),
        },
      );
    } catch (error) {
      console.error('Error removing user device from the database:', error);
    }
    console.log('Device removed from database sert null');
    setSelectedDevice(null);
  };
  const setUsersDeviceInDb = async (deviceId, deviceName) => {
    try {
      await fetch(
        'https://data-esp32-api.azurewebsites.net/api/AddDevice?code=QXavj55oAx0dPu-lDPJ4SqMyWqTDFZnR3puuXBr_UIXhAzFuupm23Q==',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            id: deviceId,
            name: deviceName,
          }),
        },
      );
    } catch (error) {
      console.error('Error setting user device in the database:', error);
    }
  };

  const handleDeviceSelect = async device => {
    try {
      console.log('Device selected:', device.id);
      await setUsersDeviceInDb(device.id, device.name);
      setSelectedDevice(device);
    } catch (error) {
      console.error('Error setting user device in the database', error);
    }
  };

  return (
    <View style={styles.container}>
      {email && selectedDevice ? (
        <TemperatureDisplay
          token={token}
          device={selectedDevice.name}
          onDeviceDisconnect={handleDeviceDisconnect}
        />
      ) : (
        <DeviceScanner onDeviceConnect={handleDeviceSelect} token={token} />
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
});
