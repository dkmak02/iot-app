#include "mgos.h"
#include "mgos_i2c.h"
#include "mgos_azure.h"
#include "mgos_bt.h"
#include "mgos_bt_gatt.h"
#include "mgos_bt_gatts.h"
#include "mgos_wifi.h"
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include "mongoose.h"
#include "mgos_sys_config.h"
#include "mgos_mqtt.h"
#include "mgos_shadow.h"
#include <time.h>
//DANE DO BT
#define SERVICE_UUID "19b10000-e8f2-537e-4f6c-d104768a1214"
#define WRITE_CHAR_UUID_STR "19b10002-e8f2-537e-4f6c-d104768a1214"
#define WRITE_PASSWORD_STR "19b10001-e8f2-537e-4f6c-d104768a1214"
#define WRITE_KEY_STR "19b10003-e8f2-537e-4f6c-d104768a1214"
#define WRITE_KEYLEN_STR "19b10004-e8f2-537e-4f6c-d104768a1214"
#define WRITE_SSIDLEN_STR "19b10005-e8f2-537e-4f6c-d104768a1214"
#define WRITE_PASSWORDLEN_STR "19b10006-e8f2-537e-4f6c-d104768a1214"
#define WRITE_EMAIL_STR "19b10007-e8f2-537e-4f6c-d104768a1214"
#define WRITE_EmAILLEN_STR "19b10008-e8f2-537e-4f6c-d104768a1214"

static int ssidlen_n = 0;
static int passwordlen_n = 0;
static int keylen_n = 0;
static int emailLen_n = 0;
//FAJNA STRUKTURA DO I2C
const struct mgos_config_i2c cfg = {
  .enable = true,
  .freq = 400,
  .debug = 0,
  .sda_gpio = 21,
  .scl_gpio = 22,
};
static bool connectedToWifi = false;
struct mgos_i2c *myi2c;
//Szyfrowanie
struct EncryptionKey {
    const char *key;
    size_t keyLen;
};
struct Email
{
    const char *email;
};

