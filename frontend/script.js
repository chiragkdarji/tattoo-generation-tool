import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, listAll } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp, doc, updateDoc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let app, auth, provider, storage, db;

const BACKEND_URL = "https://tattoo-generation-tool.onrender.com";

// --- Constants ---
const CREDITS_PER_GENERATION = 50;
const BLOB_REVOKE_DELAY_MS = 2000;
const AUTH_OVERLAY_FADE_MS = 300;

// Fetch config securely from backend env
const configResponse = await fetch(`${BACKEND_URL}/api/config`);
const { firebaseConfig } = await configResponse.json();

app = initializeApp(firebaseConfig);
auth = getAuth(app);
provider = new GoogleAuthProvider();
storage = getStorage(app);
db = getFirestore(app);

// Backend is ready — enable the sign-in button and update its label
const loginBtnEl = document.getElementById('google-login-btn');
const loginBtnText = document.getElementById('login-btn-text');
if (loginBtnEl) loginBtnEl.disabled = false;
if (loginBtnText) loginBtnText.textContent = 'Sign in with Google';

let currentUser = null;
let userCredits = 0;

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

// --- Utilities ---

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showError(message) {
    alert(message);
}

function downloadBlob(blobUrl, filename) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// --- Prompt Logic ---

function getFormValues() {
    let subject = document.getElementById('subject').value || null;
    if (subject && subject.includes('Custom') && subjectDetail.value) {
        subject = subject.replace('(Custom)', `(${subjectDetail.value})`);
    }

    let elements = document.getElementById('elements').value || null;
    if (elements && elements.includes('Custom') && elementsDetail.value) {
        elements = elements.replace('(Custom)', `(${elementsDetail.value})`);
    } else if (elements && elements.includes('Script') && elementsDetail.value) {
        elements += ` - "${elementsDetail.value}"`;
    }

    return {
        placement: document.getElementById('placement').value || null,
        style: document.getElementById('style').value || null,
        subject,
        elements,
        shading: document.getElementById('shading').value || null,
        background: document.getElementById('background').value || null,
        aspectRatio: document.getElementById('aspectRatio').value || "1:1"
    };
}

function buildPromptText(values) {
    const { placement, style, subject, elements, shading, background } = values;
    const p = placement || '[PLACEMENT]';
    const st = style || '[STYLE]';
    const sub = subject || '[PRIMARY SUBJECT]';
    const sh = shading || '[SHADING TECHNIQUE]';
    const bg = background || '[BACKGROUND]';

    const elementsPart = (elements && elements !== 'None')
        ? `integrated with [SECONDARY ELEMENTS: ${elements}]`
        : '';

    return `A high-resolution, professional studio photography shot of a [PLACEMENT: ${p}] tattoo. The design is a [STYLE: ${st}] composition featuring [PRIMARY SUBJECT: ${sub}] ${elementsPart}. The tattoo features [SHADING TECHNIQUE: ${sh}] and exceptionally clean, sharp linework. The skin texture is realistic, against a [BACKGROUND: ${bg}] backdrop.`;
}

// Populate dropdowns
function populateSelects() {
    ['placement', 'style', 'subject', 'elements', 'shading', 'background', 'aspectRatio'].forEach(id => {
        const select = document.getElementById(id);

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

        select.addEventListener('change', handleSelectChange);
    });
}

function handleSelectChange(e) {
    const id = e.target.id;
    const value = e.target.value;

    if (id === 'subject') {
        const isCustom = value.includes('(Custom)');
        subjectDetail.classList.toggle('active', isCustom);
        subjectDetail.required = isCustom;
    }

    if (id === 'elements') {
        const needsDetail = value.includes('Integrated Script') || value.includes('(Custom)');
        elementsDetail.classList.toggle('active', needsDetail);
        elementsDetail.required = needsDetail;
    }

    updatePromptPreview();
}

