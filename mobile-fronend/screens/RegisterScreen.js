/* eslint-disable prettier/prettier */
import React, {useState} from 'react';
import {View, Text, TextInput, Button, StyleSheet, Alert} from 'react-native';
import {useNavigation} from '@react-navigation/native';
const RegisterScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const secretKey = 'kolejnysmiesnytekstxdf';
  const isEmailValid = email => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const checkEmailExists = async emailToCheck => {
    try {
      const response = await fetch(
        `https://data-esp32-api.azurewebsites.net/api/getUserByEmail?email=${emailToCheck}`,
      );
      const data = await response.json();
      if (response) {
        return data.user ? true : false;
      }
    } catch (error) {
      console.error('Error checking email existence:', error);
      return false;
    }
  };

  const handleRegister = async () => {
    if (!isEmailValid(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (password !== repeatPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 4) {
      Alert.alert(
        'Password too short',
        'Password must be at least 4 characters.',
      );
      return;
    }
    const emailExists = await checkEmailExists(email);

    if (emailExists) {
      Alert.alert('Email Exists', 'This email is already registered.');
      return;
    }

    const document = {
      email,
      password,
    };

    try {
      const response = await fetch(
        'https://data-esp32-api.azurewebsites.net/api/addUser',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(document),
        },
      );

      if (response.ok) {
        console.log('Registration successful');
        let token = await response.json();
        token = token.token;
        navigation.navigate('Bluetooth', {token});
      } else {
        console.error('Registration failed');
      }
    } catch (error) {
      console.error('Error during registration:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="black"
        onChangeText={text => setEmail(text)}
        value={email}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="black"
        secureTextEntry={true}
        onChangeText={text => setPassword(text)}
        value={password}
      />

      <TextInput
        style={styles.input}
        placeholder="Repeat Password"
        placeholderTextColor="black"
        secureTextEntry={true}
        onChangeText={text => setRepeatPassword(text)}
        value={repeatPassword}
      />

      <Button title="Register" onPress={handleRegister} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333333', // Dark Grey Background
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    color: 'white', // White Text
  },
  input: {
    height: 40,
    width: '80%',
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 20,
    paddingLeft: 10,
    backgroundColor: 'white', // White Input Background
    color: 'black', // Black Text
  },
});

export default RegisterScreen;
