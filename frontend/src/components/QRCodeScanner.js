import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { isValidQRFormat } from '../utils/qrCodeGenerator';

/**
 * QR Code Scanner component for scanning QR codes
 * 
 * @param {Object} props
 * @param {function} props.onScan - Callback when a QR code is scanned
 * @param {function} props.onError - Callback when an error occurs
 * @param {boolean} props.showAlert - Show an alert message with scanned data (default: false)
 */
function QRCodeScanner({ onScan, onError, showAlert = false }) {
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    // Initialize scanner when component mounts
    scannerRef.current = new Html5QrcodeScanner(
      'reader', 
      { 
        fps: 10,
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: ['scanner']
      },
      false
    );

    // Handle successful scan
    const handleScanSuccess = (decodedText, decodedResult) => {
      setScanning(false);
      console.log(`Scan result: ${decodedText}`, decodedResult);
      
      // Check if valid ReactStock QR format
      if (isValidQRFormat(decodedText)) {
        if (showAlert) {
          alert(`Successfully scanned QR code: ${decodedText}`);
        }
        
        if (onScan) {
          onScan(decodedText, decodedResult);
        }
      } else {
        const message = 'Invalid QR code format. This is not a ReactStock QR code.';
        console.warn(message);
        
        if (showAlert) {
          alert(message);
        }
        
        if (onError) {
          onError(new Error(message));
        }
      }
      
      // Stop the scanner after successful scan
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };

    // Handle scan errors
    const handleScanError = (error) => {
      console.error('QR code scan error:', error);
      if (onError) {
        onError(error);
      }
    };

    return () => {
      // Cleanup the scanner when component unmounts
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, [onScan, onError, showAlert]);

  const startScanning = () => {
    if (scannerRef.current && !scanning) {
      scannerRef.current.render(handleScanSuccess, handleScanError);
      setScanning(true);
    }
  };

  const stopScanning = () => {
    if (scannerRef.current && scanning) {
      scannerRef.current.clear();
      setScanning(false);
    }
  };

  return (
    <div className="qr-scanner-container">
      <div id="reader" className="mb-3"></div>
      <div className="d-flex justify-content-center mb-3">
        {!scanning ? (
          <button 
            type="button" 
            className="btn btn-primary btn-sm" 
            onClick={startScanning}
          >
            Start Scanner
          </button>
        ) : (
          <button 
            type="button" 
            className="btn btn-danger btn-sm" 
            onClick={stopScanning}
          >
            Stop Scanner
          </button>
        )}
      </div>
    </div>
  );
}

export default QRCodeScanner; 