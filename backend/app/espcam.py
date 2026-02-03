"""ESP32-CAM Model Downloader
Downloads YOLO models for object detection from ESP32-CAM images
"""
import os
import requests

def download_models(base_dir=None):
    """Download YOLO models for object detection"""
    if base_dir is None:
        base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Files to download (Official Sources)
    files = {
        "yolov4-tiny.cfg": "https://raw.githubusercontent.com/AlexeyAB/darknet/master/cfg/yolov4-tiny.cfg",
        "yolov4-tiny.weights": "https://github.com/AlexeyAB/darknet/releases/download/darknet_yolo_v4_pre/yolov4-tiny.weights",
        "yolov3.txt": "https://raw.githubusercontent.com/arunponnusamy/object-detection-opencv/master/yolov3.txt"
    }
    
    print("------------------------------------------------")
    print(f"Checking AI Models in: {base_dir}")
    print("------------------------------------------------")
    
    success_count = 0
    total_files = len(files)
    
    for filename, url in files.items():
        dest_path = os.path.join(base_dir, filename)
        
        # Skip if file already exists
        if os.path.exists(dest_path):
            file_size = os.path.getsize(dest_path)
            if file_size > 1000:  # Basic validation
                print(f"✓ {filename} already exists ({file_size} bytes)")
                success_count += 1
                continue
        
        print(f"Downloading {filename}...", end=" ", flush=True)
        
        try:
            # stream=True helps prevent memory errors on small devices like Pi
            r = requests.get(url, stream=True, timeout=30)
            r.raise_for_status()
            
            # Check for "HTML Error" content (common firewall issue)
            first_chunk = next(r.iter_content(100), b"")
            if b"<html" in first_chunk or b"<!DOCTYPE" in first_chunk:
                print("\n[ERROR] Download blocked by network (HTML error page).")
                print("TRY: Use mobile hotspot or check firewall.")
                continue
            
            # Write file
            with open(dest_path, 'wb') as f:
                f.write(first_chunk)
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            print("✓ Success!")
            success_count += 1
            
        except Exception as e:
            print(f"✗ Failed: {e}")
    
    print("------------------------------------------------")
    if success_count == total_files:
        print(f"✓ All {total_files} model files ready!")
        return True
    else:
        print(f"⚠ {success_count}/{total_files} files ready. Some downloads failed.")
        return False

if __name__ == '__main__':
    download_models()