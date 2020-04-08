import { vec3, mat4, vec4 } from 'gl-matrix';
import isMobile from 'is-mobile';

const origin = vec3.fromValues(0, 0, 0);
const forward = vec3.fromValues(0, 0, 1);
const up = vec3.fromValues(0, 1, 0);
const rotateLeft = mat4.fromYRotation(mat4.create(), -0.5 * Math.PI);
const rotateRight = mat4.fromYRotation(mat4.create(), 0.5 * Math.PI);

export default class PlayerControls {
    constructor(speed = 0.015, mouseSensitivity = 0.0015, touchSensitivity = 0.15) {
        // TODO: cleanup event listeners
        this.speed = speed;
        this.mouseSensitivity = mouseSensitivity;
        this.touchSensitivity = touchSensitivity;
        this.position = vec3.fromValues(0, 0, -5);
        this.direction = vec3.fromValues(0, 0, 1);
        this.hasPointerLock = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.touchX = 0;
        this.touchY = 0;
        this.directionKeys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
        };
        this.isTouching = false;

        this.onPointerLock = () => {};

        this.handleKeyboardEvent = keyboardEvent => {
            const { code, type } = keyboardEvent;
            const value = type === 'keydown';
            if (code === 'KeyW' || code === 'ArrowUp') this.directionKeys.forward = value;
            if (code === 'KeyS' || code === 'ArrowDown') this.directionKeys.backward = value;
            if (code === 'KeyA' || code === 'ArrowLeft') this.directionKeys.left = value;
            if (code === 'KeyD' || code === 'ArrowRight') this.directionKeys.right = value;
        };

        this.onTouchEvent = touchEvent => {
            const lastTouch = touchEvent.touches[touchEvent.touches.length - 1];
            this.touchX = lastTouch.clientX;
            this.touchY = lastTouch.clientY;
        };

        document.addEventListener('keydown', this.handleKeyboardEvent);
        document.addEventListener('keyup', this.handleKeyboardEvent);

        document.addEventListener('mousedown', () => {
            if (isMobile()) return;
            document.querySelector('body').requestPointerLock();
            const transformedDir = vec4.transformMat4([], vec4.fromValues(...forward, 0), this.directionMatrix);
            console.log(
                'position', this.position,
                'direction', this.direction,
                'directionMatrix', this.directionMatrix,
                'pos + dir', vec3.add([], this.position, this.direction),
                'transformed Direction', transformedDir
            );
        });

        document.addEventListener('pointerlockchange', () => {
            this.hasPointerLock = !!document.pointerLockElement;
            this.onPointerLock(this.hasPointerLock);
        }, false);

        document.addEventListener('mousemove', e => {
            if (!this.hasPointerLock) return;
            this.mouseX += e.movementX;
            this.mouseY += e.movementY;
        });

        document.addEventListener('touchstart', e => {
            this.directionKeys.forward = true;
            this.isTouching = true;
            this.onTouchEvent(e);
            this.onPointerLock(true);
        });

        document.addEventListener('touchmove', this.onTouchEvent);

        const onTouchOver = () => {
            this.directionKeys.forward = false;
            this.isTouching = false;
        }

        document.addEventListener('touchend', onTouchOver);
        document.addEventListener('touchcancel', onTouchOver);
        document.addEventListener('mouseup', onTouchOver);

        requestAnimationFrame(() => this.loop());
    }
    
    loop() {
        if (this.isTouching) {
            this.mouseX += (this.touchX - window.innerWidth / 2) * this.touchSensitivity;
            this.mouseY += (this.touchY - window.innerHeight / 2) * this.touchSensitivity;
        }

        const newDirection = vec3.clone(forward);
        vec3.rotateX(newDirection, newDirection, origin, -this.mouseY * this.mouseSensitivity);
        vec3.rotateY(newDirection, newDirection, origin, this.mouseX * this.mouseSensitivity);
        vec3.copy(this.direction, newDirection);
    
		const deltaPosition = vec3.clone(newDirection);
        vec3.scale(deltaPosition, deltaPosition, this.speed);
    
        // strafing with keys
        const diff = vec3.create();
        if (this.directionKeys.forward) vec3.add(diff, diff, deltaPosition);
        if (this.directionKeys.backward) vec3.add(diff, diff, vec3.negate(vec3.create(), deltaPosition));
        if (this.directionKeys.left) vec3.add(diff, diff, vec3.transformMat4(vec3.create(), deltaPosition, rotateLeft));
        if (this.directionKeys.right) vec3.add(diff, diff, vec3.transformMat4(vec3.create(), deltaPosition, rotateRight));
    
        vec3.add(this.position, this.position, diff);
    
        requestAnimationFrame(() => this.loop());
    }

    get directionMatrix() {
        return mat4.targetTo(
            mat4.create(),
            this.position,
            vec3.sub([], this.position, this.direction),
            up
        );
    }
}
