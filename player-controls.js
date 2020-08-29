import { vec3, mat4, quat } from 'gl-matrix';
import getCurrentDistance from './get-speed';

const forward = vec3.fromValues(0, 0, 1);
const backward = vec3.fromValues(0, 0, -1);
const left = vec3.fromValues(-1, 0, 0);
const right = vec3.fromValues(1, 0, 0);

const minSpeed = 0.0005;

function getTouchEventCoordinates(touchEvent) {
    const lastTouch = touchEvent.touches[touchEvent.touches.length - 1];
    return {
        x: lastTouch.clientX,
        y: lastTouch.clientY,
    }
}

export default class PlayerControls {
    constructor(speed = 0.0022, mouseSensitivity = 0.15, touchSensitivity = 0.012) {
        // TODO: cleanup event listeners
        this.speed = speed;
        this.mouseSensitivity = mouseSensitivity;
        this.touchSensitivity = touchSensitivity;
        this.position = vec3.fromValues(0, 0, -9);
        this.direction = quat.create();
        this.isPanning = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.touchX = 0;
        this.touchY = 0;
        this.touchStartX = window.innerWidth / 2;
        this.touchStartY = window.innerHeight / 2;
        this.directionKeys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
        };
        this.sprintMode = false;
        this.isTouching = false;

        this.onPointerLock = () => {};

        this.handleKeyboardEvent = keyboardEvent => {
            const { code, type, shiftKey } = keyboardEvent;
            const value = type === 'keydown';
            if (code === 'KeyW' || code === 'ArrowUp') this.directionKeys.forward = value;
            if (code === 'KeyS' || code === 'ArrowDown') this.directionKeys.backward = value;
            if (code === 'KeyA' || code === 'ArrowLeft') this.directionKeys.left = value;
            if (code === 'KeyD' || code === 'ArrowRight') this.directionKeys.right = value;
            this.sprintMode = shiftKey;
        };

        document.addEventListener('keydown', this.handleKeyboardEvent);
        document.addEventListener('keyup', this.handleKeyboardEvent);

        document.addEventListener('mousedown', (e) => {
            if (e.target.tagName !== 'CANVAS') {
                return;
            }
            this.isPanning = true;
            const requestPointerLock = () => {
                if (e.target.tagName !== 'CANVAS') {
                    return;
                }
                document.querySelector('body').requestPointerLock();
            }
            document.addEventListener('mouseup', requestPointerLock);
            setTimeout(() => document.removeEventListener('mouseup', requestPointerLock), 300);
        });

        document.addEventListener('mouseup', (e) => {
            this.isPanning = false;
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPanning = !!document.pointerLockElement;
            this.onPointerLock(this.isPanning);
        }, false);

        document.addEventListener('mousemove', e => {
            if (!this.isPanning) return;
            this.hasMovedSinceMousedown = true;
            this.mouseX += e.movementX * this.mouseSensitivity;
            this.mouseY += e.movementY * this.mouseSensitivity;
        });

        document.addEventListener('touchstart', e => {
            this.directionKeys.forward = true;
            this.isTouching = true;
            const { x, y } = getTouchEventCoordinates(e);
            this.touchX = x;
            this.touchY = y;
            this.touchStartX = x;
            this.touchStartY = y;
            this.onPointerLock(true);
        });

        document.addEventListener('touchmove', e => {
            const { x, y } = getTouchEventCoordinates(e);
            this.touchX = x;
            this.touchY = y;
        });

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
            this.mouseX += (this.touchX - this.touchStartX) * this.touchSensitivity;
            this.mouseY += (this.touchY - this.touchStartY) * this.touchSensitivity;
        }
        this.mouseY = Math.min(this.mouseY, 90);
        this.mouseY = Math.max(this.mouseY, -90);

        quat.fromEuler(
            this.direction,
            this.mouseY,
            this.mouseX,
            0
        );
    
        // strafing with keys
        const diff = vec3.create();
        if (this.directionKeys.forward) vec3.add(diff, diff, forward);
        if (this.directionKeys.backward) vec3.add(diff, diff, backward);
        if (this.directionKeys.left) vec3.add(diff, diff, left);
        if (this.directionKeys.right) vec3.add(diff, diff, right);
        vec3.normalize(diff, diff);

        const currentDistance = getCurrentDistance(this.position);
        let speedLimit = this.speed * Math.max(currentDistance, minSpeed) ** 0.5;
        if (this.sprintMode) speedLimit = speedLimit ** 0.8;
        vec3.scale(diff, diff, speedLimit);
        vec3.transformQuat(diff, diff, this.direction);
        vec3.add(this.position, this.position, diff);
    
        requestAnimationFrame(() => this.loop());
    }

    get directionMatrix() {
        return mat4.fromQuat(mat4.create(), this.direction);
    }
}
