// ==============================================================================
// File: edge_firmware/android_gateway/GatewayScannerService.kt
// Description: Industrial Android BLE Scanner Foreground Service for Gateway Anchors.
// Purpose: Continuous low-latency BLE scan capturing Arduino Nano 33 IoT RSSI
//          and decoding packed LSM6DS3 IMU telemetry from advertising manufacturer
//          data. Transmits structured JSON to the laptop edge server at up to 10 Hz
//          with configurable transmission modes (Raw vs Smoothed) and broadcasts
//          real-time metrics to MainActivity.
// ==============================================================================

package com.warehouse.iot.gateway

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.nio.ByteBuffer
import java.nio.ByteOrder

class GatewayScannerService : Service() {

    companion object {
        const val TAG = "GatewayScannerService"
        const val CHANNEL_ID = "WarehouseGatewayScanChannel"
        const val NOTIFICATION_ID = 2001

        const val ACTION_RSSI_UPDATE = "com.warehouse.iot.BLE_RSSI_UPDATE"
        const val ACTION_SCAN_COUNT = "com.warehouse.iot.BLE_SCAN_COUNT"

        const val TARGET_COMPANY_ID = 0xFFFF
    }

    private lateinit var settingsManager: SettingsManager
    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bleScanner: BluetoothLeScanner? = null
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private var scanCount = 0
    private var detectionCount = 0
    private val rssiBuffer = mutableListOf<Int>()

