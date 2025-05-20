import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

// Styles for the scanner component
const scannerStyles = {
  container: {
    width: '100%',
    maxWidth: '500px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  reader: {
    width: '100%',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '10px',
    minHeight: '250px',
  },
  button: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#0d6efd',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  closeButton: {
    backgroundColor: '#6c757d',
    marginRight: '5px',
  },
  message: {
    textAlign: 'center',
    margin: '10px 0',
    color: '#6c757d',
  },
  error: {
    color: '#dc3545',
  },
  instructions: {
    backgroundColor: '#f8f9fa',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '10px',
    fontSize: '0.9rem',
  },
};

const BarcodeScanner = ({ onScan, onClose, scannerTitle = "Scan Barcode" }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [html5QrCode, setHtml5QrCode] = useState(null);
  const [cameraId, setCameraId] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [isIOS, setIsIOS] = useState(false);
  
  // Create a unique ID for the scanner element
  const scannerId = 'html5-qr-code-scanner';
  
  // Detect iOS device
  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);
    
    if (isIOSDevice) {
      console.log("iOS device detected - special camera handling will be used");
    }
  }, []);
  
  // Get available cameras
  useEffect(() => {
    const getCameras = async () => {
      try {
        // First check if we have general camera permission
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            // Request camera permission first
            await navigator.mediaDevices.getUserMedia({ video: true });
            console.log("Camera permission granted");
          } catch (permissionErr) {
            console.error("Camera permission denied:", permissionErr);
            setError("Camera permission denied. Please allow camera access in your browser settings.");
            return;
          }
        }
        
        // Now try to get the list of cameras
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
          console.log("Available cameras:", devices);
          setCameras(devices);
          
          // Prefer back camera if available
          const backCamera = devices.find(camera => 
            camera.label.toLowerCase().includes('back') || 
            camera.label.toLowerCase().includes('rear')
          );
          
          if (backCamera) {
            console.log("Back camera found:", backCamera.label);
            setCameraId(backCamera.id);
          } else {
            console.log("No back camera found, using first available camera:", devices[0].label);
            setCameraId(devices[0].id);
          }
        } else {
          console.log("No cameras found on device");
          setError('No cameras found on this device');
        }
      } catch (err) {
        console.error('Error getting cameras:', err);
        
        // Special handling for iOS
        if (isIOS) {
          // For iOS, try to use a generic camera ID
          console.log("iOS device: using default camera");
          setCameraId("environment");
        } else {
          setError('Could not access cameras. Please ensure you have granted camera permissions in your browser settings.');
        }
      }
    };
    
    getCameras();
  }, [isIOS]);
  
  useEffect(() => {
    // Initialize scanner
    const scanner = new Html5Qrcode(scannerId);
    setHtml5QrCode(scanner);
    
    // Start scanning automatically if camera is available
    if (cameraId) {
      startScanner(scanner, cameraId);
    }
    
    // Clean up on unmount
    return () => {
      if (scanner && scanner.isScanning) {
        scanner.stop().catch(err => console.error('Error stopping scanner:', err));
      }
    };
  }, [cameraId]);
  
  const startScanner = async (scanner, cameraId) => {
    if (!scanner) return;
    
    setError('');
    setIsScanning(true);
    
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      formatsToSupport: [
        Html5Qrcode.FORMATS.QR_CODE,
        Html5Qrcode.FORMATS.EAN_13,
        Html5Qrcode.FORMATS.EAN_8,
        Html5Qrcode.FORMATS.CODE_39,
        Html5Qrcode.FORMATS.CODE_93,
        Html5Qrcode.FORMATS.CODE_128,
        Html5Qrcode.FORMATS.UPC_A,
        Html5Qrcode.FORMATS.UPC_E,
        Html5Qrcode.FORMATS.ITF,
        Html5Qrcode.FORMATS.CODABAR
      ]
    };
    
    try {
      // For iOS, we need to use a different approach
      if (isIOS && cameraId === "environment") {
        // Use facingMode constraint for iOS
        await scanner.start(
          { facingMode: "environment" },
          config,
          (decodedText, decodedResult) => {
            // On successful scan
            console.log(`Scan result: ${decodedText}`, decodedResult);
            
            // Call the onScan callback with the result
            if (onScan) {
              onScan(decodedText, decodedResult);
            }
            
            // Stop scanning after successful scan
            stopScanner(scanner);
          },
          (errorMessage) => {
            // Handle scan errors silently (no need to show every frame error)
            console.log(errorMessage);
          }
        );
      } else {
        // Start scanning with camera ID for non-iOS devices
        await scanner.start(
          cameraId,
          config,
          (decodedText, decodedResult) => {
            // On successful scan
            console.log(`Scan result: ${decodedText}`, decodedResult);
            
            // Call the onScan callback with the result
            if (onScan) {
              onScan(decodedText, decodedResult);
            }
            
            // Stop scanning after successful scan
            stopScanner(scanner);
          },
          (errorMessage) => {
            // Handle scan errors silently (no need to show every frame error)
            console.log(errorMessage);
          }
        );
      }
    } catch (err) {
      console.error('Error starting scanner:', err);
      
      // Special handling for iOS
      if (isIOS && cameraId !== "environment") {
        console.log("Trying iOS fallback with environment camera");
        setCameraId("environment");
        return;
      }
      
      setError(`Could not access camera: ${err.message || 'Unknown error'}. Please ensure you have granted camera permissions in your browser settings.`);
      setIsScanning(false);
    }
  };
  
  const stopScanner = async (scanner) => {
    if (scanner && scanner.isScanning) {
      try {
        await scanner.stop();
        setIsScanning(false);
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  };
  
  const handleClose = () => {
    if (html5QrCode && html5QrCode.isScanning) {
      stopScanner(html5QrCode);
    }
    
    if (onClose) {
      onClose();
    }
  };
  
  const handleCameraChange = (e) => {
    const newCameraId = e.target.value;
    setCameraId(newCameraId);
    
    // Stop current scanning
    if (html5QrCode && html5QrCode.isScanning) {
      stopScanner(html5QrCode).then(() => {
        // Start with new camera
        startScanner(html5QrCode, newCameraId);
      });
    }
  };
  
  return (
    <div style={scannerStyles.container}>
      <div style={scannerStyles.header}>
        <h5>{scannerTitle}</h5>
        <button 
          className="btn btn-sm btn-outline-secondary" 
          onClick={handleClose}
        >
          <i className="bi bi-x"></i>
        </button>
      </div>
      
      {isIOS && (
        <div style={scannerStyles.instructions} className="mb-2">
          <strong>iOS Users:</strong>
          <ul className="mb-0 ps-3">
            <li>Make sure you're using Safari</li>
            <li>Allow camera access when prompted</li>
            <li>If scanning doesn't start, check your browser settings</li>
          </ul>
        </div>
      )}
      
      {cameras.length > 1 && (
        <div className="mb-2">
          <select 
            className="form-select form-select-sm" 
            onChange={handleCameraChange}
            value={cameraId || ''}
          >
            {cameras.map(camera => (
              <option key={camera.id} value={camera.id}>
                {camera.label || `Camera ${camera.id}`}
              </option>
            ))}
          </select>
        </div>
      )}
      
      <div style={scannerStyles.reader}>
        <div id={scannerId}></div>
      </div>
      
      {error && (
        <div className="alert alert-danger" style={scannerStyles.error}>
          {error}
        </div>
      )}
      
      <div style={scannerStyles.message}>
        {isScanning ? (
          <span>
            <i className="bi bi-camera me-2"></i>
            Position barcode in the frame to scan
          </span>
        ) : (
          <button 
            style={{...scannerStyles.button}}
            onClick={() => cameraId && startScanner(html5QrCode, cameraId)}
            disabled={!cameraId}
          >
            <i className="bi bi-camera me-2"></i>
            {!cameraId ? 'No camera available' : 'Start Scanning'}
          </button>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner; 