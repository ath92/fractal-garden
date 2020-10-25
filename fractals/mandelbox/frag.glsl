precision highp float;
uniform vec2 screenSize;
uniform vec2 offset;
uniform vec2 repeat;
uniform float time;
uniform vec3 cameraPosition;
uniform mat4 cameraDirection;
uniform bool onlyDistance;
uniform float scrollX;
uniform float scrollY;

const float hitThreshold = 0.0005;

const int CAMERA_ITERATIONS = 140;
const int LIGHT_ITERATIONS= 60;

const vec3 spaceRepetition = vec3(12);

vec3 getRay(vec2 xy) {
    vec2 normalizedCoords = xy - vec2(0.5) + (offset / repeat);
    vec2 pixel = (normalizedCoords - 0.5 * screenSize) / min(screenSize.x, screenSize.y);

    // normalize to get unit vector
    return (cameraDirection * normalize(vec4(pixel.x, pixel.y, 1, 0))).xyz;
}

vec3 opRepeat(vec3 p, vec3 distance) {
    return mod(p + 0.5 * distance, distance) - 0.5 * distance;
}

// from https://strangerintheq.github.io/sdf.html
float fixed_radius2 = 5.5;
float min_radius2 = 0.5;
float folding_limit = 1.5 + sin(scrollY) * .8;
float scale = 24.;

void sphere_fold(inout vec3 p, inout float dp) {
    float r2 = dot(p, p);
    if(r2 < min_radius2) {
        float temp = (fixed_radius2 / min_radius2);
        p *= temp;
        dp *= temp;
    } else if(r2 < fixed_radius2) {
        float temp = (fixed_radius2 / r2);
        p *= temp;
        dp *= temp;
    }
}

void box_fold(inout vec3 p, inout float dp) {
     p = clamp(p, -folding_limit, folding_limit) * 2.0 - p;
}

float mandelbox(vec3 p) {
     float scale = 4.;
     float dr = 1.;
     vec3 offset = p;
     for (int n = 0; n < 10; ++n) {
         sphere_fold(p, dr);
         box_fold(p, dr);
         p = scale * p + offset;
         dr = dr * abs(scale) + 1.0;
         offset = vec3( 0.1 - sin(scrollY) * cos(scrollY) * 0.1) ;
     }
     float r = length(p);
     return r / abs(dr);
}

float ground(vec3 p, float y) {
    return p.y - y;
}

float doModel(vec3 p) {
    return mandelbox(opRepeat(p, vec3(10., 0., 10.)));
    // return menger(opRepeat(p, vec3(10., 0., 5.)), 3., 1. / 2.));
}

vec3 calcNormal(vec3 p, float h) {
    const vec2 k = vec2(1,-1);
    return normalize( k.xyy*doModel( p + k.xyy*h ) + 
                      k.yyx*doModel( p + k.yyx*h ) + 
                      k.yxy*doModel( p + k.yxy*h ) + 
                      k.xxx*doModel( p + k.xxx*h ) );
}

vec3 light = normalize(vec3(sin(scrollX), 3, cos(scrollX)));
const float mint = 5. * hitThreshold;
const float maxt = 1.;
const float k = 8.;
const float fogNear = 10.;
const float fogFar = 20.;
// this is kinda contrived and does a bunch of stuff I'm not using right now, but I'll leave it like this for now
float trace(vec3 origin, vec3 direction, out vec3 collision, out int iterations, out float fog) {
    vec3 position = origin;
    float distanceTraveled = 0.;
    float d = 0.;
    float h = hitThreshold;
    for(int i = 0; i <= CAMERA_ITERATIONS; i++) {
        iterations = i;
        d = doModel(position);
        h = max(hitThreshold * distanceTraveled, hitThreshold / 20.);
        if (d < h) break;
        position += d * direction;
        distanceTraveled += d;
        if (distanceTraveled > fogFar) break;
    }
    fog = max(0., (distance(position, origin) - fogNear) / (fogFar - fogNear));
    if (iterations == CAMERA_ITERATIONS || distanceTraveled > fogFar) {
        iterations = 0;
        fog = 1.;
        return dot(direction, light);
    }
    collision = position;
    vec3 n = calcNormal(collision, h);
    float t = mint;
    float res = 1.0;
    float pd = 1e1;
    for (int i = 0; i < LIGHT_ITERATIONS; i++) {
        position = collision + light * t;
        d = doModel(position);
        if (d < hitThreshold){
            return 0.;
            // return (t - mint) / (maxt - mint);
        };
        if (t > maxt) {
            res = 1.;
            break;
        }
        float y = d*d/(2.0*pd);
        float h = sqrt(d*d-y*y);
        res = min( res, k*h/max(0.,t-y) );
        pd = d;
        t += d;
    }
    return max(0., res * dot(n, light));
}

float occlusion(int iterations) {
    float occlusionLight = 1. - float(iterations) / float(CAMERA_ITERATIONS);
    return occlusionLight;
}

// const float col = 0.05; // amount of coloring

vec3 hsl2rgb( in vec3 c ) {
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
    return c.z + c.y * (rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
}

vec3 getColor(float it, float d) {
    return hsl2rgb(vec3(
        d,
        0.6,
        pow(it, 0.8)
    ));
}

void main() {
    vec3 direction = getRay(gl_FragCoord.xy);

    int iterations;
    vec3 collision;
    float fog;
    float lightStrength = trace(cameraPosition * 10. + vec3(0, 2, 7.7), direction, collision, iterations, fog);

    float fogColor = dot(direction, light);

    float d = distance(collision, cameraPosition);
    float ol = .25;
    gl_FragColor = vec4(
        vec3((ol * occlusion(iterations) + (1. - ol) * lightStrength) * (1. - fog) + fog * fogColor),
        1.
    );
}