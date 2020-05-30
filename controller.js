import PlayerControls from './player-controls';
import * as dat from 'dat.gui';

class Controller {
    constructor() {
        Object.assign(this, {
            power: 12,
            dr: 1,
            r: 0,
            hitThreshold: 0.0005,
            maxIterations: 100,
            mandelbulbIterations: 10,
        });
        this.playerControls = new PlayerControls();

        this.createGUI();
    }

    createGUI = () => {
        const gui = new dat.GUI();
        gui.add(this, 'power', 1, 20);
        gui.add(this, 'hitThreshold', 0.00001, 0.005);
        gui.add(this, 'maxIterations', 30, 300);
        gui.add(this, 'mandelbulbIterations', 1, 20);
    }

    get state() {
        return {
            power: this.power,
            dr: this.dr,
            r: this.r,
            hitThreshold: this.hitThreshold,
            maxIterations: this.maxIterations,
            mandelbulbIterations: this.mandelbulbIterations,
            cameraPosition: [...this.playerControls.position],
            cameraDirection: this.playerControls.directionMatrix,
        }
    }
}

export default Controller;