struct SsidAndPassword {
    const char *ssid;
    const char *password;
};
struct SsidAndPassword ssidAndPassword;
struct EncryptionKey globalKey;
struct Email emailData;
void setSsid(const char *ssid, size_t ssidLen) {
    char *newSsid = malloc(ssidLen + 1);
    if (newSsid != NULL) {
        memcpy(newSsid, ssid, ssidLen);
        newSsid[ssidLen] = '\0'; 
        ssidAndPassword.ssid = newSsid;
    } else {
        LOG(LL_ERROR, ("Failed to allocate memory for SSID."));
    }
}
void setEmail(const char* email, size_t emailLen){
    char *newEmail = malloc(emailLen + 1);
    if (newEmail != NULL) {
        memcpy(newEmail, email, emailLen);
        newEmail[emailLen] = '\0';
        emailData.email = newEmail;
    } else {
        LOG(LL_ERROR, ("Failed to allocate memory for encryption key."));
    }
}
void setPassword(const char *password, size_t passwordLen) {
    char *newPassword = malloc(passwordLen + 1);
    if (newPassword != NULL) {
        memcpy(newPassword, password, passwordLen);
        newPassword[passwordLen] = '\0';
    ssidAndPassword.password = newPassword;
    } else {
        LOG(LL_ERROR, ("Failed to allocate memory for encryption key."));
    }
}
//Ustawianie klucza
void setEncryptionKey(const char *key, size_t keyLen) {
    char *newKey = malloc(keyLen + 1);
    if (newKey != NULL) {
        memcpy(newKey, key, keyLen);
        newKey[keyLen] = '\0';
    //save the key to config
    mgos_sys_config_set_wifi_sta2_ssid(newKey);
    mgos_sys_config_save(&mgos_sys_config, false, NULL);
    //log the key from config
    globalKey.key = newKey;
    globalKey.keyLen = keyLen;
    } else {
        LOG(LL_ERROR, ("Failed to allocate memory for encryption key."));
    }
}
//Funckja szyfrująca
void xorEncrypt(char *data, size_t len, const char *key, size_t keyLen) {
    for (size_t i = 0; i < len; i++) {
        data[i] ^= key[i % keyLen];
    }
}
void xorDecrypt(char *data, size_t len) {
    const char *key = "-=[;//.,;-=/.]][;;]]";
    const size_t keyLen = strlen(key);

    LOG(LL_INFO, ("Decrypting data, %s.", data));

    for (size_t i = 0; i < len; i++) {
        size_t keyIndex = i % keyLen;
        char originalData = data[i];
        char originalKey = key[keyIndex];

        data[i] ^= key[keyIndex];
    }
}
//CZYTANIE TEMPERATURY
static double readTemperature(void) {
  uint8_t data[2];
  if (mgos_i2c_read(myi2c, 0x48, data, sizeof(data), true)) {
    int16_t temperature_raw = (data[0] << 4) | (data[1] >> 4);
    double temperature = temperature_raw * 0.0625;
    return temperature;
  } else {
    return -1000.0; 
  }
}
//URUCHAMIANIE CO ILEŚ TAM SEKUND TAK O
static void timerCallback(void *arg) {
    const char *key = globalKey.key;
    const size_t keyLen = globalKey.keyLen;

   // LOG(LL_INFO, ("Reading temperature. Key: %s, Key Length: %zu", key, keyLen));

    double temp = readTemperature();
    if (temp == -1000.0) {
        LOG(LL_ERROR, ("Failed to read temperature."));
        return;
    }
    char tempStr[20];
    snprintf(tempStr, sizeof(tempStr), "%.6f", temp);  
    LOG(LL_INFO, ("Temperature: %.6f", temp));
    if (strlen(tempStr) < sizeof(tempStr) - 1) {
        xorEncrypt(tempStr, strlen(tempStr), key, keyLen);
        printf("Encrypted Temperature: %s\n", tempStr);

        if (mgos_azure_is_connected()) {
            char props_buf[50];
            char *newKey = malloc(keyLen + 1);
            if (newKey != NULL) {
                memcpy(newKey, key, keyLen);
                newKey[keyLen] = '\0';
            }
            xorEncrypt(newKey, keyLen, key, keyLen);
            LOG(LL_INFO, ("Sending Device-to-Cloud message. Key: %s, Key Length: %zu", newKey, keyLen));
            snprintf(props_buf, sizeof(props_buf), "temperature=%s&owner=%s", tempStr, newKey);
            struct mg_str props = mg_mk_str(props_buf);
            struct mg_str body = mg_mk_str(""); 
            if (!mgos_azure_send_d2c_msg(props, body)) {
                LOG(LL_ERROR, ("Failed to send Device-to-Cloud message."));
            }
            
        } else {
            LOG(LL_ERROR, ("Azure IoT Hub not connected."));
        }
    } else {
        LOG(LL_ERROR, ("Temp string is too long for encryption."));
    }

    (void)arg;
}
//USTAWIANIE WIFI
static bool setupWiFiStation(const char *ssid, const char *password) {
    struct mgos_config_wifi_sta wifi_sta_cfg;
    memset(&wifi_sta_cfg, 0, sizeof(wifi_sta_cfg));

    wifi_sta_cfg.enable = 1;
    wifi_sta_cfg.ssid = ssid;
    wifi_sta_cfg.pass = password;

    bool wifi_setup_result = mgos_wifi_setup_sta(&wifi_sta_cfg);

    if (wifi_setup_result) {
        LOG(LL_INFO, ("WiFi Station credentials set. SSID: %s", ssid));
        mgos_sys_config_set_wifi_sta_ssid(ssid);
        mgos_sys_config_set_wifi_sta_pass(password);
        mgos_sys_config_save(&mgos_sys_config, false, NULL);
    } else {
        LOG(LL_ERROR, ("Failed to set WiFi Station credentials."));
    } 
    return wifi_setup_result;
}
typedef enum {
    STATE_SEARCH_KEY,  
    STATE_PARSE_VALUE, 
    STATE_DONE         
} ParserState;
static bool parse_json_for_key(const char *json, const char *key, char *value, size_t max_len) {
    ParserState state = STATE_SEARCH_KEY;
    size_t key_len = strlen(key);
    size_t value_index = 0;

    while (*json != '\0' && state != STATE_DONE) {
        switch (state) {
            case STATE_SEARCH_KEY:
                if (strncmp(json, key, key_len) == 0) {
                    json += key_len; 
                    state = STATE_PARSE_VALUE;
                } else {
                    json++; 
                }
                break;

            case STATE_PARSE_VALUE:
                if (*json == ':') {
                    json++; 
                    while (*json == ' ' || *json == '\"') json++; 

                    while (*json != '\"' && *json != '\0' && value_index < max_len - 1) {
                        value[value_index++] = *json++;
                    }
                    value[value_index] = '\0';  
                    state = STATE_DONE; 
                } else {
                    json++; 
                }
                break;

            case STATE_DONE:
                break;
        }
    }

    return (state == STATE_DONE);
}
//FUNKCJA DO OBSŁUGI GATT - nasłuchiwanie na dane z telefonu
enum mgos_bt_gatt_status gattsEventHandler(struct mgos_bt_gatts_conn *gatts_conn,
                                           enum mgos_bt_gatts_ev ev,
                                           void *ev_arg, void *handler_arg) {
  struct mgos_bt_uuid write_char_uuid;
  mgos_bt_uuid_from_str(mg_mk_str(WRITE_CHAR_UUID_STR), &write_char_uuid);
  struct mgos_bt_uuid write_password_uuid;
  mgos_bt_uuid_from_str(mg_mk_str(WRITE_PASSWORD_STR), &write_password_uuid);
  struct mgos_bt_uuid write_key_uuid;
  mgos_bt_uuid_from_str(mg_mk_str(WRITE_KEY_STR), &write_key_uuid);
  struct mgos_bt_uuid write_keyLen_uuid;
  mgos_bt_uuid_from_str(mg_mk_str(WRITE_KEYLEN_STR), &write_keyLen_uuid);
  struct mgos_bt_uuid write_ssidLen_uuid;
  mgos_bt_uuid_from_str(mg_mk_str(WRITE_SSIDLEN_STR), &write_ssidLen_uuid);
  struct mgos_bt_uuid write_passwordLen_uuid;
  mgos_bt_uuid_from_str(mg_mk_str(WRITE_PASSWORDLEN_STR), &write_passwordLen_uuid);
  struct mgos_bt_uuid write_email_uuid;
  mgos_bt_uuid_from_str(mg_mk_str(WRITE_EMAIL_STR), &write_email_uuid);
  struct mgos_bt_uuid write_emailLen_uuid;
  mgos_bt_uuid_from_str(mg_mk_str(WRITE_EmAILLEN_STR), &write_emailLen_uuid);
  {
    /* data */
  };
  
  switch (ev) {
    case MGOS_BT_GATTS_EV_WRITE: {
      struct mgos_bt_gatts_write_arg *wa = (struct mgos_bt_gatts_write_arg *)ev_arg;
      if(mgos_bt_uuid_eq(&wa->char_uuid, &write_ssidLen_uuid)){
        char data_copy[256];
        strncpy(data_copy, wa->data.p, wa->data.len);
        ssidlen_n = atoi(data_copy);
        LOG(LL_INFO, ("SSIDLEN: %d", ssidlen_n));
        break;
      }
      if(mgos_bt_uuid_eq(&wa->char_uuid, &write_passwordLen_uuid)){
        char data_copy[256];
        strncpy(data_copy, wa->data.p, wa->data.len);
        passwordlen_n = atoi(data_copy);
        LOG(LL_INFO, ("PASSWORDLEN: %d", passwordlen_n));
        break;
      }
      if(mgos_bt_uuid_eq(&wa->char_uuid, &write_keyLen_uuid)){
        char data_copy[256];
        strncpy(data_copy, wa->data.p, wa->data.len);
        keylen_n = atoi(data_copy);
        LOG(LL_INFO, ("KEYLEN: %d", keylen_n));
        break;
      }
      if(mgos_bt_uuid_eq(&wa->char_uuid, &write_emailLen_uuid)){
        char data_copy[256];
        strncpy(data_copy, wa->data.p, wa->data.len);
        emailLen_n = atoi(data_copy);
        LOG(LL_INFO, ("EMAILLEN: %d", emailLen_n));
        break;
      }
      if (mgos_bt_uuid_eq(&wa->char_uuid, &write_email_uuid)) {
        char data_copy[256];
        strncpy(data_copy, wa->data.p, wa->data.len);
        data_copy[wa->data.len] = '\0';
        xorDecrypt(data_copy, wa->data.len);
        const char *email = data_copy;
        LOG(LL_INFO, ("Email: %s", email));
        setEmail(email, emailLen_n);
        break;
      }
      if (mgos_bt_uuid_eq(&wa->char_uuid, &write_char_uuid)) {
        char data_copy[256];
        strncpy(data_copy, wa->data.p, wa->data.len);
        data_copy[wa->data.len] = '\0';
        LOG(LL_INFO, ("Datdasdasdasdasda: %s", data_copy));
        xorDecrypt(data_copy, ssidlen_n);
        const char *ssidafterdec = data_copy;
        LOG(LL_INFO, ("SSID: %s", ssidafterdec));
        setSsid(ssidafterdec, ssidlen_n);
        break;
      }
      if (mgos_bt_uuid_eq(&wa->char_uuid, &write_password_uuid)) {
        char data_copy[256];
        strncpy(data_copy, wa->data.p, wa->data.len);
        data_copy[wa->data.len] = '\0';
        LOG(LL_INFO, ("Datdasdasdasdasda: %s", data_copy));
        xorDecrypt(data_copy, passwordlen_n);
        const char *password = data_copy;
        LOG(LL_INFO, ("Password: %s", password));
        setPassword(password, passwordlen_n);
        break;
      }
      if (mgos_bt_uuid_eq(&wa->char_uuid, &write_key_uuid)) {
        char data_copy[256];
        strncpy(data_copy, wa->data.p, wa->data.len);
        data_copy[wa->data.len] = '\0';
        xorDecrypt(data_copy, wa->data.len);
        const char *key = data_copy;
        LOG(LL_INFO, ("Key: %s", key));
        setEncryptionKey(key, strlen(key));
        LOG(LL_INFO, ("SSID: %s", ssidAndPassword.ssid));
        LOG(LL_INFO, ("Password: %s", ssidAndPassword.password));
        LOG(LL_INFO, ("Key: %s", globalKey.key));
        LOG(LL_INFO, ("Email: %s", emailData.email));
        setupWiFiStation(ssidAndPassword.ssid, ssidAndPassword.password);
        break;
      }     
    }
    default:
      break;
  }
  return MGOS_BT_GATT_STATUS_OK;
}

