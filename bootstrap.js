/* ***** BEGIN LICENSE BLOCK *****
 * Version: GPL License
 * 
 * Copyright (C) 2013 Diego Casorran <dcasorran@gmail.com>
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>
 * 
 * ***** END LICENSE BLOCK ***** */

let {classes:Cc,interfaces:Ci,utils:Cu,results:Cr} = Components,
	{ btoa, atob } = Cu.import("resource://gre/modules/Services.jsm"),
	VOID = function(){}, addon, scope = this;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

function rsc(n) 'resource://' + addon.tag + '/' + n;
function LOG_(m) (m = addon.name + ' Message @ '
	+ (new Date()).toISOString() + "\n> " + m,
		dump(m + "\n"), Services.console.logStringMessage(m));

function LOG(m) addon.branch.getBoolPref('debug') && LOG_(m);

function P(m,i,f) {
	i = i || 2;
	LOG(m);
	i$.Window.openDialog('chrome://'+addon.tag+'/content/alert.xul', null,
		'centerscreen,dialog', i, ''+m, f || (function(t){
					Services.obs.addObserver(i$, t, true);
					return function(d,s) {
						Services.obs.notifyObservers(s,t,JSON.stringify(d));
					};
				})(addon.tag+'-'+i)
			);
}

function getBrowser(w) {
	
	try {
		return w.getBrowser();
	} catch(e) {
		return w.gBrowser;
	}
}

let apipath = 'https://eu.api.mega.co.nz/';

