importScripts('libs/three.min.js');
importScripts('raytracingRenderer.js');
importScripts('scenecontroller.js');

let sceneController = new SceneController(null, self);
sceneController.renderer.isWorker = true;

self.addEventListener('message', function(e) {
	switch(e.data.command) {
		case 'close':
			self.close();
			break;
		case 'raytrace':
			sceneController.renderer.sizeOverwrite = e.data.size;
			sceneController.renderer.superSamplingRate = e.data.superSamplingRate,
			sceneController.renderer.maxRecursionDepth = e.data.maxRecursionDepth,
			sceneController.renderer.phongMagnitude = e.data.phongMagnitude,
			sceneController.renderer.allLights= e.data.allLights,
			sceneController.renderer.calcDiffuse = e.data.calcDiffuse,
			sceneController.renderer.calcPhong = e.data.calcPhong,
			sceneController.renderer.useMirrors = e.data.useMirrors,
			sceneController.renderer.workerIndex = e.data.workerIndex;
			sceneController.renderer.workerCount = e.data.workerCount;
			sceneController.renderer.sectionSize = e.data.sectionSize;
			sceneController.renderer.raytrace();
			break;
		default:
			console.log('Worker: unknown command ' + e.data.command);
			break;
	}
}, false);