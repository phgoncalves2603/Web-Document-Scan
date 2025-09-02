import React, { useEffect, useRef, useState } from "react";

function App() {
  const [scanner, setScanner] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [cameraScanResult, setCameraScanResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  // Wait until OpenCV and jscanify are loaded
  useEffect(() => {
    const waitForLibs = () => {
      if (window.cv && window.jscanify) {
        setScanner(new window.jscanify());
      } else {
        setTimeout(waitForLibs, 100);
      }
    };
    waitForLibs();

    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    if (!scanner) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
        },
      });
      streamRef.current = stream;

      // Wait until video element is rendered
      const waitForVideo = () =>
        new Promise((resolve) => {
          const check = () => {
            if (videoRef.current) resolve();
            else requestAnimationFrame(check);
          };
          check();
        });

      await waitForVideo();

      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();

      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");

      intervalRef.current = setInterval(() => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const resultCanvas = scanner.highlightPaper(canvas);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(resultCanvas, 0, 0);
        } catch (err) {
          console.warn("Highlight error:", err);
        }
      }, 200);

      setCameraActive(true);
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Could not access camera: " + err.message);
    }
  };

  const captureFromCamera = () => {
    if (!scanner || !canvasRef.current) return;
    const canvas = canvasRef.current;

    try {
      const scan = scanner.extractPaper(canvas, 500, 700);
      const mat = window.cv.imread(canvas);
      const contour = scanner.findPaperContour(mat);
      const corners = scanner.getCornerPoints(contour);
      setCameraScanResult({ scan, corners });
    } catch (err) {
      alert("Capture failed. Try again.");
    }
  };

  const onFileChange = (e) => {
    if (!scanner) return;
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      try {
        const hl = scanner.highlightPaper(img);
        const scan = scanner.extractPaper(img, 500, 700);
        const mat = window.cv.imread(img);
        const contour = scanner.findPaperContour(mat);
        const corners = scanner.getCornerPoints(contour);
        setUploadResult({ hl, scan, corners });
      } catch (err) {
        alert("Error processing image.");
      }
    };
    img.src = URL.createObjectURL(file);
  };

  const saveImage = (canvas) => {
    const link = document.createElement("a");
    link.download = "scanned.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "sans-serif",
        maxWidth: 800,
        margin: "auto",
      }}
    >
      <h1>jscanify Document Scanner Demo</h1>

      {/* Upload Option */}
      <section>
        <h2>Scan From File</h2>
        <input type="file" accept="image/*" onChange={onFileChange} />
        {uploadResult && (
          <div>
            <h3>Highlighted</h3>
            <div
              ref={(el) =>
                el && uploadResult.hl && el.appendChild(uploadResult.hl)
              }
            />

            <h3>Scanned</h3>
            <div style={{ position: "relative", display: "inline-block" }}>
              <div
                ref={(el) =>
                  el && uploadResult.scan && el.appendChild(uploadResult.scan)
                }
              />
              <button
                onClick={() => saveImage(uploadResult.scan)}
                style={{ position: "absolute", top: 8, right: 8 }}
              >
                💾 Save
              </button>
            </div>

            <h4>Corner Points</h4>
            <pre>{JSON.stringify(uploadResult.corners, null, 2)}</pre>
          </div>
        )}
      </section>

      {/* Camera Option */}
      <section style={{ marginTop: 40 }}>
        <h2>Live Detection</h2>
        <button onClick={cameraActive ? stopCamera : startCamera}>
          {cameraActive ? "Stop Camera" : "Start Camera"}
        </button>

        {/* Always render video and canvas to avoid ref issues */}
        <video ref={videoRef} style={{ display: "none" }} />
        <canvas
          ref={canvasRef}
          style={{ width: "100%", marginTop: 10, border: "1px solid #ccc" }}
        />

        {cameraActive && (
          <>
            <button onClick={captureFromCamera} style={{ marginTop: 10 }}>
              📸 Capture Scan
            </button>
          </>
        )}

        {cameraScanResult && (
          <>
            <h3>Scanned from Camera</h3>
            <div style={{ position: "relative", display: "inline-block" }}>
              <div
                ref={(el) =>
                  el &&
                  cameraScanResult.scan &&
                  el.appendChild(cameraScanResult.scan)
                }
              />
              <button
                onClick={() => saveImage(cameraScanResult.scan)}
                style={{ position: "absolute", top: 8, right: 8 }}
              >
                Save
              </button>
            </div>

            <h4>Corner Points</h4>
            <pre>{JSON.stringify(cameraScanResult.corners, null, 2)}</pre>
          </>
        )}
      </section>
    </div>
  );
}

export default App;