//Funkcja do parsowania JSONA
static void parse_json_for_email(const char *json, char *email, size_t max_len) {
    ParserState state = STATE_SEARCH_KEY;
    const char *key = "\"email\"";
    size_t key_len = strlen(key);
    size_t email_index = 0;

    while (*json != '\0' && state != STATE_DONE) {
        switch (state) {
            case STATE_SEARCH_KEY:
                if (strncmp(json, key, key_len) == 0) {
                    json += key_len; 
                    state = STATE_PARSE_VALUE;
                } else {
                    json++; 
                }
                break;

            case STATE_PARSE_VALUE:
                if (*json == ':') {
                    json++; 
                    while (*json == ' ' || *json == '\"') json++; 

                    while (*json != '\"' && *json != '\0' && email_index < max_len - 1) {
                        email[email_index++] = *json++;
                    }
                    email[email_index] = '\0'; 
                    state = STATE_DONE; 
                } else {
                    json++; 
                }
                break;

            case STATE_DONE:
                break;
        }
    }
}
static bool setupClearWifiConfig() {
    struct mgos_config_wifi_sta wifi_sta_cfg;
    memset(&wifi_sta_cfg, 0, sizeof(wifi_sta_cfg));

    wifi_sta_cfg.enable = 0;
    wifi_sta_cfg.ssid = "";
    wifi_sta_cfg.pass = "";

    bool wifi_setup_result = mgos_wifi_setup_sta(&wifi_sta_cfg);

    if (wifi_setup_result) {
        mgos_sys_config_set_wifi_sta_ssid("");
        mgos_sys_config_set_wifi_sta_pass("");
        mgos_sys_config_set_wifi_sta2_ssid("yourEncryptionKey");
        mgos_sys_config_save(&mgos_sys_config, false, NULL);
    } else {
        LOG(LL_ERROR, ("Failed to set WiFi Station credentials."));
    } 
    return wifi_setup_result;
}

