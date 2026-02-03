/*
 * ESP32-CAM - Forklift Load Detection System
 * 
 * Features:
 * - Live MJPEG video stream on port 80 (working example)
 * - Captures images every 3 seconds
 * - Sends images to Raspberry Pi backend via HTTP POST
 * - LED indicator for capture status
 * - Configurable forklift ID
 * 
 * Hardware:
 * - Board: ESP32-CAM (AI-Thinker with OV3660)
 * - LED indicator: Built-in GPIO 4
 */

#include "esp_camera.h"
#include "esp_http_server.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// ============ CAMERA PINS (AI-Thinker ESP32-CAM) ============
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22
#define LED_GPIO_NUM       4

// ============ CONFIGURATION ============
const char* ssid = "Me";
const char* password = "noname101";
const char* RPI_IP = "10.136.57.165";
const int RPI_PORT = 5000;
const char* FORKLIFT_ID = "forklift_1";

// Capture settings
const unsigned long CAPTURE_INTERVAL = 1000;  // 1 second
unsigned long lastCaptureTime = 0;
int captureCount = 0;

// Camera server
httpd_handle_t stream_httpd = NULL;

#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

void startCameraServer();
void setupLedFlash(int pin);

// ============ SETUP ============
void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  
  // Disable brownout detector
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  
  Serial.println("\n========================================");
  Serial.println("ESP32-CAM Forklift Monitoring System");
  Serial.println("========================================");

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  
  // CRITICAL FIX FOR OV3660: Lower frequency to 10MHz
  config.xclk_freq_hz = 10000000;
  
  config.frame_size = FRAMESIZE_VGA; 
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 15;  // Higher number = lower quality, faster processing
  config.fb_count = 1;

  // PSRAM Check
  if (config.pixel_format == PIXFORMAT_JPEG) {
    if (psramFound()) {
      Serial.println("PSRAM found - using optimized quality settings");
      config.jpeg_quality = 15;  // Optimized for speed
      config.fb_count = 2;
      config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
      Serial.println("No PSRAM - using standard quality");
      config.frame_size = FRAMESIZE_QVGA;
      config.fb_location = CAMERA_FB_IN_DRAM;
    }
  }

  // Camera Init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("✗ Camera init failed with error 0x%x\n", err);
    return;
  }
  Serial.println("✓ Camera initialized successfully");

  sensor_t *s = esp_camera_sensor_get();
  // Settings for OV3660 Sensor
  if (s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);
    s->set_brightness(s, 1);
    s->set_saturation(s, -2);
  }
  // Standard AI-Thinker orientation fix
  s->set_vflip(s, 1);
  s->set_hmirror(s, 1);

  // Setup LED Flash
  setupLedFlash(LED_GPIO_NUM);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  WiFi.setSleep(false);
  
  Serial.print("Connecting to WiFi: ");
  Serial.print(ssid);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✓ WiFi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // Start camera web server
  startCameraServer();

  Serial.println("\n✓ System ready!");
  Serial.printf("Forklift ID: %s\n", FORKLIFT_ID);
  Serial.printf("Backend: http://%s:%d\n", RPI_IP, RPI_PORT);
  Serial.printf("Stream: http://%s/\n", WiFi.localIP().toString().c_str());
  Serial.printf("Capture interval: %lu seconds\n", CAPTURE_INTERVAL / 1000);
  Serial.println("========================================\n");
}

// ============ MAIN LOOP ============
void loop() {
  // Auto-capture and send to backend every 3 seconds
  unsigned long currentTime = millis();
  if (currentTime - lastCaptureTime >= CAPTURE_INTERVAL) {
    captureAndSend();
    lastCaptureTime = currentTime;
  }
  delay(100);
}

// ============ CAPTURE AND SEND IMAGE ============
void captureAndSend() {
  captureCount++;
  Serial.printf("\n[Capture #%d] Taking image...\n", captureCount);
  
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("✗ Camera capture failed");
    return;
  }
  
  Serial.printf("✓ Image captured: %d bytes (%dx%d)\n", fb->len, fb->width, fb->height);
  
  // Send to backend
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String("http://") + RPI_IP + ":" + RPI_PORT + "/api/forklift/" + FORKLIFT_ID + "/image";
    
    http.begin(url);
    http.addHeader("Content-Type", "image/jpeg");
    http.addHeader("X-Forklift-ID", FORKLIFT_ID);
    http.setTimeout(10000);
    
    int httpResponseCode = http.POST(fb->buf, fb->len);
    
    if (httpResponseCode == 200 || httpResponseCode == 201) {
      Serial.printf("✓ Sent to backend (HTTP %d)\n", httpResponseCode);
    } else {
      Serial.printf("✗ Backend error: HTTP %d\n", httpResponseCode);
    }
    
    http.end();
  } else {
    Serial.println("✗ WiFi not connected");
  }
  
  esp_camera_fb_return(fb);
}

// ============ LED FLASH SETUP ============
void setupLedFlash(int pin) {
  ledcAttach(pin, 5000, 8);
}

// ============ CAMERA WEB SERVER ============
static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t *fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t *_jpg_buf = NULL;
  char part_buf[64];
  size_t hlen = 0;

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if (res != ESP_OK) {
    return res;
  }

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      res = ESP_FAIL;
    } else {
      if (fb->format != PIXFORMAT_JPEG) {
        bool jpeg_converted = frame2jpg(fb, 80, &_jpg_buf, &_jpg_buf_len);
        esp_camera_fb_return(fb);
        fb = NULL;
        if (!jpeg_converted) {
          Serial.println("JPEG compression failed");
          res = ESP_FAIL;
        }
      } else {
        _jpg_buf_len = fb->len;
        _jpg_buf = fb->buf;
      }
    }
    
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    }
    if (res == ESP_OK) {
      hlen = snprintf(part_buf, 64, _STREAM_PART, _jpg_buf_len);
      res = httpd_resp_send_chunk(req, part_buf, hlen);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    }
    
    if (fb) {
      esp_camera_fb_return(fb);
      fb = NULL;
      _jpg_buf = NULL;
    } else if (_jpg_buf) {
      free(_jpg_buf);
      _jpg_buf = NULL;
    }
    
    if (res != ESP_OK) {
      break;
    }
  }
  
  return res;
}

void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;

  httpd_uri_t index_uri = {
    .uri = "/",
    .method = HTTP_GET,
    .handler = stream_handler,
    .user_ctx = NULL
  };

  Serial.println("Starting camera web server...");
  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &index_uri);
    Serial.println("✓ Camera server started on port 80");
  } else {
    Serial.println("✗ Failed to start camera server");
  }
}
