
/*
 * This is main.js which is referenced directly from within
 * a <script> node in index.html
 */

// "use strict" means that some strange JavaScript things are forbidden
"use strict";

/*********************************/
/**********    SETUP    **********/
/*********************************/

function main() {

  var sceneController = new SceneController(document);

  var htmlController = new HtmlController(sceneController);
  htmlController.setup();
}
