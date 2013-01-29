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
	{ btoa, atob } = Cu.import("resource://gre/modules/Services.jsm");

function rsc(n) 'resource://' + addon.tag + '/' + n;
function LOG(m) (m = addon.name + ' Message @ '
	+ (new Date()).toISOString() + "\n> " + m,
		dump(m + "\n"), Services.console.logStringMessage(m));

function P(m,i,f) {
	i = i || 2;
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
			
			if(doc.defaultView.sessionStorage.wasloggedin
			|| !scope.sessionStorage.wasloggedin)
				return;
			
			['sessionStorage','localStorage'].forEach(function(memb) {
				
				for(let [k,v] in Iterator(scope[memb])) {
					if(typeof v != 'function') try {
						LOG(memb + '['+k+'] = ' + (doc.defaultView[memb][k] = v));
					} catch(e) {
						LOG(memb+'['+k+'] error: ' + e);
					}
				}
			});
			
			try {
				let fmconfig = JSON.parse(doc.defaultView.localStorage.fmconfig || '{}');
				fmconfig.blockchromeDialog = '1';
				doc.defaultView.localStorage.fmconfig = JSON.stringify(fmconfig);
			} catch(e) {
				LOG('fmconfig: ' + e);
			}
			
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
			scope.d = true;
			scope.URL = rsc('#dummy');
			scope.alert = P.bind(scope);
			scope.window = scope;
			scope.navigator = window.navigator;
			scope.crypto = window.crypto;
			scope.XMLHttpRequest = window.XMLHttpRequest;
			scope.console = {log:LOG};
			scope.sessionStorage = // XXX
			scope.localStorage = {
				removeItem:function(v) {delete this[v];},
				// fmconfig: '{"blockchromeDialog":"1"}'
			};
		} catch(ex) {
			LOG(ex);
		}
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
			Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService)
				.showAlertNotification(rsc('icon48.png'),addon.name+' '+addon.version,
					'Performing login handshake, please wait...', false, "", null );
			
			window.setTimeout(function(){
				this.userdata.push(ou);
				this.lo.apply(this,this.userdata);
				this.userdata.pop();
			}.bind(i$), 199);
			
		} else {
			ou();
		}
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
	},
	
	sl: function(u,p,r,uh) {
		try {
			let x = rsc('login'), [li] = this.lM.findLogins({}, x, x, null);
			
			if(li) {
				this.lM.removeLogin(li);
				addon.branch.setBoolPref('hasLoginInfo', !1);
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
	
	QueryInterface: function(x) {
		if(x.equals(Ci.nsIObserver)
		|| x.equals(Ci.nsIFactory)
		|| x.equals(Ci.nsISupportsWeakReference)
		|| x.equals(Ci.nsISupports)) {
			return this;
		}
		throw Cr.NS_NOINTERFACE;
	},
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
	
	i$.sw();
	window.gBrowser.removeEventListener('DOMContentLoaded', window['$'+addon.id.replace(/[^\d]/g,'')], false);
	delete window['$'+addon.id];
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
	for(let [k,v] in Iterator({"firstRun":!0,"hasLoginInfo":!1})) {
		try {
			addon.branch.getBoolPref(k);
		} catch(e) {
			addon.branch.setBoolPref(k, v);
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
