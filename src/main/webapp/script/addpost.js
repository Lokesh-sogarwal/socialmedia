// Initialize Cropper instance
let cropper;
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const croppedImage = document.getElementById('croppedImage');
const cropperContainer = document.getElementById('cropper-container');

// When user selects an image
imageInput.addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            imagePreview.src = e.target.result;
            croppedImage.src = e.target.result;
            cropperContainer.style.display = 'block';
            
            // Destroy existing cropper instance if any
            if (cropper) cropper.destroy();
            
            // Initialize cropper
            cropper = new Cropper(croppedImage, {
                aspectRatio: 1, // Default aspect ratio
                viewMode: 1,
                scalable: true,
                movable: true,
            });
        };
        reader.readAsDataURL(file);
    }
});

// Function to set aspect ratio
function setAspectRatio(ratio) {
    if (cropper) cropper.setAspectRatio(ratio);
}

// Function to rotate image
function rotateImage(degrees) {
    if (cropper) cropper.rotate(degrees);
}

// Apply crop and save the edited image
document.getElementById("applyEdit").addEventListener("click", function () {
    if (!cropper) {
        alert("Please upload and crop an image before applying changes.");
        return;
    }

    const canvas = cropper.getCroppedCanvas();
    const editedImageData = canvas.toDataURL(); // Get cropped image data

    imagePreview.src = editedImageData; // Update preview with cropped image
    cropperContainer.style.display = 'none'; // Hide cropper after applying

    // Optionally, send `editedImageData` to the server or use it in other ways
});
