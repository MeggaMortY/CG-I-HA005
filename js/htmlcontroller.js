var HtmlController = function(sceneController)
{
  this.sceneController = sceneController;
}

HtmlController.prototype.setup = function()
{
  //bind? --> https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind
	window.addEventListener( 'resize', this.onWindowResize.bind(this), false );

  document.addEventListener("keydown", this.onDocumentKeyDown.bind(this), false);
  document.addEventListener("mousedown", this.onDocumentMouseDown.bind(this), false);
  document.addEventListener("mousemove", this.onDocumentMouseMove.bind(this), false);
  document.addEventListener("mouseup", this.onDocumentMouseUp.bind(this), false);
}

//event handler that is called when the window is resized
HtmlController.prototype.onWindowResize = function()
{
  this.sceneController.renderer.setSize( window.innerWidth, window.innerHeight);
}

HtmlController.prototype.onDocumentMouseDown = function(event)
{
    //event.button 0 - 4 gives right, middle, left, side button
    // window.console.log("mouse down at " + event.x + " / " + event.y + " with button " + event.button);
}

HtmlController.prototype.onDocumentMouseMove = function(event)
{
    // window.console.log("mouse move");
}

HtmlController.prototype.onDocumentMouseUp = function(event)
{
    //event.button 0 - 4 gives right, middle, left, side button
      // window.console.log("mouse up at " + event.x + " / " + event.y + " with button " + event.button);
}


HtmlController.prototype.onDocumentKeyDown = function(event) {
    //as alternative to event.key one can use event.which that returns the ASCII codes, e.g., r = 82
    var keyCode = event.key;

    // window.console.log("key input (ASCII): " + event.which + ". key input (KEY): " + keyCode);

    switch(keyCode)
    {
      case "f": // r
        this.sceneController.render();
        break;
    }
};
