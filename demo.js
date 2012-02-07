window.onload = (function(){
  setDragAndDropEvent();
})();

function setDragAndDropEvent() {
  var droparea = document;

  droparea.addEventListener('drop', function(e) {
    var file = e.dataTransfer.files[0];
    var reader = new FileReader();
    var i;

    reader.onload = function () {
      var data = new Uint8Array(reader.result),
          png,
          identify,
          result = document.getElementById('result');

      // empty
      while (result.hasChildNodes()) { result.removeChild(result.firstChild);  }

      // parse
      if (!PngIdentify.isPNG(data)) {
        result.textContent = 'File "' + file.fileName + '" is not PNG file.';
        return;
      }
      png = new PNG(data);
      identify = new PngIdentify(png);

      identify.appendToElement(result, undefined, undefined, {Filename: file.fileName});
    };

    reader.readAsArrayBuffer(file);

    e.preventDefault();
  }, false);

  droparea.addEventListener('dragover', function(e) {
    e.preventDefault();
  }, false);
}

