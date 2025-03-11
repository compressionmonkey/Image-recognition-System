document.addEventListener('DOMContentLoaded', function() {
    const validCustomerIDs = ['a8358', '0e702', '571b6', 'be566', '72d72'];
    let isLoggedIn = false;
    let children = [];
    let currentConfirmationData = null;

    // Add a flag to control prediction loop
    let isPredicting = false;

    // Update the window load event listener to show dashboard button if logged in
    window.addEventListener('load', () => {
        const loginOverlay = document.getElementById('loginOverlay');
        const mainContent = document.getElementById('mainContent');
        
        if (sessionStorage.getItem('isLoggedIn') === 'true') {
            isLoggedIn = true;
            loginOverlay.style.display = 'none';
            // userNav.style.display = 'block';
            mainContent.style.display = 'block';
            
            // // Hide initial content
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

    // Update the saveImageToBucket function
    async function saveImageToBucket(imageData, filename = 'receipt.jpg') {
        try {
            // First upload to S3
            const response = await fetch('/upload-receipt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageData,
                    filename,
                    customerID: sessionStorage.getItem('customerID')
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
                    saveImageToBucket(file.imageData, file.filename);
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
            console.log(`check data: ${JSON.stringify(data)} response status: ${response.status}, ok: ${response.ok}`);

            // First check if response is not ok
            if (!response.ok) {
                showFailureModal('Scan failed', 'Please retry');
                return;
            }

            // Show confirmation modal with extracted data
            showConfirmationModal(data);

        } catch (error) {
            imageSaved = false;  // Reset flag on error
            console.log(`Error ${JSON.stringify(error)}`);
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
        console.log(`data ${JSON.stringify(data)}`);
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
                saveImageToBucket(currentImageData, 'receipt.jpg');
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
            'Recognized Text': currentConfirmationData.recognizedText,
            'Receipt URL': sessionStorage.getItem('lastReceiptUrl')
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

                console.log(`stream ${JSON.stringify(stream)}`);

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
            input.multiple = true;  // Enable multiple file selection
            input.onchange = async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;
                
                closePhotoOptions();
                
                if (!isLoggedIn) {
                    const loginOverlay = document.getElementById('loginOverlay');
                    if (loginOverlay) loginOverlay.style.display = 'block';
                    return;
                }
                
                try {
                    // Warn if trying to upload more than 10 files
                    if (files.length > 10) {
                        showToast('Only the first 10 files will be processed', 'info');
                    }
                    
                    if (files.length === 1) {
                        // Handle single file
                        const file = files[0];
                        const reader = new FileReader();
                        reader.onload = async function(event) {
                            const base64Image = event.target.result.split(',')[1];
                            currentImageData = base64Image;
                            await saveImageToBucket(base64Image, file.name);
                            await processImage(file);
                        };
                        reader.readAsDataURL(file);
                    } else {
                        // Process images for OCR and analysis
                        const filesWithOcrData = await processMultipleImages(Array.from(files));
                        // Now create the UI with the processed files
                        createMultipleUploadsUI(filesWithOcrData);
                    }
                } catch (error) {
                    console.error('Error processing files:', error);
                    showToast('Failed to process files', 'error');
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

    // Update the predictWebcam function to include the countdown
     async function predictWebcam(video, liveView) {
        if (!isPredicting) return;

        children.forEach(child => liveView.removeChild(child));
        children = [];

        // const guidanceText = document.getElementById('guidanceText');
        const currentTime = performance.now();
        
        try {
            // Capture current frame with better quality
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);
            
            // Convert to blob with better quality
            const blob = await new Promise(resolve => 
                canvas.toBlob(resolve, 'image/jpeg', 0.85)
            );

            // Add retry logic
            const maxRetries = 3;
            let retryCount = 0;
            let success = false;

            console.log(`while loop ${!success && retryCount < maxRetries}`);
            console.log(`success ${success} retryCount ${retryCount} maxRetries ${maxRetries}`);

            while (!success && retryCount < maxRetries) {
                try {
                    console.log(`while loop inside ${!success && retryCount < maxRetries}`);
                    const formData = new FormData();
                    formData.append('image', blob);

                    const response = await fetch('https://keldendraduldorji.com/detect', {
                        method: 'POST',
                        body: formData,
                        timeout: 2000
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const result = await response.json();
                    success = true;

                    // Use the more detailed response
                    if (result.phoneDetected) {
                        const currentPhoneBox = {
                            x: result.bbox ? result.bbox[0] : liveView.offsetWidth * 0.2,
                            y: result.bbox ? result.bbox[1] : liveView.offsetHeight * 0.2,
                            width: result.bbox ? result.bbox[2] : liveView.offsetWidth * 0.6,
                            height: result.bbox ? result.bbox[3] : liveView.offsetHeight * 0.6
                        };

                        const qualityMetrics = analyzeFrameQuality(
                            currentPhoneBox,
                            previousPhoneBox,
                            lastFrameTime ? (currentTime - lastFrameTime) : 16.67
                        );

                        console.log(`qualityMetrics ${JSON.stringify(qualityMetrics)}`);

                        // Update UI with confidence score
                        qualityMetrics.confidence = result.confidence;
                        console.log(`qualityMetrics ${JSON.stringify(qualityMetrics)}`);

                        await updateDetectionUI(qualityMetrics, currentPhoneBox, liveView);

                        // Check if conditions are good for automatic capture
                        if (qualityMetrics.isStable && 
                            qualityMetrics.isSharp && 
                            qualityMetrics.isGoodRatio && 
                            qualityMetrics.confidence > 0.8) {
                            
                            // Pause predictions during capture
                            isPredicting = false;

                            try {
                                // Take the photo without countdown
                                await handlePhotoCapture(video, video.srcObject);
                                return;
                            } catch (error) {
                                console.error('Error during capture:', error);
                                isPredicting = true; // Resume predictions if there's an error
                            }
                        }

                        previousPhoneBox = currentPhoneBox;
                        lastFrameTime = currentTime;
                    }

                } catch (error) {
                    retryCount++;
                    if (retryCount === maxRetries) {
                        console.log(`Detection failed after retries: ${error}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 100)); // Wait before retry
                }
            }

        } catch (error) {
            console.error('Prediction error:', error);
        }

        // Continue predictions if no capture occurred
        if (isPredicting) {
            const nextDelay = determineNextDelay(currentTime);
            setTimeout(() => requestAnimationFrame(() => predictWebcam(video, liveView)), nextDelay);
        }
    }

    // Add adaptive polling rate function
    function determineNextDelay(currentTime) {
        const processingTime = performance.now() - currentTime;
        // Adjust delay based on processing time
        if (processingTime > 400) return 800; // Slower devices
        if (processingTime > 200) return 600; // Medium devices
        return 500; // Fast devices
    }

    // Add function to update detection UI
    async function updateDetectionUI(metrics, box, liveView) {
        const video = document.getElementById('camera-preview');
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        // Calculate area ratio
        const areaRatio = (box.width / videoWidth) * (box.height / videoHeight);
        const isMobileOrTablet = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const minRatio = isMobileOrTablet ? 0.4 : 0.1;
        const maxRatio = 1;
        const isGoodRatio = areaRatio >= minRatio && areaRatio < maxRatio;

        // Add ratio info to metrics
        metrics.areaRatio = areaRatio;
        metrics.isGoodRatio = isGoodRatio;
        metrics.minRatio = minRatio;

        // Create highlighter with color based on all metrics
        const highlighter = document.createElement('div');
        highlighter.classList.add('highlighter');
        Object.assign(highlighter.style, {
            left: `${box.x}px`,
            top: `${box.y}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
            borderColor: metrics.confidence > 0.8 && isGoodRatio ? '#4CAF50' : '#FFA500'
        });

        liveView.appendChild(highlighter);
        children.push(highlighter);

        // Update guidance text with all metrics
        const guidanceText = document.getElementById('guidanceText');
        if (guidanceText) {
            guidanceText.innerHTML = getGuidanceMessage(metrics);
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

    function getGuidanceMessage(metrics) {
        if (!metrics.isStable) {
            return '<p style="color: #FFA500">Hold phone more steady</p>';
        }
        if (!metrics.isSharp) {
            return '<p style="color: #FFA500">Image too blurry</p>';
        }
        if (!metrics.isGoodRatio) {
            if (metrics.areaRatio < metrics.minRatio) {
                return '<p style="color: #FFA500">Move closer to the receipt</p>';
            }
            if (metrics.areaRatio >= 1) {
                return '<p style="color: #FFA500">Move further from the receipt</p>';
            }
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
                    <button id="capture-button" class="camera-button capture" style="width: 100%;">
                        Capture
                    </button>
                </div>
            </div>
        `;
        
        // Add event listener after the modal is created
        setTimeout(() => {
            const captureButton = document.getElementById('capture-button');
            if (captureButton) {
                captureButton.addEventListener('click', () => {
                    const video = document.getElementById('camera-preview');
                    if (video && video.srcObject) {
                        handlePhotoCapture(video, video.srcObject);
                    }
                });
            }
        }, 100);
        
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
                        await saveImageToBucket(base64Image, filename);
                        
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
    window.handleSubmitAll = handleSubmitAll;

    async function saveMultipleImagesToBucket(filesArray) {
        try {
            showToast('Uploading files...', 'info');
            
            // Prepare the files data
            const customerID = sessionStorage.getItem('customerID');
            
            // First upload to S3 using the multiple endpoint
            const response = await fetch('/upload-multiple-receipts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: filesArray,
                    customerID: customerID
                })
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Upload failed');
            }

            // Create and show preview modal with the first S3 URL
            const previewModal = document.createElement('div');
            previewModal.className = 'image-preview-modal';
            previewModal.innerHTML = `
                <div class="preview-content">
                    <div class="preview-header">
                        <h3>Receipt Preview (${filesArray.length} files uploaded)</h3>
                    </div>
                    <div class="image-container">
                        <img src="${data.urls[0]}" 
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
            
            // Add each file to recent files
            filesArray.forEach((file, index) => {
                addToRecentFiles(file.imageData, file.filename);
            });

            // Force reflow then add show class for animation
            previewModal.offsetHeight;
            previewModal.classList.add('show');

            // Store first URL in session storage for later use
            sessionStorage.setItem('lastReceiptUrl', data.urls[0]);
            // Store all URLs in session storage (as JSON string)
            sessionStorage.setItem('allReceiptUrls', JSON.stringify(data.urls));
            // Store all keys in session storage (as JSON string)
            sessionStorage.setItem('allReceiptKeys', JSON.stringify(data.keys));

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

            // Setup image zoom (same as in saveImageToBucket)
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
                previewModal.classList.remove('show');
                setTimeout(() => previewModal.remove(), 300);
            }

            // Add pinch-zoom support (same as in saveImageToBucket)
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
                const photoOptionsModal = document.getElementById('photoOptionsModal');
                if (photoOptionsModal) {
                    photoOptionsModal.style.display = 'flex';
                }
            };
            
            return data;
        } catch (error) {
            console.error('Error:', error);
            showToast('Failed to upload receipts', 'error');
            throw error;
        }
    }

    async function processMultipleImages(filesArray) {
        showToast('Processing multiple images...', 'info');

        try {
            // Convert all files to processable format
            const processedFiles = await Promise.all(filesArray.map(async (file, index) => {
                // Create a promise for each file processing
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const img = new Image();
                        img.onload = function() {
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            
                            // Maintain higher resolution
                            let { width, height } = img;
                            const maxDim = Math.min(2560, Math.max(width, height));
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
                            const finalImage = canvas.toDataURL('image/jpeg', 0.95);
                            const base64Image = finalImage.split(',')[1];
                            
                            resolve({
                                index,
                                filename: file.name,
                                base64Image,
                                file // Include the original file for reference
                            });
                        };
                        img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                });
            }));

            // Send processed images to server and get OCR results
            const ocrResults = await uploadMultipleToServer(processedFiles);
            
            // Combine OCR results with file data
            if (ocrResults && ocrResults.allResults) {
                // Map each file with its corresponding OCR data
                const filesWithOcr = processedFiles.map(processedFile => {
                    // Find matching OCR result by index
                    const ocrData = ocrResults.allResults.find(
                        result => result.index === processedFile.index
                    );
                    
                    // Return the file with OCR data attached
                    return {
                        ...processedFile,
                        ocrData: ocrData || { error: 'No OCR data found' }
                    };
                });
                
                // Return the files with OCR data
                return filesWithOcr;
            }
            
            // If no OCR results, return the processed files anyway
            return processedFiles;
            
        } catch (error) {
            console.error('Error processing multiple images:', error);
            showToast('Failed to process images', 'error');
            // Return original files with error indication
            return filesArray.map((file, index) => ({
                index,
                file,
                filename: file.name,
                ocrData: { error: 'Processing failed' }
            }));
        }
    }

    async function uploadMultipleToServer(processedFiles) {
        try {
            // Store the first image data globally (for potential use)
            if (processedFiles.length > 0) {
                currentImageData = processedFiles[0].base64Image;
            }

            // Close any existing modals
            const photoOptionsModal = document.getElementById('photoOptionsModal');
            const cameraModal = document.querySelector('.camera-modal');
            
            if (photoOptionsModal) {
                photoOptionsModal.style.display = 'none';
            }
            
            if (cameraModal) {
                closeCameraModal();
            }

            // Make API call
            const customerID = sessionStorage.getItem('customerID');
            const response = await fetch('/multiple-vision-api', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    images: processedFiles.map(file => ({
                        image: file.base64Image,
                        filename: file.filename,
                        index: file.index
                    })),
                    deviceInfo: navigator.userAgent,
                    screenResolution: `${window.screen.width}x${window.screen.height}`,
                    paymentMethod: 'Bank Receipt',
                    customerID: customerID,
                    startTime: new Date().getTime()
                })
            });

            const data = await response.json();

            // Log relevant response details
            console.log(`Multiple image response:`, data);

            // Check response status
            if (!response.ok) {
                showFailureModal('Scan failed', 'Please retry');
                return null;
            }

            // Success - note we're not showing confirmation modal yet as requested
            showToast(`Processed ${processedFiles.length} images successfully`, 'success');
            
            // Return the data for further processing
            return data;

        } catch (error) {
            console.error('Error uploading multiple images:', error);
            showFailureModal('Processing Error', 'An error occurred while processing your images. Please try again.');
            return null;
        }
    }
    async function handleSubmitAll() {
        // Validate all entries
        const invalidEntries = imageEntries.filter(entry => !entry.isValid());
        if (invalidEntries.length > 0) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        try {
            // Show loading toast
            showToast('Uploading files...', 'info');
            
            // Create FormData for bulk file upload
            const formData = new FormData();
            const customerID = sessionStorage.getItem('customerID');
            formData.append('customerID', customerID);
            
            // Add all files to FormData
            const receiptMetadata = [];
            
            imageEntries.forEach((entry, index) => {
                // Add the file to FormData
                formData.append('files', entry.file);
                
                // Collect metadata for each receipt
                receiptMetadata.push({
                    index,
                    amount: entry.element.querySelector('.amount-input').value,
                    reference: entry.element.querySelector('.reference-input').value,
                    particulars: entry.element.querySelector('.particulars-input').value,
                    date: entry.element.querySelector('.date-input').value,
                    ocrData: entry.originalOcrData || {}
                });
            });
            
            // Store metadata in session storage for use after upload
            sessionStorage.setItem('receiptMetadata', JSON.stringify(receiptMetadata));
            
            // Upload all files in a single request
            const response = await fetch('/upload-multiple-receipts-form', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Upload failed');
            }
            
            // Process confirmations in batch after successful upload
            await processReceiptConfirmations(data.urls, receiptMetadata);
            
            // Store URLs in session storage
            sessionStorage.setItem('lastReceiptUrl', data.urls[0]);
            sessionStorage.setItem('allReceiptUrls', JSON.stringify(data.urls));
            sessionStorage.setItem('allReceiptKeys', JSON.stringify(data.keys));
            
            // Show success message
            showToast(`Successfully processed ${data.count} files`, 'success');
            showConfetti();
            
            // Close the modal
            const modal = document.getElementById('multipleUploadsModal');
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
                document.getElementById('uploadsContainer').innerHTML = '';
            }, 300);
            
        } catch (error) {
            console.error('Error processing uploads:', error);
            showToast('Failed to process uploads: ' + error.message, 'error');
        }
    }

    // Helper function to process receipt confirmations in batch
    async function processReceiptConfirmations(urls, metadataArray) {
        if (!urls || urls.length === 0 || !metadataArray || metadataArray.length === 0) {
            return;
        }
        
        const customerID = sessionStorage.getItem('customerID');
        
        // Create batch of confirmation requests
        const confirmationPromises = metadataArray.map((metadata, index) => {
            // Make sure we have a URL for this metadata
            if (index >= urls.length) return Promise.resolve({ success: false });
            
            const receiptUrl = urls[index];
            
            // Create confirmation data object
            const confirmData = {
                customerID,
                amount: metadata.amount,
                referenceNo: metadata.reference || 'MANUAL',
                Particulars: metadata.particulars || '',
                'OCR Timestamp': metadata.date,
                'Payment Method': 'Bank Receipt',
                'Bank': metadata.ocrData.Bank || 'Unknown',
                'Recognized Text': metadata.ocrData.recognizedText || '',
                'Receipt URL': receiptUrl
            };
            
            // Send confirmation to server
            return fetch('/confirm-receipt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(confirmData)
            })
            .then(response => response.json())
            .catch(error => {
                console.error('Error confirming receipt:', error);
                return { success: false, error: error.message };
            });
        });
        
        // Process all confirmations in parallel
        return Promise.all(confirmationPromises);
    }

    // Function to create the multiple uploads UI
    function createMultipleUploadsUI(files) {
        // Get the template modal and show it
        const modal = document.getElementById('multipleUploadsModal');
        modal.style.display = 'flex';
        
        // Get the uploads container
        const uploadsContainer = document.getElementById('uploadsContainer');
        // Clear any existing entries
        uploadsContainer.innerHTML = '';

        // Add image entries to the container
        const imageEntries = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const entry = createImageEntryUI(file, i);
            uploadsContainer.appendChild(entry.element);
            imageEntries.push(entry);
        }
        window.imageEntries = imageEntries;

        // Handle close button
        const closeBtn = modal.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
                uploadsContainer.innerHTML = '';
            }, 300);
        });

        // Handle add another payment button
        // const addAnotherBtn = document.getElementById('addAnotherPayment');
        // addAnotherBtn.addEventListener('click', () => {
        //     if (imageEntries.length >= 10) {
        //         showToast('Maximum 10 images allowed', 'error');
        //         return;
        //     }

        //     const input = document.createElement('input');
        //     input.type = 'file';
        //     input.accept = 'image/*';
        //     input.onchange = (e) => {
        //         if (e.target.files && e.target.files.length > 0) {
        //             const file = e.target.files[0];
        //             const entry = createImageEntryUI(file, imageEntries.length);
        //             uploadsContainer.appendChild(entry.element);
        //             imageEntries.push(entry);
        //         }
        //     };
        //     input.click();
        // });

        // Show the modal with animation
        setTimeout(() => modal.classList.add('show'), 10);

        return {
            modal,
            imageEntries
        };
    }

    // Function to create a single image entry UI
    function createImageEntryUI(file, index) {
        // Clone the template
        const template = document.getElementById('imageEntryTemplate');
        const entryElement = template.content.cloneNode(true).querySelector('.image-entry');
        
        // Add ID to the entry
        const entryId = `image-entry-${index}`;
        entryElement.id = entryId;

        // Create reader to get image preview if needed
        let imageData = null;
        
        // Store the original OCR data if available
        const originalOcrData = file.ocrData || {};

        // Handle different file formats for preview
        let actualFile = file.file || file;
        
        const imgPreview = entryElement.querySelector('.image-preview img');
        
        if (file.base64Image) {
            // If we already have base64 data
            imgPreview.src = `data:image/jpeg;base64,${file.base64Image}`;
            imageData = file.base64Image;
        } else if (actualFile instanceof File || actualFile instanceof Blob) {
            // If we have a File or Blob object, create reader
            const reader = new FileReader();
            reader.onload = (event) => {
                imgPreview.src = event.target.result;
                imageData = event.target.result.split(',')[1];
            };
            reader.readAsDataURL(actualFile);
        }

        // Set default date to today
        const dateInput = entryElement.querySelector('.date-input');
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];
        dateInput.value = formattedDate;

        // Fill in OCR data if available
        if (originalOcrData && !originalOcrData.error) {
            const amountInput = entryElement.querySelector('.amount-input');
            const referenceInput = entryElement.querySelector('.reference-input');
            const particularsInput = entryElement.querySelector('.particulars-input');
            
            // Set values if they exist in OCR data
            if (originalOcrData.amount) amountInput.value = originalOcrData.amount;
            if (originalOcrData.referenceNo) referenceInput.value = originalOcrData.referenceNo;
            if (originalOcrData.Bank && originalOcrData.Bank !== 'Unknown') {
                particularsInput.value = `Payment to ${originalOcrData.Bank}`;
            }
            if (originalOcrData.Date) {
                // Try to parse the date from OCR
                try {
                    const ocrDate = new Date(originalOcrData.Date);
                    if (!isNaN(ocrDate.getTime())) {
                        dateInput.value = ocrDate.toISOString().split('T')[0];
                    }
                } catch (e) {
                    console.log('Could not parse OCR date, using today instead');
                }
            }
        }

        // Add delete functionality
        const deleteBtn = entryElement.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            entryElement.classList.add('removing');
            setTimeout(() => {
                entryElement.remove();
                // Update the global imageEntries array
                const index = window.imageEntries.findIndex(entry => entry.element === entryElement);
                if (index !== -1) {
                    window.imageEntries.splice(index, 1);
                }
            }, 300);
        });

        return {
            element: entryElement,
            file: actualFile,
            originalOcrData, // Store the original OCR data for later use
            isValid: () => {
                const amountInput = entryElement.querySelector('.amount-input');
                const dateInput = entryElement.querySelector('.date-input');
                return amountInput.value.trim() !== '' && dateInput.value.trim() !== '';
            }
        };
    }

});