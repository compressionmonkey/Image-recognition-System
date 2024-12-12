document.addEventListener('DOMContentLoaded', function() {

    const validCustomerIDs = ['a8358', '0e702', '571b6', 'be566', '72d72'];
    let isLoggedIn = false;
    let model = undefined;
    let children = [];

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
            logEvent(`check ${JSON.stringify(data)} ${JSON.stringify(response)}`);
            if (!response.ok) {
                showFailureModal('Scan failed', 'Please retry');
                return;
            }

            // Show confirmation modal with extracted data
            showConfirmationModal(data);

        } catch (error) {
            console.error('Error:', error);
            showFailureModal('Processing Error', 'An error occurred while processing your image. Please try again.');
        }
    }

    function showConfirmationModal(data) {
        const modal = document.getElementById('confirmationModal');
        
        // Populate the form with extracted data
        document.getElementById('confirmAmount').value = data.amount || '';
        document.getElementById('confirmReference').value = data.referenceNo || '';
        
        // Parse and set the date with validation
        let dateValue = '';
        if (data.timestamp) {
            const date = new Date(data.timestamp);
            if (!isNaN(date.getTime())) {
                dateValue = date.toISOString().split('T')[0];
            }
        }
        
        // Fallback to today's date if parsing fails
        if (!dateValue) {
            const today = new Date();
            dateValue = today.toISOString().split('T')[0];
        }
        
        document.getElementById('confirmDate').value = dateValue;

        const dateInput = document.getElementById('confirmDate');
        dateInput.value = dateValue;
        
        // Add event listener for date changes
        dateInput.addEventListener('change', () => validateDate(dateInput));
        
        // Initial validation check
        validateDate(dateInput);
        
        // Show the modal
        window.recognizedText = data.recognizedText;
        modal.style.display = 'flex';
    }

    async function handleConfirmDetails() {
        // Get the values
        const amount = document.getElementById('confirmAmount').value.replace('Nu. ', '');
        const reference = document.getElementById('confirmReference').value;
        const date = document.getElementById('confirmDate').value;

        const confirmedCustomerDetails = {
            amount,
            referenceNo: reference,
            timestamp: date,
            customerID: sessionStorage.getItem('customerID'),
            recognizedText: window.recognizedText
        };

        try {
            const response = await fetch('/confirm-receipt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(confirmedCustomerDetails)
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to confirm receipt');
            }

            // Close the modal
            closeConfirmationModal();
            
            // Show success message
            showToast('Receipt details confirmed', 'success');
            showConfetti(); // Add celebration effect

        } catch (error) {
            console.error('Error:', error);
            showToast('Failed to confirm receipt', 'error');
        }
    }

    function closeConfirmationModal() {
        const modal = document.getElementById('confirmationModal');
        modal.classList.add('fade-out');
        
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('fade-out');
            
            // Reset form values
            document.getElementById('confirmationForm').reset();
        }, 300);
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
                        height: { ideal: 720 },
                        // Add focus capabilities
                        focusMode: ['continuous', 'auto'],
                        focusDistance: { ideal: 0.33 },
                        // Add additional camera controls for better image quality
                        whiteBalanceMode: ['continuous'],
                        exposureMode: ['continuous']
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
                // document.getElementById('capture-photo').onclick = () => handlePhotoCapture(video, stream);

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
            const video = document.getElementById('camera-preview');
            const timer = document.createElement('div');
            timer.className = 'countdown-timer';
            liveView.appendChild(timer);
            let count = 3;

            // Try to focus camera if available
            if (video.srcObject && video.srcObject.getVideoTracks().length > 0) {
                const track = video.srcObject.getVideoTracks()[0];
                logEvent(`track getCapabilities' ${JSON.stringify(track.getCapabilities())}`);
                logEvent(`track focusMode' ${track.getCapabilities().focusMode}`);
                // Check if camera supports focus mode
                if (track.getCapabilities && track.getCapabilities().focusMode) {
                    // Apply focus settings
                    track.applyConstraints({
                        advanced: [
                            { focusMode: "continuous" },  // Continuous auto-focus
                            { focusDistance: 0.33 }      // Focus at about 30cm distance
                        ]
                    }).catch(err => console.log('Focus error:', err));
                }
            }

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
                    <button class="camera-button manual" onclick="showEmptyConfirmationModal()">
                        Manual Entry
                    </button>
                    <button onclick="closeCameraModal()" class="camera-button retry">
                        Close
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

    // Add new function to show empty confirmation modal
    function showEmptyConfirmationModal() {
        const modal = document.getElementById('confirmationModal');
        
        // Clear any existing values
        document.getElementById('confirmAmount').value = '';
        document.getElementById('confirmReference').value = '';
        
        // Set default date to today
        const today = new Date();
        const dateValue = today.toISOString().split('T')[0];
        const dateInput = document.getElementById('confirmDate');
        dateInput.value = dateValue;
        
        // Add event listener for date changes and perform initial validation
        dateInput.removeEventListener('change', validateDate); // Remove any existing listener
        dateInput.addEventListener('change', () => validateDate(dateInput));
        validateDate(dateInput); // Perform initial validation
        
        // Show the modal
        modal.style.display = 'flex';
        
        // Close the camera modal
        closeCameraModal();
    }

    function validateDate(dateInput) {
        const selectedDate = new Date(dateInput.value);
        const today = new Date(); // Using your fixed date
        
        // Reset time portion for accurate date comparison
        selectedDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        
        const validationMessage = document.getElementById('dateValidationMessage');
        
        if (selectedDate.getTime() !== today.getTime()) {
            validationMessage.textContent = 'Receipt Date is not today. Are you sure you want to add this?';
            validationMessage.classList.add('show');
            validationMessage.style.display = 'block';
        } else {
            validationMessage.classList.remove('show');
            validationMessage.style.display = 'none';
        }
    }

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

    async function routeUser() {
        const customerID = sessionStorage.getItem('customerID');
        
        try {
            const response = await fetch(`/api/dashboard-url?customerID=${customerID}`);
            const data = await response.json();
            
            if (data.url) {
                // Open the URL in a new tab
                window.open(data.url, '_blank');
            } else {
                console.error('Dashboard URL not found');
                showToast('Dashboard URL not found', 'error');
            }
        } catch (error) {
            console.error('Error fetching dashboard URL:', error);
            showToast('Error accessing dashboard', 'error');
        }
    }

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
    window.handleConfirmDetails = handleConfirmDetails;
    window.closeConfirmationModal = closeConfirmationModal;
    window.routeUser = routeUser;
    window.showEmptyConfirmationModal = showEmptyConfirmationModal;

});