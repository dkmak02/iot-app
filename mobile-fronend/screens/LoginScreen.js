/* eslint-disable prettier/prettier */
import React, {useState} from 'react';
import {View, Text, TextInput, Button, StyleSheet, Alert} from 'react-native';
import {useNavigation} from '@react-navigation/native';

const LoginScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  let token = '';
  const checkCredentials = async (emailToCheck, passwordToCheck) => {
    try {
      const response = await fetch(
        'https://data-esp32-api.azurewebsites.net/api/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: emailToCheck,
            password: passwordToCheck,
          }),
        },
      );
      if (response) {
        const data = await response.json();
        token = data.token;
        return response.status === 200;
      }
    } catch (error) {
      console.error('Error checking credentials:', error);
      return false;
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Credentials', 'Please enter all fields.');
      return;
    }

    const credentialsValid = await checkCredentials(email, password);

    if (credentialsValid) {
      Alert.alert('Login Successful', 'Welcome back!');
      navigation.navigate('Bluetooth', {token});
    } else {
      Alert.alert('Invalid Credentials', 'Incorrect email or password.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

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

      <Button title="Login" onPress={handleLogin} />

      <Text style={styles.signupText}>
        Don't have an account?{' '}
        <Text
          style={styles.signupLink}
          onPress={() => navigation.navigate('Register')}>
          Sign up here
        </Text>
      </Text>
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
  signupText: {
    marginTop: 20,
    color: 'white', // White Text
  },
  signupLink: {
    color: 'blue', // Blue Text
  },
});

export default LoginScreen;
