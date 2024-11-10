const uploadPhoto = document.getElementById("uploadPhoto");
const removePhoto = document.getElementById("removePhoto");
const mediaUpload = document.getElementById("mediaUpload");
const postButton = document.getElementById("postButton");
const postsContainer = document.getElementById("postsContainer");
const postContent = document.getElementById("postContent");

function updateProfilePhotos(src) {
    const profilePhotos = document.querySelectorAll(".profile-photo");
    profilePhotos.forEach(photo => {
        photo.src = src || "";
    });
}

window.addEventListener("load", () => {
    const savedPhoto = localStorage.getItem("profilePhoto");
    if (savedPhoto) {
        updateProfilePhotos(savedPhoto);
    }
});

uploadPhoto.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const photoSrc = e.target.result;
            localStorage.setItem("profilePhoto", photoSrc);
            updateProfilePhotos(photoSrc);
        };
        reader.readAsDataURL(file);
    }
});

removePhoto.addEventListener("click", () => {
    localStorage.removeItem("profilePhoto");
    updateProfilePhotos("");
});

postButton.addEventListener("click", () => {
    const content = postContent.value;
    const mediaFile = mediaUpload.files[0];

    // Create a new post div
    const postDiv = document.createElement("div");
    postDiv.classList.add("post");

    // Get the current timestamp
    const timestamp = new Date().toLocaleString(); // Formats the date and time

    const postHeader = document.createElement("div");
    postHeader.classList.add("post-header");
    postHeader.innerHTML = `
        <div class="photo">
            <img class="profile-photo" src="${localStorage.getItem("profilePhoto") || 'assets/profile.png'}" alt="Profile Photo" width="50" height="50">
        </div>
        <div class="post-info">
            <p class="username">Username</p>
            <p class="timestamp">${timestamp}</p> <!-- Display the timestamp -->
        </div>
    `;

    const postContentDiv = document.createElement("div");
    postContentDiv.classList.add("post-content");
    postContentDiv.innerHTML = `<p>${content}</p>`;

    // Display media if exists
    if (mediaFile) {
        const mediaReader = new FileReader();
        mediaReader.onload = (e) => {
            const mediaSrc = e.target.result;
            const mediaElement = mediaFile.type.startsWith('image/') ? 
                `<img src="${mediaSrc}" alt="Post Media">` : 
                `<video controls><source src="${mediaSrc}" type="${mediaFile.type}">Your browser does not support the video tag.</video>`;
            postContentDiv.innerHTML += mediaElement;
        };
        mediaReader.readAsDataURL(mediaFile);
    }

    const postActions = document.createElement("div");
    postActions.classList.add("post-actions");
    postActions.innerHTML = `
        <button class="like-button" onclick="toggleLike(this)">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            <div class="like-count">0</div>
        </button>
        <button><img src="assets/comment.png" alt="Comment" width="20"></button>
        <button><img src="assets/share.png" alt="Share" width="20"></button>
    `;

    postDiv.appendChild(postHeader);
    postDiv.appendChild(postContentDiv);
    postDiv.appendChild(postActions);
    postsContainer.prepend(postDiv);

    // Clear input fields after posting
    postContent.value = "";
    mediaUpload.value = "";
});

function toggleLike(button) {
    const likeCountElement = button.querySelector('.like-count');
    let likeCount = parseInt(likeCountElement.innerText);
    button.classList.toggle('liked');

    if (button.classList.contains('liked')) {
        likeCount++;
    } else {
        likeCount--;
    }

    likeCountElement.innerText = likeCount;
}
