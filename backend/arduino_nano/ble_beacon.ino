/*
 * Forklift BLE Beacon + Vibration Monitor
 * Arduino Nano 33 IoT
 * 
 * Functions:
 * 1. BLE Beacon - Advertises position for RSSI tracking
 * 2. Vibration Monitor - Sends IMU data to ESP32-CAM via Serial
 * 
 * Hardware Connections:
 * - Arduino TX (Pin 1) -> ESP32-CAM RX (GPIO 3)
 * - Arduino GND -> ESP32-CAM GND
 */

#include <ArduinoBLE.h>
#include <Arduino_LSM6DS3.h>

// ========== CONFIGURATION ==========
#define BEACON_NAME "Forklift_1"
#define FORKLIFT_ID "forklift_1"        // For vibration data

// BLE Service and Characteristics
BLEService forkliftService("19B10000-E8F2-537E-4F6C-D104768A1214");

BLEStringCharacteristic forkliftID("19B10001-E8F2-537E-4F6C-D104768A1214", 
                                    BLERead, 20);
BLEFloatCharacteristic vibrationX("19B10002-E8F2-537E-4F6C-D104768A1214", 
                                   BLERead | BLENotify);
BLEFloatCharacteristic vibrationY("19B10003-E8F2-537E-4F6C-D104768A1214", 
                                   BLERead | BLENotify);
BLEFloatCharacteristic vibrationZ("19B10004-E8F2-537E-4F6C-D104768A1214", 
                                   BLERead | BLENotify);
BLEIntCharacteristic batteryLevel("19B10005-E8F2-537E-4F6C-D104768A1214", 
                                   BLERead | BLENotify);

// IMU Variables
float accelX, accelY, accelZ;
float vibrationMagnitude = 0;

// Vibration data accumulation for averaging
float sumX = 0, sumY = 0, sumZ = 0;
int sampleCount = 0;

// Battery simulation
int battery = 100;

// Timing
unsigned long lastBLEUpdate = 0;
unsigned long lastSerialSend = 0;
unsigned long updateCount = 0;

void setup() {
  // Initialize Serial for ESP32-CAM communication
  Serial.begin(115200);
  delay(1000);  // Short delay for stability
  
  // Initialize IMU
  if (!IMU.begin()) {
    // IMU failed - halt (critical for this application)
    while (1) {
      delay(1000);
    }
  }
  
  // Initialize BLE
  if (!BLE.begin()) {
    // BLE failed - halt (critical for positioning)
    while (1) {
      delay(1000);
    }
  }
  
  // Configure BLE
  BLE.setLocalName(BEACON_NAME);
  BLE.setDeviceName(BEACON_NAME);
  BLE.setAdvertisedService(forkliftService);
  
  // Add characteristics to service
  forkliftService.addCharacteristic(forkliftID);
  forkliftService.addCharacteristic(vibrationX);
  forkliftService.addCharacteristic(vibrationY);
  forkliftService.addCharacteristic(vibrationZ);
  forkliftService.addCharacteristic(batteryLevel);
  
  // Add service
  BLE.addService(forkliftService);
  
  // Set initial characteristic values
  forkliftID.writeValue(BEACON_NAME);
  vibrationX.writeValue(0.0);
  vibrationY.writeValue(0.0);
  vibrationZ.writeValue(0.0);
  batteryLevel.writeValue(battery);
  
  // Start advertising
  BLE.advertise();
  
  // System ready - minimal output to avoid Serial conflicts
  delay(500);
}

void loop() {
  unsigned long currentTime = millis();
  
  // Keep BLE beacon active
  BLE.poll();
  
  // Update battery level every 1 second
  if (currentTime - lastBLEUpdate >= 1000) {
    lastBLEUpdate = currentTime;
    
    // Simulate battery level
    int batteryRaw = analogRead(A0);
    battery = map(batteryRaw, 0, 1023, 0, 100);
    battery = constrain(battery, 0, 100);
    batteryLevel.writeValue(battery);
  }
  
  delay(10);  // Small delay
}