// Lake Reflection - Shadertoy compatible
// Realistic water surface with reflections and caustics

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
    for(int i = 0; i < 5; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value;
}

// Water wave function
float waterWave(vec2 p, float time) {
    float wave1 = sin(p.x * 0.01 + time * 2.0) * cos(p.y * 0.008 + time * 1.5);
    float wave2 = sin(p.x * 0.005 + time * 1.0) * sin(p.y * 0.012 + time * 2.5);
    float wave3 = sin(p.x * 0.02 + time * 3.0) * cos(p.y * 0.015 + time * 1.8);
    return (wave1 + wave2 + wave3) * 0.3;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = fragCoord;

    // Create sky gradient (dawn/dusk colors for lake reflection)
    vec3 skyTop = vec3(0.3, 0.5, 0.8);    // Blue sky
    vec3 skyBottom = vec3(0.8, 0.6, 0.4); // Warm horizon
    vec3 skyColor = mix(skyBottom, skyTop, pow(uv.y, 0.8));

    // Add some clouds
    vec2 cloudUV = uv * 4.0 + iTime * 0.02;
    float clouds = fbm(cloudUV);
    clouds += fbm(cloudUV * 2.0 + iTime * 0.01) * 0.3;
    clouds += fbm(cloudUV * 4.0 + iTime * 0.005) * 0.1;

    // Mix clouds with sky
    float cloudOpacity = smoothstep(0.4, 0.8, clouds);
    skyColor = mix(skyColor, vec3(1.0, 1.0, 0.95), cloudOpacity * 0.6);

    // Water surface (reflection point)
    float waterLevel = 0.4;
    bool isWater = uv.y < waterLevel;

    if (isWater) {
        // Water reflection
        vec2 reflectionUV = vec2(uv.x, waterLevel + (waterLevel - uv.y));

        // Add water distortion
        float distortion = waterWave(p, iTime) * 0.02;
        reflectionUV.x += distortion;
        reflectionUV.y += distortion * 0.5;

        // Sample reflected sky
        vec3 reflectedColor = skyColor;

        // Add cloud reflection with distortion
        vec2 cloudReflectionUV = reflectionUV * 4.0 + iTime * 0.02 + vec2(distortion * 10.0, 0.0);
        float reflectedClouds = fbm(cloudReflectionUV);
        reflectedClouds += fbm(cloudReflectionUV * 2.0 + iTime * 0.01) * 0.3;
        float reflectedCloudOpacity = smoothstep(0.4, 0.8, reflectedClouds);
        reflectedColor = mix(reflectedColor, vec3(1.0, 1.0, 0.95), reflectedCloudOpacity * 0.8);

        // Add water color and transparency
        vec3 waterColor = vec3(0.1, 0.3, 0.5); // Deep blue water
        float depth = (waterLevel - uv.y) * 2.0;
        vec3 finalWaterColor = mix(reflectedColor, waterColor, depth * 0.7);

        // Add some caustics/light patterns
        vec2 causticUV = uv * 8.0 + iTime * 0.1 + vec2(distortion * 5.0, 0.0);
        float caustics = fbm(causticUV) * fbm(causticUV * 1.5 + iTime * 0.05);
        finalWaterColor += vec3(0.2, 0.3, 0.4) * caustics * 0.3 * (1.0 - depth);

        fragColor = vec4(finalWaterColor, 1.0);
    } else {
        // Sky above water
        fragColor = vec4(skyColor, 1.0);
    }

    // Add subtle vignette
    float vignette = 1.0 - length(uv - 0.5) * 0.3;
    fragColor.rgb *= vignette;
}
