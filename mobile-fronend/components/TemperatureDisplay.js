/* eslint-disable prettier/prettier */
import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, Button, TextInput} from 'react-native';
import {BleManager} from 'react-native-ble-plx';
import WifiManager from 'react-native-wifi-reborn';
import {btoa} from 'react-native-quick-base64';
import {decode as atob} from 'base-64';
const bleManager = new BleManager();

function TemperatureDisplay({token, device, onDeviceDisconnect}) {
  const [header, payload, signature] = token.split('.');
  const decodedPayload = JSON.parse(atob(payload));
  const email = decodedPayload.email;

  const [disabled, setDisabled] = useState(true);
  const [temp, setTemp] = useState(null);
  const handleDisconnect = async () => {
    console.log('Disconnecting from device', device);
    await onDeviceDisconnect(device);
  };
  function xorDecrypt(data, key) {
    const keyLen = key.length;
    let decryptedData = '';

    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % keyLen);
      decryptedData += String.fromCharCode(charCode);
    }

    return decryptedData;
  }
  const fetchDataFromApi = async () => {
    try {
      const response = await fetch(
        'https://data-esp32-api.azurewebsites.net/api/getData',
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
      const data = await response.json();
      let {temp, enqueuedTime} = data;
      const timeDate = new Date(enqueuedTime);
      const nowDate = new Date();
      if (nowDate - timeDate <= 4000) {
        temp = xorDecrypt(temp, email);
        const roundedTemp = parseFloat(temp).toFixed(4);
        setTemp(`${roundedTemp}C`);
      } else {
        setTemp(null);
      }
    } catch (error) {
      console.error('Error fetching data from the API', error);
    }
  };
  useEffect(() => {
    setTimeout(() => {
      setDisabled(false);
    }, 6000);
  }, []);
  useEffect(() => {
    const fetchDataInterval = setInterval(() => {
      fetchDataFromApi();
    }, 500);
    return () => clearInterval(fetchDataInterval);
  }, []);
  return (
    <View style={styles.container}>
      <View style={styles.userInfoContainer}>
        <Text>User Email: {email}</Text>
        {device ? <Text>Device ID: {device}</Text> : null}
      </View>
      <View style={styles.temperatureContainer}>
        {temp !== null ? (
          <Text>Temperature: {temp}°C</Text>
        ) : (
          <Text>Temperature: N/A</Text>
        )}
      </View>
      <Button
        title="Disconnect"
        onPress={handleDisconnect}
        disabled={disabled}
      />
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
  userInfoContainer: {
    marginBottom: 20,
  },
  temperatureContainer: {
    marginBottom: 20,
  },
});

export default TemperatureDisplay;
