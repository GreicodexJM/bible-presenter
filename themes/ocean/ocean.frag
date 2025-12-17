// Ocean Primitive - Shadertoy compatible
// Inspired by https://www.shadertoy.com/view/mlBGDw

#define MAX_STEPS 100
#define MAX_DIST 100.0
#define SURF_DIST 0.01

// Noise functions
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), 
                   hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), 
                   hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

// Ocean height map
float map(vec3 p) {
    float h = 0.0;
    vec2 pos = p.xz * 0.5;
    
    // Add multiple waves
    float t = iTime * 0.5;
    h += sin(pos.x * 1.0 + t) * 0.5;
    h += sin(pos.y * 0.8 + t * 1.1) * 0.5;
    h += sin((pos.x + pos.y) * 0.5 + t * 0.8) * 0.3;
    
    // Detail
    h += fbm(pos * 2.0 + t * 0.2) * 0.2;
    
    return p.y - h * 0.5;
}

// Ray marching
float rayMarch(vec3 ro, vec3 rd) {
    float dO = 0.0;
    for(int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * dO;
        float dS = map(p);
        dO += dS * 0.5; // Lower step size for better accuracy on waves
        if(dO > MAX_DIST || abs(dS) < SURF_DIST) break;
    }
    return dO;
}

// Normal calculation
vec3 getNormal(vec3 p) {
    float d = map(p);
    vec2 e = vec2(0.01, 0.0);
    vec3 n = d - vec3(
        map(p - e.xyy),
        map(p - e.yxy),
        map(p - e.yyx)
    );
    return normalize(n);
}

// Sky color
vec3 getSky(vec3 rd) {
    vec3 col = vec3(0.3, 0.5, 0.8);
    col = mix(col, vec3(0.8, 0.9, 1.0), pow(1.0 - max(rd.y, 0.0), 4.0));
    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Camera setup
    vec3 ro = vec3(0.0, 5.0, -5.0 + iTime * 0.5); // Moving camera
    vec3 lookAt = ro + vec3(0.0, -0.5, 1.0);
    vec3 f = normalize(lookAt - ro);
    vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f));
    vec3 u = cross(f, r);
    vec3 rd = normalize(uv.x * r + uv.y * u + f);
    
    // Render
    float d = rayMarch(ro, rd);
    vec3 col = vec3(0.0);
    
    if(d < MAX_DIST) {
        vec3 p = ro + rd * d;
        vec3 n = getNormal(p);
        vec3 r = reflect(rd, n);
        
        // Water color
        vec3 waterCol = vec3(0.0, 0.1, 0.2);
        vec3 skyCol = getSky(r);
        
        // Fresnel
        float fresnel = pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
        fresnel = clamp(fresnel, 0.2, 1.0);
        
        // Lighting
        vec3 lightDir = normalize(vec3(0.5, 0.8, 0.5));
        float diff = max(dot(n, lightDir), 0.0);
        float spec = pow(max(dot(r, lightDir), 0.0), 32.0);
        
        col = mix(waterCol * (0.2 + diff * 0.8), skyCol, fresnel);
        col += vec3(1.0) * spec * 0.5;
        
        // Fog
        col = mix(col, getSky(rd), 1.0 - exp(-d * 0.05));
    } else {
        col = getSky(rd);
    }
    
    // Gamma correction
    col = pow(col, vec3(0.4545));
    
    fragColor = vec4(col, 1.0);
}
