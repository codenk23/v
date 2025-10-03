// --- Global State and Utility Functions ---
let uploadedImages = []; // For Image to PDF
let compressorImage = null; // For Image Compressor
let currentPdfFile = null; // For PDF Compressor

const STATUS_MSG = document.getElementById('status-message');

function displayStatus(message, type) {
    // ... (same as previous) ...
    STATUS_MSG.textContent = message;
    STATUS_MSG.className = `status-message ${type}`;
    STATUS_MSG.style.display = 'block';
    setTimeout(() => {
        STATUS_MSG.style.display = 'none';
    }, 5000);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


// --- 1. Tool Switching Logic ---

document.addEventListener('DOMContentLoaded', () => {
    // Selectors
    const selectors = {
        pdf: document.getElementById('pdf-selector'),
        compressor: document.getElementById('compressor-selector'),
        pdfCompressor: document.getElementById('pdf-compressor-selector')
    };

    // Interfaces
    const interfaces = {
        pdf: document.getElementById('pdf-tool-interface'),
        compressor: document.getElementById('compressor-tool-interface'),
        pdfCompressor: document.getElementById('pdf-compressor-interface')
    };

    function switchTool(activeTool) {
        // Loop through all selectors and interfaces to manage active/hidden states
        for (const key in selectors) {
            selectors[key].classList.remove('active');
            interfaces[key].classList.add('hidden');
        }

        selectors[activeTool].classList.add('active');
        interfaces[activeTool].classList.remove('hidden');
        STATUS_MSG.style.display = 'none'; // Clear status on switch
    }

    // Event listeners for switching tools
    selectors.pdf.addEventListener('click', () => switchTool('pdf'));
    selectors.compressor.addEventListener('click', () => switchTool('compressor'));
    selectors.pdfCompressor.addEventListener('click', () => switchTool('pdfCompressor'));
    
    // Initial rendering checks
    renderPdfPreviews();
    renderCompressorImage();
});


// --- 2. Image to PDF Converter Functionality (Unchanged logic) ---

const pdfFileInput = document.getElementById('pdf-file-input');
const pdfPreviewList = document.getElementById('pdf-preview-list');
const convertPdfBtn = document.getElementById('convert-pdf-btn');
const clearPdfBtn = document.getElementById('clear-pdf-btn');
const pdfFileNameInput = document.getElementById('pdf-file-name');

function updatePdfButtons() {
    const hasImages = uploadedImages.length > 0;
    convertPdfBtn.disabled = !hasImages;
    clearPdfBtn.disabled = !hasImages;
    pdfPreviewList.querySelector('.placeholder-preview').style.display = hasImages ? 'none' : 'block';
}

function removeImage(index) {
    uploadedImages.splice(index, 1);
    renderPdfPreviews();
    displayStatus(`Image removed successfully. Total images: ${uploadedImages.length}`, 'success');
}

function renderPdfPreviews() {
    // ... (Same rendering logic for Image to PDF) ...
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
            // Use an anonymous function to ensure 'removeImage' is called with the correct index
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removeImage(index);
            }; 

            item.appendChild(img);
            item.appendChild(name);
            item.appendChild(removeBtn);
            pdfPreviewList.appendChild(item);
        };
        reader.readAsDataURL(file);
    });
    updatePdfButtons();
}

// Handle file selection
pdfFileInput.addEventListener('change', (e) => {
    const newFiles = Array.from(e.target.files);
    
    if (uploadedImages.length + newFiles.length > 100) {
        displayStatus(`Error: You can only upload a maximum of 100 images.`, 'error');
        return;
    }

    uploadedImages = uploadedImages.concat(newFiles);
    
    renderPdfPreviews();
    displayStatus(`${newFiles.length} image(s) added. Total images: ${uploadedImages.length}`, 'success');
    e.target.value = null;
});

// Clear all files
clearPdfBtn.addEventListener('click', () => {
    uploadedImages = [];
    renderPdfPreviews();
    pdfFileNameInput.value = '';
    displayStatus('All images cleared.', 'success');
});

// Convert to PDF Logic (Simplified to show only event listener)
convertPdfBtn.addEventListener('click', async () => {
    if (uploadedImages.length === 0) {
        displayStatus('Please add images before converting.', 'error');
        return;
    }
    
    convertPdfBtn.textContent = 'Converting...';
    convertPdfBtn.disabled = true;

    try {
        const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
        const a4Width = 210, a4Height = 297;
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

            // Logic to calculate dimensions and center image on A4 page
            const margin = 10;
            const contentWidth = a4Width - 2 * margin;
            const contentHeight = a4Height - 2 * margin;
            const imgWidth = img.width, imgHeight = img.height;
            let scaleFactor = Math.min(contentWidth / imgWidth, contentHeight / imgHeight);
            let finalWidth = imgWidth * scaleFactor;
            let finalHeight = imgHeight * scaleFactor;
            const x = (a4Width - finalWidth) / 2;
            const y = (a4Height - finalHeight) / 2;

            if (!firstImage) { pdf.addPage(); } else { firstImage = false; }
            pdf.addImage(dataUrl, file.type.split('/')[1].toUpperCase(), x, y, finalWidth, finalHeight);
        }

        const fileName = (pdfFileNameInput.value.trim() || 'converted_images') + '.pdf';
        pdf.save(fileName);
        
        displayStatus('PDF converted and download initiated!', 'success');

    } catch (error) {
        console.error("PDF Conversion Error:", error);
        displayStatus('An error occurred during PDF conversion.', 'error');
    } finally {
        convertPdfBtn.textContent = 'Convert to PDF';
        updatePdfButtons();
    }
});


