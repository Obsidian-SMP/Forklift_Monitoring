apiservice.kt
package com.warehouse.blegateway

import com.google.gson.annotations.SerializedName
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import java.util.concurrent.TimeUnit

data class RSSIData(
    @SerializedName("gateway_id") val gatewayId: String,
    @SerializedName("rssi") val rssi: Int
)

data class ApiResponse(
    @SerializedName("status") val status: String,
    @SerializedName("position") val position: Position?
)

data class Position(
    @SerializedName("x") val x: Double,
    @SerializedName("y") val y: Double,
    @SerializedName("confidence") val confidence: Double
)

interface ApiService {
    @POST("/api/rssi")
    suspend fun sendRSSI(@Body data: RSSIData): ApiResponse

    companion object {
        fun create(baseUrl: String): ApiService {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }

            val client = OkHttpClient.Builder()
                .addInterceptor(logging)
                .connectTimeout(30, TimeUnit.SECONDS)  // INCREASED from 5s
                .readTimeout(30, TimeUnit.SECONDS)     // INCREASED from 5s
                .writeTimeout(30, TimeUnit.SECONDS)    // INCREASED from 5s
                .retryOnConnectionFailure(true)        // AUTO-RETRY on failure
                .build()

            val retrofit = Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()

            return retrofit.create(ApiService::class.java)
        }
    }
}


blescanservice
package com.warehouse.blegateway

import android.Manifest
import android.app.*
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*

class BLEScanService : Service() {

    private val TAG = "BLEScanService"
    private val CHANNEL_ID = "BLEScanChannel"
    private val NOTIFICATION_ID = 1

    private lateinit var settingsManager: SettingsManager
    private lateinit var bluetoothAdapter: BluetoothAdapter
    private lateinit var bluetoothLeScanner: BluetoothLeScanner
    private var apiService: ApiService? = null

