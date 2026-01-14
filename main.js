
        let scene, camera, renderer, bomb, wires = [];
        let timeLeft = 180; // 3 minutes
        let wiresCut = 0;
        let gameOver = false;
        const COLORS = ['red', 'blue', 'green', 'yellow'];
        let wireOrder = [];
        let nextWireIndex = 0;
        
        const wireColors = {
            red: 0xff0000,
            blue: 0x0088ff,
            green: 0x00ff00,
            yellow: 0xffff00
        };

        function shuffleArray(arr) {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }

        // choose a random order for the wire-cutting sequence
        wireOrder = shuffleArray(COLORS.slice());

        init();
        animate();

        function init() {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0xffffff);
            scene.fog = new THREE.Fog(0xffffff, 10, 20);

            camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000);
            camera.position.set(0, 1.5, 3);
            camera.lookAt(0, 0, 0);

            renderer = new THREE.WebGLRenderer({ antialias: false });
            renderer.setSize(800, 600);
            document.getElementById('gameContainer').appendChild(renderer.domElement);

            // Lighting for rendering
            const ambient = new THREE.AmbientLight(0xffffff, 0.6);
            scene.add(ambient);
            
            const light1 = new THREE.PointLight(0xffffff, 0.8, 10);
            light1.position.set(2, 3, 2);
            scene.add(light1);
            
            const light2 = new THREE.PointLight(0xffffff, 0.5, 10);
            light2.position.set(-2, 2, 2);
            scene.add(light2);

            // the bomb body
            const bombGeo = new THREE.BoxGeometry(2, 1, 1);
            const bombMat = new THREE.MeshPhongMaterial({ 
                color: 0x888888,
                flatShading: true 
            });
            bomb = new THREE.Mesh(bombGeo, bombMat);
            scene.add(bomb);

            // the timer display on bomb
            const displayGeo = new THREE.BoxGeometry(0.8, 0.3, 0.05);
            const displayMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
            const display = new THREE.Mesh(displayGeo, displayMat);
            display.position.set(0, 0.2, 0.53);
            bomb.add(display);

            // the wires attached to the front face of the bomb
            const wirePositions = [
                { x: -0.6, color: 'red' },
                { x: -0.2, color: 'blue' },
                { x: 0.2, color: 'green' },
                { x: 0.6, color: 'yellow' }
            ];

            wirePositions.forEach((pos, i) => {
                // Wire cylinder - vertical, attached to bomb front
                const wireGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
                const wireMat = new THREE.MeshStandardMaterial({ 
                    color: wireColors[pos.color],
                    emissive: wireColors[pos.color],
                    emissiveIntensity: 0.7,
                    metalness: 0.3,
                    roughness: 0.5
                });
                const wire = new THREE.Mesh(wireGeo, wireMat);
                // Position on the front face of the bomb (z = 0.5 is the front face)
                wire.position.set(pos.x, 0, 0.5);
                wire.userData = { color: pos.color, cut: false, index: i };
                bomb.add(wire); // Attached to bomb so they rotate with it
                wires.push(wire);
                
                // Top connector - where wire connects to bomb
                const connectorGeo = new THREE.SphereGeometry(0.08, 8, 8);
                const connectorMat = new THREE.MeshStandardMaterial({ 
                    color: 0x222222,
                    metalness: 0.8,
                    roughness: 0.2
                });
                const connector1 = new THREE.Mesh(connectorGeo, connectorMat);
                connector1.position.set(pos.x, 0.4, 0.5);
                bomb.add(connector1);
                
                // Bottom connector
                const connector2 = new THREE.Mesh(connectorGeo, connectorMat);
                connector2.position.set(pos.x, -0.4, 0.5);
                bomb.add(connector2);
            });

            // Floor
            const floorGeo = new THREE.PlaneGeometry(20, 20);
            const floorMat = new THREE.MeshPhongMaterial({ 
                color: 0xcccccc,
                flatShading: true 
            });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.y = -0.5;
            scene.add(floor);

            // Mouse/Touch controls
            let mouseX = 0;
            let isDragging = false;
            let lastTouchX = 0;
            let lastMouseX = 0;
            let dragSpeed = 6; // higher = stronger drag effect

            // Desktop mouse drag controls (click-and-hold to drag)
            renderer.domElement.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return; // only react to left button
                isDragging = true;
                lastMouseX = e.clientX;
                e.preventDefault();
            });

            window.addEventListener('mouseup', (e) => {
                if (e.button !== 0) return;
                isDragging = false;
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const delta = (e.clientX - lastMouseX) / window.innerWidth;
                bomb.rotation.y += delta * dragSpeed;
                lastMouseX = e.clientX;
                e.preventDefault();
            });

            // Mobile touch controls
            const container = document.getElementById('gameContainer');
            container.addEventListener('touchstart', (e) => {
                isDragging = true;
                lastTouchX = e.touches[0].clientX;
                e.preventDefault();
            });

            container.addEventListener('touchmove', (e) => {
                if (isDragging && e.touches.length > 0) {
                    const touchX = e.touches[0].clientX;
                    const delta = (touchX - lastTouchX) / container.clientWidth;
                    bomb.rotation.y += delta * dragSpeed;
                    lastTouchX = touchX;
                    e.preventDefault();
                }
            });

            container.addEventListener('touchend', (e) => {
                isDragging = false;
                e.preventDefault();
            });

            // Click/Tap to cut wire
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();

            function handleInteraction(clientX, clientY) {
                if (gameOver) return;

                const rect = renderer.domElement.getBoundingClientRect();
                mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(wires);

                if (intersects.length > 0) {
                    const wire = intersects[0].object;
                    if (!wire.userData.cut) {
                        cutWire(wire);
                    }
                }
            }

            renderer.domElement.addEventListener('click', (e) => {
                handleInteraction(e.clientX, e.clientY);
            });

            renderer.domElement.addEventListener('touchend', (e) => {
                if (e.changedTouches.length > 0) {
                    const touch = e.changedTouches[0];
                    handleInteraction(touch.clientX, touch.clientY);
                }
            });

            window.addEventListener('resize', onWindowResize);
            
            // Initial resize to set correct dimensions
            onWindowResize();

            // Start timer
            // Update on-screen instructions to match randomized wire order
            ['wire1', 'wire2', 'wire3', 'wire4'].forEach((id, i) => {
                const el = document.getElementById(id);
                if (el && wireOrder[i]) el.textContent = `${i + 1}. ${wireOrder[i].toUpperCase()}`;
            });

            setInterval(updateTimer, 1000);
        }

        function cutWire(wire) {
            const correctWire = wireOrder[nextWireIndex];
            
            if (wire.userData.color === correctWire) {
                // Correct wire
                wire.userData.cut = true;
                wire.material.emissiveIntensity = 0;
                wire.material.color.setHex(0x333333);
                wire.material.emissive.setHex(0x000000);
                wire.position.y -= 0.5;
                
                wiresCut++;
                nextWireIndex++;
                document.getElementById('wiresCut').textContent = wiresCut;

                if (wiresCut === 4) {
                    winGame();
                }
            } else {
                // Wrong wire - game over
                loseGame('WRONG WIRE!');
            }
        }

        function updateTimer() {
            if (gameOver) return;
            
            timeLeft--;
            const mins = Math.floor(timeLeft / 60);
            const secs = timeLeft % 60;
            document.getElementById('timer').textContent = 
                `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

            if (timeLeft <= 0) {
                loseGame('TIME\'S UP!');
            }
        }

        function winGame() {
            gameOver = true;
            const msg = document.getElementById('message');
            msg.textContent = 'BOMB DEFUSED!\nMISSION SUCCESS';
            msg.className = 'success';
            msg.style.display = 'block';
            scene.background = new THREE.Color(0xccffcc);
        }

        function loseGame(reason) {
            gameOver = true;
            const msg = document.getElementById('message');
            msg.textContent = reason + '\n💥 BOOM! 💥';
            msg.className = 'failure';
            msg.style.display = 'block';
            
            // Explosion effect
            wires.forEach(w => {
                w.material.emissive.setHex(0xff0000);
                w.material.emissiveIntensity = 1;
            });
            scene.background = new THREE.Color(0xffcccc);
        }

        function animate() {
            requestAnimationFrame(animate);

            if (!gameOver) {
                // Bomb rotation is now user-controlled via drag; no auto-rotation here.
                // Pulsing effect on active wire
                if (nextWireIndex < wires.length) {
                    const activeWire = wires.find(w => w.userData.color === wireOrder[nextWireIndex]);
                    if (activeWire) {
                        activeWire.material.emissiveIntensity = 0.3 + Math.sin(Date.now() * 0.005) * 0.2;
                    }
                }
            }

            renderer.render(scene, camera);
        }

        function onWindowResize() {
            const container = document.getElementById('gameContainer');
            const rect = container.getBoundingClientRect();
            const aspect = rect.width / rect.height;
            
            camera.aspect = aspect;
            camera.updateProjectionMatrix();
            
            // Maintain 800x600 internal resolution, scale to fit container
            renderer.setSize(rect.width, rect.height);
        }