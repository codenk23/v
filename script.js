// --- Global State and Utility Functions ---
let uploadedImages = []; // Stores File objects for PDF conversion
let compressorImage = null; // Stores the single File object for compression

const STATUS_MSG = document.getElementById('status-message');

/**
 * Helper to display a status message (success/error).
 * @param {string} message - The text to display.
 * @param {string} type - 'success' or 'error'.
 */
function displayStatus(message, type) {
    STATUS_MSG.textContent = message;
    STATUS_MSG.className = `status-message ${type}`;
    STATUS_MSG.style.display = 'block';
    // Automatically hide after 5 seconds
    setTimeout(() => {
        STATUS_MSG.style.display = 'none';
    }, 5000);
}

/**
 * Converts bytes to a human-readable size string.
 * @param {number} bytes 
 * @returns {string}
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


// --- 1. Tool Switching Logic ---

document.addEventListener('DOMContentLoaded', () => {
    const pdfSelector = document.getElementById('pdf-selector');
    const compressorSelector = document.getElementById('compressor-selector');
    const pdfInterface = document.getElementById('pdf-tool-interface');
    const compressorInterface = document.getElementById('compressor-tool-interface');

    function switchTool(activeSelector, activeInterface, inactiveSelector, inactiveInterface) {
        activeSelector.classList.add('active');
        inactiveSelector.classList.remove('active');
        activeInterface.classList.remove('hidden');
        inactiveInterface.classList.add('hidden');
        STATUS_MSG.style.display = 'none'; // Clear status on switch
    }

    pdfSelector.addEventListener('click', () => {
        switchTool(pdfSelector, pdfInterface, compressorSelector, compressorInterface);
    });

    compressorSelector.addEventListener('click', () => {
        switchTool(compressorSelector, compressorInterface, pdfSelector, pdfInterface);
    });
});


// --- 2. Image to PDF Converter Functionality ---

const pdfFileInput = document.getElementById('pdf-file-input');
const pdfPreviewList = document.getElementById('pdf-preview-list');
const convertPdfBtn = document.getElementById('convert-pdf-btn');
const clearPdfBtn = document.getElementById('clear-pdf-btn');
const pdfFileNameInput = document.getElementById('pdf-file-name');

/**
 * Updates the state of the buttons based on the image count.
 */
function updatePdfButtons() {
    const hasImages = uploadedImages.length > 0;
    convertPdfBtn.disabled = !hasImages;
    clearPdfBtn.disabled = !hasImages;
    pdfPreviewList.querySelector('.placeholder-preview').style.display = hasImages ? 'none' : 'block';
}

/**
 * Renders the list of uploaded image previews.
 */
function renderPdfPreviews() {
    pdfPreviewList.innerHTML = '';
    if (uploadedImages.length === 0) {
        pdfPreviewList.innerHTML = '<div class="placeholder-preview">No images added yet.</div>';
    }

    uploadedImages.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const item = document.createElement('div');
            item.className = 'image-preview-item';
            item.dataset.index = index;

            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = file.name;

            const name = document.createElement('span');
            name.className = 'image-name';
            name.textContent = file.name;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.textContent = 'X';
            removeBtn.title = 'Remove image';
            removeBtn.onclick = () => removeImage(index);

            item.appendChild(img);
            item.appendChild(name);
            item.appendChild(removeBtn);
            pdfPreviewList.appendChild(item);
        };
        reader.readAsDataURL(file);
    });
    updatePdfButtons();
}

/**
 * Removes an image from the array and re-renders previews.
 * @param {number} index - The index of the image to remove.
 */
function removeImage(index) {
    uploadedImages.splice(index, 1);
    renderPdfPreviews();
    displayStatus(`Image removed successfully. Total images: ${uploadedImages.length}`, 'success');
}

// Handle file selection
pdfFileInput.addEventListener('change', (e) => {
    const newFiles = Array.from(e.target.files);
    
    // Check limit
    if (uploadedImages.length + newFiles.length > 100) {
        displayStatus(`Error: You can only upload a maximum of 100 images.`, 'error');
        return;
    }

    // Add new files to the array
    uploadedImages = uploadedImages.concat(newFiles);
    
    renderPdfPreviews();
    displayStatus(`${newFiles.length} image(s) added. Total images: ${uploadedImages.length}`, 'success');
    e.target.value = null; // Clear input
});

// Clear all files
clearPdfBtn.addEventListener('click', () => {
    uploadedImages = [];
    renderPdfPreviews();
    pdfFileNameInput.value = '';
    displayStatus('All images cleared.', 'success');
});