//Funkcja do rejestrowania serwisu GATT
static bool registerGattService() {

  struct mgos_bt_gatts_char_def chars[] = {
      {
          .uuid = WRITE_CHAR_UUID_STR,
          .prop = MGOS_BT_GATT_PROP_READ | MGOS_BT_GATT_PROP_WRITE,
          .handler = NULL,
          .handler_arg = NULL,
      },
      {
        .uuid = WRITE_PASSWORD_STR,
        .prop = MGOS_BT_GATT_PROP_READ | MGOS_BT_GATT_PROP_WRITE,
        .handler = NULL,
        .handler_arg = NULL,
      },
      {
        .uuid = WRITE_KEY_STR,
        .prop = MGOS_BT_GATT_PROP_READ | MGOS_BT_GATT_PROP_WRITE,
        .handler = NULL,
        .handler_arg = NULL,
      },
      {
        .uuid = WRITE_KEYLEN_STR,
        .prop = MGOS_BT_GATT_PROP_READ | MGOS_BT_GATT_PROP_WRITE,
        .handler = NULL,
        .handler_arg = NULL,
      },
        {
            .uuid = WRITE_SSIDLEN_STR,
            .prop = MGOS_BT_GATT_PROP_READ | MGOS_BT_GATT_PROP_WRITE,
            .handler = NULL,
            .handler_arg = NULL,
        },
        {
            .uuid = WRITE_PASSWORDLEN_STR,
            .prop = MGOS_BT_GATT_PROP_READ | MGOS_BT_GATT_PROP_WRITE,
            .handler = NULL,
            .handler_arg = NULL,
        },
        {
            .uuid = WRITE_EMAIL_STR,
            .prop = MGOS_BT_GATT_PROP_READ | MGOS_BT_GATT_PROP_WRITE,
            .handler = NULL,
            .handler_arg = NULL,
        },
        {
            .uuid = WRITE_EmAILLEN_STR,
            .prop = MGOS_BT_GATT_PROP_READ | MGOS_BT_GATT_PROP_WRITE,
            .handler = NULL,
            .handler_arg = NULL,
        },
      {
          .uuid = NULL
      },
  };

  return mgos_bt_gatts_register_service(SERVICE_UUID, MGOS_BT_GATT_SEC_LEVEL_NONE,
                                        chars, gattsEventHandler, NULL);
}
static bool connectToWifi() {
  LOG(LL_INFO, ("Connecting to WiFidsadasdasdasdasdasd."));
    struct mgos_config_wifi_sta wifi_sta_cfg;
    memset(&wifi_sta_cfg, 0, sizeof(wifi_sta_cfg));
    wifi_sta_cfg.ssid = mgos_sys_config_get_wifi_sta_ssid();
    wifi_sta_cfg.pass = mgos_sys_config_get_wifi_sta_pass();
    wifi_sta_cfg.enable = 1;

    bool wifi_setup_result = mgos_wifi_setup_sta(&wifi_sta_cfg);

    if (wifi_setup_result) {
        mgos_sys_config_save(&mgos_sys_config, false, NULL);
    } else {
        LOG(LL_ERROR, ("Failed to set WiFi Station credentials."));
    } 
    return wifi_setup_result;
}
//Funkcja inicjalizująca
static void setTimersForApp() {
    mgos_set_timer(1000, MGOS_TIMER_REPEAT, timerCallback, NULL);
}
static void button_handler(int pin, void *arg) {
    if (mgos_azure_is_connected()) {
        time_t current_time;
        struct tm *time_info;
        char date_str[20];

        time(&current_time);
        time_info = localtime(&current_time);
        strftime(date_str, sizeof(date_str), "%Y-%m-%dT%H:%M:%S", time_info);

        if (!mgos_shadow_updatef(0, "{disconnectTime: \"%s\"}", date_str)) {
            LOG(LL_ERROR, ("Failed to update device shadow"));
        }
    } else {
        setupClearWifiConfig();
        mgos_system_restart();
    }
    (void)pin;
    (void)arg;
}

