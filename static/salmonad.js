class SalmonadObstacle {
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
    }

    update(deltaTime) {
        // This method is no longer needed for movement,
        // but we'll keep it in case we want to add other updates later
    }
}

function spawnSalmonadObstacle(salmonadObstacle) {
    if (Math.random() < 0.005 && !salmonadObstacle.isActive) { // Reduced spawn chance
        salmonadObstacle.activate();
    }
}

// Export the class and function
export { SalmonadObstacle, spawnSalmonadObstacle };