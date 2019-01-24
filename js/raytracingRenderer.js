function dataSetColor(self, x, y, color, alpha=1) {
    let index = x + y * self.width;
    self.data[index * 4] = color.r * 255;
    self.data[index * 4 + 1] = color.g * 255.0;
    self.data[index * 4 + 2] = color.b * 255.0;
    self.data[index * 4 + 3] = alpha * 255;
}

ImageData.prototype.setColor = function(x, y, color, alpha=1) {
    dataSetColor(this, x, y, color, alpha);
}

function dataReadColor(self, x, y, color) {
    let index = x + y * self.width;
    color.r = self.data[index * 4] / 255;
    color.g = self.data[index * 4 + 1] / 255.0;
    color.b = self.data[index * 4 + 2] / 255.0;
    return self.data[index * 4 + 3] / 255.0;
}

ImageData.prototype.readColor = function(x, y, color) {
    return dataReadColor(this, x, y, color);
}

function createImageData(width, height) {
    let data = [];
    for(var i = 0; i < width*height; i += 1) {
        data.push(0);
        data.push(0);
        data.push(0);
        data.push(0);
    }
    let obj = {
        width: width,
        height: height,
        data: data
    };
    Object.defineProperty(obj, 'setColor', {
        value: ImageData.prototype.setColor
    });
    Object.defineProperty(obj, 'readColor', {
        value: ImageData.prototype.readColor
    });
    return obj;
}

/**
 * RaytracingRenderer interpretation of http://github.com/zz85
 */

var RaytracingRenderer =function(scene, camera, workerObject)
{
    this.scene = scene;
    this.camera = camera;

    this.rendering = false;
    this.superSamplingRate = 0;
    this.maxRecursionDepth = 0;

    this.allLights = false;
    this.calcDiffuse = false;
    this.calcPhong = false;
    this.phongMagnitude = 10;
    this.useMirrors = false;

    this.workerObject = workerObject;
    this.isWorker = (workerObject != undefined);

    if (!this.isWorker) {
        this.canvas = document.createElement('canvas');
        window.canvas = this.canvas;
        this.context = this.canvas.getContext('2d', {
            alpha: false
        });

        this.createImageData = this.context.createImageData.bind(this.context);
    } else {
        this.createImageData = createImageData;
    }
    this.workerCount = 15;
    this.sectionWidth = 6;
    this.sectionSize = {x: 64, y: 64};

    this.overwriteSize = true;
    this.sizeOverwrite = {x: 960, y: 720};
    // this.sizeOverwrite = {x: 120, y: 120};

    this.clearColor = new THREE.Color(0x000000);
    this.domElement = this.canvas;
    this.autoClear = true;

    this.raycaster = new THREE.Raycaster();
    this.imageData = null;
    if (typeof Image != 'undefined') {
        this.image = new Image();
        this.image.onload = this.render.bind(this);
    }

    if (!this.isWorker) {
        this.clock = new THREE.Clock();
        this.workers = [];
        this.tmpColor = new THREE.Color(0, 0, 0);

        setInterval(this.updateWorkers.bind(this), 1000)
    }

    this.lights = [];
    for(var c = 0; c < this.scene.children.length; c++)
    {
        if(this.scene.children[c].isPointLight)
            this.lights.push(this.scene.children[c]);
    }
}

RaytracingRenderer.prototype.setClearColor = function ( color, alpha )
{
	clearColor.set( color );
};

RaytracingRenderer.prototype.clear = function () {	};

RaytracingRenderer.prototype.spawnWorker = function () {
    var worker = new Worker('js/worker.js');
    worker.addEventListener('message', this.workerMessageHandler.bind(this), false);
    this.workers.push(worker);
}

RaytracingRenderer.prototype.workerMessageHandler = function (e) {
    switch(e.data.message) {
        case 'raytraceResult':
            let sectionWidth = e.data.data.width;
            let sectionHeight = e.data.data.height;
            for(let y = 0; y < sectionHeight; y += 1) {
                for(let x = 0; x < sectionWidth; x += 1) {
                    dataReadColor(e.data.data,x, y, this.tmpColor);
                    this.imageData.setColor(x, y, this.tmpColor);
                }
            }
            this.context.putImageData(this.imageData, e.data.startX, e.data.startY);
            this.render();
            this.sectionCount.calculated += 1;
            if(this.sectionCount.calculated == this.sectionCount.total) {
                this.rendering = false;
                this.clock.stop();
                console.log("Finished rendering in " + this.clock.elapsedTime + " seconds. Image " + this.canvas.width + " w / " + this.canvas.height + " h");
            }
            break;
    }
}

RaytracingRenderer.prototype.render = function() {
    if(this.imageData != null) {
        let imageAspect = this.canvas.width/this.canvas.height;
        if(imageAspect < window.innerWidth/window.innerHeight) {
            let width = window.innerHeight * imageAspect;
            this.canvas.style.width = width + "px";
            this.canvas.style.height = '100%';
            this.canvas.style.left = (window.innerWidth - width) / 2 + 'px';
            this.canvas.style.top = '0px';
        } else {
            let height = window.innerWidth / imageAspect;
            this.canvas.style.width = '100%';
            this.canvas.style.height = height + "px";
            this.canvas.style.left = '0px';
            this.canvas.style.top = (window.innerHeight - height) / 2 + 'px';
        }
    }
}

