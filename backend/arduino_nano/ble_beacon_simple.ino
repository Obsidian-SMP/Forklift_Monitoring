/*
 * Forklift BLE Beacon
 * Arduino Nano 33 IoT
 * 
 * Function: BLE Beacon for RSSI-based positioning system
 * 
 * Note: Vibration monitoring removed (ESP32-CAM gateway faulty)
 * This is a simplified BLE-only beacon for positioning.
 */

#include <ArduinoBLE.h>

// ========== CONFIGURATION ==========
#define BEACON_NAME "Forklift_1"
#define FORKLIFT_ID "forklift_1"        // Matches database ID

// BLE Service and Characteristics
BLEService forkliftService("19B10000-E8F2-537E-4F6C-D104768A1214");

BLEStringCharacteristic forkliftID("19B10001-E8F2-537E-4F6C-D104768A1214", 
                                    BLERead, 20);
BLEIntCharacteristic batteryLevel("19B10005-E8F2-537E-4F6C-D104768A1214", 
                                   BLERead | BLENotify);

// Battery simulation
int battery = 100;

// Timing
unsigned long lastBLEUpdate = 0;

void setup() {
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
  forkliftService.addCharacteristic(batteryLevel);
  
  // Add service
  BLE.addService(forkliftService);
  
  // Set initial values
  forkliftID.writeValue(FORKLIFT_ID);
  batteryLevel.writeValue(battery);
  
  // Start advertising
  BLE.advertise();
}

void loop() {
  unsigned long currentTime = millis();
  
  // Keep BLE beacon active
  BLE.poll();
  
  // Update battery level every 1 second
  if (currentTime - lastBLEUpdate >= 1000) {
    lastBLEUpdate = currentTime;
    
    // Simulate battery level (you can connect actual battery monitor)
    int batteryRaw = analogRead(A0);
    battery = map(batteryRaw, 0, 1023, 0, 100);
    battery = constrain(battery, 0, 100);
    batteryLevel.writeValue(battery);
  }
  
  delay(10);  // Small delay to prevent watchdog issues
}
