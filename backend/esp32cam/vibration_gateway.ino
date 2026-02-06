/*
 * ESP32-CAM Vibration Data Gateway
 * Receives vibration data from Arduino Nano via UART and sends to backend via WiFi
 * 
 * Hardware:
 * - ESP32-CAM (with broken camera - camera NOT used)
 * - Connected to Arduino Nano 33 IoT via Serial
 * 
 * Wiring (3 wires):
 * ═══════════════════════════════════════════════════════════
 * Arduino Nano TX (Pin 1)  →  ESP32-CAM U0R (RX/GPIO 3)  [DATA]
 * Arduino Nano GND         →  ESP32-CAM GND              [GROUND - REQUIRED]
 * Arduino Nano 5V          →  ESP32-CAM 5V               [POWER - Optional]
 * 
 * Pin Label Reference:
 * - U0R on ESP32-CAM = UART0 RX = GPIO 3 ← Connect Arduino TX here
 * - U0T on ESP32-CAM = UART0 TX = GPIO 1 ← Leave disconnected
 * 
 * ⚠️ IMPORTANT:
 * - DO NOT connect Arduino RX to ESP32 U0T/TX (one-way communication only)
 * - Ensure common ground connection
 * - ESP32 needs stable 5V/1A power supply
 * 
 * Configuration:
 * - Update WIFI_SSID and WIFI_PASSWORD below
 * - Update BACKEND_URL if your backend is on different IP
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ========== CONFIGURATION - UPDATE THESE ==========
const char* WIFI_SSID = "YOUR_WIFI_SSID";        // ⚠️ UPDATE THIS
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"; // ⚠️ UPDATE THIS
const char* BACKEND_URL = "http://10.136.57.165:5000/api/forklift";  // Update if different

// ESP32-CAM LED
#define LED_BUILTIN 33

// Serial buffer for receiving data from Arduino
String serialBuffer = "";

// Statistics
unsigned long packetsReceived = 0;
unsigned long packetsSent = 0;
unsigned long sendErrors = 0;
unsigned long lastStatusPrint = 0;

void setup() {
  // Initialize Serial for communication with Arduino Nano
  Serial.begin(115200);
  
  // Initialize LED
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);
  
  // Wait for serial connection
  delay(2000);
  
  Serial.println();
  Serial.println("===============================================");
  Serial.println("  ESP32-CAM VIBRATION DATA GATEWAY");
  Serial.println("===============================================");
  
  // Connect to WiFi
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN)); // Blink during connection
    attempts++;
  }
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal Strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    digitalWrite(LED_BUILTIN, HIGH); // LED on when connected
  } else {
    Serial.println("WiFi Connection FAILED");
    Serial.println("Check credentials and try again");
    digitalWrite(LED_BUILTIN, LOW);
  }
  
  Serial.println("Backend URL: " + String(BACKEND_URL));
  Serial.println("===============================================");
  Serial.println();
  Serial.println("Waiting for data from Arduino Nano...");
  Serial.println();
}

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(LED_BUILTIN, LOW);
    Serial.println("WiFi disconnected! Reconnecting...");
    WiFi.reconnect();
    delay(5000);
    return;
  }
  
  // Read data from Arduino via Serial
  while (Serial.available()) {
    char c = Serial.read();
    
    if (c == '\n' || c == '\r') {
      // End of message - process the buffer
      if (serialBuffer.length() > 0) {
        processVibrationData(serialBuffer);
        serialBuffer = "";  // Clear buffer
      }
    } else {
      serialBuffer += c;
    }
  }
  
  // Print status every 30 seconds
  if (millis() - lastStatusPrint >= 30000) {
    lastStatusPrint = millis();
    printStatus();
  }
  
  delay(10);  // Small delay to prevent watchdog issues
}

void processVibrationData(String jsonData) {
  packetsReceived++;
  
  // Parse JSON from Arduino
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, jsonData);
  
  if (error) {
    Serial.println("JSON Parse Error: " + String(error.c_str()));
    Serial.println("Raw data: " + jsonData);
    return;
  }
  
  // Extract data
  String forkliftId = doc["fid"];
  float accelX = doc["x"];
  float accelY = doc["y"];
  float accelZ = doc["z"];
  float magnitude = doc["mag"];
  int battery = doc["bat"];
  
  // Print received data
  Serial.print("Received: ");
  Serial.print(forkliftId);
  Serial.print(" | Accel: (");
  Serial.print(accelX, 2); Serial.print(", ");
  Serial.print(accelY, 2); Serial.print(", ");
  Serial.print(accelZ, 2);
  Serial.print(") | Mag: ");
  Serial.print(magnitude, 2);
  Serial.print("g | Bat: ");
  Serial.print(battery);
  Serial.println("%");
  
  // Send to backend
  sendToBackend(forkliftId, accelX, accelY, accelZ, magnitude, battery);
}

void sendToBackend(String forkliftId, float x, float y, float z, float mag, int battery) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Cannot send: WiFi not connected");
    sendErrors++;
    return;
  }
  
  HTTPClient http;
  
  // Build URL
  String url = String(BACKEND_URL) + "/" + forkliftId + "/data";
  
  // Start HTTP POST
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  // Build JSON payload
  StaticJsonDocument<256> payload;
  payload["vibration_x"] = x;
  payload["vibration_y"] = y;
  payload["vibration_z"] = z;
  payload["magnitude"] = mag;
  payload["battery_level"] = battery;
  
  String jsonString;
  serializeJson(payload, jsonString);
  
  // Send POST request
  int httpCode = http.POST(jsonString);
  
  if (httpCode > 0) {
    if (httpCode == HTTP_CODE_OK || httpCode == 201) {
      packetsSent++;
      digitalWrite(LED_BUILTIN, LOW);
      delay(50);
      digitalWrite(LED_BUILTIN, HIGH);  // Quick blink on success
    } else {
      Serial.print("HTTP Error: ");
      Serial.println(httpCode);
      sendErrors++;
    }
  } else {
    Serial.print("HTTP Request Failed: ");
    Serial.println(http.errorToString(httpCode));
    sendErrors++;
  }
  
  http.end();
}

void printStatus() {
  Serial.println();
  Serial.println("=== STATUS ===");
  Serial.print("WiFi: ");
  Serial.print(WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected");
  Serial.print(" (RSSI: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm)");
  Serial.print("Packets Received: ");
  Serial.println(packetsReceived);
  Serial.print("Packets Sent: ");
  Serial.println(packetsSent);
  Serial.print("Send Errors: ");
  Serial.println(sendErrors);
  Serial.print("Success Rate: ");
  if (packetsReceived > 0) {
    Serial.print((packetsSent * 100.0) / packetsReceived);
    Serial.println("%");
  } else {
    Serial.println("N/A");
  }
  Serial.println("==============");
  Serial.println();
}
