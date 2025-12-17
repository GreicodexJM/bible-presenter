// Starfield - Shadertoy compatible
// Inspired by classic starfield effects

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for(int i = 0; i < 4; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

// Star field function
vec3 starField(vec2 uv, float time) {
    vec3 stars = vec3(0.0);

    // Large background stars
    for(int i = 0; i < 50; i++) {
        vec2 pos = vec2(hash(vec2(float(i), 0.0)), hash(vec2(float(i), 1.0)));
        vec2 offset = pos * 2.0 - 1.0;
        float dist = length(uv - offset);

        float size = hash(vec2(float(i), 2.0)) * 0.01 + 0.005;
        float brightness = 1.0 - smoothstep(0.0, size, dist);

        // Twinkle effect
        float twinkle = sin(time * 2.0 + float(i) * 0.1) * 0.5 + 0.5;
        brightness *= twinkle;

        vec3 color = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.9, 0.8), hash(vec2(float(i), 3.0)));
        stars += color * brightness;
    }

    // Smaller foreground stars with parallax
    for(int i = 0; i < 100; i++) {
        vec2 pos = vec2(hash(vec2(float(i + 50), 0.0)), hash(vec2(float(i + 50), 1.0)));
        vec2 offset = (pos * 2.0 - 1.0) + time * 0.01 * (hash(vec2(float(i + 50), 4.0)) - 0.5);
        offset = mod(offset + 1.0, 2.0) - 1.0; // Wrap around
        float dist = length(uv - offset);

        float size = hash(vec2(float(i + 50), 2.0)) * 0.003 + 0.001;
        float brightness = 1.0 - smoothstep(0.0, size, dist);

        // Faster twinkle for smaller stars
        float twinkle = sin(time * 4.0 + float(i) * 0.2) * 0.3 + 0.7;
        brightness *= twinkle;

        vec3 color = vec3(0.9, 0.95, 1.0);
        stars += color * brightness * 0.5;
    }

    return stars;
}

// Nebula background
vec3 nebula(vec2 uv, float time) {
    vec3 nebulaColor = vec3(0.0);

    // Create swirling nebula patterns
    vec2 p = uv * 3.0;
    float n1 = fbm(p + time * 0.1);
    float n2 = fbm(p * 2.0 - time * 0.15);
    float n3 = fbm(p * 4.0 + time * 0.08);

    // Color mixing
    vec3 color1 = vec3(0.2, 0.1, 0.4); // Purple
    vec3 color2 = vec3(0.4, 0.2, 0.1); // Orange
    vec3 color3 = vec3(0.1, 0.3, 0.5); // Blue

    nebulaColor += color1 * n1 * 0.3;
    nebulaColor += color2 * n2 * 0.2;
    nebulaColor += color3 * n3 * 0.1;

    return nebulaColor;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    uv = uv * 2.0 - 1.0; // Center coordinates
    uv.x *= iResolution.x / iResolution.y; // Correct aspect ratio

    // Create nebula background
    vec3 nebulaColor = nebula(uv, iTime);

    // Add star field
    vec3 starColor = starField(uv, iTime);

    // Combine layers
    vec3 finalColor = nebulaColor + starColor;

    // Add some subtle vignette
    float vignette = 1.0 - length(uv) * 0.3;
    finalColor *= vignette;

    // Add a subtle glow
    finalColor += vec3(0.02, 0.03, 0.05);

    fragColor = vec4(finalColor, 1.0);
}