// Convert to PDF Logic
convertPdfBtn.addEventListener('click', async () => {
    if (uploadedImages.length === 0) {
        displayStatus('Please add images before converting.', 'error');
        return;
    }
    
    // Disable button during process
    convertPdfBtn.textContent = 'Converting...';
    convertPdfBtn.disabled = true;

    try {
        // Initialize PDF (A4 size)
        const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
        const a4Width = 210;
        const a4Height = 297;
        let firstImage = true;

        for (const file of uploadedImages) {
            const dataUrl = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });

            const img = await new Promise(resolve => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.src = dataUrl;
            });

            // Calculate dimensions to fit image on the page
            const margin = 10;
            const contentWidth = a4Width - 2 * margin;
            const contentHeight = a4Height - 2 * margin;

            const imgWidth = img.width;
            const imgHeight = img.height;
            
            let scaleFactor = Math.min(contentWidth / imgWidth, contentHeight / imgHeight);

            // If image is portrait and page is landscape, or vice-versa, this correctly scales
            let finalWidth = imgWidth * scaleFactor;
            let finalHeight = imgHeight * scaleFactor;

            const x = (a4Width - finalWidth) / 2;
            const y = (a4Height - finalHeight) / 2;

            if (!firstImage) {
                pdf.addPage();
            } else {
                firstImage = false;
            }

            // Add the image to the PDF
            pdf.addImage(dataUrl, file.type.split('/')[1].toUpperCase(), x, y, finalWidth, finalHeight);
        }

        // Trigger download
        const fileName = (pdfFileNameInput.value.trim() || 'converted_images') + '.pdf';
        pdf.save(fileName);
        
        displayStatus('PDF converted and download initiated!', 'success');

    } catch (error) {
        console.error("PDF Conversion Error:", error);
        displayStatus('An error occurred during PDF conversion.', 'error');
    } finally {
        convertPdfBtn.textContent = 'Convert to PDF';
        updatePdfButtons(); // Re-enable if needed
    }
});


// --- 3. Image Compressor Functionality ---

const compressorFileInput = document.getElementById('compressor-file-input');
const compressDownloadBtn = document.getElementById('compress-download-btn');
const qualitySlider = document.getElementById('quality-slider');
const qualityValueSpan = document.getElementById('quality-value');
const originalSizeSpan = document.getElementById('original-size');
const newSizeSpan = document.getElementById('new-size');
const compressorImageDisplay = document.getElementById('compressor-image-display');
const compressorFileNameInput = document.getElementById('compressor-file-name');


/**
 * Renders the single image for the compressor.
 */
function renderCompressorImage() {
    compressorImageDisplay.innerHTML = '';
    compressorImageDisplay.style.alignItems = 'flex-start'; // Align left for single image

    if (!compressorImage) {
        compressorImageDisplay.innerHTML = '<div class="placeholder-preview">Image selected will appear here.</div>';
        compressorImageDisplay.style.alignItems = 'center'; // Center when empty
        compressDownloadBtn.disabled = true;
        originalSizeSpan.textContent = '-- KB';
        newSizeSpan.textContent = '-- KB';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '200px'; 
        img.style.objectFit = 'contain';

        const item = document.createElement('div');
        item.style.width = '100%';
        item.style.textAlign = 'center';
        item.appendChild(img);
        
        compressorImageDisplay.appendChild(item);
    };
    reader.readAsDataURL(compressorImage);

    // Update original size display
    originalSizeSpan.textContent = formatBytes(compressorImage.size);
    newSizeSpan.textContent = 'N/A';
    compressDownloadBtn.disabled = false;
}

// Handle file selection for compressor
compressorFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        compressorImage = file;
        renderCompressorImage();
        displayStatus(`Image loaded for compression: ${file.name}`, 'success');
    } else {
        compressorImage = null;
        renderCompressorImage();
    }
    e.target.value = null; // Clear input
});

// Handle quality slider change
qualitySlider.addEventListener('input', () => {
    qualityValueSpan.textContent = `${qualitySlider.value}%`;
    newSizeSpan.textContent = 'N/A'; // Reset new size until re-compressed
});


// Compress and Download Logic
compressDownloadBtn.addEventListener('click', async () => {
    if (!compressorImage) {
        displayStatus('Please select an image to compress.', 'error');
        return;
    }

    // Set button state
    compressDownloadBtn.textContent = 'Compressing...';
    compressDownloadBtn.disabled = true;
    
    const quality = parseInt(qualitySlider.value) / 100;

    const options = {
        maxSizeMB: 100, // Large enough not to interfere, compression is based on quality
        maxWidthOrHeight: 1920, // Limit resolution to save more space, adjust as needed
        useWebWorker: true,
        fileType: 'image/jpeg', // Force output to JPG for best compression
        initialQuality: quality,
    };

    try {
        const compressedFile = await imageCompression(compressorImage, options);

        // Update UI with new size
        newSizeSpan.textContent = formatBytes(compressedFile.size);

        // Trigger download
        const originalName = compressorImage.name.split('.').slice(0, -1).join('.');
        const finalFileName = (compressorFileNameInput.value.trim() || originalName + '_compressed') + '.jpg';

        const url = URL.createObjectURL(compressedFile);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFileName;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        displayStatus('Image compressed and download initiated!', 'success');

    } catch (error) {
        console.error('Image compression failed:', error);
        displayStatus('An error occurred during compression.', 'error');
    } finally {
        // Reset button state
        compressDownloadBtn.textContent = 'Compress & Download';
        compressDownloadBtn.disabled = false;
    }
});

// Initial rendering of PDF section
document.addEventListener('DOMContentLoaded', renderPdfPreviews);
document.addEventListener('DOMContentLoaded', renderCompressorImage);
