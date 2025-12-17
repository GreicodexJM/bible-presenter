import * as THREE from 'three';
import type { ThemeConfig, Theme, InputState, BibleAPIResponse } from '../types';
import { BibleService } from '../services/BibleService';

// Game state
export class Presenter3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private input: InputState;
  private animationId: number | null = null;

  // Theme
  private theme!: Theme;

  // Bible functionality
  private bibleService: BibleService;
  private textInput: string = '';
  private currentVerse: BibleAPIResponse | null = null;

  // Cloud background
  private shaderMaterial: THREE.ShaderMaterial | null = null;

  // Text overlay elements
  private textOverlay: HTMLDivElement | null = null;
  private inputContainer: HTMLDivElement | null = null;
  private inputTextElement: HTMLInputElement | null = null;
  private verseContainer: HTMLDivElement | null = null;
  private verseTextElement: HTMLDivElement | null = null;



  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.input = {
      mouse: { x: 0, y: 0, buttons: [] },
      keyboard: {}
    };

    this.bibleService = new BibleService();

    // Load configuration and theme
    this.loadConfiguration().then(() => {
      this.init();
      this.setupEventListeners();
      this.createScene();
      this.animate();
    });
  }

  private async loadConfiguration(): Promise<void> {
    try {
      // Load main config
      const configResponse = await fetch('/config.json');
      const config = await configResponse.json();

      // Load theme configuration
      const themeResponse = await fetch(`/themes/${config.activeTheme}/theme.json`);
      const themeConfig: ThemeConfig = await themeResponse.json();

      // Load theme resources
      const [vertexShader, fragmentShader, inputTemplate, verseTemplate, styles] = await Promise.all([
        themeConfig.background.vertexShader ? fetch(`/themes/${config.activeTheme}/${themeConfig.background.vertexShader}`).then(r => r.text()) : Promise.resolve(''),
        themeConfig.background.fragmentShader ? fetch(`/themes/${config.activeTheme}/${themeConfig.background.fragmentShader}`).then(r => r.text()) : Promise.resolve(''),
        fetch(`/themes/${config.activeTheme}/templates/${themeConfig.input.backgroundImage}`).then(r => r.text()),
        fetch(`/themes/${config.activeTheme}/templates/${themeConfig.verse.backgroundImage}`).then(r => r.text()),
        fetch(`/themes/${config.activeTheme}/styles/animations.css`).then(r => r.text())
      ]);

      // Inject Styles
      if (styles) {
        const oldStyle = document.getElementById('theme-styles');
        if (oldStyle) oldStyle.remove();

        const styleEl = document.createElement('style');
        styleEl.id = 'theme-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
      }

      // Load textures
      const textureLoader = new THREE.TextureLoader();
      const loadedTextures: THREE.Texture[] = [];

      if (themeConfig.background.textures && themeConfig.background.textures.length > 0) {
        const texturePromises = themeConfig.background.textures.map(textureFile => {
          return new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(
              `/themes/${config.activeTheme}/images/${textureFile}`,
              (texture) => {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                resolve(texture);
              },
              undefined,
              (err) => {
                console.error(`Failed to load texture: ${textureFile}`, err);
                // Return a basic placeholder texture on error to prevent crashes
                reject(new THREE.Texture());
              }
            );
          });
        });

        const textures = await Promise.all(texturePromises);
        loadedTextures.push(...textures);
      }

      this.theme = {
        config: themeConfig,
        backgroundShaders: {
          vertex: vertexShader,
          fragment: fragmentShader
        },
        loadedTextures: loadedTextures,
        inputTemplate: inputTemplate,
        verseTemplate: verseTemplate,
        styles: styles
      };

      // Load translation data
      const translationResponse = await fetch(`/translations/${config.activeTranslation}.json`);
      this.bibleService.loadTranslation(await translationResponse.json());

    } catch (error) {
      console.error('Failed to load configuration:', error);
      // Fallback to a basic default theme
      const fallbackConfig: ThemeConfig = {
        name: 'Default',
        background: {
          type: 'shader',
          vertexShader: 'default.vert',
          fragmentShader: 'default.frag',
          uniforms: {
            time: { type: 'float', value: 0.0 },
            resolution: { type: 'vec2', value: [1920, 1080] }
          }
        },
        input: {
          backgroundImage: 'input.svg',
          position: { x: '50%', y: '40%' },
          size: { width: '600px', height: '80px' }
        },
        verse: {
          backgroundImage: 'verse.svg',
          position: { x: '50%', y: '60%' },
          size: { width: '800px', height: '200px' }
        },
        transitions: {
          animDuration: 500,
          easing: 'ease-in-out'
        }
      };
      this.theme = { config: fallbackConfig };
    }
  }

  private init(): void {
    // Setup renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000011, 1);
    document.getElementById('app')!.appendChild(this.renderer.domElement);

    // Create overlay container for text elements
    this.createTextOverlay();

    // Setup camera
    this.camera.position.z = 5;

    // Handle window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  private createTextOverlay(): void {
    // Create overlay container
    this.textOverlay = document.createElement('div');
    this.textOverlay.id = 'text-overlay';
    this.textOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    `;

    // Create input container (for SVG background)
    this.inputContainer = document.createElement('div');
    this.inputContainer.id = 'bible-input-container';
    this.inputContainer.style.cssText = `
      position: absolute;
      left: ${this.theme.config.input.position.x};
      top: ${this.theme.config.input.position.y};
      width: ${this.theme.config.input.size.width};
      height: ${this.theme.config.input.size.height};
      display: none;
      z-index: 11;
      pointer-events: auto;
    `;

    // Create native input element
    this.inputTextElement = document.createElement('input');
    this.inputTextElement.type = 'text';
    this.inputTextElement.id = 'bible-input';
    this.inputTextElement.style.cssText = `
      width: 100%;
      height: 100%;
      background: transparent;
      border: none;
      outline: none;
      color: #ffffff;
      font-size: 24px;
      text-align: center;
      font-family: 'Segoe UI', sans-serif;
      text-shadow: 0 0 5px rgba(0,0,0,0.5);
    `;

    // Add event listeners for native input
    this.inputTextElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.processBibleReference();
      } else if (e.key === 'Escape') {
        this.hideInputText();
      }
    });

    this.inputTextElement.addEventListener('input', (e) => {
      this.textInput = (e.target as HTMLInputElement).value;
    });

    this.inputContainer.appendChild(this.inputTextElement);

    // Create verse container (for SVG background)
    this.verseContainer = document.createElement('div');
    this.verseContainer.id = 'bible-verse-container';
    this.verseContainer.style.cssText = `
      position: absolute;
      left: ${this.theme.config.verse.position.x};
      top: ${this.theme.config.verse.position.y};
      width: ${this.theme.config.verse.size.width};
      height: ${this.theme.config.verse.size.height};
      display: none;
      z-index: 11;
      pointer-events: none;
    `;

    // Create verse text element (for HTML text content)
    this.verseTextElement = document.createElement('div');
    this.verseTextElement.id = 'bible-verse-text';
    this.verseTextElement.style.cssText = `
      position: absolute;
      left: ${this.theme.config.verse.position.x};
      top: ${this.theme.config.verse.position.y};
      width: ${this.theme.config.verse.size.width};
      height: ${this.theme.config.verse.size.height};
      font-size: 28px;
      color: #ffffff;
      text-align: center;
      white-space: pre-wrap;
      display: none;
      z-index: 12;
      line-height: 1.4;
      pointer-events: none;
      font-family: 'Segoe UI', sans-serif;
      text-shadow: 0 0 5px rgba(0,0,0,0.5);
    `;

    // Add elements to overlay
    this.textOverlay.appendChild(this.inputContainer);
    this.textOverlay.appendChild(this.verseContainer);
    this.textOverlay.appendChild(this.verseTextElement);

    // Add overlay to app
    document.getElementById('app')!.appendChild(this.textOverlay);
  }

  private setupEventListeners(): void {
    // Mouse events
    document.addEventListener('mousemove', (event) => {
      this.input.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.input.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    document.addEventListener('mousedown', (event) => {
      this.input.mouse.buttons[event.button] = true;
    });

    document.addEventListener('mouseup', (event) => {
      this.input.mouse.buttons[event.button] = false;
    });

    // Keyboard events
    document.addEventListener('keydown', (event) => {
      this.input.keyboard[event.code] = true;

      // Handle Verse Navigation
      if (this.currentVerse) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
          this.handleVerseNavigation(event.key);
          return;
        }
      }

      // Auto-focus input on typing (if not already focused and not a control key)
      if (!this.inputTextElement) return;
      if (document.activeElement !== this.inputTextElement) {
        if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
          this.showInputText();
          this.inputTextElement.focus();
          // We don't prevent default here so the key goes to the input
        } else if (event.key === 'Enter') {
          this.showInputText();
          this.inputTextElement.focus();
        }
      }
    });

    document.addEventListener('keyup', (event) => {
      this.input.keyboard[event.code] = false;
    });

    // Prevent context menu
    document.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
  }

  private createScene(): void {
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);

    // Create animated cloud background
    this.createShaderBackground();
  }

  private createShaderBackground(): void {
    if (this.theme.config.background.type !== 'shader') return;

    // Use loaded shaders if available, otherwise fallback to inline shaders
    const vertexShader = this.theme.backgroundShaders?.vertex || `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    // Convert Shadertoy fragment shader to WebGL compatible format
    let fragmentShader = this.theme.backgroundShaders?.fragment || `
      uniform float iTime;
      uniform vec2 iResolution;
      uniform vec2 iMouse;

      // Test Shadertoy shader - Simple gradient
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
          vec2 uv = fragCoord / iResolution.xy;
          vec3 col = vec3(uv.x, uv.y, 0.5);
          fragColor = vec4(col, 1.0);
      }

      void main() {
        mainImage(gl_FragColor, gl_FragCoord.xy);
      }
    `;

    // Check if this is a Shadertoy-style shader (has mainImage function)
    const hasMainImage = fragmentShader.includes('mainImage');

    if (hasMainImage) {
      // Convert Shadertoy shader to WebGL format
      fragmentShader = this.convertShadertoyToWebGL(fragmentShader);
    } else {
      // Use as-is (already WebGL format)
      fragmentShader = fragmentShader;
    }

    // Create shader material with Shadertoy-compatible uniforms
    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      uniforms: {
        iTime: { value: 0.0 },
        iTimeDelta: { value: 0.016 },
        iResolution: { value: new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0) },
        iMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
        iFrame: { value: 0 },
        iFrameRate: { value: 60.0 },
        iChannel0: { value: this.theme.loadedTextures?.[0] || null },
        iChannel1: { value: this.theme.loadedTextures?.[1] || null },
        iChannel2: { value: this.theme.loadedTextures?.[2] || null },
        iChannel3: { value: this.theme.loadedTextures?.[3] || null },
        iChannelTime: { value: [0.0, 0.0, 0.0, 0.0] },
        iChannelResolution: {
          value: [
            this.theme.loadedTextures?.[0]?.image ? new THREE.Vector3((this.theme.loadedTextures[0].image as any).width || window.innerWidth, (this.theme.loadedTextures[0].image as any).height || window.innerHeight, 1.0) : new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0),
            this.theme.loadedTextures?.[1]?.image ? new THREE.Vector3((this.theme.loadedTextures[1].image as any).width || window.innerWidth, (this.theme.loadedTextures[1].image as any).height || window.innerHeight, 1.0) : new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0),
            this.theme.loadedTextures?.[2]?.image ? new THREE.Vector3((this.theme.loadedTextures[2].image as any).width || window.innerWidth, (this.theme.loadedTextures[2].image as any).height || window.innerHeight, 1.0) : new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0),
            this.theme.loadedTextures?.[3]?.image ? new THREE.Vector3((this.theme.loadedTextures[3].image as any).width || window.innerWidth, (this.theme.loadedTextures[3].image as any).height || window.innerHeight, 1.0) : new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0)
          ]
        },
        iDate: { value: new THREE.Vector4() },
        iSampleRate: { value: 44100.0 }
      },
      side: THREE.BackSide
    });

    // Create large sphere for skybox
    const skyGeometry = new THREE.SphereGeometry(100, 32, 32);
    const skyMesh = new THREE.Mesh(skyGeometry, shaderMaterial);
    this.scene.add(skyMesh);

    // Store material reference for animation
    this.shaderMaterial = shaderMaterial;

    // Update resolution on window resize
    window.addEventListener('resize', () => {
      if (this.shaderMaterial) {
        this.shaderMaterial.uniforms.iResolution.value.set(window.innerWidth, window.innerHeight);
      }
    });
  }

  private convertShadertoyToWebGL(shadertoyCode: string): string {
    // Add Shadertoy uniforms at the top if not already present
    let webGLShader = shadertoyCode;

    // Ensure we have the standard Shadertoy uniforms
    const uniforms = `
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform float iFrameRate;
uniform vec4 iMouse;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec4 iDate;
uniform float iSampleRate;
`;

    // Add uniforms if not already present
    if (!webGLShader.includes('uniform vec3 iResolution;')) {
      // Find the first non-comment, non-empty line after precision declarations
      const lines = webGLShader.split('\n');
      let insertIndex = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#') || line.startsWith('precision') || line === '') {
          insertIndex = i + 1;
        } else {
          break;
        }
      }

      lines.splice(insertIndex, 0, uniforms);
      webGLShader = lines.join('\n');
    }

    // Ensure mainImage is called from main if not already done
    if (!webGLShader.includes('void main()')) {
      webGLShader += `

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}`;
    }

    return webGLShader;
  }

  private lastTime: number = 0;

  // Main Loop
  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    // Update cloud animation with Shadertoy-compatible uniforms
    if (this.shaderMaterial) {
      const now = performance.now();
      const deltaTime = (now - this.lastTime) * 0.001; // Convert to seconds
      this.lastTime = now;

      this.shaderMaterial.uniforms.iTime.value = now * 0.001;
      this.shaderMaterial.uniforms.iTimeDelta.value = deltaTime;
      this.shaderMaterial.uniforms.iFrame.value++;
      this.shaderMaterial.uniforms.iFrameRate.value = 60.0;

      // Update mouse position (normalized 0-1)
      this.shaderMaterial.uniforms.iMouse.value.set(
        (this.input.mouse.x + 1) * 0.5 * window.innerWidth,
        (1 - (this.input.mouse.y + 1) * 0.5) * window.innerHeight
      );

      // Update date (simplified)
      const date = new Date();
      this.shaderMaterial.uniforms.iDate.value.set(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()
      );

      // Update channel times (for video textures, if any)
      if (this.shaderMaterial.uniforms.iChannelTime) {
        this.shaderMaterial.uniforms.iChannelTime.value[0] = now * 0.001;
        this.shaderMaterial.uniforms.iChannelTime.value[1] = now * 0.001;
        this.shaderMaterial.uniforms.iChannelTime.value[2] = now * 0.001;
        this.shaderMaterial.uniforms.iChannelTime.value[3] = now * 0.001;
      }

      // Update channel resolutions (default values)
      if (this.shaderMaterial.uniforms.iChannelResolution) {
        const res = new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0);
        this.shaderMaterial.uniforms.iChannelResolution.value[0].copy(res);
        this.shaderMaterial.uniforms.iChannelResolution.value[1].copy(res);
        this.shaderMaterial.uniforms.iChannelResolution.value[2].copy(res);
        this.shaderMaterial.uniforms.iChannelResolution.value[3].copy(res);
      }

      // Update sample rate (for audio, if any)
      this.shaderMaterial.uniforms.iSampleRate.value = 44100.0;
    }

    this.handleInput();
    this.renderer.render(this.scene, this.camera);
  };

  private handleInput(): void {
    // Movement disabled as requested.
    // We can use this hook for other per-frame input logic if needed.

  }

  private handleVerseNavigation(keyCode: string): void {
    if (!this.currentVerse || this.currentVerse.verses.length === 0) return;

    const currentVerse = this.currentVerse.verses[0];
    let newBook = currentVerse.book;
    let newChapter = currentVerse.chapter;
    let newVerse = currentVerse.verse;

    switch (keyCode) {
      case 'ArrowRight':
      case 'ArrowDown':
        newVerse++;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        newVerse--;
        break;
    }

    // Hide current verse with exit transition, then load new verse
    this.hideVerseText();
    this.currentVerse = null;

    // Load new verse after exit transition completes (0.8s)
    setTimeout(() => {
      this.loadVerse(newBook, newChapter, newVerse);
    }, this.theme.config.transitions.animDuration);
  }

  private async processBibleReference(): Promise<void> {
    const reference = this.bibleService.parseReference(this.textInput);
    if (reference) {
      await this.loadVerse(reference.book, reference.chapter, reference.verse);
    }

    // Hide input text immediately (CSS transitions will handle animation)
    this.hideInputText();
    this.textInput = '';
    if (this.inputTextElement) {
      this.inputTextElement.value = '';
    }
  }

  private async loadVerse(book: string, chapter: number, verse: number): Promise<void> {

    const verseData = await this.bibleService.getVerse(book, chapter, verse);

    if (verseData) {
      this.currentVerse = verseData;
      return await this.showVerseText();
    }
    return await this.hideVerseText();
  }

  private async showInputText(): Promise<void> {
    if (!this.inputContainer || !this.inputTextElement || !this.theme.inputTemplate) return;

    // const displayText = ''; // No text in SVG, native input handles text

    // Replace template variables in SVG (remove text)
    let svgContent = this.theme.inputTemplate
      .replace(/\{\{text\}\}/g, '');

    // Convert SVG to data URL for background image
    const svgDataUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`;

    // Apply SVG as background image
    this.inputContainer.style.backgroundImage = `url("${svgDataUrl}")`;
    this.inputContainer.style.backgroundSize = 'contain';
    this.inputContainer.style.backgroundRepeat = 'no-repeat';
    this.inputContainer.style.backgroundPosition = 'center';

    this.inputContainer.style.display = 'block';
    this.inputTextElement.focus();
    this.hideVerseText();

    // Apply theme enter transition
    return await this.applyTransition(this.inputContainer, this.theme.config.input.enterClass, this.theme.config.input.enterActiveClass, true);
  }



  /**
   * Applies CSS transition animation to an element
   * @param element The HTML element to animate
   * @param initialClass The initial CSS class to apply
   * @param activeClass The active CSS class to add after initial class
   * @param isShow Whether this is a show transition (true) or hide transition (false)
   * @returns Promise that resolves when the transition completes
   */
  private applyTransition(element: HTMLElement | null, initialClass?: string, activeClass?: string, isShow: boolean = true): Promise<void> {
    return new Promise((resolve) => {
      if (!element || !initialClass) {
        // Fallback if no transition classes defined
        if (!isShow && element) {
          element.style.display = 'none';
        }
        resolve(); // Resolve immediately
        return;
      }

      // Apply initial class
      element.className = initialClass;

      // Add active class on next frame for smooth transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (activeClass && element) {
            element.classList.add(activeClass);
          }
        });
      });

      // Resolve after transition completes
      setTimeout(() => {
        // For hide transitions, hide element after animation completes
        if (!isShow && element) {
          element.style.display = 'none';
        }
        resolve();
      }, this.theme.config.transitions.animDuration);
    });
  }

  private async showVerseText(): Promise<void> {
    if (!this.currentVerse || !this.verseContainer || !this.verseTextElement || !this.theme.verseTemplate) return;

    const reference = this.currentVerse.reference;
    const text = this.currentVerse.text;

    // Replace template variables in SVG (remove text for background)
    let svgContent = this.theme.verseTemplate
      .replace(/\{\{reference\}\}/g, '')
      .replace(/\{\{text\}\}/g, '');

    // Convert SVG to data URL for background image
    const svgDataUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`;

    // Apply SVG as background image to container
    this.verseContainer.style.backgroundImage = `url("${svgDataUrl}")`;
    this.verseContainer.style.backgroundSize = 'contain';
    this.verseContainer.style.backgroundRepeat = 'no-repeat';
    this.verseContainer.style.backgroundPosition = 'center';

    // Set text content in HTML element
    this.verseTextElement.innerHTML = `<div class="reference">${reference}</div><div class="cite" >${text}</div>`;

    // Show both elements
    this.verseContainer.style.display = 'block';
    this.verseTextElement.style.display = 'block';

    // Apply theme enter transition to container
    const p = await this.applyTransition(this.verseContainer, this.theme.config.verse.enterClass, this.theme.config.verse.enterActiveClass, true);

    // Position both elements
    const position = this.theme.config.verse.position;
    const size = this.theme.config.verse.size;

    this.verseContainer.style.left = position.x;
    this.verseContainer.style.top = position.y;
    this.verseContainer.style.width = size.width;
    this.verseContainer.style.height = size.height;

    this.verseTextElement.style.left = position.x;
    this.verseTextElement.style.top = position.y;
    this.verseTextElement.style.width = size.width;
    this.verseTextElement.style.height = size.height;
    return p;
  }

  private async hideInputText(): Promise<void> {
    // Apply theme exit transition
    return await this.applyTransition(this.inputContainer, this.theme.config.input.exitClass, this.theme.config.input.exitActiveClass, false);
  }


  private async hideVerseText(): Promise<void> {
    this.currentVerse = null;
    // Apply theme exit transition to container
    const ret = await this.applyTransition(this.verseContainer, this.theme.config.verse.exitClass, this.theme.config.verse.exitActiveClass, false);

    // Also hide the text element immediately (no transition needed for text)
    if (this.verseTextElement) {
      this.verseTextElement.style.display = 'none';
    }
    return ret;
  }

  public dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.renderer.dispose();
  }
}