static void wifi_connection_cb(int ev, void *ev_data, void *userdata) {
    switch (ev) {
        case MGOS_WIFI_EV_STA_CONNECTED:
            LOG(LL_INFO, ("Wi-Fi connected and got IP address"));
            connectedToWifi = true;
            break;
        case MGOS_WIFI_EV_STA_DISCONNECTED:
            LOG(LL_INFO, ("Wi-Fi disconnected"));
            break;
    }
    (void) ev_data;
    (void) userdata;
}
static void azure_connection_cb(int ev, void *ev_data, void *userdata) {
    switch (ev) {
        case MGOS_AZURE_EV_CONNECT:
            LOG(LL_INFO, ("Azure IoT Hub connected"));
            break;
    }
    (void) ev_data;
    (void) userdata;
}
static void shadow_callback(int ev, void *ev_data, void *userdata) {
    if (ev == MGOS_SHADOW_CONNECTED) {
        LOG(LL_INFO, ("Device shadow connected to the cloud."));
        mgos_shadow_get();
    } else if ((ev == MGOS_SHADOW_UPDATE_DELTA) || (ev == MGOS_SHADOW_GET_ACCEPTED)) {
        struct mg_str *json_str = (struct mg_str *)ev_data;
        LOG(LL_INFO, ("Received device shadow state: %.*s", (int)json_str->len, json_str->p));
        char restart_value[10]; 
        if (parse_json_for_key(json_str->p, "restart", restart_value, sizeof(restart_value))) {
            bool restart = (strcmp(restart_value, "true") == 0);
            if (restart) {
                if (!mgos_shadow_updatef(0, "{restart: false}")) {
                LOG(LL_ERROR, ("Failed to update device shadow"));
                }
                LOG(LL_INFO, ("Restarting device."));
                setupClearWifiConfig();
                mgos_system_restart();
            }
        } else {
            printf("Key not found or parsing error.\n");
        }

    }
}
enum mgos_app_init_result mgos_app_init(void) {
  myi2c = mgos_i2c_create(&cfg);
  if (myi2c == NULL) {
    LOG(LL_ERROR, ("Failed to initialize I2C."));
    return MGOS_APP_INIT_ERROR;
  }
  if (!registerGattService()) {
    LOG(LL_ERROR, ("Failed to register GATT service."));
    return MGOS_APP_INIT_ERROR;
  }
  if (!mgos_bt_start()) {
    LOG(LL_ERROR, ("Failed to start Bluetooth stack."));
    return MGOS_APP_INIT_ERROR;
  }
  else{
    LOG(LL_INFO, ("Bluetooth stack started."));
  }
  int button_pin = 0;
  mgos_gpio_set_button_handler(button_pin, MGOS_GPIO_PULL_UP, MGOS_GPIO_INT_EDGE_NEG, 50, button_handler, NULL);
  connectToWifi();
  mgos_event_add_group_handler(MGOS_SHADOW_BASE, shadow_callback, NULL);
  mgos_event_add_group_handler(MGOS_WIFI_EV_BASE, azure_connection_cb, NULL);
  setTimersForApp();
  const char *encryptionKey = "yourEncryptionKey";
  const char *ssid = mgos_sys_config_get_wifi_sta2_ssid();
  if (ssid != NULL && strlen(ssid) > 0) {
      encryptionKey = ssid;
      LOG(LL_INFO, ("Encryption key: %s", encryptionKey));
  } else {
      LOG(LL_ERROR, ("WiFi SSID not set. Cannot initialize encryption key."));
  }
  setEncryptionKey(encryptionKey, strlen(encryptionKey));
  return MGOS_APP_INIT_SUCCESS;
} 
