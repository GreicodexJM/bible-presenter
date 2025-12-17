import * as THREE from 'three';

// Theme configuration
interface ThemeConfig {
  name: string;
  background: {
    type: 'shader' | 'solid' | 'gradient' | 'texture';
    vertexShader?: string;
    fragmentShader?: string;
    uniforms?: { [key: string]: { type: string; value: any } };
    textures?: string[];
    animationClass?: string;
    skyColorTop?: string;
    skyColorBottom?: string;
    cloudColor?: string;
    animationSpeed?: number;
    gradientColors?: string[];
    textureUrl?: string;
    opacity?: number;
  };
  input: {
    template: string;
    position: { x: string; y: string };
    size: { width: string; height: string };
    enterClass?: string;
    enterActiveClass?: string;
    exitClass?: string;
    exitActiveClass?: string;
  };
  verse: {
    template: string;
    position: { x: string; y: string };
    size: { width: string; height: string };
    enterClass?: string;
    enterActiveClass?: string;
    exitClass?: string;
    exitActiveClass?: string;
  };
  transitions: {
    fadeDuration: number;
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  };
}

// Runtime theme object
interface Theme {
  config: ThemeConfig;
  backgroundShaders?: {
    vertex: string;
    fragment: string;
  };
  loadedTextures?: THREE.Texture[];
  inputTemplate?: string;
  verseTemplate?: string;
  styles?: string;
}

// Bible API interfaces
interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

interface BibleAPIResponse {
  reference: string;
  verses: BibleVerse[];
  text: string;
  translation_id: string;
  translation_name: string;
  translation_note: string;
}

// Input state
interface InputState {
  mouse: {
    x: number;
    y: number;
    buttons: boolean[];
  };
  keyboard: {
    [key: string]: boolean;
  };
}

// Bible service
class BibleService {
  private translationData: any = null;

  loadTranslation(data: any): void {
    this.translationData = data;
  }

  async getVerse(book: string, chapter: number, verse: number): Promise<BibleAPIResponse | null> {
    // Try local data first
    try {
      if (this.translationData) {
        // Check for array-based structure (new format)
        if (Array.isArray(this.translationData.books)) {
          const bookData = this.translationData.books.find((b: any) => b.name.toUpperCase().includes(book.toUpperCase()) );
          if (bookData) {
            const chapterData = bookData.chapters.find((c: any) => c.chapter === chapter);
            if (chapterData) {
              const verseData = chapterData.verses.find((v: any) => v.verse === verse);
              if (verseData) {
                return {
                  reference: `${book.toUpperCase()} ${chapter}:${verse}`,
                  verses: [{
                    book: book.toUpperCase(),
                    chapter: chapter,
                    verse: verse,
                    text: verseData.text
                  }],
                  text: verseData.text,
                  translation_id: this.translationData.metadata?.abbreviation || 'KJV',
                  translation_name: this.translationData.metadata?.name || this.translationData.translation || 'King James Version',
                  translation_note: this.translationData.metadata?.description || ''
                };
              }
            }
          }
        } 
        // Fallback to object-based structure (old format)
        else {
          const bookData = this.translationData.books[book.toUpperCase()];
          if (bookData && bookData.chapters[chapter] && bookData.chapters[chapter][verse]) {
            return {
              reference: `${book.toUpperCase()} ${chapter}:${verse}`,
              verses: [{
                book: book.toUpperCase(),
                chapter: chapter,
                verse: verse,
                text: bookData.chapters[chapter][verse]
              }],
              text: bookData.chapters[chapter][verse],
              translation_id: this.translationData.metadata?.abbreviation,
              translation_name: this.translationData.metadata?.name,
              translation_note: this.translationData.metadata?.description
            };
          }
        }
      }
    } catch (error) {
      console.error('Bible API error:', error);
    }
    return null;
  }

  parseReference(input: string): { book: string; chapter: number; verse: number } | null {
    // Match patterns like "GEN 1:1", "gen 1:1", "Genesis 1:1", etc.
    const match = input.trim().match(/^([A-Za-z\s]+)\s*(\d+)?:?(\d+)?$/);
    if (!match) return null;

    const [, book, chapter, verse] = match;
    return {
      book: book.trim(),
      chapter: parseInt(chapter??1),
      verse: parseInt(verse??1)
    };
  }
}

