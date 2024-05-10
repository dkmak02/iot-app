/* eslint-disable prettier/prettier */
const checkTokenValidity = async token => {
  try {
    const response = await fetch(
      'https://data-esp32-api.azurewebsites.net/api/checkTokenValid?code=8cs97j-bfEf1Jy4yAKI2t9FOu8P4w1SpWuxEV5QuwF4zAzFuPwKi3w==',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
        }),
      },
    );
    console.log(token);
    if (!response.ok) {
      throw new Error('Failed to check token validity');
    }
    const data = await response.json();
    if (!data.isValid) {
      console.log('Token is not valid');
    }

    return data.isValid;
  } catch (error) {
    console.error('Error checking token validity:', error);
  }
};
export default checkTokenValidity;