function updatePromptPreview() {
    const values = getFormValues();
    const p = escapeHtml(values.placement || '[PLACEMENT]');
    const st = escapeHtml(values.style || '[STYLE]');
    const sub = escapeHtml(values.subject || '[PRIMARY SUBJECT]');
    const el = values.elements;
    const sh = escapeHtml(values.shading || '[SHADING TECHNIQUE]');
    const bg = escapeHtml(values.background || '[BACKGROUND]');

    let html = `A high-resolution, professional studio photography shot of a <strong>[PLACEMENT: ${p}]</strong> tattoo.
    The design is a <strong>[STYLE: ${st}]</strong> composition featuring <strong>[PRIMARY SUBJECT: ${sub}]</strong>`;

    if (el && el !== 'None') {
        html += ` integrated with <strong>[SECONDARY ELEMENTS: ${escapeHtml(el)}]</strong>. `;
    } else {
        html += `. `;
    }

    html += `The tattoo features <strong>[SHADING TECHNIQUE: ${sh}]</strong> and exceptionally clean, sharp linework. The skin texture is realistic, against a <strong>[BACKGROUND: ${bg}]</strong> backdrop.`;

    promptOutput.innerHTML = html;
}

// Add input listeners for real-time prompt updating
subjectDetail.addEventListener('input', updatePromptPreview);
elementsDetail.addEventListener('input', updatePromptPreview);

// Generate Submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = getFormValues();
    generateImage(buildPromptText(values), values.aspectRatio);
});