// Game state
class Game3D {
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
        fetch(`/themes/${config.activeTheme}/templates/${themeConfig.input.template}`).then(r => r.text()),
        fetch(`/themes/${config.activeTheme}/templates/${themeConfig.verse.template}`).then(r => r.text()),
        fetch(`/themes/${config.activeTheme}/styles/animations.css`).then(r => r.text())
      ]);

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
                resolve(new THREE.Texture());
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
          template: 'input.svg',
          position: { x: '50%', y: '40%' },
          size: { width: '600px', height: '80px' }
        },
        verse: {
          template: 'verse.svg',
          position: { x: '50%', y: '60%' },
          size: { width: '800px', height: '200px' }
        },
        transitions: {
          fadeDuration: 500,
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

    // Create verse text element
    this.verseTextElement = document.createElement('div');
    this.verseTextElement.id = 'bible-verse';

    // Add elements to overlay
    this.textOverlay.appendChild(this.inputContainer);
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
    }, 8000);
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
      this.showVerseText();
    } else {
      this.hideVerseText();
    }
  }

  private showInputText(): void {
    if (!this.inputContainer || !this.inputTextElement || !this.theme.inputTemplate) return;

    const displayText = ''; // No text in SVG, native input handles text

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

    // Apply theme enter class for transitions
    if (this.theme.config.input.enterClass) {
      this.inputContainer.className = this.theme.config.input.enterClass;
      // Trigger transition to active state on next frame
      requestAnimationFrame(() => {
        if (this.theme.config.input.enterActiveClass && this.inputContainer) {
          this.inputContainer.className = this.theme.config.input.enterActiveClass;
        }
      });
    }

    this.inputContainer.style.display = 'block';
    this.inputTextElement.focus();
    this.hideVerseText();
  }

  private escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '<';
        case '>': return '>';
        case '&': return '&';
        case "'": return '&#39;';
        case '"': return '"';
        default: return c;
      }
    });
  }

  private showVerseText(): void {
    if (!this.currentVerse || !this.verseTextElement || !this.theme.verseTemplate) return;

    const reference = this.currentVerse.reference;
    const text = this.currentVerse.text;

    // Replace template variables in SVG
    let svgContent = this.theme.verseTemplate
      .replace(/\{\{reference\}\}/g, this.escapeXml(reference))
      .replace(/\{\{text\}\}/g, this.escapeXml(text));

    // Convert SVG to data URL for background image
    const svgDataUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`;

    // Clear text content since we're using SVG background
    this.verseTextElement.textContent = '';
    
    this.verseTextElement.innerHTML = svgContent;
    this.verseTextElement.style.backgroundImage = ''; // Clear BG if using innerHTML

    // Apply theme enter class for transitions
    if (this.theme.config.verse.enterClass) {
      this.verseTextElement.className = this.theme.config.verse.enterClass;
      // Trigger transition to active state on next frame
      requestAnimationFrame(() => {
        if (this.theme.config.verse.enterActiveClass) {
          this.verseTextElement!.className = this.theme.config.verse.enterActiveClass;
        }
      });
    }

    // Position the element
    this.verseTextElement.style.left = this.theme.config.verse.position.x;
    this.verseTextElement.style.top = this.theme.config.verse.position.y;
    this.verseTextElement.style.width = this.theme.config.verse.size.width;
    this.verseTextElement.style.height = this.theme.config.verse.size.height;

    // Show immediately (CSS transitions will handle animation)
    this.verseTextElement.style.display = 'block';
  }

  private hideInputText(): void {
    if (this.inputContainer && this.theme.config.input.exitClass) {
      // Apply exit transition class
      this.inputContainer.className = this.theme.config.input.exitClass;

      // Trigger transition to exit-active state on next frame
      requestAnimationFrame(() => {
        if (this.theme.config.input.exitActiveClass && this.inputContainer) {
          this.inputContainer.className = this.theme.config.input.exitActiveClass;

          // Hide element after transition completes (0.6s for exit transition)
          setTimeout(() => {
            if (this.inputContainer) {
              this.inputContainer.style.display = 'none';
            }
          }, 6000);
        }
      });
    } else if (this.inputContainer) {
      // Fallback if no transition classes defined
      this.inputContainer.style.display = 'none';
    }
  }


  private hideVerseText(): void {
    this.currentVerse = null;
    if (this.verseTextElement && this.theme.config.verse.exitClass) {
      // Apply exit transition class
      this.verseTextElement.className = this.theme.config.verse.exitClass;

      // Trigger transition to exit-active state on next frame
      requestAnimationFrame(() => {
        if (this.theme.config.verse.exitActiveClass) {
          this.verseTextElement!.className = this.theme.config.verse.exitActiveClass;

          // Hide element after transition completes (0.8s for verse exit transition)
          setTimeout(() => {
            if (this.verseTextElement) {
              this.verseTextElement.style.display = 'none';
            }
          }, 8000);
        }
      });
    } else if (this.verseTextElement) {
      // Fallback if no transition classes defined
      this.verseTextElement.style.display = 'none';
    }
  }

  public dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.renderer.dispose();
  }
}

// Initialize the game
const game = new Game3D();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  game.dispose();
});
