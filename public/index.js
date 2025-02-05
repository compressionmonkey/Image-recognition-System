document.addEventListener('DOMContentLoaded', function() {

    const validCustomerIDs = ['a8358', '0e702', '571b6', 'be566', '72d72'];
    let isLoggedIn = false;
    let model = undefined;
    let children = [];
    let currentConfirmationData = null;

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
        // Get and disable the submit button
        const submitButton = document.querySelector('.photo-option-btn[onclick="handleManualSubmit()"]');
        submitButton.disabled = true;
        submitButton.style.opacity = '0.5';
        submitButton.style.cursor = 'not-allowed';

        const amount = parseFloat(document.getElementById('amount').value);
        const particulars = document.getElementById('particulars').value;
        const customerID = sessionStorage.getItem('customerID');
        
        // Validate amount
        if (!amount || isNaN(amount) || amount <= 0) {
            showToast('Please enter a valid amount', 'error');
            // Re-enable button if validation fails
            submitButton.disabled = false;
            submitButton.style.opacity = '1';
            submitButton.style.cursor = 'pointer';
            return;
        }

        if (!particulars) {
            showToast('Please enter valid particulars', 'error');
            // Re-enable button if validation fails
            submitButton.disabled = false;
            submitButton.style.opacity = '1';
            submitButton.style.cursor = 'pointer';
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
                    amount: amount,
                    paymentMethod: 'Cash',
                    customerID: customerID,
                    particulars: particulars
                })
            });

            const data = await response.json();
            
            if (data.success) {
                closeManualEntryModal();
                showToast('Receipt added successfully', 'success');
                showConfetti();
            } else {
                // Re-enable button if API returns error
                submitButton.disabled = false;
                submitButton.style.opacity = '1';
                submitButton.style.cursor = 'pointer';
                showToast(data.error || 'Failed to add receipt', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            // Re-enable button if API call fails
            submitButton.disabled = false;
            submitButton.style.opacity = '1';
            submitButton.style.cursor = 'pointer';
            showToast('Failed to add receipt', 'error');
        }
    }

    // Add event listener for the Add Photo button
    document.getElementById('addPhotoBtn').addEventListener('click', showPhotoOptions);
    
    document.getElementById('addCashBtn').addEventListener('click', showManualEntryModal);

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
        // Clear any existing values
        document.getElementById('confirmAmount').value = '';
        document.getElementById('confirmReference').value = '';
        
        // Set default date to today and validate
        const today = new Date();
        const dateValue = today.toISOString().split('T')[0];
        const dateInput = document.getElementById('confirmDate');
        dateInput.value = dateValue;
        
        // Remove any existing listener before adding a new one
        dateInput.removeEventListener('change', validateDate);
        dateInput.addEventListener('change', () => validateDate(dateInput.value));
        validateDate(dateInput.value);
        
        // Show the modal
        const modal = document.getElementById('manualEntryModal');
        modal.style.display = 'flex';  // Make sure we're targeting the correct modal
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
        if (modal) {
            // Re-enable the submit button
            const submitButton = modal.querySelector('.photo-option-btn[onclick="handleManualSubmit()"]');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.style.opacity = '1';
                submitButton.style.cursor = 'pointer';
            }
            modal.classList.add('fade-out');
            setTimeout(() => {
                modal.style.display = 'none';
                modal.classList.remove('fade-out');
                document.getElementById('manualReceiptForm').reset();
            }, 300);
        }
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
    async function saveImageToDevice(imageData, filename = 'receipt.jpg', shouldAutoDownload) {
        try {
            // First upload to S3
            const response = await fetch('/upload-receipt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageData,
                    filename
                })
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Upload failed');
            }

            // Create and show preview modal with the S3 URL
            const previewModal = document.createElement('div');
            previewModal.className = 'image-preview-modal';
            previewModal.innerHTML = `
                <div class="preview-content">
                    <div class="preview-header">
                        <h3>Receipt Preview</h3>
                    </div>
                    <div class="image-container">
                        <img src="${data.url}" 
                             alt="Receipt Preview" 
                             loading="lazy" 
                             decoding="async">
                        <div class="zoom-hint">
                            <span class="icon">🔍</span>
                            Pinch or scroll to zoom
                        </div>
                    </div>
                    <div class="preview-controls">
                        <button class="preview-button retake-btn">
                            <span class="icon">📸</span> Retake
                        </button>
                        <button class="preview-button close-btn">
                        <span class="icon">➡️</span> Proceed
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(previewModal);
            
            // Add to recent files
            addToRecentFiles(imageData, filename);

            // Force reflow then add show class for animation
            previewModal.offsetHeight;
            previewModal.classList.add('show');

            // Store URL in session storage for later use
            sessionStorage.setItem('lastReceiptUrl', data.url);

            // Setup touch handling for mobile
            let touchStartY = 0;
            previewModal.addEventListener('touchstart', (e) => {
                touchStartY = e.touches[0].clientY;
            });

            previewModal.addEventListener('touchmove', (e) => {
                const deltaY = e.touches[0].clientY - touchStartY;
                if (deltaY > 100) {
                    closePreviewModal();
                }
            });

            // Setup image zoom
            const img = previewModal.querySelector('img');
            let scale = 1;
            let panning = false;
            let pointX = 0;
            let pointY = 0;
            let start = { x: 0, y: 0 };

            img.addEventListener('wheel', (e) => {
                e.preventDefault();
                const xs = (e.clientX - img.offsetLeft) / scale;
                const ys = (e.clientY - img.offsetTop) / scale;
                
                scale += e.deltaY * -0.01;
                scale = Math.min(Math.max(1, scale), 4);
                
                img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
            });

            img.addEventListener('mousedown', (e) => {
                e.preventDefault();
                start = { x: e.clientX - pointX, y: e.clientY - pointY };
                panning = true;
            });

            img.addEventListener('mousemove', (e) => {
                e.preventDefault();
                if (!panning) return;
                pointX = (e.clientX - start.x);
                pointY = (e.clientY - start.y);
                img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
            });

            img.addEventListener('mouseup', () => {
                panning = false;
            });

            // Handle button clicks
            const closeBtn = previewModal.querySelector('.close-btn');

            closeBtn.onclick = closePreviewModal;

            function closePreviewModal() {
                imageSaved = false;  // Reset flag on close
                previewModal.classList.remove('show');
                setTimeout(() => previewModal.remove(), 300);
            }

            // Add pinch-zoom support
            let currentScale = 1;
            let startDistance = 0;

            img.addEventListener('touchstart', (e) => {
                if (e.touches.length === 2) {
                    startDistance = Math.hypot(
                        e.touches[0].pageX - e.touches[1].pageX,
                        e.touches[0].pageY - e.touches[1].pageY
                    );
                }
            });

            img.addEventListener('touchmove', (e) => {
                if (e.touches.length === 2) {
                    e.preventDefault();
                    
                    const currentDistance = Math.hypot(
                        e.touches[0].pageX - e.touches[1].pageX,
                        e.touches[0].pageY - e.touches[1].pageY
                    );
                    
                    const scale = currentDistance / startDistance;
                    currentScale = Math.min(Math.max(1, currentScale * scale), 4);
                    
                    img.style.transform = `scale(${currentScale})`;
                    startDistance = currentDistance;
                }
            });

            // Add a loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            previewModal.querySelector('.image-container').appendChild(loadingIndicator);

            img.onload = () => {
                loadingIndicator.remove();
            };

            const retakeBtn = previewModal.querySelector('.retake-btn');
            retakeBtn.onclick = () => {
                closePreviewModal();
                closeConfirmationModal();
                const photoOptionsModal = document.getElementById('photoOptionsModal');
                if (photoOptionsModal) {
                    photoOptionsModal.style.display = 'flex';
                }
            };
        } catch (error) {
            console.error('Error:', error);
            showToast('Failed to upload receipt', 'error');
        }
    }

    // Recent files management
    function addToRecentFiles(imageData, filename) {
        try {
            const recentFiles = JSON.parse(localStorage.getItem('recentFiles') || '[]');
            recentFiles.unshift({
                imageData,
                filename,
                timestamp: Date.now()
            });
            localStorage.setItem('recentFiles', JSON.stringify(recentFiles.slice(0, 5)));
        } catch (error) {
            console.error('Error saving to recent files:', error);
        }
    }

    function showRecentFiles() {
        try {
            const recentFiles = JSON.parse(localStorage.getItem('recentFiles') || '[]');
            if (recentFiles.length === 0) {
                showToast('No recent files', 'info');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'image-preview-modal';
            modal.innerHTML = `
                <div class="preview-content">
                    <h2 style="color: white; text-align: center;">Recent Files</h2>
                    <div class="recent-files-grid">
                        ${recentFiles.map(file => `
                            <div class="recent-file-item">
                                <img src="data:image/jpeg;base64,${file.imageData}" alt="Recent receipt">
                                <div class="recent-file-timestamp">
                                    ${new Date(file.timestamp).toLocaleDateString()}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="preview-controls">
                        <button class="preview-button close-btn">Close</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            setTimeout(() => modal.classList.add('show'), 0);

            modal.querySelector('.close-btn').onclick = () => {
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            };

            // Add click handlers for recent files
            modal.querySelectorAll('.recent-file-item').forEach((item, index) => {
                item.onclick = () => {
                    const file = recentFiles[index];
                    saveImageToDevice(file.imageData, file.filename, false);
                    modal.remove();
                };
            });
        } catch (error) {
            console.error('Error showing recent files:', error);
            showToast('Failed to load recent files', 'error');
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

    // Add this at the top level of your script
    let currentImageData;

    async function uploadToServer(imageData) {
        try {
            // Store the image data globally
            currentImageData = imageData;
            imageSaved = true;  // Set flag when image is stored

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
                    paymentMethod: 'Bank Receipt',
                    customerID: customerID,
                    startTime: new Date().getTime()
                })
            });

            const data = await response.json();

            // Log relevant response details
            logEvent(`check data: ${JSON.stringify(data)} response status: ${response.status}, ok: ${response.ok}`);

            // First check if response is not ok
            if (!response.ok) {
                showFailureModal('Scan failed', 'Please retry');
                return;
            }

            // Show confirmation modal with extracted data
            showConfirmationModal(data);

        } catch (error) {
            imageSaved = false;  // Reset flag on error
            logEvent(`Error ${JSON.stringify(error)}`);
            console.error('Error:', error);
            showFailureModal('Processing Error', 'An error occurred while processing your image. Please try again.');
        }
    }

    function showConfirmationModal(data) {
        const modal = document.getElementById('confirmationModal');
        const amountInput = document.getElementById('confirmAmount');
        const referenceInput = document.getElementById('confirmReference');
        const ParticularsInput = document.getElementById('confirmParticulars');
        const dateInput = document.getElementById('confirmDate');
        currentConfirmationData = data;

        console.log('data', data);
        logEvent(`data ${JSON.stringify(data)}`);
        // Check if elements exist before setting values
        if (amountInput) amountInput.value = data.amount || '';
        if (referenceInput) referenceInput.value = data.referenceNo || '';
        if (ParticularsInput) ParticularsInput.value = data.Particulars || '';
        if (dateInput) dateInput.value = data.Date || '';

        // Add view image button if not exists
        let viewImageBtn = modal.querySelector('.view-image-btn');
        if (!viewImageBtn && currentImageData) {
            const form = modal.querySelector('form');
            viewImageBtn = document.createElement('button');
            viewImageBtn.type = 'button';
            viewImageBtn.className = 'view-image-btn';
            viewImageBtn.innerHTML = '<span class="icon">🖼️</span> View Receipt Image';
            viewImageBtn.onclick = (e) => {
                e.preventDefault();
                saveImageToDevice(currentImageData, 'receipt.jpg', false);
            };
            form.insertBefore(viewImageBtn, form.firstChild);
        }

        // Show the modal first
        if (modal) {
            modal.style.display = 'flex';
        } else {
            console.error('Confirmation modal not found in DOM');
        }

        // Then validate the date
        validateDate(dateInput.value);

        // Add date change event listener
        if (dateInput) {
            dateInput.addEventListener('change', (e) => validateDate(e.target.value));
        }
    }

    // Add this function to handle confirmation
    function handleConfirmDetails() {
        const confirmButton = document.querySelector('.primary-button[onclick="handleConfirmDetails()"]');
        confirmButton.disabled = true;
        confirmButton.style.opacity = '0.5';
        confirmButton.style.cursor = 'not-allowed';

        const amount = document.getElementById('confirmAmount').value;
        const referenceNo = document.getElementById('confirmReference').value;
        const Particulars = document.getElementById('confirmParticulars').value;
        const date = document.getElementById('confirmDate').value;

        // Basic validation for empty fields
        if (!amount || !referenceNo || !Particulars || !date) {
            showToast('Please fill in all fields', 'error');
            // Re-enable button if validation fails
            confirmButton.disabled = false;
            confirmButton.style.opacity = '1';
            confirmButton.style.cursor = 'pointer';
            return;
        }

        // Specific validation for reference number
        if (referenceNo.length < 4 || !/\d/.test(referenceNo)) {
            showToast('This is not a reference number', 'error');
            // Re-enable button if validation fails
            confirmButton.disabled = false;
            confirmButton.style.opacity = '1';
            confirmButton.style.cursor = 'pointer';
            return;
        }

        // Get customer ID from session storage
        const customerID = sessionStorage.getItem('customerID');

        // Create confirmation data object
        const confirmationData = {
            customerID,
            amount,
            referenceNo,
            Particulars,
            'OCR Timestamp': date,
            'Time': currentConfirmationData.Time,
            'Payment Method': currentConfirmationData.PaymentMethod,
            'Bank': currentConfirmationData.Bank,
            'Recognized Text': currentConfirmationData.recognizedText 
        };
        console.log('confirmationData', confirmationData);
        // Send confirmation to server
        fetch('/confirm-receipt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(confirmationData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                imageSaved = false;  // Reset flag on successful submission
                showToast('Receipt confirmed successfully', 'success');
                closeConfirmationModal();
                showConfetti();
            } else {
                // Re-enable button if API call fails
                confirmButton.disabled = false;
                confirmButton.style.opacity = '1';
                confirmButton.style.cursor = 'pointer';
                showToast(data.error || 'Failed to confirm receipt', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            // Re-enable button if API call errors
            confirmButton.disabled = false;
            confirmButton.style.opacity = '1';
            confirmButton.style.cursor = 'pointer';
            showToast('Failed to confirm receipt', 'error');
        });
    }

    function closeConfirmationModal() {
        const modal = document.getElementById('confirmationModal');
        if (modal) {
            // Re-enable the confirm button
            const confirmButton = modal.querySelector('.primary-button[onclick="handleConfirmDetails()"]');
            if (confirmButton) {
                confirmButton.disabled = false;
                confirmButton.style.opacity = '1';
                confirmButton.style.cursor = 'pointer';
            }
            modal.style.display = 'none';
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
                    
                    // Maintain higher resolution
                    let { width, height } = img;
                    const maxDim = Math.min(2560, Math.max(width, height)); // Increased from 1920
                    if (Math.max(width, height) > maxDim) {
                        const scale = maxDim / Math.max(width, height);
                        width *= scale;
                        height *= scale;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Disable image smoothing for sharper edges
                    ctx.imageSmoothingEnabled = false;
                    
                    // Draw image without filters
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Use higher quality JPEG encoding
                    const finalImage = canvas.toDataURL('image/jpeg', 0.95); // Increased from 0.7
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
                        focusDistance: { ideal: 1.0 },
                        // Add additional camera controls for better image quality
                        whiteBalanceMode: ['continuous'],
                        exposureMode: ['continuous']
                    }
                });

                logEvent(`stream ${JSON.stringify(stream)}`);

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
                        const reader = new FileReader();
                        reader.onload = async function(event) {
                            const base64Image = event.target.result.split(',')[1];
                            currentImageData = base64Image; // Store the image data
                            await saveImageToDevice(base64Image, file.name, true);
                            await processImage(file);
                        };
                        reader.readAsDataURL(file);
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
                    </div>
                </div>
                <div class="camera-controls">
                    <button onclick="closeCameraModal()" class="camera-button retry" style="width: 100%;">
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
                        await saveImageToDevice(base64Image, filename, true);
                        
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

    function isToday(dateString) {
        try {
            // Parse the input date string
            const inputDate = new Date(dateString);
            
            // Check if parsing resulted in an invalid date
            if (isNaN(inputDate)) {
                return false;
            }
    
            // Get today's date
            const today = new Date();
    
            // Compare year, month, and day
            return (
                inputDate.getFullYear() === today.getFullYear() &&
                inputDate.getMonth() === today.getMonth() &&
                inputDate.getDate() === today.getDate()
            );
        } catch (error) {
            return false; // Return false if there's any parsing or comparison error
        }
    }
    

    function validateDate(dateInput) {
        const validationMessage = document.getElementById('dateValidationMessage');
        const dateInputElement = document.getElementById('confirmDate');
        
        // Remove existing classes first
        dateInputElement.classList.remove('date-warning');
        
        if (!dateInput || dateInput === '') {
            validationMessage.style.display = 'none';
            validationMessage.classList.remove('show');
            return;
        }

        if (!isToday(dateInput)) {
            // Add warning class to input
            dateInputElement.classList.add('date-warning');
            
            // Update validation message with icon
            validationMessage.innerHTML = `
                <span class="warning-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 9v4M12 17h.01M12 3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2s2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                    </svg>
                </span>
                Receipt Date is not today. Are you sure you want to add this?
            `;
            validationMessage.style.display = 'flex';
            validationMessage.classList.add('show');
        } else {
            dateInputElement.classList.remove('date-warning');
            validationMessage.style.display = 'none';
            validationMessage.classList.remove('show');
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
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('Failed to log event:', error);
                return false;
            }

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error logging event:', error);
            return false;
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
    window.showRecentFiles = showRecentFiles;
});