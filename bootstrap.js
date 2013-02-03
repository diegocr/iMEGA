/* ***** BEGIN LICENSE BLOCK *****
 * Version: MIT/X11 License
 * 
 * Copyright (c) 2013 Diego Casorran
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 * 
 * Contributor(s):
 *   Diego Casorran <dcasorran@gmail.com> (Original Author)
 * 
 * ***** END LICENSE BLOCK ***** */

let {classes:Cc,interfaces:Ci,utils:Cu,results:Cr} = Components,addon,scope = this,
	{ btoa, atob } = Cu.import("resource://gre/modules/Services.jsm"),
	VOID = function(){},
	STATE_CHANGE=(Ci.nsIWebProgressListener.STATE_IS_NETWORK
				| Ci.nsIWebProgressListener.STATE_IS_DOCUMENT
				| Ci.nsIWebProgressListener.STATE_TRANSFERRING);

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

let apipath = 'https://eu.api.mega.co.nz/';

let i$ = {
	get Window() Services.wm.getMostRecentWindow('navigator:browser'),
	
	cl: function(window) {
		window.getBrowser().addEventListener('DOMContentLoaded',window['$'+addon.id.replace(/[^\d]/g,'')] = (function(ev) {
			let doc = ev.originalTarget;
			
			if(!(doc.location && doc.location.host == 'mega.co.nz'))
				return;
			
			let win = doc.defaultView;
			
			LOG('DOMContentLoaded: ' + win.location.href);
			
			try {
				// let sandbox = Cu.Sandbox(win, { sandboxPrototype: win });
				// sandbox.unsafeWindow = win.wrappedJSObject;
				// Services.scriptloader.loadSubScript(rsc('inc/idb.filesystem.js'),sandbox);
				Services.scriptloader.loadSubScript(rsc('inc/idb.filesystem.js'),win);
				LOG('FileSystem API Injected...');
			} catch(ex) {
				LOG('FileSystem API: ' + ex);
			}
			
			try {
				let fmconfig = JSON.parse(win.localStorage.fmconfig || '{}');
				fmconfig.blockchromeDialog = '1';
				win.localStorage.fmconfig = JSON.stringify(fmconfig);
			} catch(e) {
				LOG('fmconfig: ' + e);
			}
			
			let x = doc.getElementById('dllink');
			if( x ) {
				x.addEventListener('click', function(ev) {
					// this.removeEventListener(ev.type, arguments.callee, true);
					ev.preventDefault();
					ev.stopPropagation();
					let fn = this.download || (''+(doc.getElementById('download_filename2')
						|| doc.getElementById('download_filename') || {}).textContent)
						.replace(/\s*\([\d\.]+\s\w{2}\)\s*$/,'').trim();
					i$.ir(i$.dl.bind(i$,base64urldecode(this.href.split(':')[1]),
						fn,this.ownerDocument.defaultView));
				}, true);
				
				win.setTimeout(function(){
					try {
						doc.getElementById('download_checkbox1').click();
					} catch(e) {}
				}, 3001);
				
				x = undefined;
			}
			
			if(win.sessionStorage.wasloggedin
			|| !scope.sessionStorage.wasloggedin)
				return;
			
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
			
		}).bind(this), false);
	},
	
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
				d: !!scope.d
				// fmconfig: '{"blockchromeDialog":"1"}'
			};
		} catch(ex) {
			LOG(ex);
		}
		window = undefined;
	},
	
	dl: function(u,f,window) {
		u = u.split('!');
		u.shift();
		u = Services.io.newURI(u.join('!'),null,null);
		
		let db_name = (u.scheme + '_' + u.host + '_' + u.ref),
			db_file = u.path.replace(/#.+$/g,''), fs;
		f = f != 'undefined' && f || db_file.replace(/^.*\//g,'');
		
		LOG('db_name:'+db_name+', db_file:'+db_file+', fn:'+f);
		
		if(~f.indexOf('.') && addon.branch.getCharPref('dir')) {
			let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
			file.initWithPath(addon.branch.getCharPref('dir'));
			file.append(f);
			f = file;
		} else {
			let nsIFilePicker = Ci.nsIFilePicker,
				fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
			fp.init(window,addon.name + ' :: Save Downloaded File',nsIFilePicker.modeSave);
			fp.appendFilters(nsIFilePicker.filterAll); // TODO: ext2filter?
			fp.defaultString=f.replace(/[:\/*\\<">|?]+/g,'.').replace(/\.+/g,'.');
			if(~f.indexOf('.')) {
				fp.defaultExtension = f.replace(/^.*\./,'');
			} else try {
				let b = window.QueryInterface(Ci.nsIInterfaceRequestor)
					.getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsIDocShellTreeItem).rootTreeItem
					.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow).gBrowser;
				b.selectedTab = b._getTabForContentWindow(window);
			} catch(e) {}
			// TODO: async
			f = fp.show() != nsIFilePicker.returnCancel ? fp.file : null;
		}
		
		LOG('Saving to: ' + (f && f.path));
		
		let dbr,
			err = function(msg,db) {
				return function(ev) {
					P("Sorry, something went wrong...\n\n" + msg + " (#"+(ev&&ev.target.errorCode)+")");
					if(db) db.close();
				};
			};
		
		try {
			dbr = window.indexedDB.open(db_name);
		} catch(ex) {
			err(ex.message)();
			return;
		}
		
		if( f ) try {
			if(f.exists())
				f.remove(false);
			
			f.create(Ci.nsIFile.NORMAL_FILE_TYPE, parseInt("0755",8));
			fs = Cc["@mozilla.org/network/safe-file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
			fs.init(f, 0x02 | 0x08 | 0x20, parseInt("0755",8), 0);
		} catch(ex) {
			err(ex.message)();
			return;
		}
		
		dbr.onerror = err('Unable to access database.');
		dbr.onblocked = err('Database is blocked.');
		
		dbr.onupgradeneeded = function(ev) {
			LOG('--------------------- onupgradeneeded');
		};
		
		dbr.onsuccess = function(ev) {
			let db = ev.target.result, m = 'readwrite',
				et = 'entries';
			
			db.onerror = err('Error accessing database.', db);
			
			let tx = db.transaction([et], m),
				rg = window.IDBKeyRange.only(db_file),
				os = tx.objectStore(et),
				tr = f ? os.get(db_file) : os.delete(rg);
			
			tx.onabort = err('Error processing transaction.', db);
			
			let oncomplete = function(e) {
				LOG('Transaction Completed!');
				
				let done = function() {
					db.close();
					
					if( fs ) {
						if(fs instanceof Ci.nsISafeOutputStream) {
							fs.finish();
						} else {
							fs.close();
						}
						
						if( e === true )
							f.remove(false);
					}
					
					dbr = db = fs = tx = rg = os = tr = f = undefined;
				};
				
				if( f ) {
					db.transaction([et],m).objectStore(et).delete(rg).onsuccess = done;
				} else {
					done();
				}
			};
			// tx.oncomplete = oncomplete;
			tx.oncomplete = function() {};
			
			tr.onsuccess = function(ev) {
				let entry = ev.target.result,
					chunks = entry && entry.chunks;
				LOG('tr.onsuccess: ' + !!chunks);
				
				if(chunks) {
					let w = i$.Window, st = window.document.getElementById('download_statustxt');
					if(chunks.length > 16)
						i$.sa('Joining chunks, please wait...');
					
					let next = function() {
						let b = chunks.shift();
						if(st) {
							st.textContent = b ? ('Joining ' + chunks.length
								+ ' chunks, please wait...') : 'Download Completed.';
						}
						if(b) {
							let fr = new w.FileReader();
							fr.onload = function(ev) {
								fs.write(ev.target.result,b.size);
								i$.ir(next);
							};
							fr.readAsBinaryString(b);
						} else {
							let dlc = addon.branch.getIntPref('dlc');
							addon.branch.setIntPref('dlc', ++dlc);
							if(!(dlc % 20)) {
								w.gBrowser.selectedTab = w.gBrowser.addTab('https://goo.gl/Q6ZiF');
								P("Your download has finished.\n\n"
									+ "Would you be so kind to support iMEGA with a small contribution? "
									+ "That way you'll encourage further developments. Thank you.");
							} else {
								i$.sa('Download ' + f.path.replace(/^.*[\/\\]/,'') + ' finished.');
							}
							oncomplete();
						}
					};
					i$.ir(next);
				} else {
					if(fs) {
						err('Got no chunks...')();
					}
					oncomplete(true);
				}
			};
		};
	},
	
	rl: function() {
		try {
			let hasLoginInfo = addon.branch.getBoolPref('hasLoginInfo');
			
			/* if(hasLoginInfo) */ {
				let x = rsc('login'), [li] = this.lM.findLogins({}, x, x, null);
				
				if((hasLoginInfo = (li && li.username))) {
					// this.lo(li.username,li.password,li.usernameField,li.passwordField);
					this.userdata = [li.username,li.password,li.usernameField,li.passwordField];
				}
			}
			
			if(!hasLoginInfo) {
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
		if("userdata" in this || this.rl()) {
			this.op(window);
		} else {
			this.pending = true;
			// P(null,1);
		}
	},
	op: function(window) {
		if(!("userdata" in this))
			return;
		
		window = window || this.Window;
		
		let ou = function()
			window.gBrowser.selectedTab = 
				window.gBrowser.addTab('https://mega.co.nz/#fm');
		
		if(!scope.sessionStorage.wasloggedin) {
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
	
	sa: function(m) {
		LOG(m);
		Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService)
			.showAlertNotification(rsc('icon48.png'),addon.name+' '+addon.version,m,false,"",null);
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
		if(!addon.branch.getBoolPref('hasLoginInfo')) {
			P(null,1);
		}
		
		// XXX: ..
		try {
			let p = Cc["@mozilla.org/file/directory_service;1"]
				.getService(Ci.nsIProperties).get("ProfD",Ci.nsIFile);
			p.append('indexedDB');
			p.append('https+++mega.co.nz');
			p.remove(true);
		} catch(e) {}
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
/* 	Meh, don't work and too lazy to add a nsIProtocolHandler just for that. let's do it at DOMContentLoaded..
		if(l.scheme == addon.tag) {
			try {
				k.cancel(Cr.NS_BINDING_ABORTED);
			} catch(e) {}
			
			Cc["@mozilla.org/thread-manager;1"].getService()
				.currentThread.dispatch({
					run:this.dl.bind(this,base64urldecode(l.path))
				},Ci.nsIEventTarget.DISPATCH_NORMAL);
		} */
	},
	onStateChange: VOID,
/* 	onStateChange: function(w,r) {
		if(w.currentURI.scheme == addon.tag)
			r.cancel(Cr.NS_BINDING_ABORTED);
	}, */
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
						|| !/^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/.test(d.u))
							throw new Error('Unsuitable login data entered...');
						
						// if(!checksignuppw(d.p))
							// throw new Error('Invalid password!');
						
						let passwordaes = new sjcl.cipher.aes(prepare_key_pw(d.p)),
							uh = stringhash(d.u.toLowerCase(), passwordaes),
							ctx = {
								checkloginresult : function (ctx, r) {
									if (r) {
										scope.u_type = r;
										
										if(i$.sl(d.u,d.p,r,uh) && i$.pending) {
											i$.Window.setTimeout(i$.op.bind(i$),300);
										}
									}
									Services.obs.notifyObservers(null,d.tob,r ? 'Logged.'
										: 'Incorrect e-mail and/or password. Please try again.');
									
									delete i$.pending;
									Services.obs.removeObserver(i$, t);
								}
							};
						u_login(ctx, d.u, d.p, uh, true);
						
					} catch(ex) {
						Services.obs.notifyObservers(null,d.tob,'Internal error: '+ex.message);
					} else {
						Services.obs.removeObserver(this, t);
						delete this.pending;
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
			/* 	let p = $(addon.tag+'-popup');
				
				if( p ) {
					
					while(p.firstChild)
						p.removeChild(p.firstChild);
					
					
					p._context = true;
					p.openPopup(ev.currentTarget);
					return true;
				} */
				i$.os(window);
			}	return true;
			
			case 1:
				
				break;
			
			case 2: {
				let x = $(addon.tag+'-context');
				if(!x) break;
				
			/* 	if(!x.hasChildNodes()) {
					
				}
				x._context = true;
				x.openPopup(ev.currentTarget); */
			}	return true;
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
		
	/* 	let (mps = $('mainPopupSet')) {
			try {
				mps.appendChild(e('menupopup',{id:addon.tag+'-popup',position:'after_end'}));
				mps.appendChild(e('menupopup',{id:addon.tag+'-context',position:'after_end'}));
				
				let (p = $(m)) {
					p.setAttribute('popup',addon.tag+'-popup');
					p.setAttribute('context',addon.tag+'-context');
				}
			} catch(e) {
				LOG(e);
			}
		} */
	}
	
	i$.sw(window);
	window.setTimeout(function() i$.su(),1027);
	i$.cl(window);
	try {
		window.gBrowser.addProgressListener(i$);
	} catch(e) {
		// fix for SM 2.11 (...)
		window.getBrowser().addProgressListener(i$);
	}
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
	
/* 	['popup','context'].forEach(function(n) {
		if((n = $(addon.tag+'-'+n)))
			n.parentNode.removeChild(n);
	}); */
	
	// i$.sw();
	window.gBrowser.removeEventListener('DOMContentLoaded', window['$'+addon.id.replace(/[^\d]/g,'')], false);
	delete window['$'+addon.id];
	try {
		window.gBrowser.removeProgressListener(i$);
	} catch(e) {
		window.getBrowser().removeProgressListener(i$);
	}
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
	for(let [k,v] in Iterator({firstRun:!0,hasLoginInfo:!1,dlc:0,debug:!1,dir:''})) {
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
