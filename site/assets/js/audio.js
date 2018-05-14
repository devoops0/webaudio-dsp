var selectedSound, ampslid, pbRateSlid, pbRate, soundId, drawVisual, graphType = "sinewave", playing = "unplayed", shaping = "clipping", uploaded = false;
var context;
var ren;
var soundFiles = [
            'bach.wav',
            'balls.mp3',
            'brandt.wav',
            'cheering.mp3',
            'europahymne.wav',
            'maus.wav',
            'offer.mp3',
            'siren.mp3',
            'sine.mp3',
            'sweep.wav',
        ];
var sounds = new Array();
var gainNode;
var draw;

var audioPath = "assets/audio/";

function init() {
    // setup audio context
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    context = new AudioContext();
    
    // preload all sounds
    bufferLoader = new BufferLoader(
        context,
		audioPath,
        soundFiles,
    );
    sounds = bufferLoader.load();

    // create all the AudioNodes we need
	gainNode = context.createGain();                        // Amplifier
	analyser = context.createAnalyser();					// read the Data for visualization
    shaper = context.createScriptProcessor(4096, 1, 1);		// Shape the audio-wave before output in two possible ways: clipping or wrapping
    
	// Gain config
	gainNode.gain.value = 1;
    
    shaper.onaudioprocess = (evt) => {
		if(shaping == "clipping") {
			// Chrome and Firefox do not actually clip the sounds. 
			// In most cases, they compress samples, that would otherwhise be clipped.
			// Actually, this simple clipping is what we want, so we need to do it ourself.
			// This is doing nothing else than grabbing the samples, checking
			// if their values are out of bound ( [ -1, 1 ] ) and if so
			// to clip the sample's value to the maximum (1) or the minimum (-1).
			for (let ch = 0; ch < evt.outputBuffer.numberOfChannels; ch++) {
				let inputData = evt.inputBuffer.getChannelData(ch);
				let outputData = evt.outputBuffer.getChannelData(ch);
				for (let sample = 0; sample < inputData.length; sample++) {
					outputData[sample] = Math.min(1, Math.max(-1, inputData[sample]));
				}
			}
		} else if(shaping == "wrapping") {
			// If the sample-value is out of bounds we take the fractional part and add/substract it to/from the min-/max-value
			for (let ch = 0; ch < evt.outputBuffer.numberOfChannels; ch++) {
				let inputData = evt.inputBuffer.getChannelData(ch);
				let outputData = evt.outputBuffer.getChannelData(ch);
				for (let sample = 0; sample < inputData.length; sample++) {
					if(inputData[sample] >= 1) {
						outputData[sample] = -1 + inputData[sample] % 1;
					} else if(inputData[sample] <= -1) {
						outputData[sample] = 1 + inputData[sample] % -1;
					} else {
						outputData[sample] = inputData[sample];
					}
				}
			}
		}
	}

	// connect nodes together and then connect them to destination
    // so audio flows: input -> gainNode -> shaper -> filter -> analyser -> context.destination(computer boxes)
	gainNode.connect(shaper);
	shaper.connect(analyser);

    // diverse optical and functional setup
	$('#soundList .dropdown-item').click(selectSound);

	$('.shapingChooser label').click(setShaping);

	$('.filterChooser label').click(listenerFilterChooser);

    $('#graphChooser .dropdown-item').click(setGraphType);
    
    // init amplification slider and set on-slide function
    ampslid = $('#ampslider').slider({
        reversed: true
    });
    ampslid.on('slide', updateAmpVal);

    // init playbackRate slider and set on-slide function
    pbRateSlid = $('#pbRateSlider').slider();
    pbRateSlid.on('slide', updatePbRate);

    // show default samplerate in input-field for samplerate
    $('#input-sampleRate').attr("placeholder",context.sampleRate);

    // file upload listener
    $('input[name="fileSoundSel"]').on('change', listenerLoadUploadedBuffer);

    // adaptive canvas-size for graph
    var canvasMinHeight = 250;
    var canvasMinWidth = 600;
    var canvasWidth = $('#wave').width();
    var canvasHeight = $('#wave').height();
    canvasWidth >= canvasMinWidth ? $('#graph').attr('width',canvasWidth) : $('#graph').attr('width', canvasMinWidth);
    canvasHeight >= canvasMinHeight ? $('#graph').attr('height',canvasHeight) : $('#graph').attr('height', canvasMinHeight);
}

function listenerLoadUploadedBuffer() {
    var reader = new FileReader();
    reader.onload = function(e) {
        createInstanceFromUploadedFile(this.result).then(
            function() {
                selectedSound.connect(gainNode);
            }
        );
    };
    reader.readAsArrayBuffer(this.files[0]);
    uploaded = true;
}

function loadUploadedBuffer() {
    var sound;
    var reader = new FileReader();
    reader.onload = function(e) {
        createInstanceFromUploadedFile(this.result).then(
            function() {
                selectedSound.connect(gainNode);
            }
        );
    };
    reader.readAsArrayBuffer($('input[name="fileSoundSel"]')[0].files[0]);
    uploaded = true;
    return sound;
}

