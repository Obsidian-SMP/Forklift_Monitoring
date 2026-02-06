#!/usr/bin/env python3
"""
Validation script for custom YOLO model deployment
Tests model loading and configuration
"""
import os
import sys

def validate_model():
    """Validate custom YOLO model is ready for deployment"""
    print("\n" + "="*60)
    print("CUSTOM YOLO MODEL VALIDATION")
    print("="*60 + "\n")
    
    # Check model file exists
    model_path = "backend/yolo_models/my_model.pt"
    print(f"[1/4] Checking model file: {model_path}")
    if os.path.exists(model_path):
        size_mb = os.path.getsize(model_path) / (1024 * 1024)
        print(f"    ✓ Model found ({size_mb:.2f} MB)")
    else:
        print(f"    ✗ Model NOT FOUND")
        print(f"    Expected location: {os.path.abspath(model_path)}")
        return False
    
    # Check configuration
    print("\n[2/4] Checking configuration...")
    try:
        sys.path.insert(0, 'backend')
        from app.config import Config
        print(f"    ✓ Config loaded")
        print(f"    - YOLO_MODEL: {Config.YOLO_MODEL}")
        print(f"    - AI_CONFIDENCE: {Config.AI_CONFIDENCE}")
        print(f"    - AI_INPUT_SIZE: {Config.AI_INPUT_SIZE}")
        print(f"    - AI_PROCESS_EVERY_N: {Config.AI_PROCESS_EVERY_N}")
    except Exception as e:
        print(f"    ✗ Config error: {e}")
        return False
    
    # Test model loading
    print("\n[3/4] Testing model loading...")
    try:
        from ultralytics import YOLO
        model = YOLO(model_path)
        classes = list(model.names.values())
        print(f"    ✓ Model loaded successfully")
        print(f"    - Classes ({len(classes)}): {', '.join(classes)}")
    except Exception as e:
        print(f"    ✗ Failed to load model: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Check AI worker can initialize
    print("\n[4/4] Testing AI worker initialization...")
    try:
        from app.services.ai_worker import AIDetectionWorker
        worker = AIDetectionWorker(process_every_n=1)
        if worker.model:
            print(f"    ✓ AI worker initialized")
            print(f"    - Model type: {worker.model_type}")
            print(f"    - Classes: {len(worker.classes)}")
        else:
            print(f"    ✗ AI worker model not loaded")
            return False
    except Exception as e:
        print(f"    ✗ Worker initialization error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Summary
    print("\n" + "="*60)
    print("VALIDATION SUMMARY")
    print("="*60)
    print("✓ Model file: OK")
    print("✓ Configuration: OK")
    print("✓ Model loading: OK")
    print("✓ AI worker: OK")
    print("\n✅ System is READY for deployment!")
    print("="*60 + "\n")
    
    print("Next steps:")
    print("  1. Start backend: python3 backend/run.py")
    print("  2. Or use service script: ./start_services.sh")
    print()
    
    return True

if __name__ == "__main__":
    success = validate_model()
    sys.exit(0 if success else 1)
