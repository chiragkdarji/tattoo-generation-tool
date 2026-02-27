import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";
import { getFirestore, collection, addDoc, query, where, orderBy, getDocs, serverTimestamp, doc, updateDoc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let app, auth, provider, storage, db;

// SETUP: Change this to your live Render backend URL after deployment!
const BACKEND_URL = "https://tattoo-generation-tool.onrender.com"; // e.g., "https://tattoo-backend-xxx.onrender.com"

// Fetch config securely from backend env
const configResponse = await fetch(`${BACKEND_URL}/api/config`);
const { firebaseConfig } = await configResponse.json();

app = initializeApp(firebaseConfig);
auth = getAuth(app);
provider = new GoogleAuthProvider();
storage = getStorage(app);
db = getFirestore(app);

let currentUser = null;

const categories = {
    placement: [
        "Forearm: Inner", "Forearm: Outer", "Forearm: Wrist", "Forearm: Full Wrap",
        "Upper Arm: Bicep Inner", "Upper Arm: Bicep Outer", "Upper Arm: Shoulder Cap", "Upper Arm: Tricep",
        "Torso: Collarbone", "Torso: Sternum", "Torso: Side Ribs", "Torso: Full Back", "Torso: Spine", "Torso: Stomach",
        "Leg: Thigh Front", "Leg: Thigh Side", "Leg: Shin", "Leg: Calf", "Leg: Ankle", "Leg: Knee",
        "Extremities: Back of Hand", "Extremities: Finger", "Extremities: Top of Foot",
        "Head/Neck: Behind the Ear", "Head/Neck: Nape of Neck", "Head/Neck: Side of Neck"
    ],
    style: [
        "Blackwork: Heavy Black", "Blackwork: Linework Only", "Blackwork: Dotwork/Stippling",
        "Realism: Black & Grey Photo-realism", "Realism: Color Realism", "Realism: Micro-realism",
        "Illustrative: Fine-line", "Illustrative: Neo-traditional", "Illustrative: Old School/Traditional", "Illustrative: Anime/Manga",
        "Geometric: Mandala", "Geometric: Sacred Geometry", "Geometric: Minimalist Line-art", "Geometric: Abstract/Conceptual",
        "Text/Script: Calligraphy", "Text/Script: Handwritten Cursive", "Text/Script: Old English", "Text/Script: Typewriter Font",
        "Watercolor: Abstract Splashes", "Watercolor: Color Gradient Wash",
        "Japanese (Irezumi): Classic", "Japanese (Irezumi): Modern",
        "Tribal: Maori", "Tribal: Polynesian", "Tribal: Neo-Tribal/Cyber-Sigil"
    ],
    subject: [
        "Flora & Fauna: Animal (Custom)", "Flora & Fauna: Flower (Custom)", "Flora & Fauna: Insects", "Flora & Fauna: Trees/Forests",
        "Symbolic/Tools: Compass", "Symbolic/Tools: Anchor", "Symbolic/Tools: Clock/Timepiece", "Symbolic/Tools: Globe/Map", "Symbolic/Tools: Sword/Dagger", "Symbolic/Tools: Quill",
        "Human/Figures: Portrait (Custom)", "Human/Figures: Anatomical heart", "Human/Figures: Hands praying", "Human/Figures: Hands holding",
        "Mythology & Fantasy: Dragon", "Mythology & Fantasy: Phoenix", "Mythology & Fantasy: Mythological God", "Mythology & Fantasy: Zodiac Symbol",
        "Pop Culture: Anime Character", "Pop Culture: Movie Icon", "Pop Culture: Video Game Symbol",
        "Celestial: Sun", "Celestial: Moon phases", "Celestial: Stars", "Celestial: Constellations", "Celestial: Planet"
    ],
    elements: [
        "None",
        "Integrated Script (Custom)",
        "Geometrics/Frames: Enclosing Circle", "Geometrics/Frames: Triangle frame", "Geometrics/Frames: Star constellation overlay",
        "Nature Fillers: Leaves/Vines", "Nature Fillers: Cloud swirls", "Nature Fillers: Water splashes", "Nature Fillers: Tiny stars/dots",
        "Background Effects: Abstract watercolor wash", "Background Effects: Dotwork shading frame", "Background Effects: Cross-hatching shading",
        "Technical Details: Compass rose with integrated clock face", "Technical Details: Latitude/Longitude coordinates"
    ],
    shading: [
        "Stippling/Dotwork (Explicit pointillism for gradients and depth)",
        "Smooth Grey-wash (Soft, blended pencil-like shading)",
        "High-Contrast/Heavy Black (Bold, saturated solid areas)",
        "Cross-Hatching (Parallel or intersecting fine lines)",
        "Whip Shading (Tattoo-specific textured gradients)",
        "Fine-Line Only (No shading, purely defined by crisp linework)"
    ],
    background: [
        "Studio Dark (Deep charcoal grey or black velvet backdrop)",
        "Soft Focus Parlor (Blurred, warm interior of a busy tattoo shop)",
        "Natural/Street (Neutral, blurred urban or natural background)",
        "Geometric Backdrop (Subtle matching geometric pattern out of focus)"
    ],
    aspectRatio: [
        "1:1",
        "3:4",
        "4:3",
        "9:16",
        "16:9"
    ]
};

// DOM Elements
const form = document.getElementById('generator-form');
const promptOutput = document.getElementById('prompt-output');
const generateBtn = document.getElementById('generate-btn');
const btnText = document.querySelector('.btn-text');
const loader = document.querySelector('.loader');

const imageContainer = document.getElementById('image-container');
const generatedImage = document.getElementById('generated-image');
const placeholderContent = document.querySelector('.placeholder-content');
const actionsPanel = document.getElementById('action-buttons');

const subjectDetail = document.getElementById('subject-detail');
const elementsDetail = document.getElementById('elements-detail');

let currentBlobUrl = null;
let currentDocumentId = null;
let currentStencilUrl = null;
let unsubscribeCredits = null;
window.userCredits = 0;

// Populate dropdowns
function populateSelects() {
    ['placement', 'style', 'subject', 'elements', 'shading', 'background', 'aspectRatio'].forEach(id => {
        const select = document.getElementById(id);

        // Default Option
        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.text = `Select ${id.charAt(0).toUpperCase() + id.slice(1)}`;
        defaultOption.disabled = true;
        defaultOption.selected = true;
        select.appendChild(defaultOption);

        categories[id].forEach(item => {
            const option = document.createElement('option');
            option.value = item;
            option.text = item;
            select.appendChild(option);
        });

        // Add change listeners
        select.addEventListener('change', handleSelectChange);
    });
}

function handleSelectChange(e) {
    const id = e.target.id;
    const value = e.target.value;

    // Show custom inputs if required
    if (id === 'subject') {
        if (value.includes('(Custom)')) {
            subjectDetail.classList.add('active');
            subjectDetail.required = true;
        } else {
            subjectDetail.classList.remove('active');
            subjectDetail.required = false;
        }
    }

    if (id === 'elements') {
        if (value.includes('Integrated Script') || value.includes('(Custom)')) {
            elementsDetail.classList.add('active');
            elementsDetail.required = true;
        } else {
            elementsDetail.classList.remove('active');
            elementsDetail.required = false;
        }
    }

    updatePromptPreview();
}

function updatePromptPreview() {
    // Generate text internally as users select
    const p = document.getElementById('placement').value || "[PLACEMENT]";
    const st = document.getElementById('style').value || "[STYLE]";

    let sub = document.getElementById('subject').value || "[PRIMARY SUBJECT]";
    if (sub.includes('Custom') && subjectDetail.value) {
        sub = sub.replace('(Custom)', `(${subjectDetail.value})`);
    }

    let el = document.getElementById('elements').value || "[SECONDARY ELEMENTS]";
    if (el.includes('Custom') && elementsDetail.value) {
        el = el.replace('(Custom)', `(${elementsDetail.value})`);
    } else if (el.includes('Script') && elementsDetail.value) {
        el += ` - "${elementsDetail.value}"`;
    }

    const sh = document.getElementById('shading').value || "[SHADING TECHNIQUE]";
    const bg = document.getElementById('background').value || "[BACKGROUND]";

    let previewHtml = `A high-resolution, professional studio photography shot of a <strong>[FOREARM: ${p}]</strong> tattoo. 
    The design is a <strong>[STYLE: ${st}]</strong> composition featuring <strong>[PRIMARY SUBJECT: ${sub}]</strong>`;

    if (el !== "None" && el !== "[SECONDARY ELEMENTS]") {
        previewHtml += ` integrated with <strong>[SECONDARY ELEMENTS: ${el}]</strong>. `;
    } else {
        previewHtml += `. `;
    }

    previewHtml += `The tattoo features <strong>[SHADING TECHNIQUE: ${sh}]</strong> and exceptionally clean, sharp linework. The skin texture is realistic, against a <strong>[BACKGROUND: ${bg}]</strong> backdrop.`;

    promptOutput.innerHTML = previewHtml;
}

// Add input listener for real-time prompt updating on typing
subjectDetail.addEventListener('input', updatePromptPreview);
elementsDetail.addEventListener('input', updatePromptPreview);

// Generate Submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Assemble final text
    const p = document.getElementById('placement').value;
    const st = document.getElementById('style').value;

    let sub = document.getElementById('subject').value;
    if (sub.includes('Custom')) sub = sub.replace('(Custom)', `(${subjectDetail.value})`);

    let el = document.getElementById('elements').value;
    if (el.includes('Custom')) el = el.replace('(Custom)', `(${elementsDetail.value})`);
    else if (el.includes('Script')) el += ` - "${elementsDetail.value}"`;

    const sh = document.getElementById('shading').value;
    const bg = document.getElementById('background').value;
    const aspect = document.getElementById('aspectRatio').value || "1:1";

    const fullPrompt = `A high-resolution, professional studio photography shot of a [PLACEMENT: ${p}] tattoo. The design is a [STYLE: ${st}] composition featuring [PRIMARY SUBJECT: ${sub}] ${el !== 'None' ? 'integrated with [SECONDARY ELEMENTS: ' + el + ']' : ''}. The tattoo features [SHADING TECHNIQUE: ${sh}] and exceptionally clean, sharp linework. The skin texture is realistic, against a [BACKGROUND: ${bg}] backdrop.`;

    generateImage(fullPrompt, aspect);
});

