# Tool Requirements

Please fill out the sections below to describe the new tool you want to build.

## 1. Project Overview
* **What is the tool?** (e.g., A web app, a CLI tool, a VS Code extension)
  * Tattoo Photo Generation Tool
* **What problem does it solve?** 
  * It allows people to generate tattoo photos using AI
* **Who is the target audience?**
  * People who want to generate tattoo photos using AI

## 2. Core Features (The "Must-Haves")
  * Generate tattoo photos using AI

Comprehensive Options for Your Tattoo Generation Tool
These lists should be presented as nested menus or filter sets within the tool.

1. Placement (Where on the Body)

The location changes the anatomy, skin texture, and how a flat design must conform to curves.

Forearm: Inner, Outer, Wrist, Full Wrap
Upper Arm: Bicep (Inner/Outer), Shoulder Cap, Tricep
Torso: Collarbone/Clavicle, Sternum/Chest, Side Ribs, Full Back, Spine, Stomach/Abdomen
Leg: Thigh (Front/Side), Shin/Calf, Ankle, Knee
Hand/Foot: Back of Hand, Finger, Top of Foot
Head/Neck: Behind the Ear, Nape of Neck, Side of Neck

2. Style (The Core Aesthetic)

The style determines the texture, color palette, and overall "feel."

Blackwork: (Heavy Black, Linework Only, Dotwork/Stippling)
Realism: (Black & Grey Photo-realism, Color Realism, Micro-realism)
Illustrative: (Fine-line Illustrative, Neo-traditional, Old School/Traditional, Anime/Manga Style)
Geometric: (Mandala, Sacred Geometry, Minimalist Line-art, Abstract/Conceptual)
Text/Script: (Calligraphy, Handwritten Cursive, Old English, Typewriter Font)
Watercolor: (Abstract Splashes, Color Gradient Wash)
Japanese (Irezumi): (Classic, Modern interpretations)
Tribal: (Maori, Polynesian, Neo-Tribal/Cyber-Sigil)

3. Primary Subject (The Main Focal Point)

A user can type anything, but offering strong categories helps refine the details.

Flora & Fauna: (A specific animal [e.g., Wolf, Fox, Eagle, Pet Portrait], A specific flower [e.g., Rose, Peony, Lily], Insects, Trees/Forests)
Symbolic/Tools: (Compass, Anchor, Clock/Timepiece, Globe/Map, Sword/Dagger, Quill)
Human/Figures: (Portrait [detailed or conceptual], Anatomical heart, Hands [praying, holding])
Mythology & Fantasy: (Dragon, Phoenix, Mythological God, Zodiac Symbol)
Pop Culture: (Anime Character, Movie Icon, Video Game Symbol)
Celestial: (Sun, Moon phases, Stars, Constellations, Planet)

4. Secondary Elements & Text (The Integrated Fillers)

A high-quality tattoo rarely stands alone. These are elements used to tie the design together or add personal meaning.

Integrated Script: (Name [e.g., "Hiyān"], Date [e.g., DD.MM.YY], Roman Numerals, Quote)
Geometrics/Frames: (Enclosing Circle, Triangle frame, Star constellation overlay)
Nature Fillers: (Leaves/Vines, Cloud swirls, Water splashes, Tiny stars/dots)
Background Effects: (Abstract watercolor wash, Dotwork shading frame, Cross-hatching shading)
Technical Details: (Compass rose with integrated clock face, Latitude/Longitude coordinates)

5. Shading Technique (The Method of Depth)

This specific category is crucial for replicating the Black Poison quality. It defines the 'cleanliness' and 'detail' of the shading.

Stippling/Dotwork: (Explicit pointillism for gradients and depth—very clean)
Smooth Grey-wash: (Soft, blended pencil-like shading)
High-Contrast/Heavy Black: (Bold, saturated solid black areas)
Cross-Hatching: (Parallel or intersecting fine lines for depth—illustrative)
Whip Shading: (Tattoo-specific technique creating textured gradients)
Fine-Line Only: (No shading, purely defined by crisp linework)

6. Background (The Studio Environment)

This sets the mood and professionalism of the photo, not the tattoo.

Studio Dark: (A deep charcoal grey or black velvet backdrop—classic for Blackwork)
Soft Focus Parlor: (Blurred, warm interior of a busy tattoo shop)
Natural/Street: (Neutral, blurred urban or natural background for lifestyle look)
Geometric Backdrop: (A subtle, matching geometric pattern out of focus)

Exact Prompt which will be used to generate the tattoo photo.

"A high-resolution, professional studio photography shot of a [FOREARM: Outer] tattoo. The design is a [STYLE: Micro-realism Black & Grey] composition featuring [PRIMARY SUBJECT: Pet Portrait (Golden Retriever)] integrated with [SECONDARY ELEMENTS: Handwritten Cursive Name ('Max') and his birthdate]. The tattoo features [SHADING TECHNIQUE: Meticulous stippling and smooth grey-wash] and exceptionally clean, sharp linework. The skin texture is realistic, against a [BACKGROUND: Studio Dark] backdrop."

## 3. User Flow & Interface (UI/UX)
  * User select options from multiple dropdowns and click generate button
  * Modern Dark Mode UI

## 4. Technical Preferences (Optional)
  * Hosted entirely on the **Firebase Platform** (Firebase Hosting for the frontend, Firebase Cloud Functions for the backend proxy).
  * Nano Banana 2.5 APIs

## 5. Future Features (The "Nice-to-Haves")
  * Easily Download Stencil of Generated Tattoo Photo
  * Pay Wall (via Stripe + Firebase Auth)
  * Firebase Cloud Storage for saving user-generated tattoo images
  * Firebase Firestore Database to track user credits and generation history
