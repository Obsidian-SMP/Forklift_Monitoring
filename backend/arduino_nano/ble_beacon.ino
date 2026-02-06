/*
 * Forklift BLE Beacon with IMU Sensor Data
 * Arduino Nano 33 IoT - FULLY FIXED VERSION
 */

#include <ArduinoBLE.h>
#include <Arduino_LSM6DS3.h>

// ========== CONFIGURATION ==========
#define BEACON_NAME "Forklift-001"

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

// Battery simulation
int battery = 100;

// Statistics
unsigned long lastUpdate = 0;
unsigned long updateCount = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 5000); // Wait max 5 seconds for Serial
  
  Serial.println("\n==================================================");
  Serial.println("  FORKLIFT BLE BEACON SYSTEM");
  Serial.println("==================================================");
  
  // Initialize IMU
  Serial.print("Initializing IMU... ");
  if (!IMU.begin()) {
    Serial.println("✗ FAILED");
    Serial.println("⚠ WARNING: Running without IMU data");
  } else {
    Serial.println("✓ OK");
  }
  
  // Initialize BLE
  Serial.print("Initializing BLE... ");
  if (!BLE.begin()) {
    Serial.println("✗ FAILED");
    Serial.println("ERROR: Cannot start BLE. Check hardware.");
    while (1) {
      delay(1000);
    }
  }
  Serial.println("✓ OK");
  
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
  
  // Note: TX power control not available in ArduinoBLE for Nano 33 IoT
  // Default TX power (0 dBm) will be used, range ~10-30 meters
  
  // Start advertising
  BLE.advertise();
  
  // Display info
  Serial.println("\n--------------------------------------------------");
  Serial.println("BEACON INFORMATION:");
  Serial.println("--------------------------------------------------");
  Serial.print("Name:        ");
  Serial.println(BEACON_NAME);
  Serial.print("MAC Address: ");
  Serial.println(BLE.address());
  Serial.println("TX Power:    Default (0 dBm - ~10-30m range)");
  Serial.println("--------------------------------------------------");
  Serial.println("\n✓ Beacon is now ADVERTISING");
  Serial.println("✓ Gateways can now detect this beacon\n");
  Serial.println("==================================================\n");
  
  Serial.println("COPY THESE VALUES FOR GATEWAY CONFIGURATION:");
  Serial.println("============================================");
  Serial.print("FORKLIFT_NAME = \"");
  Serial.print(BEACON_NAME);
  Serial.println("\"");
  Serial.print("FORKLIFT_MAC = \"");
  Serial.print(BLE.address());
  Serial.println("\"");
  Serial.println("============================================\n");
}

void loop() {
  // Poll BLE
  BLE.poll();
  
  // Update sensor data every 100ms
  if (millis() - lastUpdate >= 100) {
    lastUpdate = millis();
    updateCount++;
    
    // Read IMU data if available
    if (IMU.accelerationAvailable()) {
      IMU.readAcceleration(accelX, accelY, accelZ);
      
      // Update BLE characteristics
      vibrationX.writeValue(accelX);
      vibrationY.writeValue(accelY);
      vibrationZ.writeValue(accelZ);
      
      // Calculate vibration magnitude
      vibrationMagnitude = sqrt(accelX*accelX + accelY*accelY + accelZ*accelZ);
    }
    
    // For real battery monitoring (example with voltage divider)
    int batteryPin = A0;
    int batteryPercent = map(analogRead(batteryPin), 0, 1023, 0, 100);
    batteryLevel.writeValue(batteryPercent);
    
    // Print status every 5 seconds
    if (updateCount % 50 == 0) {
      Serial.print("📡 Broadcasting | ");
      Serial.print("Accel: ");
      Serial.print(accelX, 2); Serial.print(", ");
      Serial.print(accelY, 2); Serial.print(", ");
      Serial.print(accelZ, 2);
      Serial.print(" | Vibration: ");
      Serial.print(vibrationMagnitude, 2);
      Serial.print(" g | Battery: ");
      Serial.print(battery);
      Serial.println("%");
    }
  }
  
  // Handle BLE central connections (for debugging)
  BLEDevice central = BLE.central();
  if (central) {
    Serial.print("\n✓ Gateway connected: ");
    Serial.println(central.address());
    
    while (central.connected()) {
      // Continue updating data while connected
      if (IMU.accelerationAvailable()) {
        IMU.readAcceleration(accelX, accelY, accelZ);
        vibrationX.writeValue(accelX);
        vibrationY.writeValue(accelY);
        vibrationZ.writeValue(accelZ);
      }
      delay(100);
    }
    
    Serial.println("✗ Gateway disconnected");
  }
}