async function generateImage(prompt, aspect) {
    if (window.userCredits < 50) {
        alert("Not enough credits! You need 50 credits to generate a new tattoo.");
        return;
    }

    // UI State Loading
    generateBtn.disabled = true;
    btnText.textContent = "Generating...";
    loader.classList.remove('hidden');

    try {
        // REPLACE THE URL with your actual backend Hostinger URL once deployed!
        // Local testing assumes backend runs on port 3000
        const backendUrl = `${BACKEND_URL}/api/generate`;

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                aspect_ratio: aspect,
                userId: currentUser.uid // Pass user ID for backend credit check
            })
        });

        if (!response.ok) {
            const err = await response.json();
            const message = err.details ? `${err.error} (${err.details})` : (err.error || 'Server error occurred');
            throw new Error(message);
        }

        // Ensure we handle image as a Blob directly
        const imageBlob = await response.blob();

        // Release previous URL to prevent memory leaks
        if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = URL.createObjectURL(imageBlob);

        // Update UI Image
        generatedImage.src = currentBlobUrl;
        generatedImage.classList.remove('hidden');
        placeholderContent.classList.add('hidden');

        // Update container's aspect ratio to match the generated image ratio exactly
        imageContainer.style.aspectRatio = aspect.replace(':', '/');
        imageContainer.classList.add('has-image');

        actionsPanel.classList.remove('hidden');

        // Save History
        currentDocumentId = null;
        currentStencilUrl = null;
        if (currentUser) {
            currentDocumentId = await saveTattooToHistory(currentUser.uid, imageBlob, prompt, aspect);
        }

    } catch (error) {
        alert("Error Generating Image! Ensure your local backend is running! Details: " + error.message);
        console.error(error);
    } finally {
        generateBtn.disabled = false;
        btnText.textContent = "Generate Tattoo";
        loader.classList.add('hidden');
    }
}

