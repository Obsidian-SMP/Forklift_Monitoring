#!/usr/bin/env python3
"""
Download YOLOv4-tiny model files for accurate object detection
"""
import os
import urllib.request
import sys

def download_file(url, destination):
    """Download a file with progress indicator"""
    print(f"Downloading: {os.path.basename(destination)}")
    try:
        def reporthook(count, block_size, total_size):
            percent = int(count * block_size * 100 / total_size)
            sys.stdout.write(f"\rProgress: {percent}%")
            sys.stdout.flush()
        
        urllib.request.urlretrieve(url, destination, reporthook)
        print(f"\n✓ Downloaded: {destination}")
        return True
    except Exception as e:
        print(f"\n✗ Error downloading: {e}")
        return False

def main():
    # Create directory for YOLO files
    yolo_dir = os.path.join(os.path.dirname(__file__), 'yolo_models')
    os.makedirs(yolo_dir, exist_ok=True)
    
    print("="*60)
    print("YOLOv4-tiny Model Download")
    print("="*60)
    
    # Files to download
    files = {
        'yolov4-tiny.cfg': 'https://raw.githubusercontent.com/AlexeyAB/darknet/master/cfg/yolov4-tiny.cfg',
        'yolov4-tiny.weights': 'https://github.com/AlexeyAB/darknet/releases/download/darknet_yolo_v4_pre/yolov4-tiny.weights',
        'coco.names': 'https://raw.githubusercontent.com/AlexeyAB/darknet/master/data/coco.names'
    }
    
    success_count = 0
    for filename, url in files.items():
        filepath = os.path.join(yolo_dir, filename)
        
        # Skip if already exists
        if os.path.exists(filepath):
            print(f"✓ Already exists: {filename}")
            success_count += 1
            continue
        
        if download_file(url, filepath):
            success_count += 1
    
    print("\n" + "="*60)
    if success_count == len(files):
        print("✅ All YOLO files downloaded successfully!")
        print(f"Location: {yolo_dir}")
    else:
        print(f"⚠ Downloaded {success_count}/{len(files)} files")
    print("="*60)

if __name__ == '__main__':
    main()
