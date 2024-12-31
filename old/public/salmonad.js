window.SalmonadObstacle = class SalmonadObstacle {
    constructor() {
        this.element = document.getElementById('salmonad-container');
        this.salmonad = document.getElementById('salmonad');
        this.isActive = false;
        this.horizontalPosition = window.innerWidth; // Start off-screen on the right
        this.verticalPosition = -300; // Start slightly lower vertically
        this.targetHorizontalPosition = window.innerWidth - 500; // Stop 200px from the right edge
        this.targetVerticalPosition = 0; // Vertical position to stop at
        this.moveInDuration = 2000; // Time to move in (ms)
        this.stayDuration = 3000; // Time to stay visible (ms)
        this.moveOutDuration = 1500; // Time to move out (ms)
        this.laserContainer = document.getElementById('laser-container');
        this.lasers = [];
        this.lastShotTime = 0;
        this.shootInterval = 2000; // Shoot every 2 seconds
    }

    activate() {
        if (this.isActive) return;
        this.isActive = true;
        this.horizontalPosition = window.innerWidth; // Reset position to right edge
        this.element.style.display = 'block';
        this.element.style.left = `${this.horizontalPosition}px`; // Use left instead of right

        // Move in
        this.moveIn();
    }

    moveIn() {
        const startTime = Date.now();
        const startPosition = this.horizontalPosition;
        const animate = () => {
            const elapsedTime = Date.now() - startTime;
            const progress = Math.min(elapsedTime / this.moveInDuration, 1);
            this.horizontalPosition = startPosition + (this.targetHorizontalPosition - startPosition) * progress;
            this.element.style.left = `${this.horizontalPosition}px`; // Use left instead of right

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Stay for a while, then move out
                setTimeout(() => this.moveOut(), this.stayDuration);
            }
        };
        animate();
    }

    moveOut() {
        const startTime = Date.now();
        const startPosition = this.horizontalPosition;
        const animate = () => {
            const elapsedTime = Date.now() - startTime;
            const progress = Math.min(elapsedTime / this.moveOutDuration, 1);
            this.horizontalPosition = startPosition + (window.innerWidth - startPosition) * progress;
            this.element.style.left = `${this.horizontalPosition}px`; // Use left instead of right

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.deactivate();
            }
        };
        animate();
    }

    deactivate() {
        this.isActive = false;
        this.element.style.display = 'none';
        this.horizontalPosition = window.innerWidth;
        this.element.style.left = `${this.horizontalPosition}px`; // Use left instead of right
        this.lasers.forEach(laser => this.laserContainer.removeChild(laser));
        this.lasers = [];
    }

    shootLaser() {
        const currentTime = Date.now();
        if (currentTime - this.lastShotTime < this.shootInterval) return;

        this.lastShotTime = currentTime;

        const laser = document.createElementNS("http://www.w3.org/2000/svg", "line");
        laser.setAttribute("x1", this.horizontalPosition + "px");
        laser.setAttribute("y1", (this.verticalPosition + 150) + "px"); // Adjust based on Salmonad's height
        laser.setAttribute("x2", "0");
        laser.setAttribute("y2", (this.verticalPosition + 150) + "px");
        laser.setAttribute("stroke", "red");
        laser.setAttribute("stroke-width", "2");

        this.laserContainer.appendChild(laser);
        this.lasers.push(laser);
    }

    update(deltaTime) {
        if (this.isActive) {
            this.shootLaser();
            this.updateLasers(deltaTime);
        }
    }

    updateLasers(deltaTime) {
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const laser = this.lasers[i];
            const x2 = parseFloat(laser.getAttribute("x2")) - 500 * deltaTime; // Adjust speed as needed
            laser.setAttribute("x2", x2 + "px");

            if (x2 < 0) {
                this.laserContainer.removeChild(laser);
                this.lasers.splice(i, 1);
            }
        }
    }

    checkLaserCollision(playerX, playerY, playerWidth, playerHeight) {
        for (const laser of this.lasers) {
            const laserX1 = parseFloat(laser.getAttribute("x1"));
            const laserX2 = parseFloat(laser.getAttribute("x2"));
            const laserY = parseFloat(laser.getAttribute("y1"));

            // Check if the laser intersects with the player
            if (laserY >= playerY && laserY <= playerY + playerHeight) {
                if ((laserX1 >= playerX && laserX1 <= playerX + playerWidth) ||
                    (laserX2 >= playerX && laserX2 <= playerX + playerWidth) ||
                    (laserX1 <= playerX && laserX2 >= playerX + playerWidth)) {
                    return true; // Collision detected
                }
            }
        }
        return false; // No collision
    }
};

window.spawnSalmonadObstacle = function (salmonadObstacle) {
    if (Math.random() < 0.005 && !salmonadObstacle.isActive) {
        salmonadObstacle.activate();
    }
};