function setGraphType() {
    graphType = $(this).text();
    $('#btn-graphSelect').text(graphType);
    if(playing == "playing") {
        cancelAnimationFrame(drawVisual);
        visualize();
    }
}

function visualize() {
	// wave-wrapper
	var wrapper = document.getElementById('wave');
	// var canvasCtx = canvas.getContext('2d');

	var WIDTH = wrapper.width;
	var HEIGHT = wrapper.height;
	
    if(graphType == "sinewave") {
        var canvas, canvasCtx;
		// set up canvas
        if (document.getElementById("graph") == null) {
            canvas = document.createElement("canvas");
            canvas.id = "graph";
            wrapper.appendChild(canvas);
            canvas = document.getElementById("graph");
            canvasCtx = canvas.getContext('2d');
        } else {
            canvas = document.getElementById("graph");
            canvasCtx = canvas.getContext('2d');
        }

        // analyser config
        analyser.fftSize = 2048;
        var bufferLength = analyser.frequencyBinCount;
        var dataArray = new Float32Array(bufferLength);

        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        function draw() {
            drawVisual = requestAnimationFrame(draw);       // keep drawing forever

            // analyser.getByteTimeDomainData(dataArray);
            analyser.getFloatTimeDomainData(dataArray);
            
            canvasCtx.beginPath();
            
            // graph-canvas-background
            // canvasCtx.fillStyle = '#D2D5D3';
            canvasCtx.fillStyle = '#FFF';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

            // graph itself
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = '#DF0134';

            canvasCtx.beginPath();

            var sliceWidth = canvas.width * 1.0 / bufferLength;
            var x = 0;

            for(var i = 0; i < bufferLength; i++) {

                var v = dataArray[i];// / 128.0;
				if(v > 1) {
					var y = canvas.height/2;
				} else {
					var y = (1 - v) * canvas.height/2;
				}

                if(i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }

				x += sliceWidth;
            }

            canvasCtx.lineTo(canvasCtx.width, canvasCtx.height/2);
            canvasCtx.stroke();
        };

        draw();
    } else if(graphType == "frequencybars") {
        
		// set up canvas
        if (document.getElementById("graph") == null) {
            canvas = document.createElement("canvas");
            canvas.id = "graph";
            wrapper.appendChild(canvas);
            canvas = document.getElementById("graph");
            canvasCtx = canvas.getContext('2d');
        } else {
            canvas = document.getElementById("graph");
            canvasCtx = canvas.getContext('2d');
        }

        analyser.fftSize = 2048;
        // analyser.fftSize = 512;
        var bufferLengthAlt = analyser.frequencyBinCount;
        var dataArrayAlt = new Uint8Array(bufferLengthAlt);
		var binRange = (selectedSound.buffer.sampleRate / 2) / analyser.frequencyBinCount;
		dataPoints =  new Array(bufferLengthAlt);
        var labels = new Array(bufferLengthAlt);

        var chart = new Chart(canvasCtx, {
            type: 'bar',

            data: {
                labels: labels,
                // labels: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000, 19000, 20000],
                datasets: [{
                    label: "Frequency Data",
                    backgroundColor: '#DF0134',
                    borderColor: '#DF0134',
                    data: dataPoints,
                }]
            },

            options: {
                color: '#DF0134',
                events: ['click'],
                scales: {
                    xAxes: [{
                        id: 'Hz',
                        ticks: {
                            maxTicksLimit: 20,
                            callback: function(value, index, values) {
                                return Number(value).toFixed(0);
                            }
                        }
                    }]
                },
            }
        });

		var drawBars = function() {
			drawVisual = requestAnimationFrame(drawBars);
			analyser.getByteFrequencyData(dataArrayAlt);

            for (var i = 0; i < analyser.frequencyBinCount; i++) {
                labels[i] = i*binRange;
             }

			for (var i = 0; i < dataArrayAlt.length; i++) {
                chart.data.datasets[0].data[i] = dataArrayAlt[i];
			}

            chart.update();
		}
		drawBars();
        dataPoints = [];
    }
}

function setShaping() {
	if($(this)[0].textContent.includes("Clipping")) {
		shaping = "clipping";
	} else if($(this)[0].textContent.includes("Wrapping")) {
		shaping = "wrapping";
	}
}

function listenerFilterChooser() {
	switch($(this)[0].textContent) {
		case "lowPass": setFilter(lowPass); break;
		case "highPass": setFilter(highPass); break;
		case "lowShelf": setFilter(lowShelf); break;
		case "highShelf": setFilter(highShelf); break;
		default: console.log("something wrong with filter....");
	}
}