// Download controls
document.getElementById('download-btn').addEventListener('click', () => {
    if (!currentBlobUrl) return;
    const a = document.createElement('a');
    a.href = currentBlobUrl;
    a.download = `tattoo-mockup-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});

document.getElementById('stencil-btn').addEventListener('click', async () => {
    if (!currentBlobUrl) return;

    // UI Loading state for Stencil button
    const stencilBtn = document.getElementById('stencil-btn');
    const originalText = stencilBtn.textContent;
    stencilBtn.textContent = "Processing...";
    stencilBtn.disabled = true;

    try {
        if (currentStencilUrl) {
            // Already generated and saved previously! Use the proxy to avoid CORS
            const proxyUrl = `${BACKEND_URL}/api/proxy-image?url=${encodeURIComponent(currentStencilUrl)}`;
            const cachedResponse = await fetch(proxyUrl);
            if (!cachedResponse.ok) throw new Error("Proxy request failed");

            const cachedBlob = await cachedResponse.blob();
            const cachedBlobUrl = URL.createObjectURL(cachedBlob);

            const a = document.createElement('a');
            a.href = cachedBlobUrl;
            a.download = `tattoo-stencil-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Wait a full 2 seconds before revoking to prevent browser download silent failures!
            setTimeout(() => URL.revokeObjectURL(cachedBlobUrl), 2000);

            // Re-enable button manually since we are returning early
            stencilBtn.textContent = originalText;
            stencilBtn.disabled = false;
            return;
        }

        // Convert the current blob URL to base64 so we can send it to our backend
        const responseBlob = await fetch(currentBlobUrl);
        const blob = await responseBlob.blob();

        const base64data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => resolve(reader.result);
        });

        // Call our new Stencil Gen backend route
        const backendUrl = `${BACKEND_URL}/api/stencil`;

        const stencilResponse = await fetch(backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64data })
        });

        if (!stencilResponse.ok) {
            throw new Error('Failed to generate stencil');
        }

        // Download the returned stencil image
        const stencilBlob = await stencilResponse.blob();
        const stencilUrl = URL.createObjectURL(stencilBlob);

        const a = document.createElement('a');
        a.href = stencilUrl;
        a.download = `tattoo-stencil-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Cleanup local ref memory leak safely
        setTimeout(() => URL.revokeObjectURL(stencilUrl), 2000);

        // Permanently cache Stencil DB Link to Google Cloud
        if (currentUser && currentDocumentId && !currentStencilUrl) {
            const timestamp = Date.now();
            const filename = `stencils/${currentUser.uid}/${timestamp}.png`;
            const sRef = storageRef(storage, filename);
            const snapshot = await uploadBytes(sRef, stencilBlob);
            const downloadUrl = await getDownloadURL(snapshot.ref);

            await updateDoc(doc(db, "tattoos", currentDocumentId), {
                stencilUrl: downloadUrl
            });
            currentStencilUrl = downloadUrl;
        }

    } catch (error) {
        console.error("Stencil Error:", error);
        alert("Failed to process the stencil. See console for details.");
    } finally {
        stencilBtn.textContent = originalText;
        stencilBtn.disabled = false;
    }
});

// Init
populateSelects();

/* --- Firebase Authentication Logic --- */

const loginOverlay = document.getElementById('login-overlay');
const loginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userBar = document.getElementById('user-bar');
const userEmail = document.getElementById('user-email');
const userAvatar = document.getElementById('user-avatar');

// Login Event
loginBtn.addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login Error:", error);
    }
});

// Buy Credits Event (Stripe Checkout)
document.getElementById('buy-credits-btn').addEventListener('click', async () => {
    if (!currentUser) return;

    // Add loading state
    const buyBtn = document.getElementById('buy-credits-btn');
    const originalText = buyBtn.textContent;
    buyBtn.textContent = "Loading...";
    buyBtn.disabled = true;

    try {
        const response = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.uid })
        });

        const data = await response.json();
        if (data.url) {
            window.location.href = data.url; // Redirect to Stripe
        } else {
            throw new Error("Missing checkout URL");
        }
    } catch (e) {
        console.error("Checkout Error:", e);
        alert("Failed to initialize secure checkout. Please try again.");
    } finally {
        buyBtn.textContent = originalText;
        buyBtn.disabled = false;
    }
});

// Logout Event
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout Error:", error);
    }
});

// Auth State Listener
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        // Init Credit Wallet
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            await setDoc(userRef, { credits: 500, email: user.email });
        }

        // Listen to Credit changes live 
        if (unsubscribeCredits) unsubscribeCredits();
        unsubscribeCredits = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                window.userCredits = data.credits;
                document.getElementById('credit-amount').textContent = `${data.credits} Credits`;
            }
        });

        // User is logged in! Hide the overlay wrapper smoothly
        loginOverlay.style.opacity = '0';
        setTimeout(() => loginOverlay.classList.add('hidden'), 300);

        userBar.classList.remove('hidden');
        userEmail.textContent = user.email;
        if (user.photoURL) {
            userAvatar.src = user.photoURL;
            userAvatar.classList.remove('hidden');
        }

        loadUserHistory(user.uid);
    } else {
        // User logged out! Bring the wall back up.
        if (unsubscribeCredits) {
            unsubscribeCredits();
            unsubscribeCredits = null;
        }

        // Clean up URL parameters if user cancels stripe or logs out
        window.history.replaceState({}, document.title, "/");

        loginOverlay.classList.remove('hidden');
        requestAnimationFrame(() => loginOverlay.style.opacity = '1');

        userBar.classList.add('hidden');
        userAvatar.classList.add('hidden');

        // Clear History UI
        document.getElementById('history-panel').classList.add('hidden');
        document.getElementById('history-grid').innerHTML = '';
    }
});

// --- History Logic ---

async function saveTattooToHistory(uid, blob, prompt, aspect) {
    try {
        const timestamp = Date.now();
        const filename = `tattoos/${uid}/${timestamp}.png`;
        const sRef = storageRef(storage, filename);

        // Upload Blob manually
        const snapshot = await uploadBytes(sRef, blob);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        const docRef = await addDoc(collection(db, "tattoos"), {
            uid: uid,
            imageUrl: downloadUrl,
            prompt: prompt,
            aspect: aspect,
            createdAt: serverTimestamp()
        });

        // reload history after saving
        loadUserHistory(uid);
        return docRef.id;
    } catch (e) {
        console.error("Failed to save history", e);
        return null;
    }
}

async function loadUserHistory(uid) {
    const historyPanel = document.getElementById('history-panel');
    const historyGrid = document.getElementById('history-grid');

    try {
        const q = query(collection(db, "tattoos"), where("uid", "==", uid));
        const snapshot = await getDocs(q);

        historyGrid.innerHTML = ''; // clear loading state

        if (snapshot.empty) {
            historyPanel.classList.add('hidden');
            return;
        }

        historyPanel.classList.remove('hidden');

        // Extract and sort manually to avoid requiring an active composite index in Firestore
        const docsArray = [];
        snapshot.forEach(doc => docsArray.push({ id: doc.id, ...doc.data() }));
        docsArray.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
        });

        docsArray.forEach((data) => {
            const img = document.createElement('img');
            img.src = data.imageUrl;
            img.className = 'history-item';
            img.title = "Click to load to editing board";

            // Allow user to click history to view it in main stage
            img.addEventListener('click', async () => {
                currentDocumentId = data.id || null;
                currentStencilUrl = data.stencilUrl || null;

                const generatedImage = document.getElementById('generated-image');
                const placeholderContent = document.querySelector('.placeholder-content');
                const imageContainer = document.getElementById('image-container');
                const actionsPanel = document.getElementById('action-buttons');

                // Show in Main Area
                generatedImage.src = data.imageUrl;
                generatedImage.classList.remove('hidden');
                placeholderContent.classList.add('hidden');
                imageContainer.style.aspectRatio = data.aspect ? data.aspect.replace(':', '/') : '1';
                imageContainer.classList.add('has-image');
                actionsPanel.classList.remove('hidden');

                // VERY IMPORTANT: Convert external Firebase URL back to a Blob URL
                // So that our C++ Stencil filter proxy or standard download link works flawlessly without CORS blocks!
                try {
                    const proxyUrl = `${BACKEND_URL}/api/proxy-image?url=${encodeURIComponent(data.imageUrl)}`;
                    const historyResponse = await fetch(proxyUrl);
                    if (!historyResponse.ok) throw new Error("Proxy request failed");

                    const historyBlob = await historyResponse.blob();
                    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
                    currentBlobUrl = URL.createObjectURL(historyBlob);
                } catch (e) {
                    console.error("Failed to map history URL to Local Blob for download tools", e);
                    currentBlobUrl = data.imageUrl; // Fallback
                }
            });

            historyGrid.appendChild(img);
        });
    } catch (e) {
        console.error("Failed to load history", e);
        // It's possible we need a Firestore Index for uid + orderBy createdAt
        if (e.message.includes("requires an index")) {
            console.warn("Firestore needs an index creation! Check console link:", e.message);
        }
    }
}

// Support Modal Logic
const supportBtn = document.getElementById('support-btn');
const supportModal = document.getElementById('support-modal');
const closeModal = document.querySelector('.close-modal');

if (supportBtn && supportModal && closeModal) {
    supportBtn.addEventListener('click', () => {
        supportModal.classList.remove('hidden');
    });

    closeModal.addEventListener('click', () => {
        supportModal.classList.add('hidden');
    });

    window.addEventListener('click', (event) => {
        if (event.target === supportModal) {
            supportModal.classList.add('hidden');
        }
    });
}