async function generateImage(prompt, aspect) {
    if (userCredits < CREDITS_PER_GENERATION) {
        showError(`Not enough credits! You need ${CREDITS_PER_GENERATION} credits to generate a new tattoo.`);
        return;
    }

    generateBtn.disabled = true;
    btnText.textContent = "Generating...";
    loader.classList.remove('hidden');

    try {
        const idToken = await currentUser.getIdToken();

        const response = await fetch(`${BACKEND_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                aspect_ratio: aspect,
                userId: currentUser.uid,
                idToken
            })
        });

        if (!response.ok) {
            const err = await response.json();
            const message = err.details ? `${err.error} (${err.details})` : (err.error || 'Server error occurred');
            throw new Error(message);
        }

        const imageBlob = await response.blob();

        if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = URL.createObjectURL(imageBlob);

        generatedImage.src = currentBlobUrl;
        generatedImage.classList.remove('hidden');
        placeholderContent.classList.add('hidden');
        imageContainer.style.aspectRatio = aspect.replace(':', '/');
        imageContainer.classList.add('has-image');
        actionsPanel.classList.remove('hidden');

        currentDocumentId = null;
        currentStencilUrl = null;
        if (currentUser) {
            currentDocumentId = await saveTattooToHistory(currentUser.uid, imageBlob, prompt, aspect);
        }

    } catch (error) {
        showError("Error generating image: " + error.message);
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
    downloadBlob(currentBlobUrl, `tattoo-mockup-${Date.now()}.png`);
});

document.getElementById('stencil-btn').addEventListener('click', async () => {
    if (!currentBlobUrl) return;

    const stencilBtn = document.getElementById('stencil-btn');
    const originalText = stencilBtn.textContent;
    stencilBtn.textContent = "Processing...";
    stencilBtn.disabled = true;

    try {
        if (currentStencilUrl) {
            // Already generated — re-download via proxy to avoid CORS
            const proxyUrl = `${BACKEND_URL}/api/proxy-image?url=${encodeURIComponent(currentStencilUrl)}`;
            const cachedResponse = await fetch(proxyUrl);
            if (!cachedResponse.ok) throw new Error("Proxy request failed");

            const cachedBlobUrl = URL.createObjectURL(await cachedResponse.blob());
            downloadBlob(cachedBlobUrl, `tattoo-stencil-${Date.now()}.png`);
            setTimeout(() => URL.revokeObjectURL(cachedBlobUrl), BLOB_REVOKE_DELAY_MS);
            return;
        }

        // Convert current blob URL to base64 for backend
        const blob = await (await fetch(currentBlobUrl)).blob();
        const base64data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => resolve(reader.result);
        });

        const idToken = currentUser ? await currentUser.getIdToken() : null;

        const stencilResponse = await fetch(`${BACKEND_URL}/api/stencil`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageBase64: base64data,
                userId: currentUser?.uid,
                idToken
            })
        });

        if (!stencilResponse.ok) {
            throw new Error('Failed to generate stencil');
        }

        const stencilBlob = await stencilResponse.blob();
        const stencilBlobUrl = URL.createObjectURL(stencilBlob);
        downloadBlob(stencilBlobUrl, `tattoo-stencil-${Date.now()}.png`);
        setTimeout(() => URL.revokeObjectURL(stencilBlobUrl), BLOB_REVOKE_DELAY_MS);

        // Save stencil URL to Firebase Storage
        if (currentUser && currentDocumentId && !currentStencilUrl) {
            const storageReference = storageRef(storage, `stencils/${currentUser.uid}/${Date.now()}.png`);
            const snapshot = await uploadBytes(storageReference, stencilBlob);
            const downloadUrl = await getDownloadURL(snapshot.ref);

            await updateDoc(doc(db, "tattoos", currentDocumentId), { stencilUrl: downloadUrl });
            currentStencilUrl = downloadUrl;
        }

    } catch (error) {
        console.error("Stencil Error:", error);
        showError("Failed to process the stencil. See console for details.");
    } finally {
        stencilBtn.textContent = originalText;
        stencilBtn.disabled = false;
    }
});

// Init
populateSelects();
loadLoginGallery();

/* --- Login Gallery --- */

function loadLoginGallery() {
    // Placeholders already rendered by inline script in HTML.
    // Swap in real tattoo images from Firestore (primary) or Storage listing (fallback).
    const track = document.getElementById('login-gallery-track');
    if (!track) return;

    (async () => {
        // Primary: Firestore query
        try {
            const q = query(collection(db, "tattoos"), orderBy("createdAt", "desc"), limit(7));
            const snapshot = await getDocs(q);
            const real = [];
            snapshot.forEach(d => { if (d.data().imageUrl) real.push(d.data().imageUrl); });

            if (real.length > 0) {
                const images = Array.from({ length: 7 }, (_, i) => real[i % real.length]);
                renderLoginGallery(track, images);
                return;
            }
        } catch (e) {
            console.warn('Gallery: Firestore query failed, trying Storage listing', e);
        }

        // Fallback: list files directly from Firebase Storage
        try {
            const rootRef = storageRef(storage, 'tattoos/');
            const rootList = await listAll(rootRef);
            const urls = [];
            for (const userFolder of rootList.prefixes) {
                if (urls.length >= 7) break;
                const folderList = await listAll(userFolder);
                if (folderList.items.length > 0) {
                    const url = await getDownloadURL(folderList.items[0]);
                    urls.push(url);
                }
            }
            if (urls.length > 0) {
                const images = Array.from({ length: 7 }, (_, i) => urls[i % urls.length]);
                renderLoginGallery(track, images);
            }
        } catch (e) {
            console.warn('Gallery: Storage listing failed, keeping placeholders', e);
        }
    })();
}

function renderLoginGallery(track, images) {
    const count = Math.min(images.length, 7);
    const centerIdx = Math.floor(count / 2);

    track.innerHTML = '';
    images.slice(0, count).forEach((src, i) => {
        const diff = Math.abs(i - centerIdx);
        const card = document.createElement('div');
        const posClass = diff === 0 ? 'gallery-pos-0' : diff === 1 ? 'gallery-pos-1' : '';
        card.className = `gallery-card ${posClass}`.trim();

        const img = document.createElement('img');
        img.src = src;
        img.alt = 'AI Generated Tattoo';

        card.appendChild(img);
        track.appendChild(card);
    });
}

/* --- Firebase Authentication Logic --- */

const loginOverlay = document.getElementById('login-overlay');
const loginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userBar = document.getElementById('user-bar');
const userEmail = document.getElementById('user-email');
const userAvatar = document.getElementById('user-avatar');

loginBtn.addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login Error:", error);
    }
});

document.getElementById('buy-credits-btn').addEventListener('click', async () => {
    if (!currentUser) return;

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
            window.location.href = data.url;
        } else {
            throw new Error("Missing checkout URL");
        }
    } catch (e) {
        console.error("Checkout Error:", e);
        showError("Failed to initialize secure checkout. Please try again.");
    } finally {
        buyBtn.textContent = originalText;
        buyBtn.disabled = false;
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout Error:", error);
    }
});

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            await setDoc(userRef, { credits: 500, email: user.email });
        }

        if (unsubscribeCredits) unsubscribeCredits();
        unsubscribeCredits = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
                userCredits = snapshot.data().credits;
                document.getElementById('credit-amount').textContent = `${userCredits} Credits`;
            }
        });

        loginOverlay.style.opacity = '0';
        setTimeout(() => loginOverlay.classList.add('hidden'), AUTH_OVERLAY_FADE_MS);

        userBar.classList.remove('hidden');
        userEmail.textContent = user.email;
        if (user.photoURL) {
            userAvatar.src = user.photoURL;
            userAvatar.classList.remove('hidden');
        }

        loadUserHistory(user.uid);
    } else {
        if (unsubscribeCredits) {
            unsubscribeCredits();
            unsubscribeCredits = null;
        }

        window.history.replaceState({}, document.title, "/");

        loginOverlay.classList.remove('hidden');
        requestAnimationFrame(() => loginOverlay.style.opacity = '1');

        userBar.classList.add('hidden');
        userAvatar.classList.add('hidden');

        document.getElementById('history-panel').classList.add('hidden');
        document.getElementById('history-grid').innerHTML = '';
    }
});

/* --- History Logic --- */

async function saveTattooToHistory(uid, blob, prompt, aspect) {
    try {
        const storageReference = storageRef(storage, `tattoos/${uid}/${Date.now()}.png`);
        const snapshot = await uploadBytes(storageReference, blob);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        const docRef = await addDoc(collection(db, "tattoos"), {
            uid,
            imageUrl: downloadUrl,
            prompt,
            aspect,
            createdAt: serverTimestamp()
        });

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

        historyGrid.innerHTML = '';

        if (snapshot.empty) {
            historyPanel.classList.add('hidden');
            return;
        }

        historyPanel.classList.remove('hidden');

        // Sort manually to avoid requiring a Firestore composite index
        const historyDocs = [];
        snapshot.forEach(d => historyDocs.push({ id: d.id, ...d.data() }));
        historyDocs.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
        });

        historyDocs.forEach((data) => {
            const img = document.createElement('img');
            img.src = data.imageUrl;
            img.className = 'history-item';
            img.title = "Click to load to editing board";

            img.addEventListener('click', async () => {
                currentDocumentId = data.id || null;
                currentStencilUrl = data.stencilUrl || null;

                generatedImage.src = data.imageUrl;
                generatedImage.classList.remove('hidden');
                placeholderContent.classList.add('hidden');
                imageContainer.style.aspectRatio = data.aspect ? data.aspect.replace(':', '/') : '1';
                imageContainer.classList.add('has-image');
                actionsPanel.classList.remove('hidden');

                // Convert Firebase URL to local Blob URL to avoid CORS issues on download/stencil
                try {
                    const proxyUrl = `${BACKEND_URL}/api/proxy-image?url=${encodeURIComponent(data.imageUrl)}`;
                    const historyResponse = await fetch(proxyUrl);
                    if (!historyResponse.ok) throw new Error("Proxy request failed");

                    const historyBlob = await historyResponse.blob();
                    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
                    currentBlobUrl = URL.createObjectURL(historyBlob);
                } catch (e) {
                    console.error("Failed to map history URL to local Blob", e);
                    currentBlobUrl = data.imageUrl;
                }
            });

            historyGrid.appendChild(img);
        });
    } catch (e) {
        console.error("Failed to load history", e);
        if (e.message.includes("requires an index")) {
            console.warn("Firestore needs an index! Check console link:", e.message);
        }
    }
}

/* --- Support Modal Logic --- */

const supportBtn = document.getElementById('support-btn');
const supportModal = document.getElementById('support-modal');
const closeModal = document.querySelector('.close-modal');

if (supportBtn && supportModal && closeModal) {
    supportBtn.addEventListener('click', () => supportModal.classList.remove('hidden'));
    closeModal.addEventListener('click', () => supportModal.classList.add('hidden'));
    window.addEventListener('click', (event) => {
        if (event.target === supportModal) supportModal.classList.add('hidden');
    });
}