    private val serviceScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    private var scanCount = 0
    private var detectionCount = 0
    private var lastRssi: Int? = null
    private val rssiBuffer = mutableListOf<Int>()
    private val BUFFER_SIZE = 10

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
            result?.let {
                val deviceName = it.device.name
                val targetName = settingsManager.beaconName

                if (deviceName == targetName) {
                    val rssi = it.rssi
                    lastRssi = rssi
                    detectionCount++

                    // Add to buffer and smooth
                    rssiBuffer.add(rssi)
                    if (rssiBuffer.size > BUFFER_SIZE) {
                        rssiBuffer.removeAt(0)
                    }

                    val smoothedRssi = rssiBuffer.average().toInt()

                    Log.d(TAG, "Found beacon: $deviceName, RSSI: $rssi (Smoothed: $smoothedRssi)")

                    // Send to server
                    sendRSSIToServer(smoothedRssi)

                    // Update notification
                    updateNotification("RSSI: $smoothedRssi dBm | Detections: $detectionCount")

                    // Broadcast update to MainActivity
                    broadcastUpdate(smoothedRssi)
                }
            }
        }

        override fun onScanFailed(errorCode: Int) {
            Log.e(TAG, "Scan failed with error: $errorCode")
        }
    }

    override fun onCreate() {
        super.onCreate()
        settingsManager = SettingsManager(this)

        val bluetoothManager = getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        bluetoothAdapter = bluetoothManager.adapter
        bluetoothLeScanner = bluetoothAdapter.bluetoothLeScanner

        createNotificationChannel()

        // Initialize API service
        val serverUrl = "http://${settingsManager.serverIp}:5000"
        apiService = ApiService.create(serverUrl)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, createNotification("Starting scan..."))

        startBLEScan()

        return START_STICKY
    }

    private fun startBLEScan() {
        if (ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.BLUETOOTH_SCAN
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            Log.e(TAG, "Missing BLUETOOTH_SCAN permission")
            stopSelf()
            return
        }

        val scanSettings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .setReportDelay(0)
            .build()

        val scanFilters = listOf(
            ScanFilter.Builder()
                .setDeviceName(settingsManager.beaconName)
                .build()
        )

        try {
            bluetoothLeScanner.startScan(scanFilters, scanSettings, scanCallback)
            Log.d(TAG, "BLE scan started for: ${settingsManager.beaconName}")

            // Periodic scan count update
            serviceScope.launch {
                while (isActive) {
                    delay(1000)
                    scanCount++
                    broadcastScanCount()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start scan: ${e.message}")
            stopSelf()
        }
    }

    private fun sendRSSIToServer(rssi: Int) {
        serviceScope.launch {
            try {
                val data = RSSIData(
                    gatewayId = settingsManager.gatewayId,
                    rssi = rssi
                )

                val response = apiService?.sendRSSI(data)

                if (response != null) {
                    Log.d(TAG, "Successfully sent RSSI: $rssi, Status: ${response.status}")
                    response.position?.let { pos ->
                        Log.d(TAG, "Position: (${pos.x}, ${pos.y}), Confidence: ${pos.confidence}%")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send RSSI: ${e.message}")
            }
        }
    }

    private fun broadcastUpdate(rssi: Int) {
        val intent = Intent("BLE_RSSI_UPDATE").apply {
            putExtra("rssi", rssi)
            putExtra("detections", detectionCount)
        }
        sendBroadcast(intent)
    }

    private fun broadcastScanCount() {
        val intent = Intent("BLE_SCAN_COUNT").apply {
            putExtra("count", scanCount)
        }
        sendBroadcast(intent)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.channel_description)
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(text: String): Notification {
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.notify(NOTIFICATION_ID, createNotification(text))
    }

    override fun onDestroy() {
        super.onDestroy()

        if (ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.BLUETOOTH_SCAN
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            bluetoothLeScanner.stopScan(scanCallback)
        }

        serviceScope.cancel()
        settingsManager.isScanning = false

        Log.d(TAG, "Service destroyed")
    }

    override fun onBind(intent: Intent?): IBinder? = null
}



main activity
package com.warehouse.blegateway

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.*
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText

class MainActivity : AppCompatActivity() {

    private val TAG = "MainActivity"

    private lateinit var settingsManager: SettingsManager
    private lateinit var bluetoothAdapter: BluetoothAdapter

    private lateinit var gatewayIdInput: TextInputEditText
    private lateinit var serverIpInput: TextInputEditText
    private lateinit var beaconNameInput: TextInputEditText
    private lateinit var rssiValue: TextView
    private lateinit var statusText: TextView
    private lateinit var scanCountText: TextView
    private lateinit var detectionCountText: TextView
    private lateinit var startButton: MaterialButton

    private var isScanning = false
    private var receiverRegistered = false

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.values.all { it }
        if (allGranted) {
            Toast.makeText(this, "Permissions granted", Toast.LENGTH_SHORT).show()
            Log.d(TAG, "All permissions granted")
        } else {
            Toast.makeText(this, "Permissions required for BLE scanning", Toast.LENGTH_LONG).show()
            Log.w(TAG, "Some permissions denied")
        }
    }

    private val rssiReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            Log.d(TAG, "✅ Broadcast received: ${intent?.action}")

            when (intent?.action) {
                "BLE_RSSI_UPDATE" -> {
                    val rssi = intent.getIntExtra("rssi", 0)
                    val detections = intent.getIntExtra("detections", 0)

                    Log.d(TAG, "📡 RSSI Update: $rssi dBm, Detections: $detections")

                    runOnUiThread {
                        rssiValue.text = "$rssi dBm"
                        detectionCountText.text = "Detections: $detections"
                        statusText.text = "Scanning - Beacon Found ✓"

                        Log.d(TAG, "🔄 UI updated successfully")
                    }
                }
                "BLE_SCAN_COUNT" -> {
                    val count = intent.getIntExtra("count", 0)

                    Log.d(TAG, "📊 Scan Count: $count")

                    runOnUiThread {
                        scanCountText.text = "Scans: $count"
                    }
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "🚀 onCreate called")

        setContentView(R.layout.activity_main)

        settingsManager = SettingsManager(this)

        val bluetoothManager = getSystemService(BLUETOOTH_SERVICE) as BluetoothManager
        bluetoothAdapter = bluetoothManager.adapter

        initViews()
        checkPermissions()
        loadSettings()

        // Register broadcast receiver
        registerBroadcastReceiver()

        // Restore scanning state
        if (settingsManager.isScanning) {
            isScanning = true
            updateUIForScanning()
            Log.d(TAG, "⚡ Restored scanning state")
        }

        Log.d(TAG, "✅ MainActivity setup complete")
    }

    private fun registerBroadcastReceiver() {
        if (receiverRegistered) {
            Log.d(TAG, "⚠️ Receiver already registered, skipping")
            return
        }

        val filter = IntentFilter().apply {
            addAction("BLE_RSSI_UPDATE")
            addAction("BLE_SCAN_COUNT")
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                // For Android 13+, try EXPORTED first
                try {
                    registerReceiver(rssiReceiver, filter, Context.RECEIVER_EXPORTED)
                    Log.d(TAG, "📻 Receiver registered with RECEIVER_EXPORTED")
                } catch (e: Exception) {
                    // Fallback to NOT_EXPORTED if EXPORTED fails
                    registerReceiver(rssiReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
                    Log.d(TAG, "📻 Receiver registered with RECEIVER_NOT_EXPORTED (fallback)")
                }
            } else {
                registerReceiver(rssiReceiver, filter)
                Log.d(TAG, "📻 Receiver registered (legacy mode)")
            }

            receiverRegistered = true
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to register receiver: ${e.message}")
        }
    }

    private fun initViews() {
        gatewayIdInput = findViewById(R.id.gatewayIdInput)
        serverIpInput = findViewById(R.id.serverIpInput)
        beaconNameInput = findViewById(R.id.beaconNameInput)
        rssiValue = findViewById(R.id.rssiValue)
        statusText = findViewById(R.id.statusText)
        scanCountText = findViewById(R.id.scanCountText)
        detectionCountText = findViewById(R.id.detectionCountText)
        startButton = findViewById(R.id.startButton)

        startButton.setOnClickListener {
            if (isScanning) {
                stopScanning()
            } else {
                startScanning()
            }
        }

        // Debug: Long press to test UI update
        startButton.setOnLongClickListener {
            Log.d(TAG, "🧪 Manual UI test triggered")
            rssiValue.text = "-65 dBm"
            statusText.text = "TEST UPDATE ✓"
            detectionCountText.text = "Detections: 99"
            scanCountText.text = "Scans: 99"
            Toast.makeText(this, "Manual UI update successful!", Toast.LENGTH_SHORT).show()
            true
        }

        Log.d(TAG, "🎨 Views initialized")
    }

    private fun loadSettings() {
        gatewayIdInput.setText(settingsManager.gatewayId)
        serverIpInput.setText(settingsManager.serverIp)
        beaconNameInput.setText(settingsManager.beaconName)

        Log.d(TAG, "⚙️ Settings loaded: Gateway=${settingsManager.gatewayId}, " +
                "Server=${settingsManager.serverIp}, Beacon=${settingsManager.beaconName}")
    }

    private fun saveSettings() {
        settingsManager.gatewayId = gatewayIdInput.text.toString()
        settingsManager.serverIp = serverIpInput.text.toString()
        settingsManager.beaconName = beaconNameInput.text.toString()

        Log.d(TAG, "💾 Settings saved")
    }

    private fun checkPermissions() {
        val permissions = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            permissions.add(Manifest.permission.BLUETOOTH_SCAN)
            permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
        } else {
            permissions.add(Manifest.permission.BLUETOOTH)
            permissions.add(Manifest.permission.BLUETOOTH_ADMIN)
        }

        permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val missingPermissions = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missingPermissions.isNotEmpty()) {
            Log.d(TAG, "🔐 Requesting permissions: $missingPermissions")
            permissionLauncher.launch(missingPermissions.toTypedArray())
        } else {
            Log.d(TAG, "✅ All permissions already granted")
        }
    }

    private fun startScanning() {
        if (!bluetoothAdapter.isEnabled) {
            Toast.makeText(this, "Please enable Bluetooth", Toast.LENGTH_SHORT).show()
            Log.w(TAG, "❌ Bluetooth not enabled")
            return
        }

        saveSettings()

        val serviceIntent = Intent(this, BLEScanService::class.java)
        ContextCompat.startForegroundService(this, serviceIntent)

        isScanning = true
        settingsManager.isScanning = true
        updateUIForScanning()

        Toast.makeText(this, "Gateway started", Toast.LENGTH_SHORT).show()
        Log.d(TAG, "▶️ BLE scanning started")
    }

    private fun stopScanning() {
        val serviceIntent = Intent(this, BLEScanService::class.java)
        stopService(serviceIntent)

        isScanning = false
        settingsManager.isScanning = false
        updateUIForStopped()

        Toast.makeText(this, "Gateway stopped", Toast.LENGTH_SHORT).show()
        Log.d(TAG, "⏹️ BLE scanning stopped")
    }

    private fun updateUIForScanning() {
        startButton.text = "Stop Gateway"
        startButton.backgroundTintList = ContextCompat.getColorStateList(this, R.color.error)
        statusText.text = "Scanning..."
        gatewayIdInput.isEnabled = false
        serverIpInput.isEnabled = false
        beaconNameInput.isEnabled = false

        Log.d(TAG, "🔄 UI updated for scanning state")
    }

    private fun updateUIForStopped() {
        startButton.text = "Start Gateway"
        startButton.backgroundTintList = ContextCompat.getColorStateList(this, R.color.accent)
        statusText.text = "Not Started"
        rssiValue.text = "-- dBm"
        scanCountText.text = "Scans: 0"
        detectionCountText.text = "Detections: 0"
        gatewayIdInput.isEnabled = true
        serverIpInput.isEnabled = true
        beaconNameInput.isEnabled = true

        Log.d(TAG, "🔄 UI updated for stopped state")
    }

    override fun onResume() {
        super.onResume()
        // Re-register receiver if needed
        if (!receiverRegistered) {
            registerBroadcastReceiver()
        }
        Log.d(TAG, "▶️ onResume - Receiver status: $receiverRegistered")
    }

    override fun onDestroy() {
        super.onDestroy()

        if (receiverRegistered) {
            try {
                unregisterReceiver(rssiReceiver)
                receiverRegistered = false
                Log.d(TAG, "📻 Receiver unregistered")
            } catch (e: IllegalArgumentException) {
                Log.w(TAG, "⚠️ Receiver was not registered")
            }
        }

        Log.d(TAG, "🛑 onDestroy called")
    }
}


settingsmanager
package com.warehouse.blegateway

import android.content.Context
import android.content.SharedPreferences

class SettingsManager(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("BLEGatewaySettings", Context.MODE_PRIVATE)

    var gatewayId: String
        get() = prefs.getString("gateway_id", "phone_1") ?: "phone_1"
        set(value) = prefs.edit().putString("gateway_id", value).apply()

    var serverIp: String
        get() = prefs.getString("server_ip", "192.168.1.100") ?: "192.168.1.100"
        set(value) = prefs.edit().putString("server_ip", value).apply()

    var beaconName: String
        get() = prefs.getString("beacon_name", "Forklift-001") ?: "Forklift-001"
        set(value) = prefs.edit().putString("beacon_name", value).apply()

    var isScanning: Boolean
        get() = prefs.getBoolean("is_scanning", false)
        set(value) = prefs.edit().putBoolean("is_scanning", value).apply()
}