// --- 3. Image Compressor Functionality (Unchanged logic) ---

const compressorFileInput = document.getElementById('compressor-file-input');
const compressDownloadBtn = document.getElementById('compress-download-btn');
const qualitySlider = document.getElementById('quality-slider');
const qualityValueSpan = document.getElementById('quality-value');
const originalSizeSpan = document.getElementById('original-size');
const newSizeSpan = document.getElementById('new-size');
const compressorImageDisplay = document.getElementById('compressor-image-display');
const compressorFileNameInput = document.getElementById('compressor-file-name');

function renderCompressorImage() {
    compressorImageDisplay.innerHTML = '';
    compressorImageDisplay.style.alignItems = 'flex-start';

    if (!compressorImage) {
        compressorImageDisplay.innerHTML = '<div class="placeholder-preview">Image selected will appear here.</div>';
        compressorImageDisplay.style.alignItems = 'center';
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
    e.target.value = null;
});

// Handle quality slider change
qualitySlider.addEventListener('input', () => {
    qualityValueSpan.textContent = `${qualitySlider.value}%`;
    newSizeSpan.textContent = 'N/A';
});


// Compress and Download Logic
compressDownloadBtn.addEventListener('click', async () => {
    if (!compressorImage) {
        displayStatus('Please select an image to compress.', 'error');
        return;
    }

    compressDownloadBtn.textContent = 'Compressing...';
    compressDownloadBtn.disabled = true;
    
    const quality = parseInt(qualitySlider.value) / 100;

    const options = {
        maxSizeMB: 100,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/jpeg',
        initialQuality: quality,
    };

    try {
        const compressedFile = await imageCompression(compressorImage, options);

        newSizeSpan.textContent = formatBytes(compressedFile.size);

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
        compressDownloadBtn.textContent = 'Compress & Download';
        compressDownloadBtn.disabled = false;
    }
});


// --- 4. PDF Compressor Functionality (Confirmed and Finalized) ---

const pdfCompressorFileInput = document.getElementById('pdf-compressor-file-input');
const compressPdfBtn = document.getElementById('compress-pdf-btn');
const pdfOriginalSizeSpan = document.getElementById('pdf-original-size');
const pdfNewSizeSpan = document.getElementById('pdf-new-size');
const pdfCompressorFileNameInput = document.getElementById('pdf-compressor-file-name');

// Handle file selection for PDF compressor
pdfCompressorFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    currentPdfFile = file || null;
    
    if (file) {
        // 3. Show the size before compression
        pdfOriginalSizeSpan.textContent = formatBytes(file.size);
        pdfNewSizeSpan.textContent = 'Ready to compress';
        compressPdfBtn.disabled = false;
        displayStatus(`PDF file loaded: ${file.name}`, 'success');
    } else {
        pdfOriginalSizeSpan.textContent = '-- MB';
        pdfNewSizeSpan.textContent = '-- MB';
        compressPdfBtn.disabled = true;
    }
    e.target.value = null;
});

// PDF Compression Logic
compressPdfBtn.addEventListener('click', async () => {
    if (!currentPdfFile) {
        displayStatus('Please select a PDF file to compress.', 'error');
        return;
    }

    compressPdfBtn.textContent = 'Processing...';
    compressPdfBtn.disabled = true;

    try {
        // Read the file buffer
        const arrayBuffer = await currentPdfFile.arrayBuffer();
        const { PDFDocument } = window.PDFLib;
        
        // 2. Load the PDF and perform optimization (compression)
        const pdfDoc = await PDFDocument.load(arrayBuffer, {
            ignoreEncryption: true,
            discardUnused: true,
        });

        // This rewrites the PDF structure to be as compact as possible (lossless optimization).
        const optimizedPdfBytes = await pdfDoc.save({
            useObjectStreams: false, 
        });
        
        const compressedBlob = new Blob([optimizedPdfBytes], { type: 'application/pdf' });
        
        // 4. Show the size after compression
        pdfNewSizeSpan.textContent = formatBytes(compressedBlob.size);
        
        // 5. & 6. Download the work and allow naming
        const originalName = currentPdfFile.name.split('.').slice(0, -1).join('.');
        const finalFileName = (pdfCompressorFileNameInput.value.trim() || originalName + '_optimized') + '.pdf';
        
        const url = URL.createObjectURL(compressedBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFileName;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        displayStatus('PDF compressed (lossless optimization) and download initiated!', 'success');

    } catch (error) {
        console.error('PDF Compression Failed:', error);
        displayStatus('An error occurred during PDF optimization. Please check the file format.', 'error');
    } finally {
        compressPdfBtn.textContent = 'Compress & Download';
        compressPdfBtn.disabled = false;
    }
});
