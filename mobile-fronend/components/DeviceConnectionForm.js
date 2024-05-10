/* eslint-disable prettier/prettier */
import React, {useState} from 'react';
import {useEffect} from 'react';
import {View, Text, TextInput, Button, StyleSheet} from 'react-native';

function DeviceConnectionForm({device, onConnect, onClose, disabled}) {
  const [ssid, setSSID] = useState('');
  const [password, setPassword] = useState('');

  const handleConnect = async () => {
    if (!ssid || !password) {
      alert('Missing SSID or password');
      return;
    }

    await onConnect(device, ssid, password);
    onClose();
  };
  const setRestartToFalse = async () => {
    try {
      await fetch(
        'https://data-esp32-api.azurewebsites.net/api/updateDeviceTwin?code=_V5s61BrUro6npiTF4rwa2b2zYdlp5n5MxPh839-0CxLAzFuR54SDg==',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceId: device.name,
            desiredRestart: 'false',
          }),
        },
      );
    } catch (error) {
      console.error('Error setting restart to true:', error);
    }
  };
  useEffect(() => {
    setRestartToFalse();
  }, []);

  return (
    <View style={styles.container}>
      <Text>Device: {device.name}</Text>
      <Text>Enter SSID:</Text>
      <TextInput
        style={styles.input}
        onChangeText={text => setSSID(text)}
        value={ssid}
      />
      <Text>Enter Password:</Text>
      <TextInput
        style={styles.input}
        onChangeText={text => setPassword(text)}
        value={password}
        secureTextEntry
      />
      <Button title="Connect" onPress={handleConnect} disabled={disabled} />
      <Button title="Close" onPress={onClose} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: 'gray',
    padding: 8,
    width: 200,
    marginBottom: 10,
  },
});

export default DeviceConnectionForm;
