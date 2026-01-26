# Technical Context

## Development Environment
-   **Language**: TypeScript (Type-safe JavaScript).
-   **Build Tool**: Vite (Fast development server and bundler).
-   **Package Manager**: npm.

## Core Libraries
-   **Three.js**: Used for all 3D rendering, scene management, and shader handling.
    -   `THREE.Scene`, `THREE.PerspectiveCamera`, `THREE.WebGLRenderer`: Basic setup.
    -   `THREE.ShaderMaterial`: For custom background effects, often adapted from Shadertoy.
    -   `THREE.TextureLoader`: For loading assets.

## Data Structures
-   **Bible Data**: JSON files located in `translations/`.
    -   Format 1 (New): Array of books -> chapters -> verses.
    -   Format 2 (Old): Object keyed by book name.
-   **Theme Config**: JSON files in `themes/<theme_name>/theme.json`.
    -   Defines shader paths, texture paths, UI positioning, and transition settings.

## Shaders
-   **GLSL**: Used for fragment shaders.
-   **Shadertoy Compatibility**: The engine includes a converter (`convertShadertoyToWebGL`) to adapt Shadertoy code (which uses `mainImage`, `iTime`, `iResolution`) to standard WebGL/Three.js uniforms.

## Project Structure
-   `/src`: Source code.
    -   `/core`: Main application logic (`Presenter3D`).
    -   `/services`: Business logic (`BibleService`, etc.).
    -   `/types`: TypeScript interfaces.
-   `/public`: Static assets served directly.
    -   `/themes`: Theme assets (shaders, images, configs).
    -   `/translations`: Bible data files.
-   `/bible_databases-master`: (Submodule) Source for generating Bible data.
