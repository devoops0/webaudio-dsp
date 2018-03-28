var selectedSound, ampslid, pbRateSlid, soundId, graphType = "sinewave", playing = "unplayed", shaping = "clipping";
var foo;
var ren;
var soundFiles = [
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
    // so audio flows: input -> gainNode -> shaper -> analyser -> context.destination(computer boxes)
	gainNode.connect(shaper);
    shaper.connect(analyser);
	analyser.connect(context.destination);

    // diverse optical and functional setup
	$('#checkboxes label').click(setShaping);

	$('#soundList .dropdown-item').click(selectSound);

    $('#graphChooser .dropdown-item').click(setGraphType);

    ampslid = $('#ampslider').bootstrapSlider({
        reversed: true
    });
    ampslid.on('slide', updateAmpVal);

    pbRateSlid = $('#pbRateSlider').bootstrapSlider({});
    pbRateSlid.on('slide', updatePbRate);

    // document.getElementById('samplerate').placeholder = context.sampleRate;
    document.getElementById('default-samplerate').innerHTML = context.sampleRate + ' Hz';

    // adaptive canvas-size for graph
    var canvasMinHeight = 250;
    var canvasMinWidth = 600;
    var canvasWidth = $('canvas').parent().width();
    var canvasHeight = $('canvas').parent().height();
    canvasWidth >= canvasMinWidth ? $('#wave').attr('width',canvasWidth) : $('#wave').attr('width', canvasMinWidth);
    canvasHeight >= canvasMinHeight ? $('#wave').attr('height',canvasHeight) : $('#wave').attr('height', canvasMinHeight);
}

function setGraphType() {
    graphType = $(this).text();
    console.log(graphType);
    $('#btn-graphSelect').text(graphType);
    visualize();
}

function visualize() {
	// canvas
	var canvas = document.getElementById('wave');
	var canvasCtx = canvas.getContext('2d');

	var WIDTH = canvas.width;
	var HEIGHT = canvas.height;
	
    if(graphType == "sinewave") {
        // analyser config
        analyser.fftSize = 2048;
        var bufferLength = analyser.frequencyBinCount;
        var dataArray = new Float32Array(bufferLength);

        canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

        function draw() {
            drawVisual = requestAnimationFrame(draw);       // keep drawing forever

            // analyser.getByteTimeDomainData(dataArray);
            analyser.getFloatTimeDomainData(dataArray);
            
            canvasCtx.beginPath();
            
            // graph-canvas-background
            // canvasCtx.fillStyle = '#D2D5D3';
            canvasCtx.fillStyle = '#FFF';
            canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

            // graph itself
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = '#DF0134';

            canvasCtx.beginPath();

            var sliceWidth = WIDTH * 1.0 / bufferLength;
            var x = 0;

            for(var i = 0; i < bufferLength; i++) {

                var v = dataArray[i];// / 128.0;
				if(v > 1) {
					var y = HEIGHT/2;
				} else {
					var y = (1 - v) * HEIGHT/2;
				}

                if(i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }

				x += sliceWidth;
                // console.log('x: ' + x + 'y: ' + y);
            }

            canvasCtx.lineTo(canvas.width, canvas.height/2);
            canvasCtx.stroke();
        };

        draw();
    } else if(graphType == "frequencybars") {
        analyser.fftSiez = 256;
        var bufferLengthAlt = analyser.frequencyBinCount;
        console.log(bufferLengthAlt);
        var dataArrayAlt = new Uint8Array(bufferLengthAlt);

        canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

        var drawAlt = function() {
            drawVisual = requestAnimationFrame(drawAlt);

            analyser.getByteFrequencyData(dataArrayAlt);

            canvasCtx.fillStyle = '#FFFFFF';
            canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

            var barWidth = (WIDTH / bufferLengthAlt) * 2.5;
            var barHeight;
            var x = 0;

            for (var i = 0; i < bufferLengthAlt; i++) {
                barHeight = dataArrayAlt[i];

                // canvasCtx.fillstyle = 'rgb(' + (barHeight+100) + ',50,50)';
                canvasCtx.fillStyle = '#DF0134';
                canvasCtx.fillRect(x, HEIGHT-barHeight, barWidth, barHeight);

                x+= barWidth + 1;
            }
        };
        drawAlt();
    }
}

function setShaping() {
	if($(this)[0].textContent.includes("Clipping")) {
		shaping = "clipping";
	} else if($(this)[0].textContent.includes("Wrapping")) {
		shaping = "wrapping";
	}
}

// Whenever the user clicks a dropdown-option, the corresponding sound
// is loaded into selectedSound
// selectedSound as Source is then connected to the first Node (gainNode) of our 'AudioGraph'
function selectSound() {
    soundId = $(this).text();
    selectedSound = createInstance(soundId);
	selectedSound.connect(gainNode);
    $('#btn-soundSelect').text(soundId);
}

// When the sound is finished, reload it so it can be played again.
// Otherwise, the user would have to select the sound from the dropdown again
function reloadSound() {
    selectedSound = createInstance(soundId);
	selectedSound.connect(gainNode);
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

// Whenever the user changes the Amplifier-slider, the gain-Value is increased,
// so the sound is effectively amplified
function updateAmpVal() {
    var ampVal = ampslid.val();
	gainNode.gain.setValueAtTime(ampVal, context.currentTime);
    $('#amp-value').text(ampVal);
}

// Whenever the user changes the PlaybackRate-slider, the playbackRate is being adjusted.
// Effectively we're increasing and decreasing the frequency of the sound playing.
function updatePbRate() {
    if ( selectedSound ) {
    var pbRate = pbRateSlid.val();
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
        selectedSound.start(0);
        setPauseIcon();
        playing = "playing";
    } else if (playing === "playing") {
        context.suspend().then(function() {
            setPlayIcon();
            playing = "paused"
        });
    } else if (playing === "paused") {
        context.resume().then(function() {
            setPauseIcon();
            playing = "playing"
        });
    }
}

function stopSound() {
    if (!selectedSound) {
        alert('You need to select a sound first!');
        return
    }
    selectedSound.stop();
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
        console.log(renderedBuffer.getChannelData(0));
        selectedSound.buffer = renderedBuffer;
    });
}
