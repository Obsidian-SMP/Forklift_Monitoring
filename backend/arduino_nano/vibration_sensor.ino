/*
 * Forklift Vibration Sensor - Arduino Nano 33 IoT
 * Sends accelerometer data via Serial to ESP32-CAM for WiFi transmission
 * 
 * Hardware:
 * - Arduino Nano 33 IoT with LSM6DS3 IMU
 * - Serial connection to ESP32-CAM (TX -> RX, GND -> GND)
 * 
 * Wiring:
 * Arduino TX (Pin 1) -> ESP32-CAM RX (GPIO 3)
 * Arduino GND -> ESP32-CAM GND
 * Arduino 5V -> ESP32-CAM 5V (if powering ESP32 from Arduino)
 */

#include <Arduino_LSM6DS3.h>

// ========== CONFIGURATION ==========
#define FORKLIFT_ID "forklift-001"
#define SAMPLE_INTERVAL_MS 100  // Sample every 100ms (10 Hz)
#define SEND_INTERVAL_MS 1000   // Send data every 1 second

// IMU Variables
float accelX, accelY, accelZ;
float vibrationMagnitude = 0;

// Timing
unsigned long lastSample = 0;
unsigned long lastSend = 0;

// Accumulated data for averaging
float sumX = 0, sumY = 0, sumZ = 0;
int sampleCount = 0;

// Battery monitoring (optional - connect to analog pin)
const int BATTERY_PIN = A0;

void setup() {
  // Initialize Serial for ESP32-CAM communication
  Serial.begin(115200);
  while (!Serial && millis() < 3000); // Wait max 3 seconds
  
  Serial.println();
  Serial.println("=======================================");
  Serial.println("  VIBRATION SENSOR - ARDUINO NANO");
  Serial.println("=======================================");
  
  // Initialize IMU
  Serial.print("Initializing IMU... ");
  if (!IMU.begin()) {
    Serial.println("FAILED!");
    Serial.println("ERROR: Cannot start IMU sensor");
    while (1) {
      delay(1000);  // Halt if IMU fails
    }
  }
  Serial.println("OK");
  
  // Configure battery pin
  pinMode(BATTERY_PIN, INPUT);
  
  Serial.println("Forklift ID: " + String(FORKLIFT_ID));
  Serial.println("Sample Rate: " + String(1000/SAMPLE_INTERVAL_MS) + " Hz");
  Serial.println("Send Rate: " + String(1000/SEND_INTERVAL_MS) + " Hz");
  Serial.println("=======================================");
  Serial.println();
  Serial.println("Starting data collection...");
  Serial.println();
}

void loop() {
  unsigned long currentTime = millis();
  
  // Sample IMU data at high frequency
  if (currentTime - lastSample >= SAMPLE_INTERVAL_MS) {
    lastSample = currentTime;
    
    if (IMU.accelerationAvailable()) {
      IMU.readAcceleration(accelX, accelY, accelZ);
      
      // Accumulate for averaging
      sumX += accelX;
      sumY += accelY;
      sumZ += accelZ;
      sampleCount++;
    }
  }
  
  // Send averaged data to ESP32-CAM via Serial
  if (currentTime - lastSend >= SEND_INTERVAL_MS) {
    lastSend = currentTime;
    
    if (sampleCount > 0) {
      // Calculate averages
      float avgX = sumX / sampleCount;
      float avgY = sumY / sampleCount;
      float avgZ = sumZ / sampleCount;
      
      // Calculate magnitude
      vibrationMagnitude = sqrt(avgX*avgX + avgY*avgY + avgZ*avgZ);
      
      // Read battery level (0-100%)
      int batteryRaw = analogRead(BATTERY_PIN);
      int batteryPercent = map(batteryRaw, 0, 1023, 0, 100);
      batteryPercent = constrain(batteryPercent, 0, 100);
      
      // Send JSON data via Serial to ESP32-CAM
      // Format: {"fid":"forklift-001","x":0.05,"y":-0.02,"z":0.98,"mag":0.99,"bat":95}
      Serial.print("{\"fid\":\"");
      Serial.print(FORKLIFT_ID);
      Serial.print("\",\"x\":");
      Serial.print(avgX, 3);
      Serial.print(",\"y\":");
      Serial.print(avgY, 3);
      Serial.print(",\"z\":");
      Serial.print(avgZ, 3);
      Serial.print(",\"mag\":");
      Serial.print(vibrationMagnitude, 3);
      Serial.print(",\"bat\":");
      Serial.print(batteryPercent);
      Serial.println("}");
      
      // Reset accumulators
      sumX = sumY = sumZ = 0;
      sampleCount = 0;
    }
  }
}
