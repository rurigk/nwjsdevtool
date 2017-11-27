var fs = require('fs');
var path = require('path');
var os = require('os');
var packageManager = require('./modules/packagemanager.js');
var Convert = require('ansi-to-html');

var convert = new Convert({
	fg: '#FFF',
	bg: 'transparent',
	newline: true,
	escapeXML: false,
	stream: true
});

var ui = {};
var cache = {};
var workdir = '';
var manifest = {};

window.addEventListener('load', () => {
	loadElements();
	showNwjsVersions();
});

function loadElements(){
	ui.minimize = document.querySelector('.window-control-minimize');
	ui.close = document.querySelector('.window-control-close');

	ui.minimize.addEventListener('click', () => {
		nw.Window.get().minimize();
	})
	ui.close.addEventListener('click', () => {
		nw.Window.get().close();
	})

	ui.versionSelector = document.getElementById('window-builder-nwjs-version-selector');
	ui.versionPlatforms = document.getElementById('window-builder-nwjs-platform-selector');
	ui.versionFlavors = document.getElementById('window-builder-nwjs-flavor-selector');

	ui.versionSelector.addEventListener('change', showVersionPlatforms);
	ui.versionPlatforms.addEventListener('change', CheckIfVersionIsInstalled);
	ui.versionFlavors.addEventListener('change', CheckIfVersionIsInstalled);

	ui.builderRunBtn = document.querySelector('.window-builder-run');
	ui.builderDownloadBtn = document.querySelector('.window-builder-download');
	ui.builderBuildBtn = document.querySelector('.window-builder-build');

	ui.builderRunBtn.addEventListener('click', Run);
	ui.builderDownloadBtn.addEventListener('click', Download);

	ui.windowManifestName = document.querySelector('.window-manifest-name');
	ui.builderManifest = document.getElementById('window-builder-manifest');
	ui.builderManifestBtn = document.querySelector('.window-builder-manifest-button');

	ui.builderManifestBtn.addEventListener('click', () => {
		ui.builderManifest.click();
	});

	ui.builderManifest.addEventListener('change', () => {
		workdir = path.dirname(ui.builderManifest.value);
		manifest = JSON.parse(fs.readFileSync(ui.builderManifest.value, {encoding: 'utf8'}));
		ui.builderManifest.value = '';
		ui.windowManifestName.innerText = manifest.name;
		ui.editor.setName(manifest.name);
		ui.editor.set(manifest);
	});

	ui.console = document.querySelector('.console-logs');
	ui.jsoneditor = document.querySelector('.jsoneditor');
	ui.editor = new JSONEditor(ui.jsoneditor, {
		mode: 'view'
	});
	ui.editor.setName('No project loaded');

	ui.builderControlsContainer = document.querySelector('.window-builder-controls-right');
	ui.builderDownloadContainer = document.querySelector('.window-builder-download-right');

	ui.builderDownloadProgress = document.querySelector('.dl-progress-bar');

	ui.consoleClear = document.querySelector('.console-clear');
	ui.consoleClear.addEventListener('click', () => {
		ui.console.innerHTML = '';
	});
}

function showNwjsVersions(){
	cache.av = packageManager.GetVersionsAvailable();
	var html = '';
	for (let i = cache.av.length - 1; i >= 0; i--) {
		html += `<option value="${i}">${cache.av[i]}</option>`;
	}
	ui.versionSelector.innerHTML = html;
	showVersionPlatforms();
}

function showVersionPlatforms(){
	var platforms = packageManager.GetPlatforms(cache.av[ui.versionSelector.value]);
	var osname = GetOsName();
	var htmlPl = '';
	for (let i = 0; i < platforms.length; i++) {
		if((osname + '-' + os.arch()) == platforms[i]){
			htmlPl += `<option value="${platforms[i]}" selected>${platforms[i]}</option>`;
		}else{
			htmlPl += `<option value="${platforms[i]}">${platforms[i]}</option>`;
		}
	}
	ui.versionPlatforms.innerHTML = htmlPl;
	showVersionFlavors();
}
function showVersionFlavors(){
	var flavors = packageManager.GetFlavors(cache.av[ui.versionSelector.value]);
	var htmlPl = '';
	for (let i = 0; i < flavors.length; i++) {
		if(flavors[i] == 'sdk'){
			htmlPl += `<option value="${flavors[i]}" selected>${flavors[i]}</option>`;
		}else{
			htmlPl += `<option value="${flavors[i]}">${flavors[i]}</option>`;
		}
	}
	ui.versionFlavors.innerHTML = htmlPl;
	CheckIfVersionIsInstalled();
}

function GetOsName(){
	var osplatform = os.platform();
	switch(osplatform){
		case 'linux':
			return 'linux';
		case 'win32':
			return 'win';
		case 'darwin':
			return 'osx';
		default:
			return false;
	}
}

function CheckIfVersionIsInstalled(){
	var isRunnable = packageManager.IsCandidateToRun(ui.versionPlatforms.value);
	var isInstalled = packageManager.CheckIfVersionIsInstalled(
		cache.av[ui.versionSelector.value],
		ui.versionPlatforms.value,
		ui.versionFlavors.value
	);
	if(isInstalled){
		if(isRunnable){
			ui.builderRunBtn.style.display = 'flex';
		}else{
			ui.builderRunBtn.style.display = 'none';
		}
		ui.builderBuildBtn.style.display = 'flex';
		ui.builderDownloadBtn.style.display = 'none';
	}else{
		ui.builderRunBtn.style.display = 'none';
		ui.builderBuildBtn.style.display = 'none';
		ui.builderDownloadBtn.style.display = 'flex';
	}
}

function Run(){
	if(workdir == ''){
		alert('No project opened');
		return false;
	}
	packageManager.Run(
		cache.av[ui.versionSelector.value],
		ui.versionPlatforms.value,
		ui.versionFlavors.value,
		workdir,
		'',
		(stdout, stderr) => {
			if(stdout != ''){
				ui.console.innerHTML += convert.toHtml(stdout);
				// ui.console.innerHTML += `<div class='console-message-log'>${stdout}</div>`;
			}
			if(stderr != ''){
				ui.console.innerHTML += convert.toHtml(stderr);
				// ui.console.innerHTML += `<div class='console-message-error'>${stderr}</div>`;
			}
		},
		exitcode => {
			ui.console.innerHTML += `<div class='console-message-exit'>Application exit with code ${exitcode}</div>`;
		}
	);
}

function Download(){
	ui.builderDownloadContainer.style.display = 'flex';
	ui.builderControlsContainer.style.display = 'none';
	packageManager.InstallVersion(
		cache.av[ui.versionSelector.value],
		ui.versionPlatforms.value,
		ui.versionFlavors.value,
		progress => { // on progress
			// console.log('donwloading ' + progress);
			ui.builderDownloadProgress.style.width = progress + '%';
		},
		() => { // on end
			console.log('installed');
			ui.builderDownloadContainer.style.display = 'none';
			ui.builderControlsContainer.style.display = 'flex';
			CheckIfVersionIsInstalled();
		},
		() => { // on error
			ui.builderDownloadContainer.style.display = 'none';
			ui.builderControlsContainer.style.display = 'flex';
			console.log('error on download');
		},
	);
}
