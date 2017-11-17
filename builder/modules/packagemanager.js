var console = require('console');
var fs = require('fs');
var path = require('path');
var https = require('https');
var exec = require('child_process').exec;
var os = require('os');
var url = require('url').URL;

var packagesRaw = {};
var packages = {};
var pids = [];
var child = null;

module.exports = {
	GetVersionsAvailable,
	GetVersionsInstalled,
	InstallVersion,
	GetNwExecPath,
	UpdateVersions,
	GetPlatforms,
	GetFlavors,
	MakePkgName,
	CheckIfVersionIsInstalled,
	Run,
	IsCandidateToRun
};

function n00p(){}

function UpdateVersions(){
	return new Promise((resolve, reject) => {
		https.get('https://nwjs.io/versions.json', res => {
			let rawdata = '';
			res.on('data', d => {
				rawdata += d;
			});
			res.on('end', () => {
				fs.writeFileSync('./builder/sources/versions.json', rawdata);
				resolve();
			});
		}).on('error', e => {
			reject(e);
		});
	});
}
async function LoadPackageDb(){
	try{
		packagesRaw = JSON.parse(fs.readFileSync('./builder/sources/versions.json'));
	}catch(err){
		await UpdateVersions();
		packagesRaw = JSON.parse(fs.readFileSync('./builder/sources/versions.json'));
	}
	for (var i = 0; i < packagesRaw.versions.length; i++) {
		packages[packagesRaw.versions[i].version] = packagesRaw.versions[i];
	}
}

function GetVersionsAvailable(){
	return Object.keys(packages).sort(sortAlphaNum);
}
function GetPlatforms(version){
	return packages[version].files;
}
function GetFlavors(version){
	return packages[version].flavors;
}
function MakePkgName(version, platform, flavor){
	flavor = (flavor == 'normal') ? '' : flavor + '-';
	var pkgn = `nwjs-${flavor}${version}-${platform}`;
	return pkgn;
}
function MakePkgExt(platform){
	if(platform.indexOf('linux') >= 0){
		return '.tar.gz';
	}
	return '.zip';
}
function CheckIfVersionIsInstalled(version, platform, flavor){
	var pkgn = MakePkgName(version, platform, flavor);
	var pathPkg = path.join('./', 'bin', pkgn);
	try{
		fs.accessSync(pathPkg, fs.constants.F_OK | fs.constants.R_OK);
		return true;
	}catch(err){
		return false;
	}
}
function GetVersionsInstalled(){}
function InstallVersion(version, platform, flavor, onprogress = n00p, onend = n00p, onerror = n00p){
	var pkgn = MakePkgName(version, platform, flavor);
	var qflavor = (flavor == 'normal') ? '' : flavor + '-';
	var ext = MakePkgExt(platform);
	var dlUrl = new url(`/${version}/${pkgn}${ext}`, 'https://dl.nwjs.io/').href;
	var filename = `${pkgn}${ext}`;
	var dest = path.join(process.cwd(), 'bin', 'cache', filename);

	var file = fs.createWriteStream(dest);
	https.get(dlUrl, res => {
		var len = parseInt(res.headers['content-length'], 10);
		var cur = 0;
		res.pipe(file);
		res.on('data', d => {
			cur += d.length;
			if(onprogress){
				onprogress((100.0 * cur / len).toFixed(2));
			}
		});
		res.on('end', () => {
			file.close(() => {
				Unpack(dest, onend);
			});
		});
	}).on('error', e => {
		onerror(e);
		fs.unlink(dest);
	});
}
function UnpackCommand(file, dest){
	var lc = os.type().toLowerCase();
	var command = '';
	if(lc == 'linux'){
		command = `tar -zxf ${file} -C ${dest}`;
	}
	if(lc == 'darwin'){
		command = `unzip ${file}`;
	}
	if(lc == 'win' || lc == 'Windows_NT'){
		command = `z7.exe x ${file}`;
	}
	return command;
}
function Unpack(filename, callback){
	var cachepath = path.join(process.cwd(), 'bin', 'cache');
	var destpath = path.join(process.cwd(), 'bin');
	var tgzipcommand = UnpackCommand(filename, destpath);
	var command = `cd ${cachepath} && ${tgzipcommand}`;
	exec(command, (err, stderr, stdout) => {
		if(err){
			console.log(err);
		}
		if(stderr){
			console.log(stderr);
		}
		if(stdout){
			console.log(stdout);
		}
		callback();
	});
}
function GetNwExecPath(){}

function IsCandidateToRun(platform){
	var osplatform = os.platform();
	var osarch = os.arch();
	switch(osplatform){
		case 'linux':
			if(platform.indexOf('linux') >= 0){
				if(osarch == 'ia32' && platform.indexOf('ia32') < 0){
					return false;
				}
				return true;
			}
			return false;
		case 'win32':
			if(platform.indexOf('win') >= 0){
				if(osarch == 'ia32' && platform.indexOf('win') < 0){
					return false;
				}
				return true;
			}
			return false;
		default:
			return false;
	}
}
function Run(version, platform, flavor, workdir, params, datacallback, exitcallback){
	var osplatform = os.platform();
	var extension = (osplatform == 'linux') ? '' : '.exe';
	var pkgn = MakePkgName(version, platform, flavor);
	var pathPkg = path.join(process.cwd(), 'bin', pkgn, 'nw' + extension); // Needs implement for osx

	var command = `cd '${workdir}' & ${pathPkg} . ${params}`;

	child = exec(command, {cwd: workdir});
	pids.push(child.pid);
	child.on('exit', () => {
		exitcallback(child.exitCode);
		pids.splice(pids.indexOf(child.pid), 1);
	});
	child.stdout.on('data', data => {
		datacallback(data, '');
	});
	child.stderr.on('data', data => {
		datacallback('', data);
	});
}

function sortAlphaNum(a, b) {
	var aVerRaw = a.slice(1, 7);
	var bVerRaw = b.slice(1, 7);
	var aVerRawExt = a.slice(8, 20);
	var bVerRawExt = b.slice(8, 20);
	var aVerArr = aVerRaw.split('.');
	var bVerArr = bVerRaw.split('.');
	for (let i = 0; i < aVerArr.length; i++) {
		aVerArr[i] = parseInt(aVerArr[i], 10);
	}
	for (let i = 0; i < bVerArr.length; i++) {
		bVerArr[i] = parseInt(bVerArr[i], 10);
	}
	if(aVerArr[0] == bVerArr[0]){
		if(aVerArr[1] == bVerArr[1]){
			if(aVerArr[2] == bVerArr[2]){
				if(aVerRawExt != '' && bVerRawExt != ''){
					if(aVerRawExt[0] > bVerRawExt[0]){
						return 1;
					}
					return -1;
				}
				if(aVerRawExt == ''){
					return 1;
				}
				return 0;
			}else if(aVerArr[2] > bVerArr[2]){
				return 1;
			}
		}else if(aVerArr[1] > bVerArr[1]){
			return 1;
		}
	}else if(aVerArr[0] > bVerArr[0]){
		return 1;
	}
	return -1;
}

LoadPackageDb();