function setFilter(type) {
	shaper.disconnect();
	filter = createBiquadFilter();
	switch(type) {
		case "lowPass": 
	shaper.connect(filter);
	filter.connect(analyser);
}

// Whenever the user clicks a dropdown-option, the corresponding sound
// is loaded into selectedSound
// selectedSound as Source is then connected to the first Node (gainNode) of our 'AudioGraph'
function selectSound() {
    soundId = $(this).text();
    selectedSound = createInstance(soundId);
	selectedSound.connect(gainNode);
    $('#btn-soundSelect').text(soundId);
    resetSliders();
    uploaded = false;
}

// Reset sliders to their initial value
function resetSliders() {
    // amplification slider
    ampslid.slider('setValue', 1);
    $('#amp-value').text("1");

    // playback rate slider
    pbRateSlid.slider('setValue', 1);
    $('#pbRate').text("1");

    updateAmpVal();
    updatePbRate();
}

// When the sound is finished, reload it so it can be played again.
// Otherwise, the user would have to select the sound from the dropdown again
function reloadSound() {
    analyser.disconnect();
    cancelAnimationFrame(drawVisual);
    console.log("playback end");
    if(uploaded == false) {
        selectedSound = null;
        selectedSound = createInstance(soundId);
        selectedSound.connect(gainNode);
    } else {
        loadUploadedBuffer();
    }
	playing = "unplayed";
    $('#btn-playPause i:first-child').replaceWith(
        '<i class="fas fa-play"></i>');
}

// Since we're loading the dropdown-menu with the IDs of the sounds we loaded at the beginning,
// we can simply find and pull the sound from the sounds-array by using it's ID
function createInstance(soundId) {
    var sound = context.createBufferSource();
    var buffer = sounds.find(sound => sound.id === soundId).buffer;
    sound.buffer = buffer;
	sound.onended = reloadSound;
    return sound;
}

function createInstanceFromUploadedFile(buf) {
    // context.decodeAudioData(buf, function(buf) {
    //     sound.buffer = buf;
    //     sound.onended = reloadSound;
    // }, function(e) {
    //     console.log("Error with decoding audio data" + e.err);
    // }
    // );
    
    selectedSound = context.createBufferSource();
    const prom = context.decodeAudioData(buf).then(function(decodedData) {
        selectedSound.buffer = decodedData;
        selectedSound.onended = reloadSound;
    });
	while(prom == undefined);
    return prom;
}

// Whenever the user changes the Amplifier-slider, the gain-Value is increased,
// so the sound is effectively amplified
function updateAmpVal() {
    // var ampVal = ampslid.val();
    var ampVal = ampslid.slider('getValue');
	gainNode.gain.setValueAtTime(ampVal, context.currentTime);
    $('#amp-value').text(ampVal);
}

// Whenever the user changes the PlaybackRate-slider, the playbackRate is being adjusted.
// Effectively we're increasing and decreasing the frequency of the sound playing.
function updatePbRate() {
    if ( selectedSound ) {
    // pbRate = pbRateSlid.val();
    pbRate = pbRateSlid.slider('getValue');
    selectedSound.playbackRate.setValueAtTime(pbRate, context.currentTime)
    $('#pbRate').text(pbRate);
    } else {
        alert('You need to select a sound first!');
    }
}

function playPauseSound() {

    if (!selectedSound) {
        alert('You need to select a sound first!');
        return
    }
    // TODO: This is dirty: Im managing the playState with a global variable
    if (playing === "unplayed") {
        analyser.connect(context.destination);
        selectedSound.start(0);
        setPauseIcon();
        playing = "playing";
        visualize();
    } else if (playing === "playing") {
        context.suspend().then(function() {
            cancelAnimationFrame(drawVisual);
            analyser.disconnect();
            setPlayIcon();
            playing = "paused"
        });
    } else if (playing === "paused") {
        analyser.connect(context.destination);
        context.resume().then(function() {
            setPauseIcon();
            playing = "playing"
            visualize();
        });
    }
}

function stopSound() {
    if (!selectedSound) {
        alert('You need to select a sound first!');
        return
    }
    selectedSound.stop();
    cancelAnimationFrame(drawVisual);
    analyser.disconnect();
    console.log("disconnected");
	reloadSound();
}

function pauseSound() {
    selectedSound.paused === false ? selectedSound.paused = true : selectedSound.paused = false;
}

function setPauseIcon() {
    $('#btn-playPause i:first-child').replaceWith(
        '<i class="fas fa-pause"></i>');
}

function setPlayIcon() {
    $('#btn-playPause i:first-child').replaceWith(
        '<i class="fas fa-play"></i>');
}

function resampleSound() {
    var targetSampleRate = document.getElementById('input-sampleRate').value;
    var channels = selectedSound.buffer.numberOfChannels;
    var samples = selectedSound.buffer.length * targetSampleRate / selectedSound.buffer.sampleRate;

    var offlineContext = new OfflineAudioContext(channels, samples, targetSampleRate);
    var bufferSource = offlineContext.createBufferSource();
    bufferSource.buffer = selectedSound.buffer;
    bufferSource.connect(offlineContext.destination);
    bufferSource.start(0);
    offlineContext.startRendering().then(function(renderedBuffer){
        selectedSound.buffer = renderedBuffer;
    });
}
