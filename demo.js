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
          result = document.getElementById('result'),
          option = {};

      // filename
      if (file.fileName) { option['Filename'] = file.filename; } // Chrome
      if (file.name)     { option['Filename'] = file.name;     } // Firefox

      // empty
      while (result.hasChildNodes()) { result.removeChild(result.firstChild);  }

      // parse
      if (!PngIdentify.isPNG(data)) {
        result.textContent = 'File "' + option['Filename'] + '" is not PNG file.';
        return;
      }
      identify = new PngIdentify(data);
      identify.appendToElement(result, undefined, undefined, option);
    };

    reader.readAsArrayBuffer(file);

    e.preventDefault();
  }, false);

  droparea.addEventListener('dragover', function(e) {
    e.preventDefault();
  }, false);
}