    private var lastTransmitTime = 0L
    private val minTransmitIntervalMs = 100L // 10 Hz upstream cap to prevent TCP queue buildup

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
            result?.let { handleScanResult(it) }
        }

        override fun onBatchScanResults(results: MutableList<ScanResult>?) {
            results?.lastOrNull()?.let { handleScanResult(it) }
        }

        override fun onScanFailed(errorCode: Int) {
            Log.e(TAG, "BLE Scan failed with errorCode: $errorCode")
        }
    }

    override fun onCreate() {
        super.onCreate()
        settingsManager = SettingsManager(this)

        val bluetoothManager = getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        bluetoothAdapter = bluetoothManager.adapter
        bleScanner = bluetoothAdapter?.bluetoothLeScanner

        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i(TAG, "Starting Gateway Scanner Service for anchor: ${settingsManager.gatewayId}")
        startForeground(NOTIFICATION_ID, buildForegroundNotification("Initializing BLE radio..."))
        startBleScan()

        // 1 Hz heartbeat timer to track total scan time and tick scan count
        serviceScope.launch {
            while (isActive) {
                delay(1000)
                scanCount++
                val tickIntent = Intent(ACTION_SCAN_COUNT).apply {
                    putExtra("scans_count", scanCount)
                    putExtra("detections_count", detectionCount)
                }
                sendBroadcast(tickIntent)
            }
        }

        return START_STICKY
    }

    private fun startBleScan() {
        if (bleScanner == null) {
            Log.e(TAG, "BluetoothLeScanner is unavailable on this device.")
            stopSelf()
            return
        }

        val scanSettings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY) // Continuous low-latency scan
            .setReportDelay(0)
            .build()

        val scanFilters = listOf(
            ScanFilter.Builder()
                .setDeviceName(settingsManager.beaconName)
                .build()
        )

        try {
            bleScanner?.startScan(scanFilters, scanSettings, scanCallback)
            Log.i(TAG, "BLE Scan active. Filtering for: '${settingsManager.beaconName}'")
            updateNotification("Active • Listening for ${settingsManager.beaconName}")
        } catch (e: SecurityException) {
            Log.e(TAG, "Missing Bluetooth Scan permissions: ${e.message}")
            stopSelf()
        }
    }

    private fun handleScanResult(result: ScanResult) {
        val rawRssi = result.rssi
        detectionCount++

        // Rolling buffer for smoothed on-screen indicator
        rssiBuffer.add(rawRssi)
        val maxWindow = maxOf(3, settingsManager.smoothWindowSize)
        if (rssiBuffer.size > maxWindow) {
            rssiBuffer.removeAt(0)
        }
        val smoothedRssi = rssiBuffer.average().toInt()

        // Decode IMU acceleration payload from manufacturer data if present
        var ax: Double? = null
        var ay: Double? = null
        var az: Double? = null
        var magnitude: Double? = null
        var battery: Int? = null

        val scanRecord = result.scanRecord
        val manufacturerData = scanRecord?.getManufacturerSpecificData(TARGET_COMPANY_ID)
        if (manufacturerData != null && manufacturerData.size >= 9) {
            try {
                val buffer = ByteBuffer.wrap(manufacturerData).order(ByteOrder.LITTLE_ENDIAN)
                val forkliftIdByte = buffer.get().toInt()
                val rawAx = buffer.short.toDouble() / 100.0
                val rawAy = buffer.short.toDouble() / 100.0
                val rawAz = buffer.short.toDouble() / 100.0
                val rawMag = (buffer.short.toInt() and 0xFFFF).toDouble() / 100.0
                val rawBat = if (buffer.hasRemaining()) buffer.get().toInt() and 0xFF else null

                ax = rawAx
                ay = rawAy
                az = rawAz
                magnitude = rawMag
                battery = rawBat
            } catch (e: Exception) {
                Log.w(TAG, "Error unpacking IMU payload: ${e.message}")
            }
        }

        // Throttle upstream transmission to 10 Hz
        val now = System.currentTimeMillis()
        if (now - lastTransmitTime >= minTransmitIntervalMs) {
            lastTransmitTime = now

            // Determine whether to send raw or smoothed RSSI based on settings
            val rssiToSend = if (settingsManager.transmitMode == "SMOOTHED") smoothedRssi else rawRssi

            serviceScope.launch {
                val (httpCode, latencyMs) = postTelemetryToLaptop(
                    rssi = rssiToSend,
                    ax = ax,
                    ay = ay,
                    az = az,
                    magnitude = magnitude,
                    battery = battery
                )

                // Broadcast live metrics to MainActivity for on-screen HUD
                val updateIntent = Intent(ACTION_RSSI_UPDATE).apply {
                    putExtra("raw_rssi", rawRssi)
                    putExtra("smoothed_rssi", smoothedRssi)
                    putExtra("detections_count", detectionCount)
                    putExtra("scans_count", scanCount)
                    putExtra("http_status", httpCode)
                    putExtra("latency_ms", latencyMs)
                    ax?.let { putExtra("ax", it) }
                    ay?.let { putExtra("ay", it) }
                    az?.let { putExtra("az", it) }
                    magnitude?.let { putExtra("magnitude", it) }
                    battery?.let { putExtra("battery", it) }
                }
                sendBroadcast(updateIntent)

                // Update notification preview
                updateNotification("RSSI: $rawRssi dBm (Avg: $smoothedRssi) | Packets: $detectionCount")
            }
        }
    }

    private suspend fun postTelemetryToLaptop(
        rssi: Int,
        ax: Double?,
        ay: Double?,
        az: Double?,
        magnitude: Double?,
        battery: Int?
    ): Pair<Int, Long> = withContext(Dispatchers.IO) {
        val startTime = System.currentTimeMillis()
        var responseCode = -1

        try {
            val endpoint = "http://${settingsManager.serverIp}:${settingsManager.serverPort}/api/telemetry/gateway"
            val url = URL(endpoint)
            val connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                connectTimeout = 1200
                readTimeout = 1200
                doOutput = true
            }

            val json = JSONObject().apply {
                put("gateway_id", settingsManager.gatewayId)
                put("forklift_id", settingsManager.forkliftId)
                put("rssi", rssi)
                ax?.let { put("ax", it) }
                ay?.let { put("ay", it) }
                az?.let { put("az", it) }
                magnitude?.let { put("magnitude", it) }
                battery?.let { put("battery", it) }
                put("timestamp", System.currentTimeMillis() / 1000.0)
            }

            OutputStreamWriter(connection.outputStream).use { writer ->
                writer.write(json.toString())
                writer.flush()
            }

            responseCode = connection.responseCode
            connection.disconnect()
        } catch (e: Exception) {
            // Silently swallow network drops to prevent log flood
            responseCode = -1
        }

        val latencyMs = System.currentTimeMillis() - startTime
        Pair(responseCode, latencyMs)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Warehouse Gateway Scanner",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Foreground beacon scanning and telemetry relay"
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildForegroundNotification(contentText: String): Notification {
        val launchIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Warehouse Gateway (${settingsManager.gatewayId})")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification(text: String) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildForegroundNotification(text))
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        try {
            bleScanner?.stopScan(scanCallback)
        } catch (e: SecurityException) {
            Log.e(TAG, "Error stopping scan: ${e.message}")
        }
        settingsManager.isScanning = false
        Log.i(TAG, "Gateway Scanner Service terminated.")
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
