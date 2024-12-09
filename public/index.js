document.addEventListener('DOMContentLoaded', function() {

    const validCustomerIDs = ['a8358', '0e702', '571b6', 'be566', '72d72'];
    let isLoggedIn = false;
    let model = undefined;
    let children = [];
    const MIN_DETECTION_CONFIDENCE = 0.5;

    // Add a flag to control prediction loop
    let isPredicting = false;

    // Update the window load event listener to show dashboard button if logged in
    window.addEventListener('load', () => {
        const loginOverlay = document.getElementById('loginOverlay');
        // const userNav = document.getElementById('userNav');
        const mainContent = document.getElementById('mainContent');
        // const heroSection = document.querySelector('.hero-section');
        // const cameraContainer = document.getElementById('camera-container');
        
        if (sessionStorage.getItem('isLoggedIn') === 'true') {
            isLoggedIn = true;
            loginOverlay.style.display = 'none';
            // userNav.style.display = 'block';
            mainContent.style.display = 'block';
            
            // // Hide initial content
            // if (heroSection) heroSection.style.display = 'none';
            // if (cameraContainer) cameraContainer.style.display = 'none';
        }
    });

    async function handleManualSubmit() {
        const amount = parseFloat(document.getElementById('amount').value);
        
        // Validate amount
        if (!amount || isNaN(amount) || amount <= 0) {
            showToast('Please enter a valid amount', 'error');
            return;
        }
        
        try {
            // Send data to server
            const response = await fetch('/record-cash', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: amount
                })
            });

            const data = await response.json();
            
            if (data.success) {
                closeManualEntryModal();
                showToast('Receipt added successfully', 'success');
            } else {
                showToast(data.error || 'Failed to add receipt', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showToast('Failed to add receipt', 'error');
        }
    }

    // Add event listener for the Add Photo button
    document.getElementById('addPhotoBtn').addEventListener('click', showPhotoOptions);

     // Add manual entry button handler
     document.getElementById('addManualBtn').addEventListener('click', showManualEntryModal);

    // Load COCO-SSD model when page loads
    cocoSsd.load().then(function(loadedModel) {
        model = loadedModel;
        console.log('COCO-SSD model loaded');
    });

    function showPhotoOptions() {
        const modal = document.getElementById('photoOptionsModal');
        modal.style.display = 'flex';
    }

    function closePhotoOptions() {
        const modal = document.getElementById('photoOptionsModal');
        modal.style.display = 'none';
    }

    function showManualEntryModal() {
        document.getElementById('manualEntryModal').style.display = 'flex';
    }

    function validateLogin() {
        const loginButton = document.getElementById('login-button');
        const spinner = document.getElementById('loginSpinner');
        const loginMessage = document.getElementById('loginMessage');
        const mainContent = document.getElementById('mainContent');

        loginButton.disabled = true;
        spinner.style.display = 'inline-block';
        loginMessage.textContent = '';

        setTimeout(() => {
            const customerID = document.getElementById('customerID').value.trim();
            
            if (validCustomerIDs.includes(customerID)) {
                isLoggedIn = true;
                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('customerID', customerID);
                
                // Fade out login overlay and show main content
                const loginOverlay = document.getElementById('loginOverlay');
                loginOverlay.style.opacity = '0';
                loginOverlay.style.transition = 'opacity 0.3s ease';
                setTimeout(() => {
                    loginOverlay.style.display = 'none';
                    mainContent.style.display = 'block';
                    document.getElementById('userNav').style.display = 'block';
                }, 300);
            } else {
                loginMessage.textContent = 'Invalid Customer ID. Please try again.';
                loginButton.disabled = false;
                spinner.style.display = 'none';
            }
        }, 1000);
    }

    function closeCameraModal() {
        isPredicting = false;  // Stop prediction loop
        
        // Clear all highlighters first
        const liveView = document.getElementById('liveView');
        if (liveView) {
            children.forEach(child => liveView.removeChild(child));
            children = [];
        }

        // Existing camera modal close logic
        const cameraModal = document.querySelector('.camera-modal');
        if (cameraModal) {
            const video = document.getElementById('camera-preview');
            if (video && video.srcObject) {
                video.srcObject.getTracks().forEach(track => track.stop());
            }
            cameraModal.remove();
        }
    }

    function closeManualEntryModal() {
        const modal = document.getElementById('manualEntryModal');
        modal.classList.add('fade-out');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('fade-out');
            document.getElementById('manualReceiptForm').reset();
        }, 300);
    }

    // Add toast functionality
    function showToast(message, type = 'info') {
        // Remove existing toast if any
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 100);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Update the saveImageToDevice function
    async function saveImageToDevice(imageData, filename = 'receipt.jpg') {
        try {
            // Convert base64 to blob
            const base64Response = await fetch(`data:image/jpeg;base64,${imageData}`);
            const blob = await base64Response.blob();

            // For iOS Safari and other mobile browsers
            if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                // Create temporary link and trigger download
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
                showToast('Image saved to downloads', 'success');
            } else {
                // For desktop browsers, try using File System Access API first
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [{
                            description: 'JPEG Image',
                            accept: { 'image/jpeg': ['.jpg', '.jpeg'] }
                        }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    showToast('Image saved successfully!', 'success');
                } catch (err) {
                    // Fallback for browsers that don't support File System Access API
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = filename;
                    link.click();
                    URL.revokeObjectURL(link.href);
                    showToast('Image downloaded successfully', 'success');
                }
            }
        } catch (error) {
            console.error('Error saving image:', error);
            showToast('Failed to save image', 'error');
        }
    }

    // Add the showFailureModal function
    function showFailureModal(title, message, details = '') {
        const modal = document.getElementById('failureModal');
        const failureContent = modal.querySelector('.failure-content');

        failureContent.innerHTML = `
            <svg class="error-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <circle class="error-circle" cx="26" cy="26" r="25" fill="none"/>
                <path class="error-x" fill="none" d="M16 16 36 36 M36 16 16 36"/>
            </svg>
            
            <h2>${title}</h2>
            
            <div class="error-message">
                ${message}
            </div>
            
            ${details ? `
                <div class="error-details">
                    ${details}
                </div>
            ` : ''}
            
            <button class="try-again-button" onclick="closeFailureModal()">Try Again</button>
        `;

        modal.style.display = 'flex';
    }

    // Add the closeFailureModal function
    function closeFailureModal() {
        const modal = document.getElementById('failureModal');
        modal.classList.add('fade-out');
        
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('fade-out');
        }, 300);
    }

    // Add confetti animation function
    function showConfetti() {
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            
            // Create confetti from both sides
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
            });
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
            });
        }, 250);
    }

    async function uploadToServer(imageData) {
        try {
            // First, close any existing modals
            const photoOptionsModal = document.getElementById('photoOptionsModal');
            const cameraModal = document.querySelector('.camera-modal');
            
            // Close photo options modal if open
            if (photoOptionsModal) {
                photoOptionsModal.style.display = 'none';
            }
            
            // Close camera modal if open
            if (cameraModal) {
                closeCameraModal();
            }

            // Make API call
            const customerID = sessionStorage.getItem('customerID');
            const response = await fetch('/vision-api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    image: imageData,
                    deviceInfo: navigator.userAgent,
                    screenResolution: `${window.screen.width}x${window.screen.height}`,
                    imageSize: imageData.length,
                    customerID: customerID,
                    startTime: new Date().getTime()
                })
            });

            const data = await response.json();

            // First check if response is not ok
            if (!response.ok) {
                showFailureModal('Scan failed', 'Please retry');
                return;
            }

            // Then check the data structure for textAnnotations
            if (!data || !data.responses || !data.responses[0] || !data.responses[0].textAnnotations || !data.responses[0].textAnnotations[0]) {
                showFailureModal('No Text Detected', 'We couldn\'t detect any clear text in the image. Please try again with a clearer image.');
                return;
            }

            const extractedText = data.responses[0].textAnnotations[0].description;
            if (!extractedText || extractedText.trim() === '') {
                showFailureModal('No Text Detected', 'We couldn\'t detect any clear text in the image. Please try again with a clearer image.');
                return;
            }

            // Log successful text extraction
            console.log('Text Extraction Success:', {
                timestamp: new Date().toISOString(),
                textLength: extractedText.length,
                preview: extractedText.substring(0, 100) + '...'
            });

            // If we get here, we have a successful response with text
            const modal = document.getElementById('successModal');
            const successContent = modal.querySelector('.success-content');

            // Update success modal content with formatted text
            successContent.innerHTML = `
                <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                    <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
                    <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                </svg>
                
                <h2>Success!</h2>
                
                <div class="receipt-text">
                    <h4>Detected Text:</h4>
                    <pre>${extractedText.replace(/\n/g, '<br>')}</pre>
                </div>
                
                <button class="close-button">Done</button>
            `;

            // Show success modal and confetti
            modal.style.display = 'flex';
            showConfetti();

            // Handle close button
            const closeButton = modal.querySelector('.close-button');
            closeButton.addEventListener('click', function handleClose() {
                closeButton.disabled = true;
                closeButton.removeEventListener('click', handleClose);
                modal.classList.add('fade-out');
                
                setTimeout(() => {
                    modal.style.display = 'none';
                    modal.classList.remove('fade-out');
                    closeButton.disabled = false;
                }, 300);
            });

        } catch (error) {
            console.error('Error:', error);
            showFailureModal('Processing Error', 'An error occurred while processing your image. Please try again.');
        }
    }
    
    async function processImage(file) {
        showToast('Processing image...', 'info');

        try {
            const reader = new FileReader();
            reader.onload = async function(event) {
                const img = new Image();
                img.onload = async function() {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Dynamic resolution adjustment
                    let { width, height } = img;
                    const maxDim = Math.min(1920, Math.max(width, height));
                    if (Math.max(width, height) > maxDim) {
                        const scale = maxDim / Math.max(width, height);
                        width *= scale;
                        height *= scale;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Apply pre-processing
                    ctx.filter = 'contrast(1.2) brightness(1.1)';
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Compress dynamic range
                    const imageData = ctx.getImageData(0, 0, width, height);
                    compressDynamicRange(imageData);
                    ctx.putImageData(imageData, 0, 0);
                    
                    const finalImage = canvas.toDataURL('image/jpeg', 0.7);
                    const base64Image = finalImage.split(',')[1];
                    
                    await uploadToServer(base64Image);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error:', error);
            showToast('Processing failed. Please try again.', 'error');
        }
    }

    // Add dynamic range compression helper
    function compressDynamicRange(imageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            // Apply logarithmic transformation to compress dynamic range
            data[i] = Math.log(1 + data[i]) * 255 / Math.log(256);
            data[i+1] = Math.log(1 + data[i+1]) * 255 / Math.log(256);
            data[i+2] = Math.log(1 + data[i+2]) * 255 / Math.log(256);
        }
    }

    // Add handlePhotoOption function
    async function handlePhotoOption(source) {
        if (source === 'camera') {
            try {
                if (!model) {
                    showToast('Please wait, AI model is loading...', 'info');
                    return;
                }

                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                });

                // Create and show camera modal
                const cameraModal = createCameraModal();
                document.body.appendChild(cameraModal);
                
                // Close photo options modal
                closePhotoOptions();
                
                const video = document.getElementById('camera-preview');
                const liveView = document.getElementById('liveView');
                
                if (cameraModal) cameraModal.style.display = 'flex';
                if (video) {
                    video.srcObject = stream;
                    // Start detection once video is playing
                    video.addEventListener('loadeddata', async function() {
                        isPredicting = true;
                        await predictWebcam(video, liveView);
                    });
                }

                // Handle capture button
                document.getElementById('capture-photo').onclick = () => handlePhotoCapture(video, stream);

            } catch (error) {
                console.error('Error accessing camera:', error);
                showToast('Camera access failed', 'error');
                closeCameraModal();
            }
        } else {
            // Gallery option
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    closePhotoOptions();
                    if (isLoggedIn) {
                        await processImage(file);
                    } else {
                        const loginOverlay = document.getElementById('loginOverlay');
                        if (loginOverlay) loginOverlay.style.display = 'block';
                    }
                }
            };
            input.click();
        }
    }

     // Add these variables at the top level
     let previousPhoneBox = null;
     let lastFrameTime = null;
     const SPEED_THRESHOLD = 50; // Adjust based on testing
     const SHARPNESS_THRESHOLD = 50; // Adjust based on testing
     const MOTION_MEMORY = 5; // Number of recent motion measurements to track
     const recentMotions = [];
    // Add this function to create and animate the countdown timer

    function showCountdownTimer() {

        return new Promise((resolve) => {
            const liveView = document.getElementById('liveView');
            const timer = document.createElement('div');
            timer.className = 'countdown-timer';
            liveView.appendChild(timer);
            let count = 3;

            function updateTimer() {
                timer.textContent = count;
                timer.classList.remove('countdown-animation');
                void timer.offsetWidth; // Trigger reflow
                timer.classList.add('countdown-animation');           

                if (count > 1) {
                    count--;
                    setTimeout(updateTimer, 1000);
                } else {
                    setTimeout(() => {
                        timer.remove();
                        resolve();
                    }, 1000);
                }
            }

            updateTimer();
        });
    }

    // Update the predictWebcam function to include the countdown
     async function predictWebcam(video, liveView) {
        if (!isPredicting) return;

        children.forEach(child => liveView.removeChild(child));
        children = [];

        const guidanceText = document.getElementById('guidanceText');
        const currentTime = performance.now();
        
        try {
            const predictions = await model.detect(video, 1, 0.7);
            
            if (!isPredicting) return;
            
            const phoneDetection = predictions.find(p => p.class === 'cell phone' && p.score > 0.7);
            
            if (phoneDetection) {
                // Calculate scale factors and create current phone box
                const videoWidth = video.videoWidth;
                const videoHeight = video.videoHeight;
                const liveViewWidth = liveView.offsetWidth;
                const liveViewHeight = liveView.offsetHeight;
                
                const scaleX = liveViewWidth / videoWidth;
                const scaleY = liveViewHeight / videoHeight;

                const currentPhoneBox = {
                    x: phoneDetection.bbox[0] * scaleX,
                    y: phoneDetection.bbox[1] * scaleY,
                    width: phoneDetection.bbox[2] * scaleX * 2,
                    height: phoneDetection.bbox[3] * scaleY * 1.5
                };

                // Calculate motion and quality metrics
                const qualityMetrics = analyzeFrameQuality(
                    currentPhoneBox, 
                    previousPhoneBox, 
                    lastFrameTime ? (currentTime - lastFrameTime) : 16.67 // Default to 60fps if no previous frame
                );

                // Create and style highlighter
                const highlighter = document.createElement('div');
                highlighter.classList.add('highlighter');
                highlighter.style.left = `${currentPhoneBox.x}px`;
                highlighter.style.top = `${currentPhoneBox.y}px`;
                highlighter.style.width = `${currentPhoneBox.width}px`;
                highlighter.style.height = `${currentPhoneBox.height}px`;

                // Calculate area ratio
                const areaRatio = (currentPhoneBox.width / videoWidth) * (currentPhoneBox.height / videoHeight);
                const isMobileOrTablet = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                const minRatio = isMobileOrTablet ? 0.4 : 0.1;
                const maxRatio = 1;
                const isGoodRatio = areaRatio >= minRatio && areaRatio < maxRatio;
                
                // Update UI with all metrics
                guidanceText.innerHTML = `
                    <div class="detection-stats">
                        <p>Status: <span style="color: ${isGoodRatio && !qualityMetrics.isBlurred ? '#4CAF50' : '#FFA500'}">Active</span></p>
                        <p>Area Ratio: <span class="ratio-value">${areaRatio.toFixed(3)}</span></p>
                        <p>Device: ${isMobileOrTablet ? 'Mobile/Tablet' : 'Desktop'}</p>
                        <p>Movement: <span style="color: ${qualityMetrics.isStable ? '#4CAF50' : '#FFA500'}">${qualityMetrics.movement.toFixed(1)}</span></p>
                        <p>Sharpness: <span style="color: ${qualityMetrics.isSharp ? '#4CAF50' : '#FFA500'}">${qualityMetrics.sharpness.toFixed(1)}</span></p>
                        ${getGuidanceMessage(qualityMetrics, isGoodRatio, areaRatio, minRatio)}
                    </div>
                `;

                // Only capture if all conditions are met
                if (isGoodRatio && !qualityMetrics.isBlurred && qualityMetrics.isStable) {
                    isPredicting = false; // Stop predictions during countdown    

                    try {
                        // Show countdown timer
                        await showCountdownTimer();

                        // Take the photo after countdown
                        await handlePhotoCapture(video, video.srcObject);
                        logEvent(`areaRatio: ${areaRatio}`);
                        return;
                    } catch (error) {
                        console.error('Error during countdown/capture:', error);
                        isPredicting = true; // Resume predictions if there's an error
                    }
                }

                // Update state for next frame
                previousPhoneBox = currentPhoneBox;
                lastFrameTime = currentTime;

                // Add highlighter to view
                liveView.appendChild(highlighter);
                children.push(highlighter);
            }

            if (video.srcObject && isPredicting) {
                setTimeout(() => {
                    requestAnimationFrame(() => predictWebcam(video, liveView));
                }, 200);
            }
        } catch (error) {
            console.error('Prediction error:', error);
            if (isPredicting) {
                setTimeout(() => {
                    requestAnimationFrame(() => predictWebcam(video, liveView));
                }, 200);
            }
        }
    }

    function analyzeFrameQuality(currentBox, previousBox, timeDelta) {
        const metrics = {
            movement: 0,
            sharpness: 100, // Default to perfect sharpness
            isBlurred: false,
            isStable: true,
            isSharp: true
        };

        // Calculate movement if we have previous frame data
        if (previousBox) {
            const prevCenter = {
                x: previousBox.x + (previousBox.width / 2),
                y: previousBox.y + (previousBox.height / 2)
            };
            
            const currentCenter = {
                x: currentBox.x + (currentBox.width / 2),
                y: currentBox.y + (currentBox.height / 2)
            };
            
            // Calculate movement speed (pixels per second)
            const distance = Math.sqrt(
                Math.pow(currentCenter.x - prevCenter.x, 2) + 
                Math.pow(currentCenter.y - prevCenter.y, 2)
            );
            
            const speed = distance / (timeDelta / 1000); // Convert to pixels per second
            
            // Add to recent motions array
            recentMotions.push(speed);
            if (recentMotions.length > MOTION_MEMORY) {
                recentMotions.shift();
            }
            
            // Calculate average recent motion
            metrics.movement = recentMotions.reduce((a, b) => a + b, 0) / recentMotions.length;
            metrics.isStable = metrics.movement < SPEED_THRESHOLD;
        }

        // Estimate sharpness based on movement
        // This is a simple approximation - could be enhanced with actual image analysis
        metrics.sharpness = Math.max(0, 100 - (metrics.movement / 2));
        metrics.isSharp = metrics.sharpness > SHARPNESS_THRESHOLD;
        
        // Determine if image is too blurred
        metrics.isBlurred = !metrics.isSharp || !metrics.isStable;

        return metrics;
    }

    function getGuidanceMessage(metrics, isGoodRatio, areaRatio, minRatio) {
        if (!isGoodRatio) {
            return `<p style="color: #FFA500">${areaRatio < minRatio ? 'Move closer' : 'Move further'}</p>`;
        }
        if (!metrics.isStable) {
            return '<p style="color: #FFA500">Hold phone more steady</p>';
        }
        if (!metrics.isSharp) {
            return '<p style="color: #FFA500">Image too blurry</p>';
        }
        return '<p style="color: #4CAF50">Perfect! Hold steady...</p>';
    }


    // Modify your camera modal HTML to include the highlighter container
    function createCameraModal() {
        const cameraModal = document.createElement('div');
        cameraModal.className = 'camera-modal';
        cameraModal.innerHTML = `
            <div class="camera-content">
                <div id="liveView" class="videoView">
                    <video id="camera-preview" autoplay playsinline></video>
                </div>
                <div class="camera-guidance">
                    <div class="detection-stats">
                        <p id="guidanceText"></p>
                        <p id="areaRatioDisplay"></p>
                    </div>
                </div>
                <div class="camera-controls">
                    <button id="capture-photo" class="camera-button capture">
                        📸 Capture
                    </button>
                    <button onclick="closeCameraModal()" class="camera-button retry">
                        ❌ Cancel
                    </button>
                </div>
            </div>
        `;
        return cameraModal;
    }

    async function handlePhotoCapture(video, stream) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        // Stop camera stream
        stream.getTracks().forEach(track => track.stop());
        
        // Convert to file and process
        return new Promise((resolve, reject) => {
            canvas.toBlob(async (blob) => {
                const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
                
                // Save image with timestamp
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `receipt_${timestamp}.jpg`;
                
                try {
                    // Convert blob to base64 for saving
                    const reader = new FileReader();
                    reader.onload = async function(event) {
                        const base64Image = event.target.result.split(',')[1];
                        await saveImageToDevice(base64Image, filename);
                        
                        // Continue with normal flow
                        closeCameraModal();
                        closePhotoOptions();
                        if (isLoggedIn) {
                            await processImage(file);
                        } else {
                            document.getElementById('loginOverlay').style.display = 'block';
                        }
                        resolve();
                    };
                    reader.readAsDataURL(blob);
                } catch (error) {
                    console.error('Error saving image:', error);
                    showToast('Failed to save image', 'error');
                    
                    // Continue with normal flow even if save fails
                    closeCameraModal();
                    closePhotoOptions();
                    if (isLoggedIn) {
                        await processImage(file);
                    } else {
                        document.getElementById('loginOverlay').style.display = 'block';
                    }
                    resolve();
                }
            }, 'image/jpeg', 0.8);
        });
    }

    // Add this after your existing utility functions
    // function lightPreProcess(video) {
    //     const canvas = document.createElement('canvas');
    //     const ctx = canvas.getContext('2d');
        
    //     const MAX_DIMENSION = 1024;
    //     const scale = MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight);
    //     canvas.width = video.videoWidth * scale;
    //     canvas.height = video.videoHeight * scale;
        
    //     // Draw original image
    //     ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
    //     // Get image data for analysis
    //     const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    //     const data = imageData.data;
        
    //     // Calculate image quality metrics
    //     let totalBrightness = 0;
    //     let blurScore = 0;
        
    //     for (let i = 0; i < data.length; i += 4) {
    //         // Calculate brightness
    //         const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    //         totalBrightness += brightness;
            
    //         // Calculate local contrast for blur detection
    //         if (i > 0 && i < data.length - 4) {
    //             const diff = Math.abs(data[i] - data[i + 4]);
    //             blurScore += diff;
    //         }
    //     }
        
    //     const avgBrightness = totalBrightness / (data.length / 4);
    //     const normalizedBlurScore = blurScore / (data.length / 4);
        
    //     // Update guidance text based on image quality
    //     const guidanceText = document.getElementById('guidanceText');
    //     if (avgBrightness < 50) {
    //         guidanceText.textContent = 'More light needed';
    //         guidanceText.style.color = '#FFA500';
    //         return canvas;
    //     }
    //     if (avgBrightness > 200) {
    //         guidanceText.textContent = 'Too bright, reduce light';
    //         guidanceText.style.color = '#FFA500';
    //         return canvas;
    //     }
    //     if (normalizedBlurScore < 10) {
    //         guidanceText.textContent = 'Image too blurry';
    //         guidanceText.style.color = '#FFA500';
    //         return canvas;
    //     }
        
    //     // Apply enhancements
    //     ctx.filter = 'contrast(1.2) brightness(1.1)';
    //     ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
    //     return canvas;
    // }

    // Make functions available globally
    window.handlePhotoOption = handlePhotoOption;
    window.showPhotoOptions = showPhotoOptions;
    window.closePhotoOptions = closePhotoOptions;
    window.closeCameraModal = closeCameraModal;
    window.validateLogin = validateLogin;
    window.showManualEntryModal = showManualEntryModal;
    window.closeManualEntryModal = closeManualEntryModal;
    window.closeFailureModal  = closeFailureModal;
    window.handleManualSubmit  = handleManualSubmit;

    // Example function to log an event
    async function logEvent(message) {
        try {
            const response = await fetch('/api/logEvent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message
                })
            });

            if (!response.ok) {
                console.error('Failed to log event:', response.statusText);
            }
        } catch (error) {
            console.error('Error logging event:', error);
        }
    }

});