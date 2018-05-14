function BufferLoader(context, audioPath, fileList) {
  this.context = context;
  this.audioPath = audioPath;
  this.fileList = fileList;
  this.bufferList = new Array();
  this.loadCount = 0;
}

BufferLoader.prototype.loadBuffer = function(file, index) {
    // Load buffer asynchronously
    var request = new XMLHttpRequest();
	var url = this.audioPath + file;
    request.open("GET", url, true);
    request.responseType = "arraybuffer";

    var loader = this;

    // yep, I'm extracting the filename from the request-url
    // to strip off the filetype to create the soundID
    filename = url.substring(url.lastIndexOf('/')+1, url.length);
    id = filename.substring(0,filename.lastIndexOf('.'))
    var sound = {'id' : id, 'buffer': null};

    addToDropdown(id);

    request.onload = function() {
        // Asynchronously decode the audio file data in request.response
        loader.context.decodeAudioData(
            request.response,
            function(buffer) {
                if (!buffer) {
                  alert('error decoding file data: ' + url);
                  return;
                }
                sound.buffer = buffer;
                loader.bufferList[index] = sound;
                if (++loader.loadCount == loader.fileList.length)
                // loader.onload(loader.bufferList);
				function nop(){};
            },
            function(error) {
                console.error('decodeAudioData error', error);
            }
        );
    }

    request.onerror = function() {
        alert('BufferLoader: XHR error');
    }

    request.send();
}

BufferLoader.prototype.load = function() {
    for (var i = 0; i < this.fileList.length; ++i)
        this.loadBuffer(this.fileList[i], i);

    return this.bufferList;
}

// add each loaded sounds ID to the dropdown to let the user choose on
function addToDropdown(id) {
	soundList = document.getElementById('soundList');
    var child = document.createElement("p");
    child.classList.add('dropdown-item');
    child.innerHTML = id;
    soundList.appendChild(child);
}