RaytracingRenderer.prototype.saveImage = function(){
    this.canvas.toBlob(function(blob) {
        saveAs(blob, "img.png");
    }, "./");
};

RaytracingRenderer.prototype.updateWorkers = function () {
    this.workerCount = Math.max(Math.floor(this.workerCount), 1);
    while(this.workers.length < this.workerCount) {
        this.spawnWorker();
    }
    if(this.workers.length > this.workerCount) {
        for(let i = this.workerCount; i < this.workers.length; i += 1) {
            this.workers[i].postMessage({command: 'close'});
        }
        this.workers.splice(this.workerCount, this.workers.length - this.workerCount);
    }
}

RaytracingRenderer.prototype.raytrace = function () {

    if(!this.rendering) {
        let width;
        let height;
        if(this.isWorker || this.overwriteSize) {
            width = this.sizeOverwrite.x;
            height = this.sizeOverwrite.y;
        } else {
            width = window.innerWidth;
            height = window.innerHeight;
        }
        this.sectionCount = {};
        if(!this.isWorker) {
            this.sectionSize = {x:Math.pow(2,this.sectionWidth)};
            this.sectionSize.y = this.sectionSize.x;
        }
        this.sectionCount.x = Math.ceil(width / this.sectionSize.x);
        this.sectionCount.y = Math.ceil(width / this.sectionSize.y);
        this.sectionCount.total = this.sectionCount.x * this.sectionCount.y;
        this.sectionCount.calculated = 0;
        if(!this.isWorker) {
            this.imageData = this.createImageData(this.sectionSize.x, this.sectionSize.y);
            this.updateWorkers();
            this.clock.start();
            this.rendering = true;
            this.canvas.width = width;
            this.canvas.height = height;
            this.workerProgress = [];
            this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
            for(let i = 0; i < this.workers.length; i += 1) {
                this.workerProgress.push(0);
                let worker = this.workers[i];
                worker.postMessage({
                    command:'raytrace',
                    size: {x: width, y: height},
                    superSamplingRate: this.superSamplingRate,
                    maxRecursionDepth: this.maxRecursionDepth,
                    phongMagnitude: this.phongMagnitude,
                    allLights: this.allLights,
                    calcDiffuse: this.calcDiffuse,
                    calcPhong: this.calcPhong,
                    useMirrors: this.useMirrors,
                    sectionSize: this.sectionSize,
                    workerIndex: i,
                    workerCount: this.workers.length
                });
            }
        }
        else {

            // update scene graph
            if (this.scene.autoUpdate === true) {
                this.scene.updateMatrixWorld();
            }

            // update camera matrices
            if (this.camera.parent === null) {
                this.camera.updateMatrixWorld();
            }

            this.camera.aspect = width/height;
            this.camera.updateProjectionMatrix();

            for(let i = this.workerIndex; i < this.sectionCount.total; i += this.workerCount) {
                let x = (i % this.sectionCount.x) * this.sectionSize.x;
                let y = Math.floor(i / this.sectionCount.x) * this.sectionSize.y;
                // this.fillImageWithNoisyStripes(x,y,this.sectionSize.x, this.sectionSize.y, width, height);
                this.raytraceSection(x,y,this.sectionSize.x, this.sectionSize.y, width, height);
            }

            this.rendering = false;
        }
    }
}


RaytracingRenderer.prototype.fillImageWithNoisyStripes = function(startX, startY, width, height, totalWidth, totalHeight) {
    //fill image with noise
    this.imageData = this.createImageData(width, height);

    for(let y = startY; y < startY + height; y += 1) {
        let c = new THREE.Color(Math.random(),Math.random(),Math.random());
        for(let x = startX; x < startX + width; x += 1) {
            this.imageData.setColor(x - startX, y - startY, c);
        }
    }

    if(!this.isWorker) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.context.putImageData(this.imageData, 0, 0);
        this.image.src = this.canvas.toDataURL();
    } else {
        this.workerObject.postMessage({
            message: 'raytraceResult',
            data: this.imageData,
            startX: startX,
            startY: startY,
        });
    }
};

RaytracingRenderer.prototype.raytraceSection = function (startX, startY, width, height, totalWidth, totalHeight) {
    this.imageData = this.createImageData(width, height);

    let defaultColor = new THREE.Color(0,0,0);
    let screenPos = new THREE.Vector2(0,0);
    let pixelColor = new THREE.Color(0,0,0);

    for(let y = startY; y < startY + height; y += 1) {
        for(let x = startX; x < startX + width; x += 1) {
            pixelColor.setRGB(0.0,0.0,0.0);

            if(this.superSamplingRate < 1)
            {
                let castX = x  / totalWidth * 2 - 1;
                let castY = y / totalHeight * 2 - 1;
                this.renderPixel(pixelColor, screenPos.set(castX, -castY), defaultColor);
            }
            else {
                // Todo: super-sampling
            }
            this.imageData.setColor(x - startX, y - startY, pixelColor);
        }
    }

    if(!this.isWorker) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.context.putImageData(this.imageData, 0, 0);
        this.image.src = this.canvas.toDataURL();
    } else {
        this.workerObject.postMessage({
            message: 'raytraceResult',
            data: this.imageData,
            startX: startX,
            startY: startY,
        });
    }
}