let i$ = {
	get Window() Services.wm.getMostRecentWindow('navigator:browser'),
	
	lo: function(u,p,k,uh,cb,ix) {
		uh = uh || stringhash(u.toLowerCase(), new sjcl.cipher.aes(prepare_key_pw(p)));
		let ctx = {
			checkloginresult : function (ctx, r) {
				if (r) {
					scope.u_type = r;
					LOG('Logged. ' + (r != k ? ' -- User status changed.':''));
					if(ix === true) {
						i$.sl(u,p,r,uh);
					}
					try {
						i$.Window.document.getElementById(addon.tag+'-toolbar-button')
							.setAttribute('tooltiptext', addon.name + ' - Logged in as '
								+ JSON.parse(scope.sessionStorage.attr).name);
					} catch(e) {}
				} else if(!ix) {
					i$.lo(u,p,k,null,cb,!0);
					return;
				} else {
					P('Incorrect e-mail and/or password.');
					i$.sl(null);
				}
				if(cb)
					cb(r);
			}
		};
		u_login(ctx, u, p, uh, true);
	},
	
	sw: function(window) {
		try {
			window = window || this.Window;
			scope.d = addon.branch.getBoolPref('debug');
			scope.URL = rsc('#dummy');
			scope.alert = P.bind(scope);
			scope.window = scope;
			scope.navigator = window.navigator;
			scope.crypto = Cc["@mozilla.org/security/crypto;1"].getService(Ci.nsIDOMCrypto);
			// XXX: Erm.. somehow api_getsid2() takes 20s longer by using the Constructor way (!?)
			scope.XMLHttpRequest = window.XMLHttpRequest;
			// scope.XMLHttpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1");
			scope.console = {log:LOG};
			scope.clearTimeout = function(t) {
				if(t) t.cancel();
			};
			scope.setTimeout = function(f,n) {
				LOG('setTimeout: ' + f);
				if(typeof f !== 'function')
					throw new Error('Invalid setTimeout callback');
				
				let i = Ci.nsITimer, t = Cc["@mozilla.org/timer;1"].createInstance(i);
				t.initWithCallback({notify:f},n||30,i.TYPE_ONE_SHOT);
				return t;
			};
			scope.sessionStorage = // XXX
			scope.localStorage = {
				removeItem:function(v) {delete this[v];},
				// d might causes l undefined..
				// d: !!scope.d
				// fmconfig: '{"blockchromeDialog":"1"}'
			};
		} catch(ex) {
			LOG(ex);
		}
		window = undefined;
	},
	
	rl: function(ask) {
		try {
			let hasLoginInfo = addon.branch.getBoolPref('hasLoginInfo');
			
			/* if(hasLoginInfo) */ {
				let x = rsc('login'), [li] = this.lM.findLogins({}, x, x, null);
				
				if((hasLoginInfo = (li && li.username))) {
					// this.lo(li.username,li.password,li.usernameField,li.passwordField);
					this.userdata = [li.username,li.password,li.usernameField,li.passwordField];
				}
			}
			
			if(ask && !hasLoginInfo) {
				P(null,1);
			}
			
			addon.branch.setBoolPref('hasLoginInfo', hasLoginInfo);
			return hasLoginInfo;
			
		} catch(ex) {
			P(ex.message);
		}
		
		return false;
	},
	
	os: function(window) {
	/* 	if("userdata" in this || this.rl()) {
			this.op(window);
		} else {
			this.pending = true;
			// P(null,1);
		} */
		// Meh, just open the site..
		("userdata" in this || this.rl());
		this.op(window);
	},
	op: function(window) {
		window = window || this.Window;
		
		let ou = function() {
			let b = getBrowser(window);
			b.selectedTab = b.addTab('https://mega.co.nz/#fm');
		};
		
		if(("userdata" in this) && !scope.sessionStorage.wasloggedin) {
			this.sa('Performing login handshake, please wait...');
			
			window.setTimeout(function(){
				this.userdata.push(ou);
				this.lo.apply(this,this.userdata);
				this.userdata.pop();
			}.bind(i$), 199);
			
		} else {
			ou();
		}
	},
	
	sa: function(m,x,cb) {
		LOG('SA: '+m);
		let i = rsc('icon48.png'), t = addon.name+' '+(x || addon.version);
		try {
			Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService)
				.showAlertNotification(i,t,m,!!cb,"",cb, addon.name);
		} catch(e) {
			let aw = Services.ww.openWindow(null,"chrome://global/content/alerts/alert.xul",
				"_blank", "chrome,titlebar=no,popup=yes", null);
			
			aw.arguments = [i,t,m, !!cb, "", cb, addon.name];
		}
	},
	
	nf: function(f,p,e) {
		let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
		file.initWithPath(p);
		if(e) e.forEach(function(s) file.append(s));
		file.append(f);
		return file;
	},
	
	gp: function(p,e) {
		let path = p.split(/[\\\/]+/),
			file = path.pop();
		if(e) {
			let tmp = [].concat(path), l;
			while((l = tmp.pop()) == e.pop());
			tmp.push(l);
			path = tmp;
		}
		return { file : file, path: path.join(path[0][1] === ':' ? '\\':'/')};
	},
	
	cl: function(window) {
		getBrowser(window).addEventListener('DOMContentLoaded',window['$'+addon.id.replace(/[^\d]/g,'')] = (function(ev) {
			let doc = ev.originalTarget;
			
			if(!(doc.location && doc.location.host == 'mega.co.nz'))
				return;
			
			let win = doc.defaultView;
			
			if(!win.sessionStorage.wasloggedin && scope.sessionStorage.wasloggedin) {
				['sessionStorage','localStorage'].forEach(function(memb) {
					
					for(let [k,v] in Iterator(scope[memb])) {
						if(typeof v != 'function') try {
							win[memb][k] = v;
							LOG(memb + '['+k+'] = ' + v);
						} catch(e) {
							LOG(memb+'['+k+'] error: ' + e);
						}
					}
				});
			}
			
		/* No longer needed..
			try {
				let fmconfig = JSON.parse(win.localStorage.fmconfig || '{}');
				fmconfig.blockchromeDialog = '1';
				win.localStorage.fmconfig = JSON.stringify(fmconfig);
			} catch(e) {
				LOG('fmconfig: ' + e);
			} */
			
			doc.addEventListener('MegaCallBack', function(ev) {
				let node = ev.target;
				
				if(node.hasAttribute("megacheck")) {
					node.setAttribute('check','1');
					node.setAttribute('version','1');
					let ev = doc.createEvent("HTMLEvents");
					ev.initEvent('MegaExtensionCallback', true, false);
					node.dispatchEvent(ev);
					doc.defaultView.setTimeout(function()
						this.wrappedJSObject.dl_method = 0, 400);
				}
				node = undefined;
			}, false);
			
			let kpkc = 0, kp = function(ev) {
				switch(ev.keyCode) {
					case window.KeyEvent.DOM_VK_SHIFT:
					case window.KeyEvent.DOM_VK_CONTROL:
						kpkc = ev.type == 'keyup' ? 0 : ev.keyCode;
					default:break;
				}
			};
			doc.addEventListener('keydown', kp, false);
			doc.addEventListener('keyup'  , kp, false);
			
			try {
				loadSubScript(rsc('inc/fileapi.js'),win);
				LOG('FileSystem API Injected...');
			} catch(ex) {
				LOG('FileSystem API: ' + ex);
				return;
			}
			
			let last_path;
			doc.addEventListener('iMEGADownloadRequest', function(ev) {
				let node = ev.target, push = function(type) {
					// LOG('PUSHing ' + type);
					let ev = doc.createEvent("Events");
					ev.initEvent(type, false, false);
					node.dispatchEvent(ev);
				};
				
				let fs,f = node.getAttribute('filename') || node.nodeName.split(':').pop(),
					fld = node.hasAttribute('folder')
						&& node.getAttribute('folder').split(/[\\\/]+/).filter(String);
				f = f.replace(/[:\/\\<">|?*]+/g,'.').replace(/\s*\.+/g,'.').substr(0,256);
				
				if((last_path && fld) || (!kpkc && ~f.indexOf('.') && addon.branch.getCharPref('dir'))) {
					f = i$.nf(f,fld && last_path || addon.branch.getCharPref('dir'),fld);
				} else {
					let nsIFilePicker = Ci.nsIFilePicker,
						fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
					fp.init(win,addon.name + ' :: Save Downloaded File',nsIFilePicker.modeSave);
					fp.appendFilters(nsIFilePicker.filterAll); // TODO: ext2filter?
					fp.defaultString = f;
					if(~f.indexOf('.')) {
						fp.defaultExtension = f.replace(/^.*\./,'');
					}
					// TODO: async
					f = fp.show() != nsIFilePicker.returnCancel ? fp.file : null;
					
					if( f && fld ) {
						let s = i$.gp(f.path);
						f = i$.nf(s.file,s.path,fld);
					}
				}
				
				last_path = fld && f && i$.gp(f.path,fld).path;
				LOG('Saving To: ' + (f && f.path) + ' -- Next path: ' + last_path);
				
				if( f ) try {
					if(f.exists())
						f.remove(false);
					
					f.create(Ci.nsIFile.NORMAL_FILE_TYPE, parseInt("0755",8));
					fs = Cc["@mozilla.org/network/safe-file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
					fs.QueryInterface(Ci.nsISeekableStream);
					fs.init(f, 0x02 | 0x08 | 0x20, parseInt("0755",8), 0);
				} catch(ex) {
					P(ex.message);
					fs = null;
				}
				
				if( fs ) {
					node.setAttribute('success', !0);
					
					try {
						let maxSlots = addon.branch.getIntPref('dls') || 4;
						if(maxSlots != 4) {
							node.ownerDocument.defaultView.wrappedJSObject.dl_maxSlots = maxSlots;
						}
					} catch(e) {
						LOG(e);
					}
					
					let startTime = Date.now();
					node.addEventListener('iMEGADownloadComplete', function(ev) {
						let fn = f.path.replace(/^.*[\/\\]/g, '');
						if(fs instanceof Ci.nsISafeOutputStream) {
							fs.finish();
						} else {
							fs.close();
						}
						try {
							let dl = {
								name: fn,
								source: node.ownerDocument.location.href,
								target: Services.io.newFileURI(f).spec,
								startTime: startTime * 1000,
								endTime: Date.now() * 1000,
								state: Ci.nsIDownloadManager.DOWNLOAD_FINISHED,
								currBytes: parseInt(node.getAttribute('filesize')),
								maxBytes: parseInt(node.getAttribute('filesize')),
							};
							try {
								dl.mimeType = Cc["@mozilla.org/mime;1"].getService(Ci.nsIMIMEService).getTypeFromFile(f);
							} catch(e) {}
							let stm = Cc["@mozilla.org/download-manager;1"]
								.getService(Ci.nsIDownloadManager).DBConnection.createStatement(
									'INSERT INTO moz_downloads ('+Object.keys(dl)+')' +
									'VALUES                    ('+Object.keys(dl).map(function(n) ':'+n)+')');
							
							for(let n in dl)
								stm.params[n] = dl[n];
							stm.execute();
							stm.finalize();
							f = null;
						} catch(e) {
							LOG(e);
						}
						let dlc = 1, dmui = Services.wm.getMostRecentWindow('Download:Manager');
						if(dmui) try {
							dmui.buildDownloadList(!0);
						} catch(e) {}
						if(node.ownerDocument.location.hash.substr(0,3) !== '#fm') {
							dlc = addon.branch.getIntPref('dlc');
							addon.branch.setIntPref('dlc', ++dlc);
						}
						if(!(dlc % 50)) {
							let b = getBrowser(i$.Window);
							b.selectedTab = b.addTab('http://goo.gl/Q6ZiF');
							P("Your download has finished.\n\n"
								+ "Would you be so kind to support iMEGA with a small contribution? "
								+ "That way you'll encourage further development. Thank you.");
						} else if(!f) {
							i$.sa(fn,'Download Finished.',function(s,t) {
								if(t !== 'alertfinished') try {
									let dlui = Components.classesByID["{7dfdf0d1-aff6-4a34-bad1-d0fe74601642}"]
										.getService(Ci.nsIDownloadManagerUI);
									dlui.show();
								} catch(e) {}
							});
						} else {
							i$.sa('Download ' + fn + ' finished.');
						}
						node = fs = f = kpkc = kp = undefined;
					}, false);
					
					node.addEventListener('iMEGADownloadSeek', function(ev) {
						// let pos = node.getAttribute('data');
						// LOG('iMEGADownloadSeek: ' + pos);
						fs.seek(0,node.getAttribute('data'));
					}, false);
					
					node.addEventListener('iMEGADownloadWrite', function(ev) {
						let blob = win.wrappedJSObject[node.nodeName];
						// LOG('iMEGADownloadWrite: ' + (blob && blob.size));
						
						let fr = new window.FileReader();
						fr.onload = function(ev) {
							fs.write(ev.target.result,blob.size);
							push('iMEGADownloadWriter');
						};
						fr.readAsBinaryString(blob);
						
					}, false);
				} else {
					try {
						doc.getElementById('download_statustxt').textContent = 'Download ' + (f ? 'Error!':'Cancelled.');
						doc.querySelector('.progress-block').style.display = 'none';
						doc.getElementById('download_speed').textContent = '\u221E';
						doc.getElementById('download_filename').style.marginBottom = '20px';
					} catch(e) {
						LOG(e);
					}
				}
				push('iMEGADownloadResponse');
				
			}, false);
			
			let x = doc.getElementById('dllink');
			if( x ) {
				x.addEventListener('click', function(ev) {
					ev.preventDefault();
					// ev.stopPropagation();
				}, true);
				
				win.setTimeout(function(){
					try {
						doc.getElementById('download_checkbox1').click();
					} catch(e) {}
				}, 3001);
				
				x = undefined;
			}
		}).bind(this), false);
	},
	
	su: function() {
		if("WeaveCrypto" in scope) {
			return;
		}
		Cu.import("resource://services-crypto/WeaveCrypto.js", scope);
		scope.WeaveCrypto = new scope.WeaveCrypto();
		
		let i = 1024, rB = WeaveCrypto.generateRandomBytes(i);
		
		loadSubScript(rsc('inc/mouse_1.js'));
		scope.eventsEnd = function(){};
		scope.eventsCollect = function() {
			rc4Init();
			while(i-- > 0)
				rc4Next(rB.charCodeAt(i));
		};
		
		['sjcl_1','rsa_1','hex_1','user_1','keygen_2','crypto_2'].forEach(function(file) {
			loadSubScript(rsc('inc/'+file+'.js'));
		});
		
		this.lM = Cc["@mozilla.org/login-manager;1"]
			.getService(Ci.nsILoginManager);
		
		// this.rl();
		if(!addon.branch.getBoolPref('hasLoginInfo')
			&& !addon.branch.getBoolPref('lic')) {
				P(null,1);
		}
	},
	
	ir: function(f) {
		Services.tm.mainThread.dispatch({run:f},Ci.nsIEventTarget.DISPATCH_NORMAL);
	},
	
	sl: function(u,p,r,uh) {
		try {
			let x = rsc('login'), [li] = this.lM.findLogins({}, x, x, null);
			
			if(li) {
				this.lM.removeLogin(li);
				addon.branch.setBoolPref('hasLoginInfo', !1);
				delete this.userdata;
			}
			
			if(u) {
				let loginInfo = new Components.Constructor (
					"@mozilla.org/login-manager/loginInfo;1", Ci.nsILoginInfo, "init");
				loginInfo = new loginInfo( x, x, null, u, p, r, uh);
				
				this.lM.addLogin(loginInfo);
				
				this.userdata = [u,p,r,uh];
				addon.branch.setBoolPref('hasLoginInfo', !0);
			}
			
			return true;
		} catch(ex) {
			LOG(ex);
		}
		return false;
	},
	
	sd: function() {
		
	},
	
	QueryInterface: XPCOMUtils.generateQI([Ci.nsISupports,Ci.nsIFactory,
		Ci.nsISupportsWeakReference,Ci.nsIWebProgressListener,Ci.nsIObserver]),
	
	onLocationChange: function(j, k, l) {
		if(this.userdata && /^https:\/\/mega\.co\.nz\/#login$/i.test(l.spec)) {
			let d = j.DOMWindow.document;
			if(scope.sessionStorage.wasloggedin)
				d.location.hash = 'fm';
			else
			  d.defaultView.setTimeout(function(){
				d.getElementById('login_email').value = this.userdata[0];
				d.getElementById('login_password').value = this.userdata[1];
			}.bind(this), 731);
		}
	},
	onStateChange: VOID,
	onStatusChange: VOID,
	onProgressChange: VOID,
	onSecurityChange: VOID,
	
	observe: function(s,t,d) {
		LOG('observer: ' + t + ' ~ ' + d.replace(/"p":"[^"]+"/,'"p":[hidden]'));
		if(/^imega-/.test(t)) {
			switch(t.substr(6)) {
				case '1':
					d = JSON.parse(d);
					if(d.status) try {
						
						if(d.u.trim() == '' || d.p.trim() == ''
						|| !/^[a-zA-Z0-9_\.\-]+\@(?:[a-zA-Z0-9\-]+\.)+[a-zA-Z0-9]{2,4}$/.test(d.u))
							throw new Error('Unsuitable login data entered...');
						
						let passwordaes = new sjcl.cipher.aes(prepare_key_pw(d.p)),
							uh = stringhash(d.u.toLowerCase(), passwordaes),
							ctx = {
								checkloginresult : function (ctx, r) {
									if (r) {
										scope.u_type = r;
										
										if(i$.sl(d.u,d.p,r,uh) && i$.pending) {
											i$.Window.setTimeout(i$.op.bind(i$),300);
										}
										delete i$.pending;
										Services.obs.removeObserver(i$, t);
									}
									Services.obs.notifyObservers(null,d.tob,r ? 'Logged.'
										: 'Incorrect e-mail and/or password. Please try again.');
								}
							};
						u_login(ctx, d.u, d.p, uh, true);
						
					} catch(ex) {
						Services.obs.notifyObservers(null,d.tob,'Internal error: '+ex.message);
					} else {
						if(this.pending) {
							this.op();
							delete this.pending;
						}
						addon.branch.setBoolPref('lic', !0);
						break;
					}
					return;
			}
			
			Services.obs.removeObserver(this, t);
		}
	},
	onOpenWindow: function(aWindow) {
		let domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
		loadIntoWindowStub(domWindow);
	},
	onCloseWindow: function() {},
	onWindowTitleChange: function() {}
};

(function(global) global.loadSubScript = function(file,scope)
	Services.scriptloader.loadSubScript(file,scope||global))(this);

function loadIntoWindow(window) {
	if(!(/^chrome:\/\/(browser|navigator)\/content\/\1\.xul$/.test(window&&window.location)))
		return;
	
	function c(n) window.document.createElement(n);
	function $(n) window.document.getElementById(n);
	function e(e,a) {
		if((e=c(e))&&a)
			for(let x in a)e.setAttribute(x,e[x] = a[x]);
		return e;
	}
	
	function ToolbarHandler(ev) {
		ev.preventDefault();
		
		switch(ev.button) {
			case 0: {
				i$.os(window);
			}	return true;
			
			case 1:
				P(null,1);
				break;
			
			case 2:
				break;
		}
	}
	
	let gNavToolbox = window.gNavToolbox || $('navigator-toolbox');
	if(gNavToolbox && gNavToolbox.palette.id == 'BrowserToolbarPalette') {
		let m = addon.tag+'-toolbar-button';
		gNavToolbox.palette.appendChild(e('toolbarbutton',{
			id:m,label:addon.name,class:'toolbarbutton-1',
			tooltiptext:addon.name,image:rsc('icon16.png')
		})).addEventListener('click', ToolbarHandler, false);
		
		if(addon.branch.getBoolPref("firstRun")) {
			addon.branch.setBoolPref("firstRun", false);
			let nBar = $('nav-bar');
			if(nBar) {
				nBar.insertItem(m, null, null, false);
				nBar.setAttribute("currentset", nBar.currentSet);
				window.document.persist('nav-bar', "currentset");
			}
		} else {
			for each(let toolbar in window.document.querySelectorAll("toolbar[currentset]")) try {
				let cSet = toolbar.getAttribute("currentset") || '';
				if(cSet.split(",").some(function(x) x == m, this)) {
					toolbar.currentSet = cSet;
					window.BrowserToolboxCustomizeDone(true);
					break;
				}
			} catch(e) {}
		}
	}
	
	i$.sw(window);
	i$.cl(window);
	window.setTimeout(function() i$.su(),1027);
	getBrowser(window).addProgressListener(i$);
}

function loadIntoWindowStub(domWindow) {
	
	if(domWindow.document.readyState == "complete") {
		loadIntoWindow(domWindow);
	} else {
		domWindow.addEventListener("load", function() {
			domWindow.removeEventListener("load", arguments.callee, false);
			loadIntoWindow(domWindow);
		}, false);
	}
}

function unloadFromWindow(window) {
	let $ = function(n) window.document.getElementById(n);
	let btnId = addon.tag+'-toolbar-button',btn= $(btnId);
	if(btn) {
		btn.parentNode.removeChild(btn);
	} else {
		let gNavToolbox = window.gNavToolbox || $('navigator-toolbox');
		if(gNavToolbox && gNavToolbox.palette.id == 'BrowserToolbarPalette') {
			for each(let node in gNavToolbox.palette) {
				if(node && node.id == btnId) {
					gNavToolbox.palette.removeChild(node);
					break;
				}
			}
		}
	}
	
	// i$.sw();
	let b = getBrowser(window),
		id = '$'+addon.id.replace(/[^\d]/g,'');
	b.removeProgressListener(i$);
	b.removeEventListener('DOMContentLoaded', window[id], false);
	delete window[id];
}

function setup(data) {
	
	let io = Services.io, wm = Services.wm;
	
	addon = {
		id: data.id,
		name: data.name,
		version: data.version,
		tag: data.name.toLowerCase().replace(/[^\w]/g,''),
	};
	
	addon.branch = Services.prefs.getBranch('extensions.'+addon.tag+'.');
	for(let [k,v] in Iterator({firstRun:!0,hasLoginInfo:!1,dlc:0,dls:4,debug:!1,dir:'',lic:!1})) {
		try {
			switch(typeof v) {
				case 'boolean': addon.branch.getBoolPref(k); break;
				case 'number':  addon.branch.getIntPref(k);  break;
				case 'string':  addon.branch.getCharPref(k); break;
			}
		} catch(e) {
			switch(typeof v) {
				case 'boolean': addon.branch.setBoolPref(k,v); break;
				case 'number':  addon.branch.setIntPref(k,v);  break;
				case 'string':  addon.branch.setCharPref(k,v); break;
			}
		}
	}
	
	io.getProtocolHandler("resource")
		.QueryInterface(Ci.nsIResProtocolHandler)
		.setSubstitution(addon.tag,
			io.newURI(__SCRIPT_URI_SPEC__+'/../',null,null));
	
	let windows = wm.getEnumerator("navigator:browser");
	while(windows.hasMoreElements()) {
		let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
		loadIntoWindowStub(domWindow);
	}
	wm.addListener(i$);
}

function startup(data) {
	let tmp = {};
	Cu.import("resource://gre/modules/AddonManager.jsm", tmp);
	tmp.AddonManager.getAddonByID(data.id,setup);
}

function shutdown(data, reason) {
	if(reason == APP_SHUTDOWN)
		return;
	
	i$.sd(reason);
	
	Services.wm.removeListener(i$);
	
	let windows = Services.wm.getEnumerator("navigator:browser");
	while(windows.hasMoreElements()) {
		let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
		unloadFromWindow(domWindow);
	}
	
	Services.io.getProtocolHandler("resource")
		.QueryInterface(Ci.nsIResProtocolHandler)
		.setSubstitution(addon.tag,null);
	
	for(let m in scope)
		delete scope[m];
}

function install(data, reason) {}
function uninstall(data, reason) {}