RaytracingRenderer.prototype.renderPixel = function(pixelColor, pixPos, defaultColor) {
    let cameraPos = new THREE.Vector3();
    cameraPos.setFromMatrixPosition(this.camera.matrixWorld);
    var direction = new THREE.Vector3();
    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pixPos, this.camera);
    var intersects = raycaster.intersectObjects( this.scene.children );
    if (intersects.length !== 0) {
        var defaultPixelColor = intersects[0].object.material.color;
        if (this.calcDiffuse === false && this.calcPhong === false) {
            pixelColor.set(intersects[0].object.material.color);
        } else {
            var origin = intersects[0].point;
            var intersectionPoint = intersects[0].point;
            var pointToCameraVector = cameraPos.sub(intersectionPoint).normalize();
            if (intersects[0].object.geometry.type === "SphereGeometry") {
                var sphereCenter = new THREE.Vector3();
                intersects[0].object.getWorldPosition(sphereCenter);
                var intersectionNormalWorld = origin.sub(sphereCenter).normalize();
            } else if (intersects[0].object.geometry.type === "BoxGeometry") {
                var intersectionNormal = intersects[0].face.normal;
                var normalMatrix = new THREE.Matrix3().getNormalMatrix( intersects[0].object.matrixWorld );
                var intersectionNormalWorld = intersectionNormal.clone().applyMatrix3( normalMatrix ).normalize();
            } else {
                console.log("Error, intersecting an object that's neither a sphere nor a box.");
            }
            direction = intersectionNormalWorld.multiplyScalar(intersectionNormalWorld.dot(pointToCameraVector)).multiplyScalar(2.0);
            direction = direction.sub(pointToCameraVector).normalize();
            // Todo: compute çamera position and ray direction
            return this.spawnRay(pixelColor, intersectionNormalWorld, origin, direction, this.maxRecursionDepth, Infinity, defaultColor, defaultPixelColor);
        }
    } else {
        pixelColor.set(defaultColor);
    }

}

RaytracingRenderer.prototype.getIntersection = function(origin, direction, farPlane) {
    // ToDo: return intersected object
    var raycaster = new THREE.Raycaster();
    raycaster.set(origin, direction);
    return raycaster.intersectObjects( this.scene.children );
}

//this method has most of the stuff of this exercise.
//good coding style will ease this exercise significantly.
RaytracingRenderer.prototype.spawnRay = function (pixelColor,intersectionNormal, origin, direction, recursionDepth, farPlane, defaultColor, defaultPixelColor) {
    var lightSource1 = new THREE.Vector3();
    lightSource1.setFromMatrixPosition(this.lights[0].matrixWorld);
    var lightDirection = lightSource1.sub(origin).normalize();

    var lightRaycaster = new THREE.Raycaster();
    lightRaycaster.set(origin, lightDirection);
    var intersectsTowardsLight = lightRaycaster.intersectObjects( this.scene.children );
    if(intersectsTowardsLight.length === 0) {
        //DIFFUSE
        var diffuseIntensity = (((1.0 * (intersectionNormal.dot(lightDirection))) + 1) / 2);
        pixelColor.r = (defaultPixelColor.r * diffuseIntensity);
        pixelColor.g = (defaultPixelColor.g * diffuseIntensity);
        pixelColor.b = (defaultPixelColor.b * diffuseIntensity);

        //PHONG
        var r_s = 0.5 * Math.pow(direction.dot(lightDirection), this.phongMagnitude);
        if ( Math.pow(direction.dot(lightDirection), this.phongMagnitude) > 0 ) {
            var L_spec = r_s * 1.0 * (Math.pow(direction.dot(lightDirection), this.phongMagnitude));
        } else {
            var L_spec = 0;
        }
        pixelColor.r += (1.0 * L_spec);
        pixelColor.g += (1.0 * L_spec);
        pixelColor.b += (1.0 * L_spec);

        // ToDo: compute color, if material is mirror, spawnRay again
        // this.calculateLightColor(pixelColor, origin, intersection, recursionDepth);
        return true;
    } else {
        pixelColor.set(defaultColor);
        return false;
    }
};

RaytracingRenderer.prototype.calculateLightColor = function(pixelColor, origin, intersection, recursionDepth) {

    // ToDo: compute pixel color
    // notes: need normal vector, light direction (e.g. lightDir.setFromMatrixPosition(light.matrixWorld);)
    // if not in the shadow, compute color based on phong model
}

